"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BookOpen, Loader2, Plus, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/toast";
import type { DeadlineMap } from "@/lib/notion/deadlines";

type Opt = { id: string; title: string };
type Conn = {
  id: string; workspace: string | null; icon: string | null; reconnect: boolean; error?: boolean;
  deadlines_ds: string | null; deadlines_map: DeadlineMap | null; save_parent: string | null;
  databases: Opt[]; pages: Opt[]; columns: Record<string, string> | null;
};

/** My connections → Notion: connect (Notion's own page picker), pick a deadlines database + a "Save to" page, disconnect. */
export function NotionCard() {
  const t = useTranslations("notion");
  const toast = useToast();
  const [state, setState] = useState<{ configured: boolean; connections: Conn[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/notion/settings").catch(() => null);
    setState(res?.ok ? await res.json() : { configured: false, connections: [] });
  }
  useEffect(() => {
    load();
    const r = new URLSearchParams(location.search).get("notion");
    if (r === "ok") toast("ok", t("connected"));
    else if (r === "failed") toast("error", t("connectFailed"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(id: string, patch: Record<string, unknown>) {
    setBusy(id);
    const res = await fetch("/api/notion/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) }).catch(() => null);
    setBusy(null);
    if (!res?.ok) { const j = await res?.json().catch(() => ({})); toast("error", t(j?.error === "no-date-column" ? "noDateColumn" : "saveFailed")); return; }
    await load();
  }
  async function disconnect(id: string) {
    setBusy(id);
    await fetch("/api/notion/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => null);
    setBusy(null);
    await load();
  }

  return (
    <div className="rounded-xl bg-surface-2/60 p-3 md:col-span-2">
      <div className="flex items-center gap-2">
        <BookOpen size={14} className="text-brand" aria-hidden />
        <p className="text-sm font-medium">{t("title")}</p>
        {state?.configured && state.connections.length > 0 && (
          <a href="/api/notion/connect" className="ml-auto flex items-center gap-1 text-[11px] text-climbed hover:underline"><Plus size={12} /> {t("connectAnother")}</a>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-muted">{t("help")}</p>

      {!state ? <Loader2 size={14} className="mt-2 animate-spin text-muted" /> : !state.configured ? (
        <p className="mt-2 text-[11px] text-muted">{t("notSetUp")}</p>
      ) : state.connections.length === 0 ? (
        <>
          <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-[11px]">
            <li>{t("step1")}</li><li>{t("step2")}</li><li>{t("step3")}</li>
          </ol>
          <a href="/api/notion/connect" className="mt-2 inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1 text-xs font-medium text-brand-contrast">{t("connect")}</a>
        </>
      ) : (
        <ul className="mt-2 space-y-2">
          {state.connections.map((c) => (
            <li key={c.id} className="rounded-lg bg-surface/60 p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.icon && !c.icon.startsWith("http") ? `${c.icon} ` : ""}{c.workspace ?? t("workspace")}</span>
                {busy === c.id && <Loader2 size={12} className="animate-spin text-muted" />}
                <button type="button" onClick={() => disconnect(c.id)} className="ml-auto text-[11px] text-muted hover:text-bad-text">{t("disconnect")}</button>
              </div>
              {c.reconnect ? (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-warn-text"><AlertTriangle size={12} /> {t("reconnect")} <a href="/api/notion/connect" className="underline">{t("connect")}</a></p>
              ) : c.error ? (
                <p className="mt-1 text-[11px] text-bad-text">{t("unreachable")}</p>
              ) : (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="block text-[11px] text-muted">{t("deadlinesDb")}
                    <select className="input mt-0.5 w-full py-1 text-xs" value={c.deadlines_ds ?? ""} onChange={(e) => save(c.id, { deadlines_ds: e.target.value || null })}>
                      <option value="">{t("none")}</option>
                      {c.databases.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                  </label>
                  <label className="block text-[11px] text-muted">{t("saveTo")}
                    <select className="input mt-0.5 w-full py-1 text-xs" value={c.save_parent ?? ""} onChange={(e) => save(c.id, { save_parent: e.target.value || null })}>
                      <option value="">{t("none")}</option>
                      {c.pages.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </select>
                  </label>
                  {c.deadlines_map && c.columns && (
                    <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
                      <label className="block text-[11px] text-muted">{t("dateColumn")}
                        <select className="input mt-0.5 w-full py-1 text-xs" value={c.deadlines_map.date}
                                onChange={(e) => save(c.id, { deadlines_map: { ...c.deadlines_map!, date: e.target.value } })}>
                          {Object.entries(c.columns).filter(([, ty]) => ty === "date").map(([k]) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </label>
                      <label className="block text-[11px] text-muted">{t("doneColumn")}
                        <select className="input mt-0.5 w-full py-1 text-xs" value={c.deadlines_map.done ?? ""}
                                onChange={(e) => save(c.id, { deadlines_map: { ...c.deadlines_map!, done: e.target.value || undefined, doneValue: c.columns![e.target.value] === "status" ? c.deadlines_map!.doneValue ?? "Done" : undefined } })}>
                          <option value="">{t("none")}</option>
                          {Object.entries(c.columns).filter(([, ty]) => ty === "status" || ty === "checkbox").map(([k]) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
