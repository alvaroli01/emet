import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { call } from "./call.ts";
import { KeyRing, type PoolKey } from "./pool.ts";

type Rule = (auth: string, model: string) => Response | undefined;
let rules: Rule[] = [];
let calls: string[] = [];
const ok = (tokens = 100) => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }], usage: { total_tokens: tokens } }), { status: 200 });
const busy = (s = 30) => new Response("{}", { status: 429, headers: { "retry-after": String(s) } });
beforeEach(() => {
  rules = []; calls = []; delete process.env.MISTRAL_API_KEY;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    const auth = String((init.headers as Record<string, string>).Authorization).slice(7);
    const model = JSON.parse(String(init.body)).model as string;
    calls.push(`${auth}:${model}`);
    for (const r of rules) { const res = r(auth, model); if (res) return res; }
    return ok();
  }) as typeof fetch;
});
const own: PoolKey = { owner: "me", key: "k0", own: true };
const ana: PoolKey = { owner: "ana", key: "k1", own: false };
const BIG = "openai/gpt-oss-120b";

test("when my key is out, the next person's key steps in on the same model", async () => {
  rules.push((a) => (a === "k0" ? busy() : undefined));
  const ring = new KeyRing([own, ana]);
  const r = await call(ring, { messages: [] }, [BIG]);
  assert.equal("ok" in r, true);
  assert.deepEqual(calls, ["k0:openai/gpt-oss-120b", "k1:openai/gpt-oss-120b"]);
  assert.equal(ring.usedLent, true);
});

test("a key that ran out is not tried again in the next call", async () => {
  rules.push((a) => (a === "k0" ? busy() : undefined));
  const ring = new KeyRing([own, ana]);
  await call(ring, { messages: [] }, [BIG]);
  calls = [];
  await call(ring, { messages: [] }, [BIG]);
  assert.deepEqual(calls, ["k1:openai/gpt-oss-120b"]);
});

test("a rejected lent key is skipped, the search continues", async () => {
  rules.push((a) => (a === "k1" ? new Response("{}", { status: 401 }) : undefined), (a) => (a === "k0" ? busy() : undefined));
  const r = await call(new KeyRing([own, ana]), { messages: [] }, [BIG]);
  assert.deepEqual(r, { error: "limit", retryAfter: 30 });
});

test("Mistral only after every Groq key, and only without web search", async () => {
  process.env.MISTRAL_API_KEY = "mk";
  rules.push((a) => (a !== "mk" ? busy() : undefined));
  const r = await call(new KeyRing([own, ana]), { messages: [] }, [BIG, "mistral/mistral-medium-latest"]);
  assert.equal("ok" in r, true);
  assert.equal(calls.at(-1), "mk:mistral-medium-latest");
  calls = [];
  const w = await call(new KeyRing([own]), { messages: [], tools: [{ type: "browser_search" }] }, ["openai/gpt-oss-20b", "mistral/mistral-small-latest"]);
  assert.equal("error" in w && w.error, "limit");
  assert.equal(calls.some((c) => c.startsWith("mk:")), false);
});

test("no Mistral key: Mistral models are ignored", async () => {
  rules.push(() => busy(12));
  const r = await call(new KeyRing([own]), { messages: [] }, [BIG, "mistral/mistral-medium-latest"]);
  assert.deepEqual(r, { error: "limit", retryAfter: 12 });
  assert.equal(calls.length, 1);
});

test("a plain key still works as before (Ask, Idea Lab, notes)", async () => {
  rules.push(() => new Response("{}", { status: 401 }));
  assert.deepEqual(await call("k0", { messages: [] }, [BIG]), { error: "bad-key" });
});

test("tokens are counted on the ring", async () => {
  const ring = new KeyRing([own]);
  rules.push(() => ok(321));
  await call(ring, { messages: [] }, [BIG]);
  assert.equal(ring.tokens, 321);
});

test("a server error with no limit hit is 'failed', not a wait", async () => {
  rules.push(() => new Response("{}", { status: 500 }));
  assert.deepEqual(await call(new KeyRing([own, ana]), { messages: [] }, [BIG]), { error: "failed" });
});

test("Mistral keys from the ring take turns: when one is busy the next steps in", async () => {
  rules.push((a) => (a.startsWith("k") ? busy() : a === "m1" ? busy(20) : undefined));
  const ring = new KeyRing([own]);
  ring.mistral = ["m1", "m2"];
  const r = await call(ring, { messages: [] }, [BIG, "mistral/mistral-medium-latest"]);
  assert.equal("ok" in r, true);
  assert.deepEqual(calls, ["k0:openai/gpt-oss-120b", "m1:mistral-medium-latest", "m2:mistral-medium-latest"]);
});

test("own key rejected and nothing else works: tell me to reconnect, even with the Mistral backup set", async () => {
  process.env.MISTRAL_API_KEY = "mk";
  rules.push(() => new Response("{}", { status: 401 }));
  assert.deepEqual(await call(new KeyRing([own]), { messages: [] }, [BIG, "mistral/mistral-medium-latest"]), { error: "bad-key" });
});

test("no own key and every lent key rejected: 'failed', not 'reconnect your key'", async () => {
  rules.push(() => new Response("{}", { status: 401 }));
  assert.deepEqual(await call(new KeyRing([ana]), { messages: [] }, [BIG]), { error: "failed" });
});

test("a server error on a model is not retried on every other key (keeps a step under 60 s)", async () => {
  rules.push(() => new Response("{}", { status: 500 }));
  await call(new KeyRing([own, ana, { owner: "ben", key: "k2", own: false }]), { messages: [] }, [BIG, "openai/gpt-oss-20b"]);
  assert.deepEqual(calls, ["k0:openai/gpt-oss-120b", "k0:openai/gpt-oss-20b"]);
});

test("a short Groq pause is waited out instead of switching the judge to Mistral", async () => {
  process.env.MISTRAL_API_KEY = "mk";
  rules.push((a) => (a === "k0" ? busy(5) : undefined));
  const r = await call(new KeyRing([own]), { messages: [] }, [BIG, "mistral/mistral-medium-latest"]);
  assert.deepEqual(r, { error: "limit", retryAfter: 5 });
  assert.equal(calls.some((c) => c.startsWith("mk:")), false);
});

test("my own calls (Ask, Idea Lab) are counted when the ring knows who I am", async () => {
  const saved: unknown[] = [];
  rules.push(() => ok(50));
  await call(new KeyRing([own], [], (e) => saved.push(e)), { messages: [] }, [BIG]);
  assert.deepEqual(saved, [{ owner: "me", model: BIG, tokens: 50 }]);
});
