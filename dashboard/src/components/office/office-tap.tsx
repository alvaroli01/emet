"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Briefcase, Building2, Check, Loader2, LogOut, MapPin, Utensils } from "lucide-react";

type State = { kind: "none" } | { kind: "in"; since: string } | { kind: "lunch"; since: string } | { kind: "outside"; since: string; note: string };
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

  const big = "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-semibold disabled:opacity-60";
  const spin = (a: Action) => busy === a ? <Loader2 size={18} className="animate-spin" /> : null;

  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-6">
      <section className="panel space-y-4 p-5">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Building2 size={20} /> {t("title")}</h1>
        <p className="text-sm text-muted">
          {state.kind === "in" ? t("inSince", { time: state.since }) : state.kind === "lunch" ? t("lunchUntil", { time: state.since }) : state.kind === "outside" ? t("outsideSince", { time: state.since, note: state.note }) : t("notIn")}
        </p>

        {!workday ? <p className="text-sm text-muted">{t("weekend")}</p> : (
          <>
            {state.kind !== "in" && (
              <button onClick={() => send("in")} disabled={!!busy} className={`${big} bg-brand text-brand-contrast`}>{spin("in") ?? <MapPin size={18} />} {t("atOffice")}</button>
            )}
            {state.kind === "in" && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => send("lunch")} disabled={!!busy} className={`${big} bg-surface-2 text-sm hover:bg-line`}>{spin("lunch") ?? <Utensils size={16} />} {t("lunch")}</button>
                <button onClick={() => send("out")} disabled={!!busy} className={`${big} bg-surface-2 text-sm hover:bg-line`}>{spin("out") ?? <LogOut size={16} />} {t("checkOut")}</button>
              </div>
            )}
            {far !== null && (
              <div className="space-y-2 rounded-xl bg-bad/10 p-3 text-sm">
                <p className="text-bad-text">{t("farWarn", { m: far })}</p>
                <button onClick={() => send("out", { anyway: true })} disabled={!!busy} className="text-xs font-medium underline underline-offset-2">{t("farAnyway")}</button>
              </div>
            )}
            {state.kind === "outside" && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => send("still")} disabled={!!busy} className={`${big} bg-surface-2 text-sm hover:bg-line`}>{spin("still") ?? <Check size={16} />} {t("still")}</button>
                <button onClick={() => send("done")} disabled={!!busy} className={`${big} bg-surface-2 text-sm hover:bg-line`}>{spin("done") ?? <LogOut size={16} />} {t("done")}</button>
              </div>
            )}
            {state.kind === "none" && outsideDay && (
              <div className="space-y-2 border-t border-line pt-4">
                <p className="text-sm font-medium">{t("outsideTitle")}</p>
                <input id="outside-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={t("notePlaceholder")}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm" />
                <button onClick={() => send("outside", { note })} disabled={!!busy || !note.trim()} className={`${big} bg-surface-2 hover:bg-line`}>{spin("outside") ?? <Briefcase size={18} />} {t("workingOutside")}</button>
                <p className="text-xs text-muted">{t("outsideHint")}</p>
              </div>
            )}
          </>
        )}
        {msg && <p className={`rounded-xl px-3 py-2 text-sm ${msg.ok ? "bg-ok/15 text-ok-text" : "bg-bad/10 text-bad-text"}`}>{msg.text}</p>}
      </section>
      <section className="panel p-5 text-xs text-muted">
        <p className="mb-1 font-medium uppercase tracking-wide">{t("rulesTitle")}</p>
        <ul className="list-disc space-y-1 pl-4">{(["r1", "r2", "r5", "r3", "r4"] as const).map((k) => <li key={k}>{t(k)}</li>)}</ul>
      </section>
    </div>
  );
}
