import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Members' Groq keys are encrypted with AES-256-GCM before they reach the database. Server only. */
function secret(): Buffer {
  const s = process.env.AI_KEY_SECRET;
  if (!s) throw new Error("AI_KEY_SECRET is not set");
  const key = Buffer.from(s, "base64");
  if (key.length !== 32) throw new Error("AI_KEY_SECRET must be 32 bytes, base64");
  return key;
}

export function encryptKey(plain: string): { key_iv: string; key_data: string; last4: string } {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", secret(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final(), c.getAuthTag()]);
  return { key_iv: iv.toString("base64"), key_data: data.toString("base64"), last4: plain.slice(-4) };
}

export function decryptKey(row: { key_iv: string; key_data: string }): string {
  const raw = Buffer.from(row.key_data, "base64");
  const d = createDecipheriv("aes-256-gcm", secret(), Buffer.from(row.key_iv, "base64"));
  d.setAuthTag(raw.subarray(raw.length - 16));
  return Buffer.concat([d.update(raw.subarray(0, raw.length - 16)), d.final()]).toString("utf8");
}
