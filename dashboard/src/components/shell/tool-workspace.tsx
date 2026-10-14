"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, X, ChevronRight } from "lucide-react";

export type WorkspaceTool = { id: string; label: string; node: React.ReactNode; group?: string };

/**
 * A team section's work area: the open tool fills the main column (the task board by default) and every other tool
 * sits in a "Tools" panel — on the right on desktop, in a bottom sheet on phones. The open tool is kept in ?tab=.
 */
export function ToolWorkspace({ tools, initial, groups }: { tools: WorkspaceTool[]; initial?: string; groups: Record<string, string> }) {
  const t = useTranslations("assist");
  const [active, setActive] = useState(tools.some((x) => x.id === initial) ? initial! : tools[0]?.id);
  const [sheet, setSheet] = useState(false);
  useEffect(() => { if (initial && tools.some((x) => x.id === initial)) setActive(initial); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = tools.find((x) => x.id === active) ?? tools[0];
  const order = ["work", "plan", "numbers", "people", "other"];
  const grouped = order.map((g) => ({ g, items: tools.filter((x) => (x.group ?? "other") === g) })).filter((x) => x.items.length);

  function open(id: string) {
    setActive(id); setSheet(false);
    const url = new URL(window.location.href);
    if (id === tools[0]?.id) url.searchParams.delete("tab"); else url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
    document.getElementById("tools")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const ToolList = () => (
    <nav aria-label={t("tools")} className="space-y-5">
      {grouped.map(({ g, items }) => (
        <div key={g}>
          <p className="mb-1.5 px-3 text-xs font-medium text-muted">{groups[g] ?? g}</p>
          <ul className="space-y-0.5">
            {items.map((x) => (
              <li key={x.id}>
                <button onClick={() => open(x.id)} aria-current={x.id === current?.id ? "page" : undefined}
                        className={`flex min-h-11 w-full items-center gap-2 rounded-2xl px-3 text-left text-[15px] transition ${x.id === current?.id ? "bg-brand-soft font-semibold text-link" : "text-ink hover:bg-surface-2"}`}>
                  <span className="flex-1 truncate">{x.label}</span>
                  {x.id !== current?.id && <ChevronRight size={15} className="text-muted" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <section id="tools" className="scroll-mt-20">
      <div className="sticky top-14 z-10 -mx-3 mb-4 flex items-center justify-between gap-3 bg-bg/85 px-3 py-3 backdrop-blur-xl sm:-mx-4 sm:px-4 lg:static lg:mx-0 lg:mb-5 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <h2 className="display text-2xl sm:text-3xl">{current?.label}</h2>
        <button onClick={() => setSheet(true)} className="flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-medium lg:hidden" aria-haspopup="dialog">
          <LayoutGrid size={16} /> {t("tools")}
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0">
          {tools.map((x) => <div key={x.id} hidden={x.id !== current?.id}>{x.node}</div>)}
        </div>
        <aside className="hidden lg:block">
          <div className="panel sticky top-20 p-3">
            <p className="flex items-center gap-2 px-3 pt-1 pb-3 text-sm font-medium"><LayoutGrid size={16} /> {t("tools")}</p>
            <ToolList />
          </div>
        </aside>
      </div>

      {sheet && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={t("tools")}>
          <button aria-label={t("close")} onClick={() => setSheet(false)} className="absolute inset-0 bg-black/60" />
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-[28px] border-t border-line bg-solid p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <div className="mb-3 flex items-center justify-between">
              <p className="display text-xl">{t("tools")}</p>
              <button onClick={() => setSheet(false)} aria-label={t("close")} className="grid size-11 place-items-center rounded-full hover:bg-surface-2"><X size={18} /></button>
            </div>
            <ToolList />
          </div>
        </div>
      )}
    </section>
  );
}
