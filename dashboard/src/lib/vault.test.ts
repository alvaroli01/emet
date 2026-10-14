import { test } from "node:test";
import assert from "node:assert/strict";
import { newSalt, deriveKey, seal, open, makeCheck, verify } from "./vault.ts";

test("right passphrase opens the vault, wrong one does not", async () => {
  const salt = newSalt();
  const key = await deriveKey("correct horse battery", salt);
  const check = await makeCheck(key);
  assert.equal(await verify(key, check), true);
  assert.equal(await verify(await deriveKey("wrong guess", salt), check), false);
});

test("items round-trip and the stored text reveals nothing", async () => {
  const key = await deriveKey("pass phrase", newSalt());
  const item = { label: "Instagram", username: "emet.team", password: "S3cret!" };
  const box = await seal(key, item);
  assert.ok(!box.data.includes("S3cret") && !atob(box.data).includes("S3cret"));
  assert.deepEqual(await open(key, box), item);
});
