"use client";

/** Synced boards: send a card change to Trello (fire and forget; the nightly sync catches anything missed). */
const pending = new Map<string, ReturnType<typeof setTimeout>>();
export function pushToTrello(body: { cardId?: string; trelloCardId?: string | null; op: "upsert" | "delete" }) {
  const key = body.cardId ?? body.trelloCardId ?? "";
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => {
    pending.delete(key);
    fetch("/api/trello/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  }, 800));
}
