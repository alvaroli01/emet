import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * "Connect Notion" round trip guard: the state sent to Notion is signed for ONE member and lives 10 minutes,
 * so a callback can't be forged or replayed into someone else's account. Signed with AI_KEY_SECRET (server only).
 */
const LIFETIME = 10 * 60_000;
const sign = (payload: string) => createHmac("sha256", Buffer.from(process.env.AI_KEY_SECRET ?? "", "base64")).update(payload).digest("base64url");

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
  const want = Buffer.from(sign(`${memberId}.${at}.${nonce}`));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
