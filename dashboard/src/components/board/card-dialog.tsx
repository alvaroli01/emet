"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X, Trash2, Plus, Check, Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { BoardCard, ListRow, Member } from "@/lib/boards";
import { LabelChip, PRESET_LABELS, useListName } from "./labels";
import { pushToTrello } from "./trello-push";

type Item = { id: string; text: string; done: boolean; position: number };
type Comment = { id: string; author_id: string; body: string; created_at: string };

export function CardDialog({ card, lists, members, viewerId, canEdit, trello, onClose, onChange }: {
  card: BoardCard; lists: ListRow[]; members: Member[]; viewerId: string; canEdit: boolean; trello: boolean;
  onClose: () => void; onChange: (card: BoardCard | null, id: string) => void;
}) {
  const t = useTranslations("board");
  const locale = useLocale();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);

  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description ?? "");
  const [items, setItems] = useState<Item[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const names = Object.fromEntries(members.map((m) => [m.id, m]));
  const listName = useListName();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      const [a, b] = await Promise.all([
        supabase.from("card_checklist_items").select("*").eq("card_id", card.id).order("position"),
        supabase.from("card_comments").select("*").eq("card_id", card.id).order("created_at"),
      ]);
      setItems((a.data as Item[]) ?? []);
      setComments((b.data as Comment[]) ?? []);
    })();
  }, [card.id, supabase]);

  async function save(patch: Partial<BoardCard>) {
    onChange({ ...card, ...patch }, card.id);
    const { assignees: _a, checklist: _c, comments: _m, ...dbPatch } = patch as BoardCard;
    void _a; void _c; void _m;
    const { error } = await supabase.from("cards").update(dbPatch).eq("id", card.id);
    if (error) toast("error", t("errors.save"));
    else if (trello) pushToTrello({ cardId: card.id, op: "upsert" });
  }

  async function toggleAssignee(id: string) {
    const has = card.assignees.includes(id);
    onChange({ ...card, assignees: has ? card.assignees.filter((x) => x !== id) : [...card.assignees, id] }, card.id);
    const { error } = has
      ? await supabase.from("card_assignees").delete().match({ card_id: card.id, user_id: id })
      : await supabase.from("card_assignees").insert({ card_id: card.id, user_id: id });
    if (error) toast("error", t("errors.save"));
    else if (trello) pushToTrello({ cardId: card.id, op: "upsert" });
  }

  function toggleLabel(l: string) {
    const labels = card.labels.includes(l) ? card.labels.filter((x) => x !== l) : [...card.labels, l];
    save({ labels });
  }

  async function addItem() {
    const text = newItem.trim();
    if (!text) return;
    setNewItem("");
    const { data, error } = await supabase.from("card_checklist_items")
      .insert({ card_id: card.id, text, position: (items.at(-1)?.position ?? 0) + 1 }).select("*").single();
    if (error || !data) return toast("error", t("errors.save"));
    const next = [...items, data as Item];
    setItems(next);
    onChange({ ...card, checklist: { done: next.filter((i) => i.done).length, total: next.length } }, card.id);
  }

  async function toggleItem(item: Item) {
    const next = items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i));
    setItems(next);
    onChange({ ...card, checklist: { done: next.filter((i) => i.done).length, total: next.length } }, card.id);
    const { error } = await supabase.from("card_checklist_items").update({ done: !item.done }).eq("id", item.id);
    if (error) toast("error", t("errors.save"));
  }

  async function deleteItem(item: Item) {
    const next = items.filter((i) => i.id !== item.id);
    setItems(next);
    onChange({ ...card, checklist: { done: next.filter((i) => i.done).length, total: next.length } }, card.id);
    await supabase.from("card_checklist_items").delete().eq("id", item.id);
  }

  async function addComment() {
    const body = newComment.trim();
    if (!body) return;
    setNewComment("");
    const { data, error } = await supabase.from("card_comments")
      .insert({ card_id: card.id, author_id: viewerId, body }).select("*").single();
    if (error || !data) return toast("error", t("errors.save"));
    setComments((c) => [...c, data as Comment]);
    onChange({ ...card, comments: card.comments + 1 }, card.id);
  }

  async function deleteComment(c: Comment) {
    setComments((cs) => cs.filter((x) => x.id !== c.id));
    onChange({ ...card, comments: Math.max(0, card.comments - 1) }, card.id);
    await supabase.from("card_comments").delete().eq("id", c.id);
  }

  async function remove() {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("cards").delete().eq("id", card.id);
    if (error) return toast("error", t("errors.save"));
    if (trello && card.trello_card_id) pushToTrello({ trelloCardId: card.trello_card_id, op: "delete" });
    onChange(null, card.id);
    toast("ok", t("deleted"));
  }

  const dueValue = card.due_at ? new Date(card.due_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) : "";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={card.title}>
      <button className="absolute inset-0 bg-black/40" aria-label={t("close")} onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-2xl sm:rounded-3xl sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          {canEdit ? (
            <textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={1}
                      onBlur={() => title.trim() && title !== card.title && save({ title: title.trim() })}
                      className="flex-1 resize-none rounded-lg bg-transparent text-lg font-semibold outline-none focus:bg-surface-2 focus:px-2"
                      aria-label={t("cardTitle")} />
          ) : (
            <h2 className="flex-1 text-lg font-semibold">{card.title}</h2>
          )}
          <button onClick={onClose} aria-label={t("close")} className="rounded-lg p-1.5 text-muted hover:bg-surface-2"><X size={18} /></button>
        </div>

        {!canEdit && (
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-muted">
            <Lock size={12} /> {t("readOnlyCard")}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <div className="space-y-5">
            <section>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{t("description")}</h3>
              {canEdit ? (
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                          onBlur={() => description !== (card.description ?? "") && save({ description: description || null })}
                          placeholder={t("descriptionPlaceholder")} className="input" />
              ) : (
                <p className="whitespace-pre-wrap text-sm">{card.description || <span className="text-muted">—</span>}</p>
              )}
            </section>

            <section>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">
                {t("checklist")} {items.length > 0 && <span className="tabular-nums">· {items.filter((i) => i.done).length}/{items.length}</span>}
              </h3>
              <ul className="space-y-1">
                {items.map((i) => (
                  <li key={i.id} className="group flex items-center gap-2 text-sm">
                    <button disabled={!canEdit} onClick={() => toggleItem(i)} aria-pressed={i.done}
                            className={`grid size-5 shrink-0 place-items-center rounded-md border ${i.done ? "border-ok bg-ok text-white" : "border-line"}`}>
                      {i.done && <Check size={13} />}
                    </button>
                    <span className={`flex-1 ${i.done ? "text-muted line-through" : ""}`}>{i.text}</span>
                    {canEdit && (
                      <button onClick={() => deleteItem(i)} aria-label={t("delete")} className="text-muted opacity-0 hover:text-bad-text group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canEdit && (
                <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addItem(); }}>
                  <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={t("addItem")} className="input py-1.5" />
                  <button className="rounded-lg border border-line px-2.5 text-muted hover:text-ink" aria-label={t("addItem")}><Plus size={16} /></button>
                </form>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">{t("comments")}</h3>
              <ul className="space-y-3">
                {comments.map((c) => (
                  <li key={c.id} className="flex gap-2.5 text-sm">
                    <Avatar name={names[c.author_id]?.full_name ?? "?"} src={names[c.author_id]?.avatar_url} size={26} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">
                        <span className="font-medium text-ink">{names[c.author_id]?.full_name ?? "—"}</span> · {timeAgo(c.created_at, locale)}
                        {c.author_id === viewerId && (
                          <button onClick={() => deleteComment(c)} className="ml-2 hover:text-bad-text">{t("delete")}</button>
                        )}
                      </p>
                      <p className="whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); addComment(); }}>
                <input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder={t("writeComment")} className="input py-1.5" />
                <button className="rounded-lg bg-brand px-3 text-sm font-medium text-brand-contrast">{t("send")}</button>
              </form>
            </section>
          </div>

          <aside className="space-y-5">
            <section>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{t("list")}</h3>
              <select disabled={!canEdit} value={card.list_id}
                      onChange={(e) => save({ list_id: e.target.value, position: Date.now() / 1000,
                        completed_at: lists.find((l) => l.id === e.target.value)?.name.toLowerCase() === "done" ? new Date().toISOString() : null })}
                      className="input py-1.5">
                {lists.map((l) => <option key={l.id} value={l.id}>{listName(l.name)}</option>)}
              </select>
            </section>
            <section>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{t("due")}</h3>
              <input type="date" disabled={!canEdit} value={dueValue}
                     onChange={(e) => save({ due_at: e.target.value ? new Date(e.target.value + "T21:59:00Z").toISOString() : null })}
                     className="input py-1.5" />
            </section>
            <section>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{t("assignees")}</h3>
              <div className="flex flex-wrap gap-1.5">
                {(canEdit ? members : members.filter((m) => card.assignees.includes(m.id))).map((m) => {
                  const on = card.assignees.includes(m.id);
                  return (
                    <button key={m.id} disabled={!canEdit} onClick={() => toggleAssignee(m.id)} aria-pressed={on}
                            className={`flex items-center gap-1.5 rounded-full border py-0.5 pr-2 pl-0.5 text-xs transition ${
                              on ? "border-ink/30 bg-surface-2 font-medium" : "border-line text-muted hover:text-ink"}`}>
                      <Avatar name={m.full_name} src={m.avatar_url} size={20} />{m.full_name}
                    </button>
                  );
                })}
                {!canEdit && !card.assignees.length && <span className="text-sm text-muted">—</span>}
              </div>
            </section>
            <section>
              <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted">{t("labelsTitle")}</h3>
              <div className="flex flex-wrap gap-1.5">
                {canEdit ? (
                  <>
                    {[...Object.keys(PRESET_LABELS), ...card.labels.filter((l) => !PRESET_LABELS[l])].map((l) => (
                      <button key={l} onClick={() => toggleLabel(l)} aria-pressed={card.labels.includes(l)}
                              className={`rounded-md ring-2 ${card.labels.includes(l) ? "ring-ink/40" : "opacity-60 ring-transparent hover:opacity-100"}`}>
                        <LabelChip label={l} />
                      </button>
                    ))}
                    <form onSubmit={(e) => { e.preventDefault(); const l = customLabel.trim(); if (l && !card.labels.includes(l)) toggleLabel(l); setCustomLabel(""); }}>
                      <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder={t("newLabel")} className="input mt-1 py-1 text-xs" />
                    </form>
                  </>
                ) : card.labels.length ? card.labels.map((l) => <LabelChip key={l} label={l} />) : <span className="text-sm text-muted">—</span>}
              </div>
            </section>
            {canEdit && (
              <button onClick={remove} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line py-2 text-sm text-bad-text hover:bg-surface-2">
                <Trash2 size={14} /> {t("deleteCard")}
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
