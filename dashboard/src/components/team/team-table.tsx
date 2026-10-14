"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, CircleCheck, CircleX, CircleAlert, CircleMinus, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui";
import type { TeamRow, Engagement } from "@/lib/team-stats";

const DAY = 864e5;
const ICON = { active: <CircleCheck size={20} className="text-ok-text" />, somewhat: <CircleMinus size={20} className="text-warn-text" />, inactive: <CircleAlert size={20} className="text-bad-text" /> };
const yes = (v: boolean, label: string) => <span role="img" aria-label={label} className="inline-flex">{v ? <CircleCheck size={20} className="text-ok-text" /> : <CircleX size={20} className="text-bad-text" />}</span>;

/** The Team page table: who is active, who logged in, who finished tasks, and when they last did something. */
export function TeamTable({ rows }: { rows: TeamRow[] }) {
  const t = useTranslations("teamTable");
  const [q, setQ] = useState("");
  const [show, setShow] = useState<Set<Engagement>>(new Set(["inactive", "somewhat", "active"]));
  const [sortStatus, setSortStatus] = useState(false);
  const order: Record<Engagement, number> = { inactive: 0, somewhat: 1, active: 2 };
  const list = rows
    .filter((r) => show.has(r.status) && `${r.name} ${r.role ?? ""} ${r.team ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (sortStatus ? order[a.status] - order[b.status] : 0) || a.name.localeCompare(b.name));
  const ago = (iso: string | null) => {
    if (!iso) return t("never");
    const d = Math.floor((Date.now() - Date.parse(iso)) / DAY);
    return d <= 0 ? t("today") : d < 60 ? t("daysAgo", { n: d }) : t("monthsAgo");
  };
  const toggle = (e: Engagement) => setShow((s) => { const n = new Set(s); if (n.has(e)) n.delete(e); else n.add(e); return n.size ? n : s; });

  return (
    <section className="panel p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="glass-pill flex min-h-11 w-full items-center gap-2 px-4 sm:w-72">
          <span className="sr-only">{t("search")}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted" />
          <Search size={15} className="text-muted" />
        </label>
        <div className="grid w-full grid-cols-3 gap-2 sm:w-auto" role="group" aria-label={t("filter")}>
          {(["inactive", "somewhat", "active"] as const).map((e) => (
            <button key={e} onClick={() => toggle(e)} aria-pressed={show.has(e)}
                    className={`min-h-11 rounded-2xl px-3 text-sm transition sm:px-5 ${show.has(e) ? "bg-surface-2 font-medium text-ink ring-1 ring-brand/60" : "text-muted ring-1 ring-line"}`}>
              {t(`status.${e}`)} <span className="ml-1 text-xs text-muted tabular-nums">{rows.filter((r) => r.status === e).length}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left align-bottom text-xs text-muted">
              <th className="pb-3 font-medium">{t("name")}</th>
              <th className="pb-3 font-medium"><button onClick={() => setSortStatus((v) => !v)} className="font-medium text-ink">{t("statusCol")} {sortStatus ? "▾" : "▴"}</button></th>
              <th className="pb-3 text-center font-medium whitespace-pre-line">{t("usedApp")}</th>
              <th className="pb-3 text-center font-medium whitespace-pre-line">{t("didTask")}</th>
              <th className="pb-3 text-right font-medium whitespace-pre-line">{t("tasksDone")}</th>
              <th className="pb-3 pl-6 font-medium">{t("lastActive")}</th>
              <th className="w-6" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const recent = r.lastActive && Date.now() - Date.parse(r.lastActive) < 30 * DAY;
              return (
                <tr key={r.id} className="group border-b border-line/60 last:border-0 hover:bg-surface-2/50">
                  <td className="py-3.5 pr-3">
                    <Link href={`/team/${r.id}`} className="flex items-center gap-3">
                      <Avatar name={r.name} src={r.avatar} size={48} />
                      <span className="min-w-0">
                        <span className="block font-medium group-hover:text-link">{r.name}</span>
                        <span className="block truncate text-xs text-muted">{[r.role, r.team].filter(Boolean).join(" - ") || t("noRole")}</span>
                        {!r.joined && <span className="block text-xs text-warn-text">{t("notJoined")}</span>}
                      </span>
                    </Link>
                  </td>
                  <td><span className="flex items-center gap-2">{ICON[r.status]} {t(`status.${r.status}`)}</span></td>
                  <td className="text-center">{yes(r.usedApp, r.usedApp ? t("yes") : t("no"))}</td>
                  <td className="text-center">{yes(r.didTask, r.didTask ? t("yes") : t("no"))}</td>
                  <td className="text-right text-muted tabular-nums">({r.done}/{r.total}) {r.total ? Math.round((r.done / r.total) * 100) : 0}%</td>
                  <td className="pl-6"><span className="flex items-center gap-2">{!r.lastActive ? <CircleMinus size={20} className="text-warn-text" /> : recent ? <CircleCheck size={20} className="text-ok-text" /> : <CircleAlert size={20} className="text-bad-text" />} {ago(r.lastActive)}</span></td>
                  <td><Link href={`/team/${r.id}`} aria-label={t("open", { name: r.name })} className="text-muted"><ChevronRight size={16} /></Link></td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={7} className="py-10 text-center text-muted">{t("empty")}</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">{t("note")}</p>
    </section>
  );
}
