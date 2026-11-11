import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { officeStatus, hm, madridMidnight, madridDay, type Visit } from "@/lib/office";
import { weekStart } from "@/lib/metrics";
import { Avatar } from "@/components/ui";
import type { Member } from "@/lib/boards";
import { OfficeAdmin } from "@/components/tools/office-admin";

/** Team Leaders → Office: everyone's office status and hours, and who has phone alerts off (they miss the 9:00 check-in tap). */
export async function OfficeReview({ people }: { people: Member[] }) {
  const t = await getTranslations("officeReview");
  const supabase = await createClient();
  const now = Date.now();
  const today = madridDay(now);
  const [{ data: setup }, { data: visits }, { data: fines }, { data: away }] = await Promise.all([
    supabase.rpc("office_setup_status"),
    supabase.from("office_visits").select("id, user_id, arrived_at, left_at, forgot").gte("arrived_at", madridMidnight(weekStart(now))).returns<Visit[]>(),
    supabase.from("strikes").select("id, user_id, kind, note").eq("happened_on", today).in("kind", ["late_fine", "late_arrival"]),
    supabase.from("office_absences").select("id, user_id, from_day, to_day, reason").gte("to_day", today).order("from_day"),
  ]);
  const awayNow = new Map((away ?? []).filter((x) => x.from_day <= today).map((x) => [x.user_id, x]));
  const phone = new Map(((setup ?? []) as { user_id: string; has_push: boolean }[]).map((r) => [r.user_id, r]));
  const rows = people.filter((p) => phone.has(p.id)).map((p) => ({ p, s: officeStatus(visits ?? [], p.id, now), ph: phone.get(p.id)! }))
    .sort((a, b) => Number(b.s.inNow) - Number(a.s.inNow) || b.s.todayMs - a.s.todayMs || a.p.full_name.localeCompare(b.p.full_name));
  const notSetUp = rows.filter((r) => !r.ph.has_push);

  return (
    <div className="space-y-4">
      <section className="panel p-5">
        <h3 className="font-semibold">{t("title")}</h3>
        <p className="mt-1 text-sm text-muted">{t("hint")}</p>
        <ul className="mt-3 divide-y divide-line">
          {rows.map(({ p, s, ph }) => (
            <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
              <Avatar name={p.full_name} src={p.avatar_url} size={28} />
              <Link href={`/team/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{p.full_name}</Link>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.inNow ? "bg-ok/15 text-ok-text" : s.paused ? "bg-warn/15 text-warn-text" : "bg-surface-2 text-muted"}`}>
                {awayNow.has(p.id) ? t("away", { reason: awayNow.get(p.id)!.reason, to: awayNow.get(p.id)!.to_day }) : s.inNow ? t("inSince", { time: s.since ?? "" }) : s.paused ? t("pausedSince", { time: s.since ?? "" }) : t("out")}
              </span>
              <span className="whitespace-nowrap text-right text-xs tabular-nums text-muted sm:w-48">{t("hours", { today: hm(s.todayMs), week: hm(s.weekMs) })}</span>
              <span className={`w-40 text-right text-xs ${ph.has_push ? "text-muted" : "font-medium text-bad-text"}`}>{ph.has_push ? t("pushOn") : t("pushOff")}</span>
            </li>
          ))}
        </ul>
      </section>
      <OfficeAdmin people={rows.map((r) => ({ id: r.p.id, name: r.p.full_name }))} fines={fines ?? []} away={away ?? []} today={today} />
      {notSetUp.length > 0 && (
        <section className="panel p-5">
          <h3 className="font-semibold">{t("missingTitle", { n: notSetUp.length })}</h3>
          <p className="mt-1 text-sm text-muted">{t("missingHint")}</p>
          <p className="mt-2 text-sm">{notSetUp.map((r) => r.p.full_name).join(", ")}</p>
        </section>
      )}
      <section className="panel p-5 text-sm">
        <h3 className="font-semibold">{t("strikesTitle")}</h3>
        <p className="mt-1 text-muted">{t("strikesHint")}</p>
        <Link href="/g/team-leader?tab=strikes" className="mt-2 inline-block text-xs underline underline-offset-2 hover:text-ink">{t("openStrikes")}</Link>
      </section>
    </div>
  );
}
