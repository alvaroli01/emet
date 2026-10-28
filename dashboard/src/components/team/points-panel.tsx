"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Users, Store, GraduationCap, Plus, Trash2, Paperclip, Pencil, Link2, X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { shortDate } from "@/lib/format";
import { POINT_KINDS, POINT_GOALS, POINTS_DEADLINE, pointTotals, perWeekNeeded, type PointKind } from "@/lib/points";

export type PointEntry = { id: string; kind: PointKind; amount: number; happened_on: string; note: string | null; file_path?: string | null; file_name?: string | null; link?: string | null };

const ICON = { community: Users, visit: Store, learning: GraduationCap } as const;

/** Community points, customer visits and learning points: progress to the June goals for anyone's page;
 *  on your own page you also log, edit and delete your entries. */
export function PointsPanel({ entries, isMe, today }: { entries: PointEntry[]; isMe: boolean; today: string }) {
  const t = useTranslations("points");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const totals = pointTotals(entries);
  const blank = { kind: "visit" as PointKind, amount: "1", happened_on: today, note: "", link: "" };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  // Editing an entry reuses the log form; dropFile removes its current file on save
  const [editing, setEditing] = useState<PointEntry | null>(null);
  const [dropFile, setDropFile] = useState(false);

  function startEdit(x: PointEntry) {
    setEditing(x); setFile(null); setDropFile(false);
    setF({ kind: x.kind, amount: String(x.amount), happened_on: x.happened_on, note: x.note ?? "", link: x.link ?? "" });
    document.getElementById("points-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  function stopEdit() { setEditing(null); setFile(null); setDropFile(false); setF({ ...blank, kind: f.kind }); }

  async function log(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    // A file (e.g. the post-mortem) goes to my own folder in the private point-files bucket
    let upload: { file_path: string; file_name: string } | null = null;
    if (file) {
      const { data: me } = await supabase.rpc("my_profile_id");
      const path = `${me}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
      const up = await supabase.storage.from("point-files").upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) { setBusy(false); return toast("error", t("uploadError")); }
      upload = { file_path: path, file_name: file.name.slice(0, 200) };
    }
    const row = { kind: f.kind, amount: Number(f.amount) || 1, happened_on: f.happened_on, note: f.note.trim() || null, link: f.link.trim() || null };
    const oldFile = editing?.file_path && (upload || dropFile) ? editing.file_path : null;
    const { error } = editing
      ? await supabase.from("member_points").update({ ...row, ...(upload ?? (dropFile ? { file_path: null, file_name: null } : {})) }).eq("id", editing.id)
      : await supabase.from("member_points").insert({ ...row, file_path: upload?.file_path ?? null, file_name: upload?.file_name ?? null });
    if (error) {
      if (upload) await supabase.storage.from("point-files").remove([upload.file_path]);
      setBusy(false);
      return toast("error", t("saveError"));
    }
    if (oldFile) await supabase.storage.from("point-files").remove([oldFile]);
    setBusy(false);
    toast("ok", editing ? t("saved") : t("logged", { kind: t(`kinds.${f.kind}`) }));
    if (editing) stopEdit(); else { setF({ ...f, amount: "1", note: "", link: "" }); setFile(null); }
    router.refresh();
  }
  async function openFile(path: string) {
    const { data } = await supabase.storage.from("point-files").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  async function remove(id: string) {
    if (!window.confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("member_points").delete().eq("id", id);
    if (error) return toast("error", t("saveError"));
    if (editing?.id === id) stopEdit();
    router.refresh();
  }

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-xs text-muted">{t("deadline", { date: shortDate(POINTS_DEADLINE, locale) })}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {POINT_KINDS.map((k) => {
          const Icon = ICON[k];
          const goal = POINT_GOALS[k], done = totals[k];
          const need = perWeekNeeded(done, goal, today);
          return (
            <div key={k} className="rounded-2xl bg-surface-2 p-4">
              <p className="flex items-center gap-2 text-sm font-medium"><Icon size={15} /> {t(`kinds.${k}`)}</p>
              <p className="readout mt-2 text-3xl">{done}<span className="text-base font-normal text-muted"> / {goal}</span></p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={goal} aria-label={t(`kinds.${k}`)}>
                <div className={`h-full rounded-full ${done >= goal ? "bg-ok" : "bg-brand"}`} style={{ width: `${Math.min(100, (done / goal) * 100)}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted">{done >= goal ? t("reached") : need === null ? t("missed", { left: goal - done }) : t("perWeek", { n: need })}</p>
            </div>
          );
        })}
      </div>

      {isMe && (
        <form id="points-form" onSubmit={log} className="mt-5 grid gap-3 rounded-2xl p-4 ring-1 ring-line sm:grid-cols-[1.2fr_0.6fr_1fr_2fr] sm:items-end">
          <label className="block text-sm font-medium">{t("what")}
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as PointKind })} className="input mt-1.5">
              {POINT_KINDS.map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}
            </select>
          </label>
          <label className="block text-sm font-medium">{t("amount")}
            <input type="number" min={1} max={100} required value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} className="input mt-1.5" />
          </label>
          <label className="block text-sm font-medium">{t("when")}
            <input type="date" required max={today} value={f.happened_on} onChange={(e) => setF({ ...f, happened_on: e.target.value })} className="input mt-1.5" />
          </label>
          <label className="block text-sm font-medium">{t("note")}
            <input maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder={t(`notePlaceholder.${f.kind}`)} className="input mt-1.5" />
          </label>
          {editing && <p className="text-sm font-medium sm:col-span-4">{t("editing")}</p>}
          <label className="block text-sm font-medium sm:col-span-2">{t("link")}
            <input type="url" pattern="https?://.+" maxLength={500} value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="https://" className="input mt-1.5" />
          </label>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line px-3 text-sm text-muted hover:text-ink sm:col-span-2">
            <Paperclip size={15} /> <span className="flex-1 truncate">{file ? file.name : editing?.file_path && !dropFile ? t("replaceFile", { name: editing.file_name ?? t("openFile") }) : t("addFile")}</span>
            <input type="file" className="sr-only" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDropFile(false); }} />
          </label>
          {editing?.file_path && !file && !dropFile && (
            <button type="button" onClick={() => setDropFile(true)} className="flex min-h-11 items-center gap-1.5 text-sm text-muted hover:text-bad-text"><X size={14} /> {t("removeFile")}</button>
          )}
          <div className="flex gap-2 sm:col-start-4">
            {editing && <button type="button" onClick={stopEdit} className="flex min-h-11 flex-1 items-center justify-center rounded-full px-5 text-sm font-semibold ring-1 ring-line">{t("cancel")}</button>}
            <button disabled={busy} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-5 text-sm font-semibold text-white disabled:opacity-50">
              {editing ? <><Check size={15} /> {t("save")}</> : <><Plus size={15} /> {t("log")}</>}
            </button>
          </div>
        </form>
      )}

      <h3 className="mt-5 text-sm font-medium">{t("history")}</h3>
      {entries.length ? (
        <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto">
          {entries.map((x) => {
            const Icon = ICON[x.kind];
            return (
              <li key={x.id} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2"><Icon size={14} /></span>
                <span className="min-w-0 flex-1"><span className="font-medium">{t("entry", { n: x.amount, kind: t(`kinds.${x.kind}`) })}</span>
                  {x.note && <span className="block truncate text-xs text-muted">{x.note}</span>}
                  {x.file_path && <button type="button" onClick={() => openFile(x.file_path!)} className="flex max-w-full items-center gap-1 text-xs text-muted hover:text-link"><Paperclip size={11} /> <span className="truncate">{x.file_name ?? t("openFile")}</span></button>}
                  {x.link && <a href={x.link} target="_blank" rel="noopener noreferrer" className="flex max-w-full items-center gap-1 text-xs text-muted hover:text-link"><Link2 size={11} /> <span className="truncate">{x.link.replace(/^https?:\/\//, "")}</span></a>}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{shortDate(x.happened_on, locale)}</span>
                {isMe && <button onClick={() => startEdit(x)} aria-label={t("edit")} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><Pencil size={14} /></button>}
                {isMe && <button onClick={() => remove(x.id)} aria-label={t("delete")} className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-bad-text"><Trash2 size={14} /></button>}
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-2 text-sm text-muted">{isMe ? t("emptyMe") : t("empty")}</p>}
    </section>
  );
}
