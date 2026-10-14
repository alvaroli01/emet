"use client";

import { useState } from "react";

type Tab = { id: string; label: string; node: React.ReactNode };

/**
 * One section at a time instead of a long stack. Every panel is rendered on the server,
 * so switching is instant; the open tab is kept in the URL (?tab=) for sharing.
 */
export function SectionTabs({ tabs, initial, label }: { tabs: Tab[]; initial?: string; label: string }) {
  const [active, setActive] = useState(tabs.some((t) => t.id === initial) ? initial! : tabs[0]?.id);

  function open(id: string) {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === tabs[0]?.id) url.searchParams.delete("tab"); else url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      <div role="tablist" aria-label={label}
           className="sticky top-[52px] z-10 -mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line bg-bg/90 px-4 backdrop-blur [scrollbar-width:none] lg:-mx-8 lg:px-8">
        {tabs.map((t) => (
          <button key={t.id} role="tab" type="button" id={`tab-${t.id}`} aria-selected={active === t.id} aria-controls={`panel-${t.id}`}
                  onClick={() => open(t.id)}
                  className={`relative shrink-0 px-3 py-3 text-sm transition-colors ${
                    active === t.id ? "font-medium text-ink" : "text-muted hover:text-ink"}`}>
            {t.label}
            <span aria-hidden className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-trail transition-transform duration-300 ${
              active === t.id ? "scale-x-100" : "scale-x-0"}`} />
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id}>
          {t.node}
        </div>
      ))}
    </div>
  );
}
