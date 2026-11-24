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

type Proof = { id: string; bucket: string | null; path: string | null; name: string; link: string | null };
/** One thing they did in emet that week, found automatically (slacker_feed). */
export type FeedItem = { kind: string; title: string; detail: string | null; at: string; bucket: string | null; path: string | null; link: string | null };

export type SlackerRow = {
  id: string; name: string; avatar: string | null;
  self: number | null; classAvg: number | null; classN: number;
  tasks: string[]; officeMs: number; activeDays: number; actions: number; note: string | null; away: string | null;
  proofs: Proof[]; feed: FeedItem[];
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
const KINDS = ["task", "file", "visit", "sale", "lead", "prospect", "community", "learning", "meeting", "idea", "post", "update", "strike"] as const;
const EMOJI: Record<string, string> = { task: "✅", file: "📎", visit: "🚶", sale: "💶", lead: "🎯", prospect: "👤", community: "🤝", learning: "📚", meeting: "📝", idea: "💡", post: "📣", update: "📌", strike: "⚠️" };

/** Every file from the week: the ones they added here + the ones emet found (task hand-ins, documents, project files, point files). */
const filesOf = (r: SlackerRow): Proof[] => [
  ...r.proofs.filter((p) => p.path),
  ...r.feed.filter((f) => f.path && f.bucket).map((f) => ({ id: `${f.bucket}:${f.path}`, bucket: f.bucket, path: f.path, name: f.title, link: null })),
];

/** A proof: a file opens through a 10-minute private link (only if the viewer may open it); a link opens as is. */
function ProofChip({ p, onRemove }: { p: Proof; onRemove?: () => void }) {
  async function open() {
    if (p.link) return window.open(p.link, "_blank", "noopener");
    const { data } = await createClient().storage.from(p.bucket ?? "slacker-proof").createSignedUrl(p.path!, 600);
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

const IMG = /\.(jpe?g|png|gif|webp|heic|avif)$/i;

/** One person's week, big enough for the projector: scores, their own words, every file (images shown) and everything emet saw them do. */
function Profile({ r, n, total, onPrev, onNext, onClose }: { r: SlackerRow; n: number; total: number; onPrev: () => void; onNext: () => void; onClose: () => void }) {
  const t = useTranslations("slackers");
  const locale = useLocale();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const files = filesOf(r);
  const imgKey = files.filter((p) => IMG.test(p.path!)).map((p) => `${p.bucket ?? "slacker-proof"}:${p.path}`).join("|");
  useEffect(() => {
    if (!imgKey) return;
    let live = true;
    const byBucket = new Map<string, string[]>();
    for (const k of imgKey.split("|")) { const i = k.indexOf(":"); byBucket.set(k.slice(0, i), [...(byBucket.get(k.slice(0, i)) ?? []), k.slice(i + 1)]); }
    const sb = createClient();
    // Files the viewer isn't allowed to open simply don't get a preview
    Promise.all([...byBucket].map(([bucket, paths]) => sb.storage.from(bucket).createSignedUrls(paths, 600)
      .then(({ data }) => (data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [`${bucket}:${d.path}`, d.signedUrl as string] as const))))
      .then((all) => { if (live) setUrls(Object.fromEntries(all.flat())); });
    return () => { live = false; };
  }, [imgKey]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowLeft") onPrev(); if (e.key === "ArrowRight") onNext(); if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onPrev, onNext, onClose]);
  const v = verdict(r.self, r.classAvg);
  const keyOf = (p: Proof) => `${p.bucket ?? "slacker-proof"}:${p.path}`;
  const images = files.filter((p) => urls[keyOf(p)]);
  const links = r.proofs.filter((p) => p.link);
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: "short", timeZone: "Europe/Madrid" });
  const groups = KINDS.map((k) => ({ k, items: r.feed.filter((f) => f.kind === k) })).filter((g) => g.items.length);
  const stat = (value: React.ReactNode, label: string) => <div className="rounded-2xl bg-surface-2 p-4"><div className="text-3xl font-bold">{value}</div><div className="text-sm text-muted">{label}</div></div>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-label={r.name}>
      <div className="panel max-h-[92vh] w-full max-w-5xl overflow-y-auto p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={r.name} src={r.avatar} size={72} />
            <div>
              <h2 className="text-3xl font-bold">{r.name}</h2>
              <div className="mt-1 flex flex-wrap gap-2">
                {v && <span className={`rounded-full px-3 py-1 text-sm font-semibold ${TONE[v]}`}>{t(`verdict.${v}`)}</span>}
                {r.away && <span className="rounded-full bg-surface-2 px-3 py-1 text-sm text-muted">{t("away", { reason: r.away })}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="mr-2 text-sm text-muted">{n} / {total}</span>
            <button type="button" onClick={onPrev} className="rounded-lg border border-line p-2 hover:bg-surface-2" aria-label={t("prevPerson")}><ChevronLeft size={18} /></button>
            <button type="button" onClick={onNext} className="rounded-lg border border-line p-2 hover:bg-surface-2" aria-label={t("nextPerson")}><ChevronRight size={18} /></button>
            <button type="button" onClick={onClose} className="ml-1 rounded-lg border border-line p-2 hover:bg-surface-2" aria-label={t("close")}><X size={18} /></button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stat(r.self ?? "—", t("colSelf"))}
          {stat(r.classAvg ?? "—", `${t("colClass")}${r.classN ? ` · ${t("votes", { n: r.classN })}` : ""}`)}
          {stat(r.feed.filter((f) => f.kind !== "strike").length, t("thingsDone"))}
          {stat(files.length, t("filesAdded"))}
          {stat(hm(r.officeMs), t("atOffice"))}
          {stat(r.activeDays, t("activeDays"))}
        </div>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">{t("saysTheyDid")}</h3>
        <p className="mt-2 whitespace-pre-wrap text-xl">{r.note ? `“${r.note}”` : <span className="text-muted">{t("nothingWritten")}</span>}</p>

        {(images.length > 0 || links.length > 0) && <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">{t("proofTitle")}</h3>}
        {images.length > 0 && (
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {images.map((p) => (
              <a key={p.id} href={urls[keyOf(p)]} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element -- private signed URL */}
                <img src={urls[keyOf(p)]} alt={p.name} className="h-56 w-full object-cover" />
              </a>
            ))}
          </div>
        )}
        {links.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{links.map((p) => <ProofChip key={p.id} p={p} />)}</div>}

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">{t("feedTitle")}</h3>
        {!groups.length && <p className="mt-2 text-muted">{t("feedEmpty")}</p>}
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          {groups.map(({ k, items }) => (
            <div key={k} className={`rounded-2xl p-4 ${k === "strike" ? "bg-bad/10" : "bg-surface-2"}`}>
              <div className="mb-2 font-semibold">{EMOJI[k]} {t(`feedKind.${k}`)} · {items.length}</div>
              <ul className="space-y-1.5">
                {items.map((f, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-base">
                    <span className="text-xs text-muted">{day(f.at)}</span>
                    <span className="min-w-0 break-words">{f.title}</span>
                    {f.detail && k !== "file" && k !== "task" && <span className="text-xs text-muted">{["sale", "strike"].includes(k) ? `€${f.detail}` : f.detail}</span>}
                    {f.path && f.bucket && <ProofChip p={{ id: f.path, bucket: f.bucket, path: f.path, name: t("openFile"), link: null }} />}
                    {f.link && <ProofChip p={{ id: f.link, bucket: null, path: null, name: f.link, link: f.link }} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Link href={`/team/${r.id}`} target="_blank" className="mt-6 inline-block text-sm text-muted underline">{t("fullProfile")}</Link>
      </div>
    </div>
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
  const [openId, setOpenId] = useState<string | null>(null);
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
  const openIdx = ranked.findIndex((r) => r.id === openId);
  const open = openIdx >= 0 ? ranked[openIdx] : null;
  const close = () => setOpenId(null);
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
                  <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer border-t border-line align-top transition hover:bg-surface-2/60">
                    <td className="p-3"><span className="flex items-center gap-2"><Avatar name={r.name} src={r.avatar} size={present ? 40 : 28} /><span><span className="block font-medium">{r.name}</span><span className="text-[11px] text-muted">{t("openProfile")}</span></span></span></td>
                    <td className="p-3 text-center font-semibold">{r.self ?? "—"}</td>
                    <td className="p-3 text-center"><span className="font-semibold">{r.classAvg ?? "—"}</span>{r.classN > 0 && <span className="block text-[11px] text-muted">{t("votes", { n: r.classN })}</span>}</td>
                    <td className="p-3">{v && <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[v]}`}>{t(`verdict.${v}`)}</span>}
                      {r.away && <span className="mt-1 block w-fit whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">{t("away", { reason: r.away })}</span>}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span><b className="text-ink">{r.tasks.length}</b> {t("tasksDone")}</span>
                        <span><b className="text-ink">{hm(r.officeMs)}</b> {t("atOffice")}</span>
                        <span><b className="text-ink">{r.activeDays}</b> {t("activeDays")}</span>
                        <span><b className="text-ink">{r.feed.filter((f) => f.kind !== "strike").length}</b> {t("thingsDone")}</span>
                        <span><b className="text-ink">{filesOf(r).length}</b> {t("filesAdded")}</span>
                      </div>
                      {r.tasks.length > 0 && (
                        <details className="mt-1 text-xs" open={present} onClick={(e) => e.stopPropagation()}>
                          <summary className="cursor-pointer text-muted">{t("whichTasks")}</summary>
                          <ul className="mt-1 list-disc pl-4">{r.tasks.map((x, i) => <li key={i}>{x}</li>)}</ul>
                        </details>
                      )}
                      {r.note && <p className="mt-1.5 text-xs italic">“{r.note}”</p>}
                      {r.proofs.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>{r.proofs.map((p) => <ProofChip key={p.id} p={p} />)}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">{t("legend")}</p>
        {open && <Profile r={open} n={openIdx + 1} total={ranked.length} onClose={close}
          onPrev={() => setOpenId(ranked[(openIdx - 1 + ranked.length) % ranked.length].id)}
          onNext={() => setOpenId(ranked[(openIdx + 1) % ranked.length].id)} />}
      </div>
    </div>
  );
}
