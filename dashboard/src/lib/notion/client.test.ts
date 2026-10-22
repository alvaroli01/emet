import { test } from "node:test";
import assert from "node:assert/strict";
import { notion, NotionError, NOTION_VERSION, type Session } from "./client.ts";

type Call = { url: string; auth: string; version: string; method: string };
function fake(responses: Response[]) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const h = init.headers as Record<string, string>;
    calls.push({ url, auth: h.Authorization, version: h["Notion-Version"], method: init.method ?? "GET" });
    return responses.shift() ?? new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

test("sends the member's token and the current Notion version", async () => {
  const { calls, fetchImpl } = fake([json({ ok: 1 })]);
  const r = await notion({ tokens: { access: "A", refresh: "R" }, fetchImpl }, "/users/me");
  assert.deepEqual(r, { ok: 1 });
  assert.deepEqual(calls[0], { url: "https://api.notion.com/v1/users/me", auth: "Bearer A", version: NOTION_VERSION, method: "GET" });
});

test("an expired token is renewed once, saved, and the call retried", async () => {
  const saved: unknown[] = [];
  const { calls, fetchImpl } = fake([json({}, 401), json({ ok: 2 })]);
  const s: Session = { tokens: { access: "old", refresh: "R1" }, fetchImpl,
    refresh: async (rt) => { assert.equal(rt, "R1"); return { access: "new", refresh: "R2" }; },
    onTokens: (t) => { saved.push(t); } };
  assert.deepEqual(await notion(s, "/search", { method: "POST", body: {} }), { ok: 2 });
  assert.deepEqual(calls.map((c) => c.auth), ["Bearer old", "Bearer new"]);
  assert.deepEqual(saved, [{ access: "new", refresh: "R2" }]);
});

test("still refused after renewing → a 401 error (reconnect needed)", async () => {
  const { fetchImpl } = fake([json({}, 401), json({}, 401)]);
  await assert.rejects(notion({ tokens: { access: "a", refresh: "r" }, fetchImpl, refresh: async () => ({ access: "b", refresh: "r2" }) }, "/x"),
    (e: unknown) => e instanceof NotionError && e.status === 401);
});

test("'slow down' (429) waits as long as Notion says, then succeeds", async () => {
  const waits: number[] = [];
  const { fetchImpl } = fake([json({}, 429, { "retry-after": "2" }), json({ ok: 3 })]);
  const r = await notion({ tokens: { access: "a", refresh: null }, fetchImpl, sleep: async (ms) => { waits.push(ms); } }, "/x");
  assert.deepEqual(r, { ok: 3 });
  assert.deepEqual(waits, [2000]);
});

test("other errors carry Notion's message", async () => {
  const { fetchImpl } = fake([json({ message: "Could not find page" }, 404)]);
  await assert.rejects(notion({ tokens: { access: "a", refresh: null }, fetchImpl }, "/pages/x"),
    (e: unknown) => e instanceof NotionError && e.status === 404 && /Could not find page/.test(e.message));
});
