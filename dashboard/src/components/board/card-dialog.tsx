"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { X, Trash2, Plus, Check, Lock } from "lucide-react";
import { BodyPortal } from "@/components/body-portal";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { BoardCard, ListRow, Member } from "@/lib/boards";
import { LabelChip, PRESET_LABELS, useListName } from "./labels";
import { pushToTrello } from "./trello-push";

type Item = { id: string; text: string; done: boolean; position: number; assignee_id: string | null; due_on: string | null };
type Comment = { id: string; author_id: string; body: string; created_at: string };

export function CardDialog({ card, lists, members, groupId, viewerId, canEdit, canDelete = canEdit, trello, onClose, onChange }: {
  card: BoardCard; lists: ListRow[]; members: Member[]; groupId: string | null; viewerId: string; canEdit: boolean; canDelete?: boolean; trello: boolean;
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
  const [everyone, setEveryone] = useState(false);
  const [repeat, setRepeat] = useState<{ id: string; cadence: string; next_run: string } | null>(null);
  const names = Object.fromEntries(members.map((m) => [m.id, m]));
  // People of this section first (the whole team on the general board); anyone already assigned stays visible
  const section = groupId ? members.filter((m) => m.group_id === groupId) : members;
  const pickable = everyone || !groupId ? members : members.filter((m) => m.group_id === groupId || card.assignees.includes(m.id));
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

  useEffect(() => {
    supabase.from("recurring_tasks").select("id, cadence, next_run").eq("source_card", card.id).eq("active", true).maybeSingle()
      .then(({ data }) => setRepeat(data ?? null));
  }, [card.id, supabase]);

  // Repeat: the card comes back on the same board every week / 2 weeks / month, assigned to the same person
  async function setCadence(cadence: string) {
    if (repeat) await supabase.from("recurring_tasks").delete().eq("id", repeat.id);
    if (cadence === "off") { setRepeat(null); return; }
    const base = card.due_at ? new Date(card.due_at) : new Date();
    const next = new Date(base);
    if (cadence === "weekly") next.setDate(next.getDate() + 7);
    else if (cadence === "biweekly") next.setDate(next.getDate() + 14);
    else next.setMonth(next.getMonth() + 1);
    const { data, error } = await supabase.from("recurring_tasks").insert({
      board_id: card.board_id, title: card.title, description: card.description, assignee_id: card.assignees[0] ?? null,
      cadence, next_run: next.toISOString().slice(0, 10), source_card: card.id,
    }).select("id, cadence, next_run").single();
    if (error) return toast("error", t("errors.save"));
    setRepeat(data);
    toast("ok", t("repeatSet", { date: next.toLocaleDateString(locale, { day: "numeric", month: "short" }) }));
  }

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

  async function patchItem(item: Item, patch: Partial<Pick<Item, "assignee_id" | "due_on">>) {
    setItems((all) => all.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("card_checklist_items").update(patch).eq("id", item.id);
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
    <BodyPortal>
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={card.title}>
      <button className="absolute inset-0 bg-black/40" aria-label={t("close")} onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-solid p-5 shadow-2xl ring-1 ring-line sm:rounded-3xl sm:p-6">
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

        {card.created_by && names[card.created_by] && (
          <p className="-mt-2 mb-4 text-xs text-muted">{t("addedBy", { name: names[card.created_by].full_name, when: timeAgo(card.created_at, locale) })}</p>
        )}
        {!canEdit && (
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-muted">
            <Lock size={12} /> {t("readOnlyCard")}
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("description")}</h3>
              {canEdit ? (
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                          onBlur={() => description !== (card.description ?? "") && save({ description: description || null })}
                          placeholder={t("descriptionPlaceholder")} className="input" />
              ) : (
                <p className="whitespace-pre-wrap text-sm">{card.description || <span className="text-muted">—</span>}</p>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold">{t("subtasks")}</h3>
                {items.length > 0 && <span className="text-xs text-muted tabular-nums">{items.filter((i) => i.done).length}/{items.length}</span>}
              </div>
              {items.length > 0 ? (
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className="h-full rounded-full bg-ok transition-[width] duration-500" style={{ width: `${(items.filter((i) => i.done).length / items.length) * 100}%` }} />
                </div>
              ) : canEdit && <p className="mb-2 text-xs text-muted">{t("subtasksHint")}</p>}
              <ul className="space-y-1.5">
                {items.map((i) => (
                  <li key={i.id} className="group flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-[10px] bg-surface-2/60 px-2.5 py-2 text-sm">
                    <button disabled={!canEdit} onClick={() => toggleItem(i)} aria-pressed={i.done} aria-label={i.text}
                            className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${i.done ? "border-ok bg-ok text-white" : "border-line bg-surface"}`}>
                      {i.done && <Check size={13} />}
                    </button>
                    <span className={`min-w-0 flex-1 basis-40 ${i.done ? "text-muted line-through" : ""}`}>{i.text}</span>
                    <span className="ml-7 flex items-center gap-1.5 sm:ml-0">
                      {i.assignee_id && <Avatar name={names[i.assignee_id]?.full_name ?? "?"} src={names[i.assignee_id]?.avatar_url} size={20} />}
                      <select disabled={!canEdit} value={i.assignee_id ?? ""} aria-label={t("subtaskPerson")}
                              onChange={(e) => patchItem(i, { assignee_id: e.target.value || null })}
                              className="max-w-28 rounded-md bg-transparent py-0.5 text-xs text-muted outline-none hover:text-ink">
                        <option value="">{t("nobody")}</option>
                        {section.concat(i.assignee_id && !section.some((m) => m.id === i.assignee_id) && names[i.assignee_id] ? [names[i.assignee_id]] : [])
                          .map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                      </select>
                      <input type="date" disabled={!canEdit} value={i.due_on ?? ""} aria-label={t("subtaskDue")}
                             onChange={(e) => patchItem(i, { due_on: e.target.value || null })}
                             className="w-[7.4rem] rounded-md bg-transparent py-0.5 text-xs text-muted outline-none hover:text-ink" />
                      {canEdit && (
                        <button onClick={() => deleteItem(i)} aria-label={t("delete")} className="p-0.5 text-muted hover:text-bad-text sm:opacity-0 sm:group-hover:opacity-100">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              {canEdit && (
                <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); addItem(); }}>
                  <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder={t("addSubtask")} className="input py-1.5" />
                  <button className="rounded-lg border border-line px-2.5 text-muted hover:text-ink" aria-label={t("addSubtask")}><Plus size={16} /></button>
                </form>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("comments")}</h3>
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
              <h3 className="mb-2 text-sm font-semibold">{t("list")}</h3>
              <select disabled={!canEdit} value={card.list_id}
                      onChange={(e) => save({ list_id: e.target.value, position: Date.now() / 1000,
                        completed_at: lists.find((l) => l.id === e.target.value)?.name.toLowerCase() === "done" ? new Date().toISOString() : null })}
                      className="input py-1.5">
                {lists.map((l) => <option key={l.id} value={l.id}>{listName(l.name)}</option>)}
              </select>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("due")}</h3>
              <input type="date" disabled={!canEdit} value={dueValue}
                     onChange={(e) => save({ due_at: e.target.value ? new Date(e.target.value + "T21:59:00Z").toISOString() : null })}
                     className="input py-1.5" />
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("repeat")}</h3>
              <select disabled={!canEdit} value={repeat?.cadence ?? "off"} onChange={(e) => setCadence(e.target.value)} aria-label={t("repeat")} className="input py-1.5">
                {["off", "weekly", "biweekly", "monthly"].map((c) => <option key={c} value={c}>{t(`cadence.${c}`)}</option>)}
              </select>
              {repeat && <p className="mt-1 text-xs text-muted">{t("nextRepeat", { date: new Date(repeat.next_run + "T12:00:00Z").toLocaleDateString(locale, { day: "numeric", month: "short" }) })}</p>}
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("assignees")}</h3>
              <div className="flex flex-wrap gap-1.5">
                {(canEdit ? pickable : members.filter((m) => card.assignees.includes(m.id))).map((m) => {
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
              {canEdit && groupId && (
                <button type="button" onClick={() => setEveryone((v) => !v)} className="mt-2 text-xs text-muted underline-offset-2 hover:text-ink hover:underline">
                  {everyone ? t("sectionOnly") : t("showEveryone")}
                </button>
              )}
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">{t("labelsTitle")}</h3>
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
            {canDelete && (
              <button onClick={remove} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line py-2 text-sm text-bad-text hover:bg-surface-2">
                <Trash2 size={14} /> {t("deleteCard")}
              </button>
            )}
          </aside>
        </div>
      </div>
    </div>
    </BodyPortal>
  );
}
