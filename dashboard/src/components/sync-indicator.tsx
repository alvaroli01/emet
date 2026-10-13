"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type State = "connecting" | "synced" | "offline";

/** "● Synced" dot: green while the live connection to Supabase Realtime is up. */
export function SyncIndicator() {
  const [state, setState] = useState<State>("connecting");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("emet-live")
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setState("synced");
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") setState("offline");
      });
    const goOffline = () => setState("offline");
    const goOnline = () => setState("connecting");
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      supabase.removeChannel(channel);
    };
  }, []);

  const color = state === "synced" ? "bg-ok" : state === "offline" ? "bg-bad" : "bg-warn";
  const label = state === "synced" ? "Synced" : state === "offline" ? "Offline" : "Connecting";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-muted"
          aria-live="polite">
      <span className={`size-2 rounded-full ${color} ${state === "synced" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}
