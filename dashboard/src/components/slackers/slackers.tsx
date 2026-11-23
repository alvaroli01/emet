"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Link2, Lock, Maximize2, Minimize2, Paperclip, X } from "lucide-react";
import { compressImage } from "@/components/finance/claim";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { Avatar } from "@/components/ui";
import { shortDate } from "@/lib/format";
import { hm } from "@/lib/office";

type Proof = { id: string; path: string | null; name: string; link: string | null };

export type SlackerRow = {
  id: string; name: string; avatar: string | null;
  self: number | null; classAvg: number | null; classN: number;
  tasks: string[]; officeMs: number; activeDays: number; actions: number; note: string | null; away: string | null;
  proofs: Proof[];
};

/** How the class verdict reads: low class score = slacker; big gap between self and class = sees themself wrong. */
export function verdict(self: number | null, cls: number | null): "slacker" | "over" | "under" | "fair" | null {
  if (cls === null) return null;
  if (cls < 2.5) return "slacker";
  if (self === null) return null;
  if (self - cls >= 1.5) return "over";
  if (cls - self >= 1.5) return "under";
  return "fair";
}
const TONE = { slacker: "bg-bad/15 text-bad-text", over: "bg-warn/15 text-warn-text", under: "bg-surface-2 text-ink", fair: "bg-ok/15 text-ok-text" } as const;

/** A proof: a file opens through a 10-minute private link; a link opens as is. */
function ProofChip({ p, onRemove }: { p: Proof; onRemove?: () => void }) {
  async function open() {
    if (p.link) return window.open(p.link, "_blank", "noopener");
    const { data } = await createClient().storage.from("slacker-proof").createSignedUrl(p.path!, 600);
    if (data) window.open(data.signedUrl, "_blank", "noopener");
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-xs">
      <button type="button" onClick={open} className="inline-flex min-w-0 items-center gap-1 hover:underline">
        {p.link ? <Link2 size={12} /> : <Paperclip size={12} />}<span className="truncate">{p.name.replace(/^https?:\/\//, "").slice(0, 40)}</span>
      </button>
      {onRemove && <button type="button" onClick={onRemove} aria-label="×" className="text-muted hover:text-ink"><X size={12} /></button>}
    </span>
  );
}

function Scores({ value, onPick, disabled, label }: { value: number | undefined; onPick: (n: number) => void; disabled: boolean; label: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} disabled={disabled} onClick={() => onPick(n)}
                className={`h-9 w-9 rounded-lg border text-sm font-semibold transition disabled:opacity-40 ${
                  value === n ? "border-brand bg-brand text-brand-contrast" : "border-line hover:bg-surface-2"}`}>{n}</button>
      ))}
    </div>
  );
}

