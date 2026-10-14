"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Unlock, Eye, EyeOff, Copy, Plus, Trash2, KeyRound, ShieldCheck, ExternalLink, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import { newSalt, deriveKey, seal, open, makeCheck, verify } from "@/lib/vault";

type KeyRow = { salt: string; check_iv: string; check_data: string } | null;
type Box = { id: string; iv: string; data: string };
type Entry = { label: string; username: string; password: string; url: string; note: string };
const BLANK: Entry = { label: "", username: "", password: "", url: "", note: "" };
const AUTO_LOCK_MS = 5 * 60 * 1000;

/** Passwords encrypted on this device with your own vault passphrase. The server only ever sees ciphertext. */
export function VaultTab({ keyRow: initialKey, items: boxes, meId }: { keyRow: KeyRow; items: Box[]; meId: string }) {
  const t = useTranslations("camp.vault");
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [keyRow, setKeyRow] = useState(initialKey);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [entries, setEntries] = useState<(Entry & { id: string })[]>([]);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<(Entry & { id?: string }) | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const lastUse = useRef(Date.now());

  // Lock again after 5 minutes without use, and whenever the page is hidden for that long
  useEffect(() => {
    if (!key) return;
    const touch = () => { lastUse.current = Date.now(); };
    const tick = setInterval(() => { if (Date.now() - lastUse.current > AUTO_LOCK_MS) lock(); }, 15_000);
    window.addEventListener("pointerdown", touch);
    window.addEventListener("keydown", touch);
    return () => { clearInterval(tick); window.removeEventListener("pointerdown", touch); window.removeEventListener("keydown", touch); };
  }, [key]);

  function lock() { setKey(null); setEntries([]); setShown(null); setForm(null); setPass(""); }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (pass.length < 10) return setError(t("tooShort"));
    if (pass !== pass2) return setError(t("noMatch"));
    setBusy(true); setError("");
    const salt = newSalt();
    const k = await deriveKey(pass, salt);
    const check = await makeCheck(k);
    const row = { owner_id: meId, salt, check_iv: check.iv, check_data: check.data };
    const { error: err } = await supabase.from("vault_keys").insert(row);
    setBusy(false);
    if (err) return setError(t("saveError"));
    setKeyRow(row); setKey(k); setPass(""); setPass2("");
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!keyRow) return;
    setBusy(true); setError("");
    const k = await deriveKey(pass, keyRow.salt);
    if (!(await verify(k, { iv: keyRow.check_iv, data: keyRow.check_data }))) { setBusy(false); return setError(t("wrong")); }
    const { data } = await supabase.from("vault_items").select("id, iv, data").order("created_at");
    const list = await Promise.all(((data as Box[] | null) ?? boxes).map(async (b) => ({ id: b.id, ...(await open<Entry>(k, b)) })));
    setEntries(list); setKey(k); setPass(""); setBusy(false);
    lastUse.current = Date.now();
  }

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!key || !form || !form.label.trim()) return;
    const { id, ...entry } = form;
    const box = await seal(key, entry);
    if (id) {
      const { error: err } = await supabase.from("vault_items").update(box).eq("id", id);
      if (err) return toast("error", t("saveError"));
      setEntries((x) => x.map((y) => (y.id === id ? { id, ...entry } : y)));
    } else {
      const newId = crypto.randomUUID();
      const { error: err } = await supabase.from("vault_items").insert({ id: newId, ...box });
      if (err) return toast("error", t("saveError"));
      setEntries((x) => [...x, { id: newId, ...entry }]);
    }
    setForm(null);
  }

  async function remove(id: string) {
    if (!confirm(t("confirmDelete"))) return;
    setEntries((x) => x.filter((y) => y.id !== id));
    await supabase.from("vault_items").delete().eq("id", id);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast("ok", t("copied"));
  }

  if (!keyRow || !key) {
    const isNew = !keyRow;
    return (
      <div className="mx-auto max-w-md">
        <form onSubmit={isNew ? create : unlock} className="panel space-y-4 p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-2"><KeyRound size={22} /></span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{isNew ? t("setupTitle") : t("lockedTitle")}</h2>
            <p className="mt-1 text-sm text-muted">{isNew ? t("setupHint") : t("lockedHint")}</p>
          </div>
          <input type="password" autoComplete={isNew ? "new-password" : "current-password"} value={pass}
                 onChange={(e) => setPass(e.target.value)} placeholder={t("passphrase")} aria-label={t("passphrase")} className="input" />
          {isNew && (
            <input type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)}
                   placeholder={t("repeat")} aria-label={t("repeat")} className="input" />
          )}
          {isNew && <p className="rounded-lg bg-surface-2 p-3 text-xs text-muted">{t("noRecovery")}</p>}
          {error && <p role="alert" className="text-sm text-bad-text">{error}</p>}
          <button disabled={busy || !pass} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-medium text-brand-contrast disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" /> : isNew ? <ShieldCheck size={16} /> : <Unlock size={16} />}
            {isNew ? t("create") : t("unlock")}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-muted">{t("teamTip")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm text-ok-text"><ShieldCheck size={15} /> {t("unlocked")}</p>
        <div className="flex gap-2">
          <button onClick={() => setForm({ ...BLANK })} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-contrast"><Plus size={16} /> {t("add")}</button>
          <button onClick={lock} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-muted shadow-[var(--shadow)] hover:text-ink"><Lock size={15} /> {t("lock")}</button>
        </div>
      </div>

      {form && (
        <form onSubmit={saveEntry} className="panel grid gap-3 p-5 sm:grid-cols-2">
          {(["label", "username", "password", "url"] as const).map((f) => (
            <label key={f} className="block">
              <span className="mb-1.5 block text-sm font-medium">{t(`fields.${f}`)}</span>
              <input type={f === "password" ? "text" : f === "url" ? "url" : "text"} required={f === "label"} value={form[f]}
                     autoComplete="off" spellCheck={false} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="input" />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium">{t("fields.note")}</span>
            <textarea rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input" />
          </label>
          <div className="flex gap-2 sm:col-span-2">
            <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-brand-contrast">{t("save")}</button>
            <button type="button" onClick={() => setForm(null)} className="rounded-xl px-4 py-2 text-sm text-muted hover:text-ink">{t("cancel")}</button>
          </div>
        </form>
      )}

      {entries.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((x) => (
            <li key={x.id} className="panel panel-lift p-4">
              <div className="mb-2 flex items-start gap-2">
                <span className="readout grid size-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-sm">{x.label.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{x.label}</p>
                  {x.username && <p className="truncate text-xs text-muted">{x.username}</p>}
                </div>
                <button onClick={() => setForm(x)} className="text-xs text-muted hover:text-ink">{t("edit")}</button>
              </div>
              {x.password && (
                <div className="flex items-center gap-1 rounded-lg bg-surface-2 px-2.5 py-1.5">
                  <code className="min-w-0 flex-1 truncate text-sm">{shown === x.id ? x.password : "••••••••••"}</code>
                  <button onClick={() => setShown(shown === x.id ? null : x.id)} aria-label={shown === x.id ? t("hide") : t("show")} className="p-1 text-muted hover:text-ink">
                    {shown === x.id ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => copy(x.password)} aria-label={t("copy")} className="p-1 text-muted hover:text-ink"><Copy size={14} /></button>
                </div>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs">
                {x.url && /^https?:\/\//.test(x.url) && (
                  <a href={x.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-muted hover:text-ink"><ExternalLink size={12} /> {t("open")}</a>
                )}
                {x.note && <span className="truncate text-muted">{x.note}</span>}
                <button onClick={() => remove(x.id)} aria-label={t("delete")} className="ml-auto p-1 text-muted hover:text-bad-text"><Trash2 size={13} /></button>
              </div>
            </li>
          ))}
        </ul>
      ) : !form && <p className="panel p-8 text-center text-sm text-muted">{t("empty")}</p>}
    </div>
  );
}
