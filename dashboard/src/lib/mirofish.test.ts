import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mirofishPass, mirofishUrl } from "./mirofish.ts";

const secret = "s".repeat(40);

// Same check as validPass in mirofish-space/gate.mjs (tested there too); the deploy only ships dashboard/, so no import
test("pass = 12-hour expiry signed with the shared secret, as the Space gate expects", () => {
  const now = Date.UTC(2026, 9, 28, 12);
  const [exp, mac] = mirofishPass(secret, now).split(".");
  assert.equal(Number(exp), now / 1000 + 12 * 3600);
  assert.equal(mac, createHmac("sha256", secret).update(`mirofish:${exp}`).digest("hex"));
});

test("no link until the Space address and secret are set", () => {
  assert.equal(mirofishUrl(undefined, secret), null);
  assert.equal(mirofishUrl("https://a.hf.space", undefined), null);
  assert.match(mirofishUrl("https://a.hf.space", secret)!, /^https:\/\/a\.hf\.space\/\?pass=\d+\.[0-9a-f]{64}$/);
});
