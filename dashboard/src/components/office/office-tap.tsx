"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Briefcase, ChevronRight, Loader2, LogOut, MapPin, Utensils } from "lucide-react";

type State = { kind: "none" } | { kind: "in"; since: string; at: string } | { kind: "lunch"; since: string; at: string } | { kind: "outside"; since: string; at: string; note: string };
type Action = "in" | "out" | "lunch" | "outside" | "still" | "done";

/** The page a check-in notification opens: one tap reads the phone's position and emet decides (see /api/office/tap). */
export function OfficeTap({ state, workday, outsideDay, go }: { state: State; workday: boolean; outsideDay: boolean; go?: string }) {
  const t = useTranslations("officeTap");
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [far, setFar] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const ran = useRef(false);

  const send = useCallback((action: Action, extra: Record<string, unknown> = {}) => {
    if (!navigator.geolocation) { setMsg({ ok: false, text: t("noLocation") }); return; }
    setBusy(action); setMsg(null); setFar(null);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const r = await fetch("/api/office/tap", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, ...extra }) }).catch(() => null);
      const j = (r ? await r.json().catch(() => null) : null) as { status?: string; distance?: number; time?: string } | null;
      setBusy(null);
      const s = j?.status ?? "error";
      if (s === "far") { setFar(j?.distance ?? 0); return; }
      if (s === "too-far-outside") setTimeout(() => document.getElementById("outside-note")?.focus(), 50); // Mon/Wed/Fri away from Dock: say what you're doing
      const good = ["in", "out", "lunch", "outside", "outside-still", "outside-done", "already-in"].includes(s);
      setMsg({ ok: good, text: t.has(`s.${s}`) ? t(`s.${s}`, { m: j?.distance ?? 0, time: j?.time ?? "" }) : t("s.error") });
      router.refresh();
    }, (e) => { setBusy(null); setMsg({ ok: false, text: e.code === e.PERMISSION_DENIED ? t("blocked") : t("noLocation") }); },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }, [t, router]);

  // Opened from a notification: do what it asked straight away (one tap)
  useEffect(() => {
    if (ran.current || !go) return;
    ran.current = true;
    if (go === "in" && state.kind !== "in") send("in");
    if (go === "out" && state.kind === "in") send("out");
    if (go === "still" && state.kind === "outside") send("still");
  }, [go, state.kind, send]);

  // Live clock: time at Dock / outside so far, or minutes of lunch left
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(id); }, []);
  const over = state.kind === "lunch" && now > Date.parse(state.at); // eating longer than the hour: counts up in red
  const mins = state.kind === "none" ? 0 : Math.round(Math.abs(state.kind === "lunch" ? Date.parse(state.at) - now : now - Date.parse(state.at)) / 60e3);
  const clock = `${over ? "+" : ""}${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, "0")}`;
  const tone = over ? "ring-bad text-bad-text" : { none: "ring-line text-ink", in: "ring-ok text-ok-text", lunch: "ring-warn text-warn-text", outside: "ring-brand text-ink" }[state.kind];
  const primary: Action | null = !workday ? null : state.kind === "in" ? "out" : state.kind === "outside" ? "still" : "in";
  const label = state.kind === "in" ? t("inSince", { time: state.since }) : state.kind === "lunch" ? t("lunchUntil", { time: state.since })
    : state.kind === "outside" ? t("outsideSince", { time: state.since, note: state.note }) : workday ? t("notIn") : t("weekend");

  // A secondary choice: a full-width row (icon, label, chevron) — long words wrap instead of overflowing
  const row = (a: Action, icon: React.ReactNode, text: string, extra?: Record<string, unknown>, off?: boolean) => (
    <button key={a} onClick={() => send(a, extra)} disabled={!!busy || off}
      className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:bg-line disabled:opacity-50">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface">{busy === a ? <Loader2 size={15} className="animate-spin" /> : icon}</span>
      <span className="min-w-0 flex-1 leading-snug">{text}</span>
      <ChevronRight size={16} className="shrink-0 text-muted" />
    </button>
  );

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <h1 className="text-center text-sm font-medium text-muted">{t("title")}</h1>

      {/* The one big thing: a round button that is also the status — tap it to do the main action */}
      <div className="my-8 flex flex-col items-center">
        <button onClick={() => primary && send(primary)} disabled={!primary || !!busy} aria-label={primary ? t(primary === "in" ? "atOffice" : primary === "out" ? "checkOut" : "still") : label}
          className={`relative grid size-56 place-items-center rounded-full bg-surface ring-[10px] ${tone} shadow-[0_0_80px_-20px_currentColor] transition-transform active:scale-95 disabled:active:scale-100`}>
          {state.kind === "none" && workday && <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-brand/30 motion-reduce:hidden" />}
          <span className="flex flex-col items-center gap-1">
            {busy && busy === primary ? <Loader2 size={34} className="animate-spin" />
              : state.kind === "none" ? <MapPin size={38} /> : <span className="readout text-5xl font-semibold tabular-nums tracking-tight">{clock}</span>}
            <span className="max-w-40 text-center text-sm font-semibold leading-tight">
              {state.kind === "none" ? (workday ? t("atOffice") : t("weekend")) : state.kind === "in" ? t("checkOut") : state.kind === "outside" ? t("still") : over ? t("lunchOver") : t("lunchLeft")}
            </span>
          </span>
        </button>
        <p className="mt-5 max-w-72 text-center text-sm text-muted">{label}</p>
      </div>

      {msg && <p className={`mb-4 rounded-2xl px-4 py-3 text-sm ${msg.ok ? "bg-ok/15 text-ok-text" : "bg-bad/10 text-bad-text"}`}>{msg.text}</p>}
      {far !== null && (
        <div className="mb-4 space-y-2 rounded-2xl bg-bad/10 p-4 text-sm">
          <p className="text-bad-text">{t("farWarn", { m: far })}</p>
          <button onClick={() => send("out", { anyway: true })} disabled={!!busy} className="text-xs font-medium underline underline-offset-2">{t("farAnyway")}</button>
        </div>
      )}

      {workday && (
        <div className="space-y-2">
          {state.kind === "in" && row("lunch", <Utensils size={15} />, t("lunch"))}
          {state.kind === "lunch" && row("in", <MapPin size={15} />, t("atOffice"))}
          {state.kind === "outside" && <>{row("in", <MapPin size={15} />, t("atOffice"))}{row("done", <LogOut size={15} />, t("done"))}</>}
          {state.kind === "none" && outsideDay && (
            <div className="space-y-2 rounded-2xl bg-surface-2 p-4">
              <p className="text-sm font-medium">{t("outsideTitle")}</p>
              <input id="outside-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t("notePlaceholder")}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm" />
              <button onClick={() => send("outside", { note })} disabled={!!busy || !note.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-brand-contrast disabled:opacity-50">
                {busy === "outside" ? <Loader2 size={16} className="animate-spin" /> : <Briefcase size={16} />} {t("workingOutside")}
              </button>
              <p className="text-xs text-muted">{t("outsideHint")}</p>
            </div>
          )}
        </div>
      )}

      <details className="mt-6 rounded-2xl bg-surface-2/60 p-4 text-xs text-muted">
        <summary className="cursor-pointer text-sm font-medium text-ink">{t("rulesTitle")}</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">{(["r1", "r2", "r5", "r3", "r4"] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul>
      </details>
    </div>
  );
}
