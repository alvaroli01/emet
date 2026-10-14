"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Sparkles, X } from "lucide-react";

/**
 * The section's AI helper as a floating bubble (bottom-right). Tap it to open the chat in a pop-up; the chat stays
 * alive while closed so the conversation isn't lost. Esc or the X closes it.
 */
export function AssistantBubble({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTranslations("assist");
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);
  return (
    <>
      <div role="dialog" aria-label={label} aria-hidden={!open}
           className={`fixed right-3 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-40 w-[min(420px,calc(100vw-1.5rem))] origin-bottom-right transition-[opacity,transform] duration-200 ease-[cubic-bezier(.23,1,.32,1)] lg:right-6 lg:bottom-24 ${open ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"}`}>
        <div className="max-h-[min(640px,72dvh)] overflow-y-auto rounded-[26px] bg-solid shadow-2xl ring-1 ring-line [scrollbar-width:thin]">
          <div className="flex justify-end p-2 pb-0">
            <button onClick={() => setOpen(false)} aria-label={t("close")} className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-ink"><X size={17} /></button>
          </div>
          <div className="-mt-9">{children}</div>
        </div>
      </div>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={label} title={label}
              className="fixed right-3 bottom-[calc(5.4rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full text-white shadow-[0_12px_30px_-8px_rgb(255_106_26/0.7)] transition active:scale-95 lg:right-6 lg:bottom-6"
              style={{ background: "var(--io-gradient)" }}>
        {open ? <X size={22} /> : <Sparkles size={22} />}
        {!open && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-brand/30 [animation-duration:2.4s]" />}
      </button>
    </>
  );
}
