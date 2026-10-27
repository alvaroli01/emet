"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BellRing, BellOff, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type State = "loading" | "unsupported" | "ios-install" | "off" | "on" | "blocked";

/** VAPID public key (base64url) → the bytes the browser's PushManager wants. */
function keyBytes(b64: string): Uint8Array {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** "Turn on phone notifications": new tasks, being added to a project, new project files, 1 day left. Works on
 *  Android/desktop browsers; on iPhone only once emet is added to the home screen (Apple's rule). */
export function PhoneAlerts() {
  const t = useTranslations("notifications.phone");
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
      setState(ios && !installed ? "ios-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") { setState("blocked"); return; }
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      const sub = await reg.pushManager.getSubscription();
      // Re-save on every visit: keeps the phone attached to whoever is signed in on it now
      if (sub && Notification.permission === "granted") { await save(sub); setState("on"); } else setState("off");
    }).catch(() => setState("unsupported"));
  }, []);

  async function save(sub: PushSubscription) {
    const j = sub.toJSON();
    return createClient().rpc("save_push_subscription", { p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh ?? "", p_auth: j.keys?.auth ?? "" });
  }
  async function turnOn() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState(permission === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription())
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!) as BufferSource });
      const { error } = await save(sub);
      setState(error ? "off" : "on");
    } catch { setState("off"); } finally { setBusy(false); }
  }
  async function turnOff() {
    setBusy(true);
    try {
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (sub) { await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint); await sub.unsubscribe(); }
      setState("off");
    } finally { setBusy(false); }
  }

  if (state === "loading" || state === "unsupported") return null;
  const row = "flex w-full items-center gap-2 border-b border-line px-4 py-2.5 text-left text-xs";
  if (state === "ios-install") return <p className={`${row} text-muted`}><Smartphone size={13} className="shrink-0" /> {t("iosInstall")}</p>;
  if (state === "blocked") return <p className={`${row} text-muted`}><BellOff size={13} className="shrink-0" /> {t("blocked")}</p>;
  if (state === "on") return (
    <div className={`${row} justify-between text-ok-text`}>
      <span className="flex items-center gap-2"><BellRing size={13} /> {t("on")}</span>
      <button type="button" onClick={turnOff} disabled={busy} className="text-muted underline hover:text-ink">{t("turnOff")}</button>
    </div>
  );
  return (
    <button type="button" onClick={turnOn} disabled={busy} className={`${row} font-medium text-climbed hover:bg-surface-2/60`}>
      <BellRing size={13} /> {busy ? t("turningOn") : t("turnOn")}
    </button>
  );
}
