import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
process.env.AI_KEY_SECRET = randomBytes(32).toString("base64");
const { loadMyGoogleEvents, fetchIcal } = await import("./gcal-server.ts");
const { encryptKey } = await import("./ai/keys.ts");

const URL_ = "https://calendar.google.com/calendar/ical/a/private-abc/basic.ics";
const ICS = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a\r\nSUMMARY:Class\r\nDTSTART:20261021T080000Z\r\nDTEND:20261021T090000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
const { key_iv, key_data } = encryptKey(URL_);
const db = (row: unknown) => ({ from: () => ({ select: () => ({ maybeSingle: async () => ({ data: row }) }) }) }) as never;

test("not connected when there is no row", async () => {
  assert.deepEqual(await loadMyGoogleEvents(db(null), "2026-10-19", "2026-10-25", (async () => { throw new Error("no fetch"); }) as never),
    { status: "not_connected", events: [] });
});

test("connected: fetches the decrypted link and parses it", async () => {
  let asked = "";
  const f = (async (u: string) => { asked = u; return new Response(ICS); }) as never;
  const got = await loadMyGoogleEvents(db({ url_iv: key_iv, url_data: key_data }), "2026-10-19", "2026-10-25", f);
  assert.equal(asked, URL_);
  assert.equal(got.status, "connected");
  assert.equal(got.events[0].title, "Class");
});

test("revoked link (404) or junk → unreachable, never throws", async () => {
  for (const res of [new Response("gone", { status: 404 }), new Response("<html/>")]) {
    const got = await loadMyGoogleEvents(db({ url_iv: key_iv, url_data: key_data }), "2026-10-19", "2026-10-25", (async () => res) as never);
    assert.deepEqual(got, { status: "unreachable", events: [] });
  }
});

test("slow Google times out after 5 s", async () => {
  const hang = ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as never;
  const t0 = Date.now();
  await assert.rejects(fetchIcal(URL_, hang));
  assert.ok(Date.now() - t0 < 6000);
});

test("refuses calendars over 2 MB", async () => {
  await assert.rejects(fetchIcal(URL_, (async () => new Response("x".repeat(2 * 1024 * 1024 + 1))) as never));
});
