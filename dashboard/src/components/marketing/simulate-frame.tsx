"use client";

import { useRef } from "react";
import { Maximize2 } from "lucide-react";

/** MiroFish iframe with a full-screen button that stays on the page (iPhone can't full-screen an iframe → new tab). */
export function SimulateFrame({ src, intro, open }: { src: string; intro: string; open: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const fullScreen = () => {
    const el = frame.current;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => window.open(src, "_blank", "noopener"));
    else window.open(src, "_blank", "noopener");
  };
  return (
    <section className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
        <p className="text-sm text-muted">{intro}</p>
        <button type="button" onClick={fullScreen} className="flex min-h-11 items-center gap-1.5 text-sm font-medium hover:text-link"><Maximize2 size={14} /> {open}</button>
      </div>
      <iframe ref={frame} src={src} title="MiroFish" className="h-[80vh] w-full border-0 bg-white" allow="clipboard-write; fullscreen" allowFullScreen />
    </section>
  );
}
