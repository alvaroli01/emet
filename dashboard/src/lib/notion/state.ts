import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * "Connect Notion" round trip guard: the state sent to Notion is signed for ONE member and lives 10 minutes,
 * so a callback can't be forged or replayed into someone else's account. Signed with AI_KEY_SECRET (server only).
 */
const LIFETIME = 10 * 60_000;
function sign(payload: string) {
  const secret = process.env.AI_KEY_SECRET;
  if (!secret) throw new Error("AI_KEY_SECRET is not set"); // never sign with an empty key (anyone could forge it)
  return createHmac("sha256", Buffer.from(secret, "base64")).update(payload).digest("base64url");
}

export function signState(memberId: string, now = Date.now()): string {
  const payload = `${now}.${randomBytes(9).toString("base64url")}`;
  return `${payload}.${sign(`${memberId}.${payload}`)}`;
}

export function verifyState(state: string, memberId: string, now = Date.now()): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [at, nonce, sig] = parts;
  const issued = Number(at);
  if (!Number.isFinite(issued) || now - issued > LIFETIME || issued - now > 60_000) return false;
  let want: Buffer;
  try { want = Buffer.from(sign(`${memberId}.${at}.${nonce}`)); } catch { return false; }
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
