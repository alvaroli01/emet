"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutTemplate, Loader2 } from "lucide-react";

export const TEMPLATE_KEYS = ["productLaunch", "stallDay", "event", "campaign", "fridayReport"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

/** "Use a template": a ready project card with its small tasks, so nobody rebuilds the same checklist. */
export function TemplateMenu({ onUse }: { onUse: (title: string, items: string[]) => Promise<void> }) {
  const t = useTranslations("templates");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<TemplateKey | null>(null);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted transition hover:bg-surface-2 hover:text-ink">
        <LayoutTemplate size={15} /> {t("use")}
      </button>
      {open && (
        <div className="panel absolute left-0 z-30 mt-1 w-72 p-1.5 text-sm" onMouseLeave={() => setOpen(false)}>
          {TEMPLATE_KEYS.map((k) => (
            <button key={k} disabled={!!busy}
                    onClick={async () => { setBusy(k); await onUse(t(`${k}.title`), t.raw(`${k}.items`) as string[]); setBusy(null); setOpen(false); }}
                    className="flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2 disabled:opacity-60">
              {busy === k ? <Loader2 size={14} className="mt-0.5 animate-spin" /> : <LayoutTemplate size={14} className="mt-0.5 text-muted" />}
              <span><span className="block font-medium">{t(`${k}.title`)}</span><span className="block text-xs text-muted">{t(`${k}.hint`)}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
