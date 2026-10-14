"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Zap, ReceiptText, Coins, Lock, Unlock, History, FileUp, Timer, RefreshCw, Download, Check, X, Loader2, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { syncBooksSoon } from "@/lib/books-client";
import { eur, shortDate, timeAgo } from "@/lib/format";
import { loggedOnTime } from "@/lib/kpis";
import { weekStart, START } from "@/lib/metrics";
import { METHODS, type Method } from "@/lib/finance";
import { uploadReceipt, ReceiptInput } from "./claim";

type Claim = { id: string; member_id: string; date: string; amount: number; description: string; category: string | null; project_id: string | null; payment_method: Method | null; receipt_path: string | null; status: string; reason: string | null; created_at: string; reimbursed_at: string | null };
type Count = { id: string; counted_at: string; counted: number; expected: number; note: string | null; counted_by: string | null };
type Audit = { id: number; table_name: string; action: string; before: Record<string, unknown> | null; after: Record<string, unknown> | null; actor_id: string | null; at: string };
type Entry = { date: string; created_at: string; logged_by: string | null; description: string };

export function Bookkeeper({ claims, counts, audit, locks, entries, cashExpected, projects, categories, names, isAdmin, me, today, sync }: {
  claims: Claim[]; counts: Count[]; audit: Audit[]; locks: string[]; entries: Entry[]; cashExpected: number;
  projects: { id: string; name: string }[]; categories: { value: string; label: string }[]; names: Record<string, string>;
  isAdmin: boolean; me: string; today: string; sync: { connected: boolean; pending: number; sheetUrl: string | null }
}) {
  const t = useTranslations("finance.books");
  const tm = useTranslations("finance.ledgers.methods");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);

  // ── 1. Quick add ──
  const [q, setQ] = useState({ kind: "expense" as "sale" | "expense", amount: "", what: "", category: "other", method: "cash" as Method, project: "" });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  async function quickAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const receipt_path = q.kind === "expense" && file ? await uploadReceipt(supabase, file) : null;
    const base = { date: today, description: q.what.trim(), amount: Number(q.amount), payment_method: q.method, project_id: q.project || null, logged_by: me };
    const { error } = q.kind === "sale"
      ? await supabase.from("sales").insert(base)
      : await supabase.from("expenses").insert({ ...base, category: q.category, receipt_path });
    setBusy(false);
    if (error) return toast("error", t("saveError"));
    toast("ok", t("added")); setQ({ ...q, amount: "", what: "" }); setFile(null); syncBooksSoon(); router.refresh();
  }

  // ── 2. Claims ──
  async function decide(c: Claim, approve: boolean) {
    const reason = approve ? null : prompt(t("rejectReason"));
    if (!approve && !reason?.trim()) return;
    let expense_id: string | null = null;
    if (approve) {
      const { data, error } = await supabase.from("expenses").insert({ date: c.date, description: `${c.description} (${names[c.member_id] ?? "—"})`, category: c.category,
        amount: c.amount, payment_method: c.payment_method, project_id: c.project_id, receipt_path: c.receipt_path, logged_by: me }).select("id").single();
      if (error) return toast("error", error.message.includes("closed") ? t("closedMonth") : t("saveError"));
      expense_id = data.id;
    }
    const { error } = await supabase.from("expense_claims").update({ status: approve ? "approved" : "rejected", reason, expense_id, decided_by: me, decided_at: new Date().toISOString() }).eq("id", c.id);
    if (error) return toast("error", t("saveError"));
    toast("ok", approve ? t("approved") : t("rejected")); syncBooksSoon(); router.refresh();
  }
  async function reimbursed(c: Claim) {
    await supabase.from("expense_claims").update({ status: "reimbursed", reimbursed_at: new Date().toISOString() }).eq("id", c.id);
    router.refresh();
  }
  async function openReceipt(path: string) {
    const { data } = await supabase.storage.from("receipts").createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }
  const pending = claims.filter((c) => c.status === "submitted");
  const owed = claims.filter((c) => c.status === "approved");

  // ── 4. Cash count ──
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  async function saveCount(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("cash_counts").insert({ counted: Number(counted), expected: cashExpected, note: note.trim() || null });
    if (error) return toast("error", t("saveError"));
    const gap = Number(counted) - cashExpected;
    toast(Math.abs(gap) < 0.01 ? "ok" : "error", Math.abs(gap) < 0.01 ? t("countOk") : t("countGap", { gap: eur(gap, locale) }));
    setCounted(""); setNote(""); router.refresh();
  }

  // ── 5. Month close ──
  const months = useMemo(() => {
    const out: string[] = [];
    for (let d = new Date(START.slice(0, 8) + "01T12:00:00Z"); d.toISOString().slice(0, 7) < today.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) out.push(d.toISOString().slice(0, 7) + "-01");
    return out.reverse();
  }, [today]);
  async function lock(m: string, close: boolean) {
    if (close && !confirm(t("confirmClose", { month: monthName(m) }))) return;
    const { error } = close ? await supabase.from("month_locks").insert({ month: m }) : await supabase.from("month_locks").delete().eq("month", m);
    if (error) return toast("error", t("saveError"));
    toast("ok", close ? t("closed", { month: monthName(m) }) : t("reopened")); router.refresh();
  }
  const monthName = (m: string) => new Date(m + "T12:00:00Z").toLocaleDateString(locale, { month: "long", year: "numeric" });

  // ── 7. CSV import ──
  const [csv, setCsv] = useState<{ head: string[]; rows: string[][] } | null>(null);
  const [map, setMap] = useState({ date: 0, description: 1, amount: 2, kind: "auto" as "auto" | "sale" | "expense" });
  function parseCsv(text: string) {
    const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    const rows: string[][] = [];
    let row: string[] = [], cell = "", quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch; }
      else if (ch === '"') quoted = true;
      else if (ch === delim) { row.push(cell.trim()); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell.trim()); if (row.some(Boolean)) rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    row.push(cell.trim()); if (row.some(Boolean)) rows.push(row);
    setCsv({ head: rows[0] ?? [], rows: rows.slice(1) });
  }
  const toDate = (s: string) => { const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null; };
  const toNum = (s: string) => { const c = s.replace(/[€\s]/g, ""); const n = Number(c.includes(",") && !c.includes(".") ? c.replace(",", ".") : c.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
  const preview = (csv?.rows ?? []).map((r) => {
    const date = toDate(r[map.date] ?? ""), amount = toNum(r[map.amount] ?? ""), description = (r[map.description] ?? "").slice(0, 200);
    const kind = map.kind === "auto" ? (amount !== null && amount < 0 ? "expense" : "sale") : map.kind;
    const dup = entries.some((x) => x.date === date && x.description === description);
    return { date, amount: amount === null ? null : Math.abs(amount), description, kind, ok: !!date && amount !== null && !!description && !dup && !locks.includes((date ?? "").slice(0, 8) + "01"), dup };
  });
  async function importCsv() {
    const good = preview.filter((p) => p.ok);
    const sales = good.filter((p) => p.kind === "sale").map((p) => ({ date: p.date, description: p.description, amount: p.amount, payment_method: "transfer", logged_by: me }));
    const exps = good.filter((p) => p.kind === "expense").map((p) => ({ date: p.date, description: p.description, amount: p.amount, category: "other", payment_method: "transfer", logged_by: me }));
    const [a, b] = await Promise.all([sales.length ? supabase.from("sales").insert(sales) : { error: null }, exps.length ? supabase.from("expenses").insert(exps) : { error: null }]);
    if (a.error || b.error) return toast("error", t("saveError"));
    toast("ok", t("imported", { count: good.length })); setCsv(null); syncBooksSoon(); router.refresh();
  }

  // ── 8. 24h compliance ──
  const week = weekStart(Date.now()), month = today.slice(0, 8) + "01";
  const late = (from: string) => {
    const m = new Map<string, number>();
    entries.filter((x) => x.date >= from && !loggedOnTime(x.date, x.created_at)).forEach((x) => m.set(x.logged_by ?? "?", (m.get(x.logged_by ?? "?") ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  // ── 9. Sync ──
  const [syncing, setSyncing] = useState(false);
  async function retry() {
    setSyncing(true);
    const res = await fetch("/api/books/sync", { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setSyncing(false);
    toast(res?.ok && !data.pending ? "ok" : "error", res?.ok && !data.pending ? t("syncOk") : t("syncWaiting"));
    router.refresh();
  }

  const card = "panel p-5";
  const h = "mb-3 flex items-center gap-2 font-semibold";
  return (
    <div className="space-y-4">
      {/* TODO(permissions): open to the Finance group + admins for now; later only the Financial leader and Bookkeeper (README §10). */}
      <section className={`${card} flex flex-wrap items-center gap-3`}>
        <RefreshCw size={18} className={sync.pending ? "text-warn-text" : "text-ok-text"} />
        <div className="min-w-48 flex-1">
          <p className="font-medium">{!sync.connected ? t("syncNotConnected") : sync.pending ? t("syncPending", { count: sync.pending }) : t("synced")}</p>
          <p className="text-xs text-muted">{t("syncHint")}</p>
        </div>
        {sync.sheetUrl && <a href={sync.sheetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-muted hover:text-ink"><ExternalLink size={14} /> {t("openSheet")}</a>}
        <button onClick={retry} disabled={syncing || !sync.connected} className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-line disabled:opacity-50">
          {syncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} {t("retry")}</button>
        <a href="/api/books/xlsx" className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-contrast"><Download size={14} /> {t("excel")}</a>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card}>
          <h3 className={h}><Zap size={16} className="text-trail" /> {t("quickAdd")}</h3>
          <form onSubmit={quickAdd} className="space-y-2.5">
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm">
              {(["sale", "expense"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setQ({ ...q, kind: k })} aria-pressed={q.kind === k}
                        className={`rounded-lg py-1.5 ${q.kind === k ? "bg-surface font-medium shadow-sm" : "text-muted"}`}>{t(k)}</button>
              ))}
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-2">
              <input required type="number" min="0.01" step="0.01" inputMode="decimal" value={q.amount} onChange={(e) => setQ({ ...q, amount: e.target.value })} placeholder="€" aria-label={t("amount")} className="input readout text-lg" />
              <input required value={q.what} onChange={(e) => setQ({ ...q, what: e.target.value })} placeholder={t("what")} aria-label={t("what")} className="input" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {METHODS.map((m) => (
                <button key={m} type="button" onClick={() => setQ({ ...q, method: m })} aria-pressed={q.method === m}
                        className={`rounded-full px-3 py-1 text-xs ${q.method === m ? "bg-brand text-brand-contrast" : "bg-surface-2 text-muted"}`}>{tm(m)}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {q.kind === "expense" && <select value={q.category} onChange={(e) => setQ({ ...q, category: e.target.value })} className="input" aria-label={t("category")}>{categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>}
              <select value={q.project} onChange={(e) => setQ({ ...q, project: e.target.value })} className={`input ${q.kind === "sale" ? "col-span-2" : ""}`} aria-label={t("project")}>
                <option value="">{t("general")}</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {q.kind === "expense" && <ReceiptInput file={file} onFile={setFile} label={t("receipt")} />}
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-contrast disabled:opacity-60">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} {t("save")}
            </button>
          </form>
        </section>

        <section className={card}>
          <h3 className={h}><ReceiptText size={16} /> {t("claims")} {pending.length > 0 && <span className="rounded-full bg-trail px-1.5 text-xs text-white">{pending.length}</span>}</h3>
          {pending.length ? (
            <ul className="space-y-2">
              {pending.map((c) => (
                <li key={c.id} className="rounded-xl bg-surface-2/60 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1"><p className="font-medium">{c.description}</p><p className="text-xs text-muted">{names[c.member_id] ?? "—"} · {shortDate(c.date, locale)}</p></div>
                    <span className="readout">{eur(c.amount, locale)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.receipt_path && <button onClick={() => openReceipt(c.receipt_path!)} className="text-xs underline underline-offset-2">{t("viewReceipt")}</button>}
                    <span className="flex-1" />
                    <button onClick={() => decide(c, false)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-bad-text hover:bg-surface"><X size={12} /> {t("reject")}</button>
                    <button onClick={() => decide(c, true)} className="flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs text-brand-contrast"><Check size={12} /> {t("approve")}</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">{t("noClaims")}</p>}
          {owed.length > 0 && (
            <div className="mt-4 border-t border-line pt-3">
              <p className="mb-2 text-sm font-medium">{t("owed")}</p>
              <ul className="space-y-1.5 text-sm">
                {owed.map((c) => (
                  <li key={c.id} className="flex items-center gap-2"><span className="flex-1">{names[c.member_id] ?? "—"} · {c.description}</span><span className="tabular-nums">{eur(c.amount, locale)}</span>
                    <button onClick={() => reimbursed(c)} className="rounded-lg bg-surface-2 px-2 py-1 text-xs hover:bg-line">{t("markPaid")}</button></li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className={card}>
          <h3 className={h}><Coins size={16} /> {t("cashCount")}</h3>
          <form onSubmit={saveCount} className="space-y-2.5">
            <p className="text-sm">{t("expected")} <span className="readout">{eur(cashExpected, locale)}</span></p>
            <div className="flex gap-2">
              <input required type="number" min="0" step="0.01" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={t("counted")} aria-label={t("counted")} className="input readout" />
              <button className="shrink-0 rounded-xl bg-brand px-4 text-sm font-medium text-brand-contrast">{t("saveCount")}</button>
            </div>
            {counted && <p className={`text-sm ${Math.abs(Number(counted) - cashExpected) < 0.01 ? "text-ok-text" : "text-bad-text"}`}>{t("gap", { gap: eur(Number(counted) - cashExpected, locale) })}</p>}
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("note")} aria-label={t("note")} className="input" />
          </form>
          {counts.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-muted">
              {counts.slice(0, 5).map((c) => { const gap = Number(c.counted) - Number(c.expected); return (
                <li key={c.id} className="flex gap-2"><span className="flex-1">{shortDate(c.counted_at, locale)} · {c.counted_by ? names[c.counted_by] : ""}</span>
                  <span className="tabular-nums">{eur(Number(c.counted), locale)}</span><span className={`w-16 text-right tabular-nums ${Math.abs(gap) < 0.01 ? "text-ok-text" : "text-bad-text"}`}>{gap >= 0 ? "+" : ""}{eur(gap, locale)}</span></li>); })}
            </ul>
          )}
        </section>

        <section className={card}>
          <h3 className={h}><Lock size={16} /> {t("monthClose")}</h3>
          <p className="mb-3 text-sm text-muted">{t("monthCloseHint")}</p>
          {months.length ? (
            <ul className="space-y-1.5">
              {months.map((m) => { const closed = locks.includes(m); return (
                <li key={m} className="flex items-center gap-2 text-sm">
                  {closed ? <Lock size={14} className="text-ok-text" /> : <Unlock size={14} className="text-muted" />}
                  <span className="flex-1 first-letter:uppercase">{monthName(m)}</span>
                  {closed ? (isAdmin ? <button onClick={() => lock(m, false)} className="text-xs text-muted underline">{t("reopen")}</button> : <span className="text-xs text-ok-text">{t("closedLabel")}</span>)
                    : <button onClick={() => lock(m, true)} className="rounded-lg bg-brand px-2.5 py-1 text-xs text-brand-contrast">{t("close")}</button>}
                </li>); })}
            </ul>
          ) : <p className="text-sm text-muted">{t("noMonths")}</p>}
        </section>

        <section className={card}>
          <h3 className={h}><Timer size={16} /> {t("compliance")}</h3>
          {[[t("thisWeek"), late(week)], [t("thisMonth"), late(month)]].map(([label, rows]) => (
            <div key={label as string} className="mb-3">
              <p className="mb-1 text-xs font-medium text-muted">{label as string}</p>
              {(rows as [string, number][]).length ? (rows as [string, number][]).map(([who, n]) => (
                <p key={who} className="flex justify-between text-sm"><span>{names[who] ?? "—"}</span><span className="text-warn-text tabular-nums">{t("lateCount", { count: n })}</span></p>
              )) : <p className="text-sm text-ok-text">{t("allOnTime")}</p>}
            </div>
          ))}
        </section>

        <section className={card}>
          <h3 className={h}><FileUp size={16} /> {t("csv")}</h3>
          {!csv ? (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line p-6 text-sm text-muted hover:text-ink">
              <FileUp size={16} /> {t("csvPick")}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) parseCsv(await f.text()); }} />
            </label>
          ) : (
            <div className="space-y-2.5 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {(["date", "description", "amount"] as const).map((k) => (
                  <label key={k} className="block"><span className="mb-1 block text-xs text-muted">{t(`col.${k}`)}</span>
                    <select value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })} className="input py-1.5">{csv.head.map((hd, i) => <option key={i} value={i}>{hd || `#${i + 1}`}</option>)}</select></label>
                ))}
                <label className="block"><span className="mb-1 block text-xs text-muted">{t("col.kind")}</span>
                  <select value={map.kind} onChange={(e) => setMap({ ...map, kind: e.target.value as typeof map.kind })} className="input py-1.5">
                    <option value="auto">{t("kindAuto")}</option><option value="sale">{t("sale")}</option><option value="expense">{t("expense")}</option></select></label>
              </div>
              <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-xl bg-surface-2/50 text-xs">
                {preview.slice(0, 30).map((p, i) => (
                  <li key={i} className={`flex gap-2 px-2.5 py-1.5 ${p.ok ? "" : "text-muted line-through"}`}>
                    <span className="w-20 tabular-nums">{p.date ?? "?"}</span><span className="flex-1 truncate">{p.description}</span>
                    <span className="tabular-nums">{p.amount === null ? "?" : `${p.kind === "expense" ? "−" : ""}${eur(p.amount, locale)}`}</span>{p.dup && <span>{t("dup")}</span>}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2"><button onClick={() => setCsv(null)} className="rounded-xl px-3 py-2 text-muted">{t("cancel")}</button>
                <button onClick={importCsv} disabled={!preview.some((p) => p.ok)} className="flex-1 rounded-xl bg-brand py-2 font-medium text-brand-contrast disabled:opacity-50">{t("importN", { count: preview.filter((p) => p.ok).length })}</button></div>
            </div>
          )}
        </section>
      </div>

      <section className={card}>
        <h3 className={h}><History size={16} /> {t("audit")}</h3>
        {audit.length ? (
          <ul className="max-h-96 divide-y divide-line overflow-y-auto text-sm">
            {audit.map((a) => {
              const changed = a.before && a.after ? Object.keys(a.after).filter((k) => !["updated_at"].includes(k) && JSON.stringify(a.before![k]) !== JSON.stringify(a.after![k])) : [];
              const desc = String((a.after ?? a.before)?.description ?? (a.after ?? a.before)?.name ?? (a.after ?? a.before)?.product ?? "");
              return (
                <li key={a.id} className="py-2">
                  <p><span className="font-medium">{a.actor_id ? names[a.actor_id] ?? "—" : t("system")}</span> <span className="text-muted">{t(`actions.${a.action}`)} · {t(`tables.${a.table_name}`)}</span> {desc}</p>
                  {changed.length > 0 && <p className="text-xs text-muted">{changed.slice(0, 4).map((k) => `${k}: ${String(a.before![k] ?? "—")} → ${String(a.after![k] ?? "—")}`).join(" · ")}</p>}
                  <p className="text-xs text-muted">{timeAgo(a.at, locale)}</p>
                </li>
              );
            })}
          </ul>
        ) : <p className="text-sm text-muted">{t("noAudit")}</p>}
      </section>
    </div>
  );
}
