import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptKey } from "./ai/keys.ts";
import { parseEvents, type GEvent } from "./gcal.ts";

const MAX = 2 * 1024 * 1024;

/** Downloads a Google iCal link: 5-second timeout, 2 MB cap. Server only. */
export async function fetchIcal(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(5000), cache: "no-store", redirect: "error" });
  if (!res.ok) throw new Error(`google ${res.status}`);
  const text = await res.text();
  if (text.length > MAX) throw new Error("too big");
  return text;
}

export type MyGoogle = { status: "connected" | "not_connected" | "unreachable"; events: GEvent[] };

/** My own Google Calendar events for fromDay..toDay (RLS returns only my row). Never throws. */
export async function loadMyGoogleEvents(supabase: SupabaseClient, fromDay: string, toDay: string, fetchImpl: typeof fetch = fetch): Promise<MyGoogle> {
  const { data } = await supabase.from("google_calendars").select("url_iv, url_data").maybeSingle();
  if (!data) return { status: "not_connected", events: [] };
  try {
    const url = decryptKey({ key_iv: data.url_iv, key_data: data.url_data });
    return { status: "connected", events: parseEvents(await fetchIcal(url, fetchImpl), fromDay, toDay) };
  } catch {
    return { status: "unreachable", events: [] };
  }
}
