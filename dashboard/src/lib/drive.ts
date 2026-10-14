import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encryptKey, decryptKey } from "@/lib/ai/keys";

/**
 * Google Drive archive for Meeting log audio (server only).
 * The team's Google account grants the "drive.file" permission: the dashboard can only see and
 * manage the files it creates itself — nothing else in that Drive.
 */
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const FOLDER_NAME = "emet HQ — meeting recordings";
export const ARCHIVE_AFTER_DAYS = 30;

export function serviceDb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export const driveConfigured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export async function getSecret(db: SupabaseClient, key: string): Promise<string | null> {
  const { data } = await db.from("app_secrets").select("iv, data").eq("key", key).maybeSingle();
  return data ? decryptKey({ key_iv: data.iv, key_data: data.data }) : null;
}
export async function setSecret(db: SupabaseClient, key: string, value: string) {
  const e = encryptKey(value);
  await db.from("app_secrets").upsert({ key, iv: e.key_iv, data: e.key_data, updated_at: new Date().toISOString() });
}

export function authUrl(state: string, redirectUri: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri, response_type: "code",
    scope: SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
  });
  return { ok: res.ok, data: (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string } };
}

/** Finishes "Connect Google Drive": stores the refresh token, creates the archive folder, remembers the account. */
export async function connect(code: string, redirectUri: string): Promise<{ ok: boolean; email?: string }> {
  const { ok, data } = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri });
  if (!ok || !data.refresh_token || !data.access_token) return { ok: false };
  const db = serviceDb();
  await setSecret(db, "google_refresh_token", data.refresh_token);
  cached = { token: data.access_token, until: Date.now() + (data.expires_in ?? 3000) * 1000 - 60_000 };
  const about = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", { headers: { Authorization: `Bearer ${data.access_token}` } });
  const email = ((await about.json().catch(() => ({}))) as { user?: { emailAddress?: string } }).user?.emailAddress ?? "";
  await setSecret(db, "drive_email", email);
  const folder = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST", headers: { Authorization: `Bearer ${data.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
  });
  const folderId = ((await folder.json().catch(() => ({}))) as { id?: string }).id;
  if (folderId) await setSecret(db, "drive_folder_id", folderId);
  return { ok: !!folderId, email };
}

export async function status(): Promise<{ configured: boolean; connected: boolean; email: string | null }> {
  if (!driveConfigured()) return { configured: false, connected: false, email: null };
  const db = serviceDb();
  const [token, email] = await Promise.all([getSecret(db, "google_refresh_token"), getSecret(db, "drive_email")]);
  return { configured: true, connected: !!token, email };
}

let cached: { token: string; until: number } | null = null;
export async function accessToken(): Promise<string | null> {
  if (cached && cached.until > Date.now()) return cached.token;
  if (!driveConfigured()) return null;
  const refresh = await getSecret(serviceDb(), "google_refresh_token");
  if (!refresh) return null;
  const { ok, data } = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  if (!ok || !data.access_token) return null;
  cached = { token: data.access_token, until: Date.now() + (data.expires_in ?? 3000) * 1000 - 60_000 };
  return cached.token;
}

export async function upload(token: string, folderId: string, name: string, blob: Blob): Promise<string | null> {
  const boundary = `emet-${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name, parents: [folderId] });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: ${blob.type || "audio/webm"}\r\n\r\n`, blob, `\r\n--${boundary}--`,
  ]);
  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body,
  });
  return res.ok ? (((await res.json()) as { id?: string }).id ?? null) : null;
}

export async function deleteFiles(ids: string[]) {
  const token = await accessToken();
  if (!token) return;
  await Promise.all(ids.map((id) => fetch(`https://www.googleapis.com/drive/v3/files/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })));
}

/** Streams one archived part from Drive (supports seeking via Range). */
export async function streamFile(fileId: string, range: string | null): Promise<Response> {
  const token = await accessToken();
  if (!token) return new Response("archive offline", { status: 503 });
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) },
  });
  const headers = new Headers({ "Cache-Control": "private, max-age=3600", "Accept-Ranges": "bytes" });
  for (const h of ["content-type", "content-length", "content-range"]) { const v = res.headers.get(h); if (v) headers.set(h, v); }
  return new Response(res.body, { status: res.status, headers });
}

/**
 * Moves meeting audio older than 30 days from Supabase Storage to Drive, oldest first,
 * until the time budget runs out. Safe to run repeatedly: a file is removed from Supabase
 * only after Drive has it and the database knows where.
 */
export async function archiveBatch(budgetMs: number): Promise<{ moved: number; remaining: number; skipped?: string }> {
  const started = Date.now();
  const token = await accessToken();
  if (!token) return { moved: 0, remaining: 0, skipped: "drive-not-connected" };
  const db = serviceDb();
  const folderId = await getSecret(db, "drive_folder_id");
  if (!folderId) return { moved: 0, remaining: 0, skipped: "no-folder" };
  const { data } = await db.rpc("meeting_audio_to_archive", { p_days: ARCHIVE_AFTER_DAYS, p_limit: 300 });
  const files = (data as { name: string; bytes: number }[] | null) ?? [];
  const titles = new Map<string, string>();
  let moved = 0;
  for (const f of files) {
    if (Date.now() - started > budgetMs) break;
    const [meetingId, part] = f.name.split("/");
    if (!titles.has(meetingId)) {
      const { data: m } = await db.from("meetings").select("title, meeting_date").eq("id", meetingId).maybeSingle();
      titles.set(meetingId, m ? `${m.meeting_date} ${m.title}`.replace(/[\\/:*?"<>|]+/g, "-") : meetingId);
    }
    const { data: blob } = await db.storage.from("meetings").download(f.name);
    if (!blob) continue;
    const id = await upload(token, folderId, `${titles.get(meetingId)} — ${part}`, blob);
    if (!id) continue;
    const { error } = await db.from("meeting_audio").upsert({ meeting_id: meetingId, part, drive_file_id: id, bytes: f.bytes });
    if (error) { await deleteFiles([id]); continue; }
    await db.storage.from("meetings").remove([f.name]);
    moved++;
  }
  return { moved, remaining: Math.max(0, files.length - moved) };
}
