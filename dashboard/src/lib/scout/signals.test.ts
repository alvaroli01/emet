import { test } from "node:test";
import assert from "node:assert/strict";
import { SIGNAL_KINDS, normalizeHook, strongestSignal, isStale, pickLinks } from "./signals.ts";

test("signal kinds for local businesses, strongest first", () => {
  assert.deepEqual(SIGNAL_KINDS.slice(0, 3), ["hiring", "new_opening", "change"]);
  assert.equal(SIGNAL_KINDS.at(-1), "none");
});

test("the AI's hook is checked: known kind, real link, honest text", () => {
  assert.deepEqual(normalizeHook({ kind: "hiring", text: "Job post for a waiter", url: "https://bar.es/empleo", date: "2026-10-10" }),
    { kind: "hiring", text: "Job post for a waiter", url: "https://bar.es/empleo", date: "2026-10-10" });
  assert.equal(normalizeHook({ kind: "rocket", text: "x" })!.kind, "none");
  assert.equal(normalizeHook({ kind: "hiring", text: "x", url: "javascript:1" })!.url, undefined);
  assert.equal(normalizeHook({ kind: "hiring", text: "" }), null);
  assert.equal(normalizeHook(null), null);
});

test("several signals: only the strongest one becomes the hook (stacking reads like a dossier)", () => {
  const best = strongestSignal([{ kind: "events", text: "a" }, { kind: "hiring", text: "b" }, { kind: "weak_online", text: "c" }]);
  assert.equal(best?.kind, "hiring");
  assert.equal(strongestSignal([]), null);
});

test("a signal older than ~60 days is not news any more", () => {
  assert.equal(isStale("2026-08-01", "2026-10-28"), true);
  assert.equal(isStale("2026-10-01", "2026-10-28"), false);
  assert.equal(isStale(undefined, "2026-10-28"), false);
});

test("which pages to read: 2 about/services/menu pages + 1 hiring/news page", () => {
  const paths = ["/", "/carta", "/quienes-somos", "/contacto", "/trabaja-con-nosotros", "/noticias", "/blog/post-1"];
  assert.deepEqual(pickLinks(paths), ["/carta", "/quienes-somos", "/trabaja-con-nosotros"]);
  assert.deepEqual(pickLinks(["/novedades"]), ["/novedades"]);
});
