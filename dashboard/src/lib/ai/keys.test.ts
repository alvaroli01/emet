import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.AI_KEY_SECRET = randomBytes(32).toString("base64");
const { encryptKey, decryptKey } = await import("./keys.ts");

test("keys are stored encrypted and come back intact", () => {
  const key = "gsk_example_1234567890abcdWXYZ";
  const row = encryptKey(key);
  assert.ok(!Buffer.from(row.key_data, "base64").toString("utf8").includes("gsk_"));
  assert.equal(row.last4, "WXYZ");
  assert.equal(decryptKey(row), key);
});

test("tampered data is rejected", () => {
  const row = encryptKey("gsk_abc");
  const bad = Buffer.from(row.key_data, "base64"); bad[0] ^= 1;
  assert.throws(() => decryptKey({ ...row, key_data: bad.toString("base64") }));
});
