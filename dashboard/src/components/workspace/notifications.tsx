"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bell, UserPlus, MessageSquare, AudioLines, Lightbulb, FileText, Palette, Clock, BarChart3, CheckCheck, ListChecks, X } from "lucide-react";
import { BodyPortal } from "@/components/body-portal";
import { isTaskPopup, dueLabel } from "@/lib/task-popup";
import { PhoneAlerts } from "./phone-alerts";
import { noteValues } from "@/lib/push";
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
  const [popups, setPopups] = useState<Notification[]>([]); // "you got a task" pop-ups on screen right now
  const box = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.read_at).length;

  useEffect(() => {
    const load = () => supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => setItems((data as Notification[] | null) ?? []));
    load();
    const ch = supabase.channel(`notifications-${meId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${meId}` }, (e) => {
        load();
        // A new task for me → pop up on screen (phone/desktop alerts come as push notifications, see PhoneAlerts)
        const n = e.new as Notification | undefined;
        if (e.eventType === "INSERT" && n && isTaskPopup(n)) {
          setPopups((p) => [n, ...p.filter((x) => x.id !== n.id)].slice(0, 3));
          setTimeout(() => setPopups((p) => p.filter((x) => x.id !== n.id)), 9000);
        }
      })
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
    const d = { ...noteValues(n.data), type: n.data.kind ? tk(n.data.kind) : "" };
    return t.has(`kinds.${n.kind}`) ? t(`kinds.${n.kind}`, d) : n.kind;
  };

  return (
    <div ref={box} className="relative">
      {popups.length > 0 && (
        <BodyPortal>
          <div aria-live="polite" className="fixed top-20 right-4 z-[60] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2 max-sm:inset-x-3 max-sm:right-auto max-sm:w-auto">
            {popups.map((n) => {
              const due = dueLabel(n.data.due, locale);
              return (
                <div key={n.id} role="status" className="fade-in flex items-start gap-3 rounded-2xl bg-solid p-3.5 shadow-[var(--shadow-lift)] ring-1 ring-brand/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-white"><ListChecks size={17} /></span>
                  <div className="min-w-0 flex-1 whitespace-normal">
                    <p className="text-xs font-medium text-brand">{t("popupTitle")}</p>
                    <p className="mt-0.5 text-sm leading-snug font-medium">{n.data.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{due ? t("popupDue", { date: due }) : t("popupNoDue")}</p>
                    <button type="button" onClick={() => { setPopups((p) => p.filter((x) => x.id !== n.id)); go(n); }} className="mt-2 rounded-lg bg-brand px-3 py-1 text-xs font-medium text-brand-contrast">{t("popupOpen")}</button>
                  </div>
                  <button type="button" onClick={() => setPopups((p) => p.filter((x) => x.id !== n.id))} aria-label={t("popupClose")} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2"><X size={14} /></button>
                </div>
              );
            })}
          </div>
        </BodyPortal>
      )}
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
          <PhoneAlerts />
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
