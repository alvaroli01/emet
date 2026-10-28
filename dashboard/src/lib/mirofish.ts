import { createHmac } from "node:crypto";

/** Signed 12-hour pass for the MiroFish Space gate (checked by mirofish-space/gate.mjs with the same secret). */
export function mirofishPass(secret: string, now = Date.now(), hours = 12): string {
  const exp = Math.floor(now / 1000) + hours * 3600;
  return `${exp}.${createHmac("sha256", secret).update(`mirofish:${exp}`).digest("hex")}`;
}

/** Address of the Space with a fresh pass, or null while MIROFISH_URL / MIROFISH_SECRET aren't set. */
export function mirofishUrl(base = process.env.MIROFISH_URL, secret = process.env.MIROFISH_SECRET): string | null {
  if (!base || !secret) return null;
  const url = new URL(base);
  url.searchParams.set("pass", mirofishPass(secret));
  return url.toString();
}
