"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bell, UserPlus, MessageSquare, AudioLines, Lightbulb, FileText, Palette, Clock, BarChart3, CheckCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/format";

type Notification = { id: string; kind: string; data: Record<string, string>; link: string | null; read_at: string | null; created_at: string };
const ICON: Record<string, typeof Bell> = {
  assigned: UserPlus, card_comment: MessageSquare, meeting: AudioLines, idea: Lightbulb, idea_comment: MessageSquare,
  doc_shared: FileText, design_request: Palette, due_soon: Clock, report: BarChart3,
};

/** The bell: everything that needs you, in one place, live. */
export function NotificationsBell({ meId }: { meId: string }) {
  const t = useTranslations("notifications");
  const tk = useTranslations("meetings.kindOne");
  const locale = useLocale();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    const load = () => supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => setItems((data as Notification[] | null) ?? []));
    load();
    const ch = supabase.channel(`notifications-${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${meId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [meId, supabase]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  async function go(n: Notification) {
    setOpen(false);
    if (!n.read_at) {
      setItems((x) => x.map((y) => (y.id === n.id ? { ...y, read_at: new Date().toISOString() } : y)));
      await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
    }
    if (n.link) router.push(n.link);
  }
  async function readAll() {
    const now = new Date().toISOString();
    setItems((x) => x.map((y) => ({ ...y, read_at: y.read_at ?? now })));
    await supabase.from("notifications").update({ read_at: now }).is("read_at", null);
  }

  const text = (n: Notification) => {
    const d = { title: n.data.title ?? "", excerpt: n.data.excerpt ?? "", type: n.data.kind ? tk(n.data.kind) : "" };
    return t.has(`kinds.${n.kind}`) ? t(`kinds.${n.kind}`, d) : n.kind;
  };

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label={t("title", { count: unread })} aria-expanded={open}
              className="relative grid size-9 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink">
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-trail px-1 text-[10px] font-semibold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="panel absolute top-[calc(100%+8px)] right-0 z-50 w-[min(380px,calc(100vw-24px))] overflow-hidden p-0 shadow-[var(--shadow-lift)] max-sm:fixed max-sm:inset-x-3 max-sm:top-[4.5rem] max-sm:w-auto max-sm:bg-solid" role="dialog" aria-label={t("heading")}>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="font-semibold">{t("heading")}</p>
            {unread > 0 && <button onClick={readAll} className="flex items-center gap-1 text-xs text-muted hover:text-ink"><CheckCheck size={14} /> {t("readAll")}</button>}
          </div>
          <ul className="max-h-[min(70vh,520px)] overflow-y-auto">
            {items.length ? items.map((n) => {
              const Icon = ICON[n.kind] ?? Bell;
              return (
                <li key={n.id}>
                  <button onClick={() => go(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left transition max-sm:whitespace-normal hover:bg-surface-2/70 ${n.read_at ? "" : "bg-[color-mix(in_srgb,var(--climbed)_6%,transparent)]"}`}>
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-muted"><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-snug ${n.read_at ? "text-muted" : ""}`}>{text(n)}</span>
                      <span className="mt-0.5 block text-xs text-muted">{timeAgo(n.created_at, locale)}</span>
                    </span>
                    {!n.read_at && <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-trail" />}
                  </button>
                </li>
              );
            }) : <li className="px-4 py-10 text-center text-sm text-muted">{t("empty")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
