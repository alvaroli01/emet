import test from "node:test";
import assert from "node:assert/strict";
import { sign, validPass } from "./gate.mjs";

const secret = "s".repeat(40);
const exp = Math.floor(Date.now() / 1000) + 3600;

test("a pass signed with the secret works until it expires", () => {
  assert.equal(validPass(`${exp}.${sign(secret, exp)}`, secret), true);
  assert.equal(validPass(`${exp}.${sign(secret, exp)}`, secret, (exp + 1) * 1000), false);
});

test("wrong secret, edited expiry or junk is refused", () => {
  assert.equal(validPass(`${exp}.${sign("x".repeat(40), exp)}`, secret), false);
  assert.equal(validPass(`${exp + 999}.${sign(secret, exp)}`, secret), false);
  for (const bad of [null, "", "abc", `${exp}.`, `${exp}.zz`, `-1.${sign(secret, -1)}`]) assert.equal(validPass(bad, secret), false);
  assert.equal(validPass(`${exp}.${sign(secret, exp)}`, ""), false);
});
