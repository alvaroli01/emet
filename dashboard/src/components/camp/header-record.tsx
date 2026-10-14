"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mic } from "lucide-react";
import { Recorder } from "./recorder";

/** Record from anywhere: the mic in the top bar opens the note-taker; the finished doc opens in Base camp. */
export function HeaderRecord() {
  const t = useTranslations("camp.docs");
  const router = useRouter();
  const [ai, setAi] = useState<{ connected: boolean; last4: string | null } | null>(null);

  async function open() {
    const res = await fetch("/api/ai-key").catch(() => null);
    setAi(res?.ok ? await res.json() : { connected: false, last4: null });
  }

  return (
    <>
      <button onClick={open} aria-label={t("record")} title={t("record")}
              className="grid size-9 place-items-center rounded-full bg-brand text-white shadow-[0_6px_18px_-6px_rgb(255_106_26/0.8)] transition hover:brightness-110 active:scale-95">
        <Mic size={16} />
      </button>
      {/* Portalled to <body>: the top bar's blur would otherwise trap a fixed window inside it */}
      {ai && createPortal(
        <Recorder connected={ai.connected} last4={ai.last4} onClose={() => setAi(null)}
                  onCreated={(doc) => { setAi(null); router.push(`/camp?tab=docs&doc=${doc.id}`); router.refresh(); }} />,
        document.body,
      )}
    </>
  );
}