export function Slackers({ week, prev, next, canVote, meId, rows, myVotes }: {
  week: string; prev: string; next: string | null; canVote: boolean; meId: string; rows: SlackerRow[]; myVotes: Record<string, number>;
}) {
  const t = useTranslations("slackers");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [votes, setVotes] = useState(myVotes);
  const [busy, setBusy] = useState(false);
  const me = rows.find((r) => r.id === meId);
  const [note, setNote] = useState(me?.note ?? "");
  const [present, setPresent] = useState(false);
  const [link, setLink] = useState("");
  const screen = useRef<HTMLDivElement>(null);

  // On screen: the class keeps voting on their phones, so refresh the numbers every 10 s
  useEffect(() => {
    if (!present) return;
    const id = setInterval(() => router.refresh(), 10_000);
    const onExit = () => { if (!document.fullscreenElement) setPresent(false); };
    document.addEventListener("fullscreenchange", onExit);
    return () => { clearInterval(id); document.removeEventListener("fullscreenchange", onExit); };
  }, [present, router]);

  async function toggleScreen() {
    if (present) { if (document.fullscreenElement) await document.exitFullscreen(); setPresent(false); return; }
    setPresent(true);
    await screen.current?.requestFullscreen?.().catch(() => {});
  }

  async function vote(target: string, score: number) {
    setVotes((v) => ({ ...v, [target]: score }));
    const { error } = await createClient().from("slacker_votes")
      .upsert({ week_start: week, voter_id: meId, target_id: target, score, updated_at: new Date().toISOString() }, { onConflict: "week_start,voter_id,target_id" });
    if (error) { toast("error", t("error")); setVotes((v) => { const c = { ...v }; delete c[target]; return c; }); return; }
    router.refresh();
  }

  async function saveNote() {
    const text = note.trim();
    if (text === (me?.note ?? "")) return;
    setBusy(true);
    const sb = createClient().from("slacker_notes");
    const { error } = text
      ? await sb.upsert({ week_start: week, user_id: meId, note: text, updated_at: new Date().toISOString() }, { onConflict: "week_start,user_id" })
      : await sb.delete().eq("week_start", week).eq("user_id", meId);
    setBusy(false);
    if (error) return toast("error", t("error"));
    toast("ok", t("noteSaved"));
    router.refresh();
  }

  async function addFile(file: File) {
    setBusy(true);
    const supabase = createClient();
    const blob = await compressImage(file);
    const name = blob === file ? file.name : file.name.replace(/\.[^.]+$/, "") + ".jpg";
    const path = `${meId}/${week}/${Date.now()}-${name.replace(/[^\w.-]+/g, "_").slice(-80)}`;
    const up = await supabase.storage.from("slacker-proof").upload(path, blob, { contentType: blob.type || "application/octet-stream" });
    const { error } = up.error ? up : await supabase.from("slacker_proofs").insert({ week_start: week, user_id: meId, file_path: path, file_name: name.slice(0, 200) });
    setBusy(false);
    if (error) return toast("error", t(up.error ? "uploadError" : "error"));
    toast("ok", t("proofAdded"));
    router.refresh();
  }

  async function addLink() {
    const url = link.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return toast("error", t("badLink"));
    setBusy(true);
    const { error } = await createClient().from("slacker_proofs").insert({ week_start: week, user_id: meId, link: url.slice(0, 1000) });
    setBusy(false);
    if (error) return toast("error", t("error"));
    setLink("");
    toast("ok", t("proofAdded"));
    router.refresh();
  }

  async function removeProof(p: Proof) {
    const supabase = createClient();
    const { error } = await supabase.from("slacker_proofs").delete().eq("id", p.id);
    if (error) return toast("error", t("error"));
    if (p.path) await supabase.storage.from("slacker-proof").remove([p.path]);
    router.refresh();
  }

  const others = rows.filter((r) => r.id !== meId);
  const rated = others.filter((r) => votes[r.id]).length;
  // Lowest class score first: that's who gets exposed
  const ranked = [...rows].sort((a, b) => (a.classAvg ?? 99) - (b.classAvg ?? 99) || a.name.localeCompare(b.name));
  const end = new Date(Date.parse(week + "T00:00:00Z") + 6 * 864e5).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/slackers?w=${prev}`} className="rounded-lg border border-line p-2 hover:bg-surface-2" aria-label={t("prevWeek")}><ChevronLeft size={16} /></Link>
          <span className="text-sm font-medium">{t("week", { from: shortDate(week, locale), to: shortDate(end, locale) })}</span>
          {next ? <Link href={`/slackers?w=${next}`} className="rounded-lg border border-line p-2 hover:bg-surface-2" aria-label={t("nextWeek")}><ChevronRight size={16} /></Link>
            : <span className="rounded-lg border border-line p-2 opacity-30"><ChevronRight size={16} /></span>}
        </div>
        <button type="button" onClick={toggleScreen} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">
          <Maximize2 size={15} /> {t("showOnScreen")}
        </button>
      </div>

      {canVote && me && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panel p-5">
            <h3 className="font-semibold">{t("selfTitle")}</h3>
            <p className="mb-3 text-xs text-muted">{t("selfHint")}</p>
            <Scores value={votes[meId]} onPick={(n) => vote(meId, n)} disabled={false} label={t("selfTitle")} />
            <label className="mt-4 block">
              <span className="mb-1 block text-xs text-muted">{t("noteLabel")}</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} onBlur={saveNote} rows={3} maxLength={1000} disabled={busy}
                        placeholder={t("notePlaceholder")} className="input" />
            </label>
            <div className="mt-3">
              <span className="mb-1 block text-xs text-muted">{t("proofLabel")}</span>
              {me.proofs.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{me.proofs.map((p) => <ProofChip key={p.id} p={p} onRemove={() => removeProof(p)} />)}</div>}
              <div className="flex flex-wrap gap-2">
                <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm hover:bg-surface-2 ${busy ? "pointer-events-none opacity-50" : ""}`}>
                  <Paperclip size={14} /> {t("addFile")}
                  <input type="file" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addFile(f); }} />
                </label>
                <form onSubmit={(e) => { e.preventDefault(); addLink(); }} className="flex min-w-0 flex-1 gap-2">
                  <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={t("linkPlaceholder")} className="input min-w-0 flex-1 py-2 text-sm" />
                  <button disabled={busy || !link.trim()} className="rounded-xl border border-line px-3 text-sm hover:bg-surface-2 disabled:opacity-50">{t("addLink")}</button>
                </form>
              </div>
            </div>
          </div>
          <div className="panel p-5">
            <h3 className="font-semibold">{t("classTitle")}</h3>
            <p className="mb-3 text-xs text-muted">{t("classHint", { done: rated, total: others.length })}</p>
            <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {others.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2"><Avatar name={r.name} src={r.avatar} size={28} /><span className="truncate text-sm">{r.name}</span></span>
                  <Scores value={votes[r.id]} onPick={(n) => vote(r.id, n)} disabled={false} label={r.name} />
                </li>
              ))}
            </ul>
            <p className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted"><Lock size={11} /> {t("secret")}</p>
          </div>
        </div>
      )}

      <div ref={screen} className={present ? "overflow-y-auto bg-bg p-8" : ""}>
        {present && (
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-3xl font-bold">{t("title")} · {t("week", { from: shortDate(week, locale), to: shortDate(end, locale) })}</h2>
            <button type="button" onClick={toggleScreen} className="rounded-lg border border-line p-2" aria-label={t("exitScreen")}><Minimize2 size={18} /></button>
          </div>
        )}
        <div className="panel overflow-x-auto">
          <table className={`w-full ${present ? "text-lg" : "text-sm"}`}>
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="p-3">{t("colPerson")}</th>
                <th className="p-3 text-center">{t("colSelf")}</th>
                <th className="p-3 text-center">{t("colClass")}</th>
                <th className="p-3">{t("colVerdict")}</th>
                <th className="p-3">{t("colProof")}</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => {
                const v = verdict(r.self, r.classAvg);
                return (
                  <tr key={r.id} className="border-t border-line align-top">
                    <td className="p-3"><span className="flex items-center gap-2"><Avatar name={r.name} src={r.avatar} size={present ? 40 : 28} /><span className="font-medium">{r.name}</span></span></td>
                    <td className="p-3 text-center font-semibold">{r.self ?? "—"}</td>
                    <td className="p-3 text-center"><span className="font-semibold">{r.classAvg ?? "—"}</span>{r.classN > 0 && <span className="block text-[11px] text-muted">{t("votes", { n: r.classN })}</span>}</td>
                    <td className="p-3">{v && <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[v]}`}>{t(`verdict.${v}`)}</span>}
                      {r.away && <span className="mt-1 block w-fit whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">{t("away", { reason: r.away })}</span>}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span><b className="text-ink">{r.tasks.length}</b> {t("tasksDone")}</span>
                        <span><b className="text-ink">{hm(r.officeMs)}</b> {t("atOffice")}</span>
                        <span><b className="text-ink">{r.activeDays}</b> {t("activeDays")}</span>
                        <span><b className="text-ink">{r.actions}</b> {t("actions")}</span>
                      </div>
                      {r.tasks.length > 0 && (
                        <details className="mt-1 text-xs" open={present}>
                          <summary className="cursor-pointer text-muted">{t("whichTasks")}</summary>
                          <ul className="mt-1 list-disc pl-4">{r.tasks.map((x, i) => <li key={i}>{x}</li>)}</ul>
                        </details>
                      )}
                      {r.note && <p className="mt-1.5 text-xs italic">“{r.note}”</p>}
                      {r.proofs.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5">{r.proofs.map((p) => <ProofChip key={p.id} p={p} />)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">{t("legend")}</p>
      </div>
    </div>
  );
}
