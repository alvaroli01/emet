"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2, SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

export type Idea = { id: string; text: string; color: string; x: number; y: number; created_at: string };

// Paper tones from the map world, readable in light and dark
const COLORS: Record<string, string> = {
  sand: "#efe3c8", sage: "#d9e6d2", sky: "#d3e2ef", rose: "#f0d6d0", lilac: "#e0dbef",
};
const W = 1600, H = 1000, NOTE = 176;
const tiltOf = (id: string) => ((parseInt(id.slice(0, 2), 16) % 7) - 3) * 0.8; // a steady, slightly hand-placed angle

/** A private wall of sticky ideas. Drag them around; tap one to edit; send a good one to a team board. */
export function IdeasTab({ ideas: initial, meId }: { ideas: Idea[]; meId: string }) {
  const t = useTranslations("camp.ideas");
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const [ideas, setIdeas] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [lifted, setLifted] = useState<string | null>(null);
  const wall = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null);

  const patch = (id: string, p: Partial<Idea>) => setIdeas((all) => all.map((i) => (i.id === id ? { ...i, ...p } : i)));

  async function add(x?: number, y?: number) {
    const el = wall.current;
    // No position given: first free spot in the visible part of the wall, left to right
    const spot = () => {
      const ox = el?.scrollLeft ?? 0, oy = el?.scrollTop ?? 0, w = el?.clientWidth ?? 800, h = el?.clientHeight ?? 500;
      for (let gy = oy + 24; gy + NOTE < oy + h + NOTE; gy += NOTE + 20)
        for (let gx = ox + 24; gx + NOTE < ox + w; gx += NOTE + 24)
          if (!ideas.some((i) => Math.abs(i.x - gx) < NOTE * 0.8 && Math.abs(i.y - gy) < NOTE * 0.8)) return [gx, gy];
      return [ox + 40 + Math.random() * 80, oy + 40 + Math.random() * 80];
    };
    const [cx, cy] = x !== undefined && y !== undefined ? [x, y] : spot();
    const keys = Object.keys(COLORS);
    const idea: Idea = { id: crypto.randomUUID(), text: "", color: keys[ideas.length % keys.length], x: clamp(cx, 0, W - NOTE), y: clamp(cy, 0, H - NOTE), created_at: new Date().toISOString() };
    setIdeas((a) => [...a, idea]);
    setEditing(idea.id);
    const { error } = await supabase.from("ideas").insert({ id: idea.id, text: " ", color: idea.color, x: idea.x, y: idea.y });
    if (error) { setIdeas((a) => a.filter((i) => i.id !== idea.id)); toast("error", t("saveError")); }
  }

  async function saveText(idea: Idea, text: string) {
    setEditing(null);
    if (!text.trim()) return remove(idea, true);
    patch(idea.id, { text });
    await supabase.from("ideas").update({ text }).eq("id", idea.id);
  }

  async function remove(idea: Idea, silent = false) {
    setIdeas((a) => a.filter((i) => i.id !== idea.id));
    await supabase.from("ideas").delete().eq("id", idea.id);
    if (!silent) toast("ok", t("deleted"));
  }

  async function recolor(idea: Idea, color: string) {
    patch(idea.id, { color });
    await supabase.from("ideas").update({ color }).eq("id", idea.id);
  }

  async function sendToBoard(idea: Idea) {
    const { data: board } = await supabase.from("boards").select("id, board_lists(id, position)").eq("slug", "general").single();
    const list = (board?.board_lists as { id: string; position: number }[] | undefined)?.sort((a, b) => a.position - b.position)[0];
    if (!board || !list) return toast("error", t("saveError"));
    const id = crypto.randomUUID();
    const { error } = await supabase.from("cards").insert({ id, board_id: board.id, list_id: list.id, title: idea.text.trim().slice(0, 200), position: Date.now() / 1000, created_by: meId });
    if (error) return toast("error", t("saveError"));
    await supabase.from("card_assignees").insert({ card_id: id, user_id: meId });
    toast("ok", t("sent"));
  }

  function down(e: React.PointerEvent, idea: Idea) {
    if (editing === idea.id || (e.target as HTMLElement).closest("button,textarea")) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    drag.current = { id: idea.id, dx: e.clientX - box.left, dy: e.clientY - box.top, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setLifted(idea.id);
  }
  function move(e: React.PointerEvent) {
    const d = drag.current, el = wall.current;
    if (!d || !el) return;
    const r = el.getBoundingClientRect();
    d.moved = true;
    patch(d.id, { x: clamp(e.clientX - r.left + el.scrollLeft - d.dx, 0, W - NOTE), y: clamp(e.clientY - r.top + el.scrollTop - d.dy, 0, H - NOTE) });
  }
  async function up(idea: Idea) {
    const d = drag.current;
    drag.current = null;
    setLifted(null);
    if (!d) return;
    if (!d.moved) { setEditing(idea.id); return; }
    const cur = ideas.find((i) => i.id === idea.id);
    if (cur) await supabase.from("ideas").update({ x: cur.x, y: cur.y }).eq("id", idea.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">{t("hint")}</p>
        <button onClick={() => add()} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-medium text-brand-contrast">
          <Plus size={16} /> {t("new")}
        </button>
      </div>
      <div ref={wall} onDoubleClick={(e) => {
             if (e.target !== e.currentTarget.firstChild) return;
             const r = e.currentTarget.getBoundingClientRect();
             add(e.clientX - r.left + e.currentTarget.scrollLeft - NOTE / 2, e.clientY - r.top + e.currentTarget.scrollTop - NOTE / 2);
           }}
           className="panel relative h-[62vh] min-h-[420px] overflow-auto [perspective:1400px]">
        <div className="relative" style={{
          width: W, height: H,
          backgroundImage: "radial-gradient(circle, color-mix(in srgb, var(--contour) 35%, transparent) 1px, transparent 1.4px)",
          backgroundSize: "28px 28px",
        }}>
          {!ideas.length && (
            <p className="pointer-events-none absolute top-24 left-1/2 w-72 -translate-x-1/2 text-center text-sm text-muted">{t("empty")}</p>
          )}
          {ideas.map((idea) => {
            const up_ = lifted === idea.id;
            return (
              <div key={idea.id}
                   onPointerDown={(e) => down(e, idea)} onPointerMove={move} onPointerUp={() => up(idea)} onPointerCancel={() => up(idea)}
                   onPointerLeave={(e) => { if (!drag.current) (e.currentTarget.style.transform = ""); }}
                   onMouseMove={(e) => {
                     if (drag.current) return;
                     const r = e.currentTarget.getBoundingClientRect();
                     const rx = ((e.clientY - r.top) / r.height - 0.5) * -10, ry = ((e.clientX - r.left) / r.width - 0.5) * 10;
                     e.currentTarget.style.transform = `rotate(${tiltOf(idea.id)}deg) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(8px)`;
                   }}
                   className="no-select group absolute flex touch-none flex-col rounded-[6px] p-3 text-[#2a2a22] transition-[box-shadow,transform] duration-200 ease-out [transform-style:preserve-3d] motion-reduce:transition-none"
                   style={{
                     left: idea.x, top: idea.y, width: NOTE, minHeight: NOTE, background: COLORS[idea.color] ?? COLORS.sand,
                     transform: up_ ? `rotate(0deg) scale(1.06) translateZ(40px)` : `rotate(${tiltOf(idea.id)}deg)`,
                     boxShadow: up_ ? "0 24px 40px -12px rgb(0 0 0 / 0.35), 0 4px 8px rgb(0 0 0 / 0.12)" : "0 1px 1px rgb(0 0 0 / 0.08), 0 10px 20px -12px rgb(0 0 0 / 0.3)",
                     zIndex: up_ ? 20 : editing === idea.id ? 10 : 1, cursor: up_ ? "grabbing" : "grab",
                   }}>
                {editing === idea.id ? (
                  <textarea autoFocus defaultValue={idea.text.trim()} onBlur={(e) => saveText(idea, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur(); }}
                            placeholder={t("placeholder")} aria-label={t("placeholder")}
                            className="min-h-[120px] w-full flex-1 resize-none bg-transparent text-sm leading-snug outline-none placeholder:text-[#2a2a22]/50" />
                ) : (
                  <p className="flex-1 text-sm leading-snug break-words whitespace-pre-wrap">{idea.text.trim() || <span className="opacity-50">{t("placeholder")}</span>}</p>
                )}
                <div className="mt-2 flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  {Object.entries(COLORS).map(([k, c]) => (
                    <button key={k} onClick={() => recolor(idea, k)} aria-label={t("color", { color: k })}
                            className={`size-3.5 rounded-full ring-1 ring-black/15 ${idea.color === k ? "ring-2 ring-black/40" : ""}`} style={{ background: c }} />
                  ))}
                  <span className="flex-1" />
                  {idea.text.trim() && (
                    <button onClick={() => sendToBoard(idea)} aria-label={t("send")} title={t("send")} className="rounded p-1 hover:bg-black/10"><SendHorizontal size={13} /></button>
                  )}
                  <button onClick={() => remove(idea)} aria-label={t("delete")} title={t("delete")} className="rounded p-1 hover:bg-black/10"><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function clamp(v: number, a: number, b: number) { return Math.min(b, Math.max(a, v)); }
