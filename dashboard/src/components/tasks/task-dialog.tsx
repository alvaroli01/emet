"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Loader2, Lock, Paperclip, Plus, Trash2, Upload, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { BodyPortal } from "@/components/body-portal";
import { compressImage } from "@/components/finance/claim";
import { statusOf, listFor, isOverdue, canEdit, canDelete, assignable, STATUSES, PRIORITIES, type Task, type TaskBoard, type Viewer, type ProjectInfo, type Priority, type Status } from "@/lib/tasks";
import type { Person } from "./tasks-view";

// Same storage as the date picker everywhere else: the end of that day in Madrid
const toDue = (d: string) => (d ? new Date(d + "T21:59:00Z").toISOString() : null);
const fromDue = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) : "");

async function openFile(path: string) {
  const { data } = await createClient().storage.from("task-files").createSignedUrl(path, 600);
  if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
}

export function TaskDialog({ taskId, tasks, board, people, projects, viewer, where, onCreated, onClose }: {
  taskId: string | null; tasks: Task[]; board: TaskBoard; people: Person[]; projects: Map<string, ProjectInfo>; viewer: Viewer;
  where: (b?: TaskBoard) => string; onCreated: (id: string) => void; onClose: () => void;
}) {
  const t = useTranslations("taskHub");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const task = taskId ? tasks.find((x) => x.id === taskId) : undefined;
  const project = board.project_id ? projects.get(board.project_id) : undefined;
  const names = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const pickable = assignable(viewer, board, people, project);

  // New task form (an existing task saves each change as it's made)
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [due, setDue] = useState(fromDue(task?.due_at ?? null));
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [needsFile, setNeedsFile] = useState(task?.needs_file ?? false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [newItem, setNewItem] = useState("");

  const fail = (e: { message?: string } | null) => { if (e) toast("error", e.message?.startsWith("emet:") ? e.message.slice(6) : t("saveError")); return !!e; };
  const done = async (p: PromiseLike<{ error: { message?: string } | null }>) => { setBusy(true); const { error } = await p; setBusy(false); if (!fail(error)) router.refresh(); return !error; };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || busy) return;
    const list = listFor(board, "todo") ?? board.lists[0]?.id;
    if (!list) return toast("error", t("saveError"));
    setBusy(true);
    const { data, error } = await supabase.from("cards").insert({
      board_id: board.id, list_id: list, title: title.trim(), description: description.trim() || null, due_at: toDue(due),
      priority, needs_file: needsFile, created_by: viewer.meId, position: Date.now() / 1000,
    }).select("id").single();
    const res = data && picked.size ? await supabase.from("card_assignees").insert([...picked].map((user_id) => ({ card_id: data.id, user_id }))) : null;
    setBusy(false);
    if (fail(error ?? res?.error ?? null) || !data) return;
    toast("ok", t("created"));
    onCreated(data.id);
  }

  const shell = (body: React.ReactNode, label: string) => (
    <BodyPortal>
      <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
        <button className="absolute inset-0 bg-black/40" aria-label={t("close")} onClick={onClose} />
        <div className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-solid p-5 shadow-2xl ring-1 ring-line sm:rounded-3xl sm:p-6">
          <button onClick={onClose} aria-label={t("close")} className="absolute top-4 right-4 rounded-lg p-1.5 text-muted hover:bg-surface-2"><X size={18} /></button>
          {body}
        </div>
      </div>
    </BodyPortal>
  );

  const picker = (selected: Set<string>, toggle: (id: string) => void, all?: () => void) => (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {all && pickable.length > 1 && (
          <button type="button" onClick={all} className="flex min-h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold ring-1 ring-line"><Users size={14} /> {t("everyone")}</button>
        )}
        {pickable.map((p) => (
          <button key={p.id} type="button" onClick={() => toggle(p.id)} aria-pressed={selected.has(p.id)}
                  className={`flex min-h-9 items-center gap-1.5 rounded-full py-0.5 pr-3 pl-0.5 text-sm transition ${selected.has(p.id) ? "bg-brand/20 font-semibold ring-2 ring-brand" : "bg-surface-2 ring-1 ring-line"}`}>
            <Avatar name={p.full_name} src={p.avatar_url} size={26} /> {p.id === viewer.meId ? t("me") : p.full_name.split(" ")[0]}
          </button>
        ))}
      </div>
      {!viewer.isLeader && <p className="mt-1.5 text-xs text-muted">{board.project_id ? t("assignProjectOnly") : t("assignGroupOnly")}</p>}
    </div>
  );

  if (!taskId) {
    return shell(
      <form onSubmit={create} className="space-y-4">
        <div className="pr-10"><h2 className="text-lg font-semibold">{t("newTask")}</h2><p className="text-sm text-muted">{t("in", { where: where(board) })}</p></div>
        <label className="block text-sm font-medium">{t("taskTitle")}
          <input required autoFocus maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1.5" />
        </label>
        <label className="block text-sm font-medium">{t("description")}
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="input mt-1.5 resize-y" />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="block text-sm font-medium">{t("due")}<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="input mt-1.5" /></label>
          <label className="block text-sm font-medium">{t("priorityLabel")}
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)} className="input mt-1.5">{PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}</select>
          </label>
        </div>
        <fieldset><legend className="mb-2 text-sm font-medium">{t("assignees")}</legend>
          {picker(picked, (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), () => setPicked(new Set(pickable.map((p) => p.id))))}
        </fieldset>
        <label className="flex w-fit cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" checked={needsFile} onChange={(e) => setNeedsFile(e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" />
          <span><span className="flex items-center gap-1.5 font-medium"><Paperclip size={14} /> {t("needsFile")}</span><span className="block text-muted">{t("needsFileHint")}</span></span>
        </label>
        <p className="text-xs text-muted">{t("checklistAfter")}</p>
        <button disabled={busy || !title.trim()} className="flex min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:opacity-40">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} {t("create")}
        </button>
      </form>, t("newTask"));
  }

  if (!task) return shell(<p className="flex items-center gap-2 py-6 text-sm text-muted"><Loader2 size={15} className="animate-spin" /> {t("loading")}</p>, t("loading"));

  const status: Status = statusOf(board.lists.find((l) => l.id === task.list_id)?.name);
  const editable = canEdit(viewer, board, task, project);
  const mine = task.people.find((p) => p.user_id === viewer.meId);
  const allDone = task.people.length > 0 && task.people.every((p) => p.done_at);
  const assigned = new Set(task.people.map((p) => p.user_id));
  const save = (patch: Record<string, unknown>) => done(supabase.from("cards").update(patch).eq("id", task.id));
  const tick = (on: boolean) => done(supabase.from("card_assignees").update({ done_at: on ? new Date().toISOString() : null }).eq("card_id", task.id).eq("user_id", viewer.meId));
  async function handIn(file: File) {
    setBusy(true);
    const blob = await compressImage(file);
    const name = blob === file ? file.name : file.name.replace(/\.[^.]+$/, "") + ".jpg";
    const path = `${viewer.meId}/${task!.id}/${Date.now()}-${name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
    const up = await supabase.storage.from("task-files").upload(path, blob, { contentType: blob.type || "application/octet-stream" });
    setBusy(false);
    if (up.error) return toast("error", t("uploadError"));
    if (await done(supabase.from("card_assignees").update({ file_path: path, file_name: name.slice(0, 200), done_at: new Date().toISOString() }).eq("card_id", task!.id).eq("user_id", viewer.meId))) toast("ok", t("handedIn"));
  }
  const togglePerson = (id: string) => done(assigned.has(id)
    ? supabase.from("card_assignees").delete().match({ card_id: task.id, user_id: id })
    : supabase.from("card_assignees").insert({ card_id: task.id, user_id: id }));
  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    const pos = Math.max(0, ...task!.checklist.map((i) => i.position)) + 1;
    if (await done(supabase.from("card_checklist_items").insert({ card_id: task!.id, text: newItem.trim().slice(0, 300), position: pos }))) setNewItem("");
  }
  async function remove() {
    if (!window.confirm(t("confirmDelete"))) return;
    if (await done(supabase.from("cards").delete().eq("id", task!.id))) onClose();
  }
  const creator = task.created_by ? names.get(task.created_by)?.full_name : null;

  return shell(
    <div className="space-y-5">
      <div className="pr-10">
        {editable ? (
          <textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={1} aria-label={t("taskTitle")}
                    onBlur={() => title.trim() && title !== task.title && save({ title: title.trim() })}
                    className="w-full resize-none rounded-lg bg-transparent text-lg font-semibold outline-none focus:bg-surface-2 focus:px-2" />
        ) : <h2 className="text-lg font-semibold">{task.title}</h2>}
        <p className="mt-0.5 text-xs text-muted">
          {where(board)} · {creator ? t("createdBy", { name: creator, date: new Date(task.created_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })
                                   : t("createdOn", { date: new Date(task.created_at).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" }) })}
        </p>
        {!editable && <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-muted"><Lock size={12} /> {t("readOnly")}</p>}
        {isOverdue(task, status) && <p className="mt-2 inline-flex rounded-lg bg-bad/10 px-2.5 py-1 text-xs font-semibold text-bad-text">{t("overdue")}</p>}
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="block text-sm font-medium">{t("statusLabel")}
          <select disabled={!editable || busy} value={status} onChange={(e) => { const l = listFor(board, e.target.value as Status); if (l) save({ list_id: l }); }} className="input mt-1.5">
            {STATUSES.filter((s) => s === status || listFor(board, s)).map((s) => (
              <option key={s} value={s} disabled={s === "done" && task.people.length > 0 && !allDone}>{t(`status.${s}`)}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">{t("priorityLabel")}
          <select disabled={!editable || busy} value={task.priority} onChange={(e) => save({ priority: e.target.value })} className="input mt-1.5">
            {PRIORITIES.map((p) => <option key={p} value={p}>{t(`priority.${p}`)}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">{t("due")}
          <input type="date" disabled={!editable || busy} value={fromDue(task.due_at)} onChange={(e) => save({ due_at: toDue(e.target.value) })} className="input mt-1.5" />
        </label>
      </div>
      {task.people.length > 0 && status !== "done" && <p className="-mt-3 text-xs text-muted">{t("doneWhenAll")}</p>}

      <section>
        <h3 className="mb-1.5 text-sm font-semibold">{t("description")}</h3>
        {editable ? (
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("descriptionPlaceholder")}
                    onBlur={() => description !== (task.description ?? "") && save({ description: description || null })} className="input resize-y" />
        ) : <p className="text-sm whitespace-pre-wrap">{task.description || <span className="text-muted">—</span>}</p>}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">{t("whoFinished")}</h3>
          {task.people.length > 0 && <span className="text-xs text-muted tabular-nums">{t("progressCount", { done: task.people.filter((p) => p.done_at).length, total: task.people.length })}</span>}
        </div>
        {mine && (
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
            {task.needs_file && !mine.done_at ? (
              <label className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-brand px-4 text-sm font-semibold text-white ${busy ? "pointer-events-none opacity-60" : ""}`}>
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {t("uploadToFinish")}
                <input type="file" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) handIn(f); }} />
              </label>
            ) : (
              <button onClick={() => tick(!mine.done_at)} disabled={busy} role="checkbox" aria-checked={!!mine.done_at}
                      className={`flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-2 transition ${mine.done_at ? "bg-ok text-[#06281a] ring-ok" : "ring-brand hover:bg-brand/10"}`}>
                <Check size={16} strokeWidth={3} /> {mine.done_at ? t("myPartDone") : t("markMyPart")}
              </button>
            )}
            {mine.file_path && <button onClick={() => openFile(mine.file_path!)} className="flex items-center gap-1 text-xs text-muted hover:text-link"><Paperclip size={12} /> {mine.file_name ?? t("openFile")}</button>}
          </div>
        )}
        {editable ? picker(assigned, togglePerson) : null}
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {task.people.map((p) => (
            <li key={p.user_id} className={`flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-0.5 text-xs ${p.done_at ? "bg-ok/15 text-ok-text" : "bg-surface-2 text-muted"}`}>
              <Avatar name={names.get(p.user_id)?.full_name ?? "?"} src={names.get(p.user_id)?.avatar_url} size={22} />
              {names.get(p.user_id)?.full_name.split(" ")[0] ?? "?"} · {p.done_at ? t("finished") : t("notYet")}
              {p.file_path && (p.user_id === viewer.meId || viewer.isAdmin) && (
                <button onClick={() => openFile(p.file_path!)} aria-label={t("openFile")} className="grid size-5 place-items-center rounded-full hover:bg-ok/25"><Paperclip size={11} /></button>
              )}
            </li>
          ))}
          {!task.people.length && <li className="text-sm text-muted">{t("nobody")}</li>}
        </ul>
        {editable && (
          <label className="mt-3 flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={task.needs_file} onChange={(e) => save({ needs_file: e.target.checked })} className="size-4 accent-[var(--brand)]" />
            <Paperclip size={14} /> {t("needsFile")}
          </label>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">{t("checklist")}</h3>
          {task.checklist.length > 0 && <span className="text-xs text-muted tabular-nums">{task.checklist.filter((i) => i.done).length}/{task.checklist.length}</span>}
        </div>
        <ul className="space-y-1">
          {task.checklist.map((i) => (
            <li key={i.id} className="group flex items-center gap-2.5">
              <button disabled={!editable || busy} onClick={() => done(supabase.from("card_checklist_items").update({ done: !i.done }).eq("id", i.id))} role="checkbox" aria-checked={i.done} aria-label={i.text}
                      className={`grid size-5 shrink-0 place-items-center rounded-md ring-2 ${i.done ? "bg-ok text-[#06281a] ring-ok" : "ring-line"}`}>{i.done && <Check size={12} strokeWidth={3} />}</button>
              <span className={`flex-1 text-sm ${i.done ? "text-muted line-through" : ""}`}>{i.text}</span>
              {editable && <button onClick={() => done(supabase.from("card_checklist_items").delete().eq("id", i.id))} aria-label={t("removeItem", { text: i.text })} className="grid size-7 place-items-center rounded-full text-muted opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-bad-text"><X size={13} /></button>}
            </li>
          ))}
        </ul>
        {editable && (
          <form onSubmit={addItem} className="mt-2 flex gap-2">
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)} maxLength={300} placeholder={t("addItem")} aria-label={t("addItem")} className="input min-h-9 py-1 text-sm" />
            <button disabled={!newItem.trim() || busy} className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-white disabled:opacity-40" aria-label={t("addItem")}><Plus size={15} /></button>
          </form>
        )}
      </section>

      {canDelete(viewer, board, task, project) && (
        <button onClick={remove} className="flex items-center gap-1.5 text-sm text-muted hover:text-bad-text"><Trash2 size={14} /> {t("delete")}</button>
      )}
    </div>, task.title);
}
