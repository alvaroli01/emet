/**
 * Base camp vault crypto. Runs in the browser (and in Node for tests) with the Web Crypto API.
 * The key comes from the member's vault passphrase (PBKDF2-SHA-256, 310 000 rounds) and never
 * leaves the device; the database only stores AES-256-GCM ciphertext. A forgotten passphrase
 * cannot be recovered by anyone.
 */
const ROUNDS = 310_000;
const CHECK = "emet-vault-v1";
const enc = new TextEncoder();
const dec = new TextDecoder();

const toB64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function newSalt() {
  return toB64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function deriveKey(passphrase: string, salt: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromB64(salt), iterations: ROUNDS, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function seal(key: CryptoKey, value: unknown): Promise<{ iv: string; data: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(value)));
  return { iv: toB64(iv), data: toB64(data) };
}

export async function open<T>(key: CryptoKey, box: { iv: string; data: string }): Promise<T> {
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(box.iv) }, key, fromB64(box.data));
  return JSON.parse(dec.decode(plain)) as T;
}

/** A sealed known value, stored once, so a wrong passphrase is detected before showing anything. */
export const makeCheck = (key: CryptoKey) => seal(key, CHECK);
export async function verify(key: CryptoKey, box: { iv: string; data: string }) {
  try { return (await open<string>(key, box)) === CHECK; } catch { return false; }
}
