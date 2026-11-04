import { NextResponse, type NextRequest } from "next/server";
import { serviceDb } from "@/lib/drive";

const TOKEN = /^[0-9a-f]{32}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Invite link form: makes the person an Ollin guest (if new), adds them to the project and emails a login link.
 *  Guests land on their project after login wherever the link sends them (sendGuestToProject). */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { token?: unknown; name?: unknown; email?: unknown };
  const token = String(body.token ?? "");
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!TOKEN.test(token) || !name || name.length > 80 || email.length > 200 || !EMAIL.test(email))
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = serviceDb();
  const { data: invite } = await db.from("project_invites").select("project_id").eq("token", token).maybeSingle();
  if (!invite) return NextResponse.json({ error: "expired" }, { status: 404 });

  let { data: profile } = await db.from("profiles").select("id, user_id, active").eq("email", email).maybeSingle();
  if (profile && !profile.active) return NextResponse.json({ error: "not-allowed" }, { status: 403 });
  if (!profile) {
    const { data, error } = await db.from("profiles").insert({ full_name: name, email, is_guest: true, role_title: "Ollin" })
      .select("id, user_id, active").single();
    if (error) return NextResponse.json({ error: "failed" }, { status: 500 });
    profile = data;
  }
  // Join now: the login link may land anywhere, and only the email's owner can log in to use this membership
  const { error: joinError } = await db.from("project_members")
    .upsert({ project_id: invite.project_id, user_id: profile.id }, { onConflict: "project_id,user_id", ignoreDuplicates: true });
  if (joinError) return NextResponse.json({ error: "failed" }, { status: 500 });

  const redirectTo = `${request.nextUrl.origin}/auth/callback?next=/join/${token}`;
  const { error } = profile.user_id
    ? await db.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })
    : await db.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) return NextResponse.json({ error: error.status === 429 ? "rate-limit" : "failed" }, { status: error.status ?? 500 });
  return NextResponse.json({ ok: true });
}
