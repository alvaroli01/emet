"use client";

import { useEffect, useState } from "react";

export type SectionTab = { id: string; label: string; node: React.ReactNode; group?: string; icon?: React.ReactNode };

/**
 * One section at a time instead of a long stack. Every panel is rendered on the server,
 * so switching is instant; the open tab is kept in the URL (?tab=) for sharing.
 * When tabs carry a `group` (Work / Plan / Numbers…), they're shown as a few categories first,
 * then the tabs of the chosen category — so a section with 10 tools still reads as 3–4 choices.
 */
export function SectionTabs({ tabs, initial, label, groups }: { tabs: SectionTab[]; initial?: string; label: string; groups?: Record<string, string> }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial! : tabs[0]?.id);
  // Links like ?tab=books (from the hero) switch the open tab without a full reload
  useEffect(() => { if (initial && tabs.some((t) => t.id === initial)) setActive(initial); }, [initial]); // eslint-disable-line react-hooks/exhaustive-deps
  const cats = groups ? [...new Set(tabs.map((t) => t.group ?? "other"))].filter((g) => tabs.some((t) => (t.group ?? "other") === g)) : [];
  const activeCat = tabs.find((t) => t.id === active)?.group ?? "other";
  const visible = cats.length > 1 ? tabs.filter((t) => (t.group ?? "other") === activeCat) : tabs;

  function open(id: string) {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === tabs[0]?.id) url.searchParams.delete("tab"); else url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      <div className="sticky top-[52px] z-10 -mx-4 mb-5 border-b border-line bg-bg/90 px-4 backdrop-blur lg:-mx-8 lg:px-8">
        {cats.length > 1 && (
          <div role="group" aria-label={label} className="flex gap-1 overflow-x-auto pt-3 [scrollbar-width:none]">
            {cats.map((c) => (
              <button key={c} type="button" aria-pressed={c === activeCat} onClick={() => open(tabs.find((t) => (t.group ?? "other") === c)!.id)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition ${c === activeCat ? "bg-ink font-medium text-brand-contrast" : "text-muted hover:bg-surface-2 hover:text-ink"}`}>
                {groups![c] ?? c}
                <span className={`ml-1.5 text-xs ${c === activeCat ? "opacity-70" : "opacity-60"}`}>{tabs.filter((t) => (t.group ?? "other") === c).length}</span>
              </button>
            ))}
          </div>
        )}
        <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
          {visible.map((t) => (
            <button key={t.id} role="tab" type="button" id={`tab-${t.id}`} aria-selected={active === t.id} aria-controls={`panel-${t.id}`}
                    onClick={() => open(t.id)}
                    className={`relative flex shrink-0 items-center gap-1.5 px-3 py-3 text-sm transition-colors ${active === t.id ? "font-medium text-ink" : "text-muted hover:text-ink"}`}>
              {t.icon}{t.label}
              <span aria-hidden className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-trail transition-transform duration-300 ${active === t.id ? "scale-x-100" : "scale-x-0"}`} />
            </button>
          ))}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id}>
          {t.node}
        </div>
      ))}
    </div>
  );
}
