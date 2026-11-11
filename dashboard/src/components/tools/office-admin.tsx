"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarOff, LogIn, LogOut, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";

type Person = { id: string; name: string };
type Fine = { id: string; user_id: string; kind: string; note: string | null };
type Away = { id: string; user_id: string; from_day: string; to_day: string; reason: string };

/** Team Leaders → Office: check someone in/out by hand (now or at a time), delete today's wrong fines, and mark people
 *  away (trip, sick…) so they get no check-in notifications and no automatic fines. */
export function OfficeAdmin({ people, fines, away, today }: { people: Person[]; fines: Fine[]; away: Away[]; today: string }) {
  const t = useTranslations("officeAdmin");
  const router = useRouter();
  const toast = useToast();
  const supabase = useMemo(() => createClient(), []);
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "—";
  const [who, setWho] = useState(people[0]?.id ?? "");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState({ user: people[0]?.id ?? "", from: today, to: today, reason: "" });

  async function set(action: "in" | "out") {
    setBusy(true);
    // An optional time today (Spanish time, the database converts it and refuses the future); empty = now
    const { error } = await supabase.rpc("office_leader_set", { p_user: who, p_action: action, p_time: time || null });
    setBusy(false);
    if (error) { toast("error", error.message.replace(/^emet: /, "")); return; }
    toast("ok", action === "in" ? t("checkedIn", { name: name(who) }) : t("checkedOut", { name: name(who) }));
    setTime(""); router.refresh();
  }
  async function delFine(f: Fine) {
    if (!confirm(t("confirmFine", { name: name(f.user_id) }))) return;
    const { error } = await supabase.from("strikes").delete().eq("id", f.id);
    if (error) { toast("error", t("error")); return; }
    toast("ok", t("fineDeleted")); router.refresh();
  }
  async function addAway() {
    if (!a.reason.trim() || a.to < a.from) { toast("error", t("awayInvalid")); return; }
    setBusy(true);
    const { error } = await supabase.from("office_absences").insert({ user_id: a.user, from_day: a.from, to_day: a.to, reason: a.reason.trim() });
    setBusy(false);
    if (error) { toast("error", t("error")); return; }
    toast("ok", t("awaySaved", { name: name(a.user) })); setA({ ...a, reason: "" }); router.refresh();
  }
  async function delAway(x: Away) {
    const { error } = await supabase.from("office_absences").delete().eq("id", x.id);
    if (error) { toast("error", t("error")); return; }
    router.refresh();
  }
  const field = "rounded-xl border border-line bg-surface px-3 py-2 text-sm";

  return (
    <>
      <section className="panel space-y-3 p-5">
        <h3 className="font-semibold">{t("fixTitle")}</h3>
        <p className="text-sm text-muted">{t("fixHint")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={who} onChange={(e) => setWho(e.target.value)} className={field}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <label className="flex items-center gap-1.5 text-xs text-muted">{t("at")}<input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} /></label>
          <button onClick={() => set("in")} disabled={busy || !who} className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-brand-contrast disabled:opacity-60"><LogIn size={14} /> {t("in")}</button>
          <button onClick={() => set("out")} disabled={busy || !who} className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-3.5 py-2 text-sm font-medium hover:bg-line disabled:opacity-60"><LogOut size={14} /> {t("out")}</button>
        </div>
        <p className="text-xs text-muted">{t("timeHint")}</p>
      </section>

      <section className="panel space-y-3 p-5">
        <h3 className="font-semibold">{t("finesTitle")}</h3>
        {fines.length ? (
          <ul className="divide-y divide-line">
            {fines.map((f) => (
              <li key={f.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate"><span className="font-medium">{name(f.user_id)}</span> · {f.kind === "late_arrival" ? t("fineStrike") : t("fine3")}
                  {f.note && <span className="text-muted"> · {f.note}</span>}</span>
                <button onClick={() => delFine(f)} className="flex items-center gap-1 text-xs text-bad-text hover:underline"><Trash2 size={12} /> {t("delete")}</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">{t("noFines")}</p>}
      </section>

      <section className="panel space-y-3 p-5">
        <h3 className="flex items-center gap-1.5 font-semibold"><CalendarOff size={16} /> {t("awayTitle")}</h3>
        <p className="text-sm text-muted">{t("awayHint")}</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={a.user} onChange={(e) => setA({ ...a, user: e.target.value })} className={field}>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <label className="flex items-center gap-1.5 text-xs text-muted">{t("from")}<input type="date" value={a.from} onChange={(e) => setA({ ...a, from: e.target.value, to: e.target.value > a.to ? e.target.value : a.to })} className={field} /></label>
          <label className="flex items-center gap-1.5 text-xs text-muted">{t("to")}<input type="date" value={a.to} min={a.from} onChange={(e) => setA({ ...a, to: e.target.value })} className={field} /></label>
          <input value={a.reason} onChange={(e) => setA({ ...a, reason: e.target.value })} maxLength={120} placeholder={t("reasonPlaceholder")} className={`${field} min-w-48 flex-1`} />
          <button onClick={addAway} disabled={busy} className="rounded-xl bg-brand px-3.5 py-2 text-sm font-medium text-brand-contrast disabled:opacity-60">{t("awaySave")}</button>
        </div>
        {away.length > 0 && (
          <ul className="divide-y divide-line">
            {away.map((x) => (
              <li key={x.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate"><span className="font-medium">{name(x.user_id)}</span> · {x.from_day === x.to_day ? x.from_day : `${x.from_day} → ${x.to_day}`} · {x.reason}</span>
                <button onClick={() => delAway(x)} className="flex items-center gap-1 text-xs text-muted hover:text-bad-text"><Trash2 size={12} /> {t("delete")}</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
