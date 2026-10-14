"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, X, ChevronRight } from "lucide-react";

export type WorkspaceTool = { id: string; label: string; node: React.ReactNode; group?: string; icon?: React.ReactNode };

/**
 * A team section: the open tool fills the page (the section's Overview dashboard by default) and every tool —
 * Overview, the task board and the rest — lives in the "Tools" panel down the right side of the whole page
 * (a bottom sheet on phones). The open tool is kept in ?tab= so links can point at it.
 */
export function ToolWorkspace({ tools, initial, groups }: { tools: WorkspaceTool[]; initial?: string; groups: Record<string, string> }) {
  const t = useTranslations("assist");
  const [active, setActive] = useState(tools.some((x) => x.id === initial) ? initial! : tools[0]?.id);
  const [sheet, setSheet] = useState(false);
  useEffect(() => { if (initial && tools.some((x) => x.id === initial)) setActive(initial); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = tools.find((x) => x.id === active) ?? tools[0];
  const order = ["overview", "work", "plan", "numbers", "people", "other"];
  const grouped = order.map((g) => ({ g, items: tools.filter((x) => (x.group ?? "other") === g) })).filter((x) => x.items.length);

  function open(id: string) {
    setActive(id); setSheet(false);
    const url = new URL(window.location.href);
    if (id === tools[0]?.id) url.searchParams.delete("tab"); else url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const ToolList = () => (
    <nav aria-label={t("tools")} className="space-y-4">
      {grouped.map(({ g, items }) => (
        <div key={g}>
          {g !== "overview" && <p className="mb-1.5 px-2 text-[11px] font-medium tracking-[0.08em] text-muted uppercase">{groups[g] ?? g}</p>}
          <ul className="space-y-0.5">
            {items.map((x) => (
              <li key={x.id}>
                <button onClick={() => open(x.id)} aria-current={x.id === current?.id ? "page" : undefined}
                        className={`flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3 text-left text-sm transition ${x.id === current?.id ? "glass-pill font-semibold text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}>
                  {x.icon && <span className={x.id === current?.id ? "text-brand" : ""}>{x.icon}</span>}
                  <span className="flex-1 truncate">{x.label}</span>
                  {x.id !== current?.id && <ChevronRight size={15} className="opacity-50" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_250px]">
      <div className="min-w-0">
        {/* Phones: which tool is open + the Tools button */}
        <div className="sticky top-16 z-10 -mx-3 mb-4 flex items-center justify-between gap-3 bg-bg/60 px-3 py-2.5 backdrop-blur-xl lg:hidden">
          <p className="truncate font-semibold">{current?.label}</p>
          <button onClick={() => setSheet(true)} className="glass-pill min-h-11 shrink-0 px-4 text-sm font-medium" aria-haspopup="dialog"><LayoutGrid size={16} /> {t("tools")}</button>
        </div>
        {current?.id !== tools[0]?.id && <h2 className="mb-4 hidden text-2xl font-medium tracking-tight lg:block">{current?.label}</h2>}
        {tools.map((x) => <div key={x.id} hidden={x.id !== current?.id}>{x.node}</div>)}
      </div>

      <aside className="hidden lg:block">
        <div className="glass sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-[26px] p-3 [scrollbar-width:none]">
          <p className="flex items-center gap-2 px-2 pt-1 pb-3 text-sm font-semibold"><LayoutGrid size={16} className="text-brand" /> {t("tools")}</p>
          <ToolList />
        </div>
      </aside>

      {sheet && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("tools")}>
          <button aria-label={t("close")} onClick={() => setSheet(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[28px] bg-solid p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] ring-1 ring-line">
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-lg font-semibold">{t("tools")}</p>
              <button onClick={() => setSheet(false)} aria-label={t("close")} className="grid size-11 place-items-center rounded-full hover:bg-surface-2"><X size={18} /></button>
            </div>
            <ToolList />
          </div>
        </div>
      )}
    </div>
  );
}
