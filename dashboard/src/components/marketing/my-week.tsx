"use client";

import { useLocale, useTranslations } from "next-intl";
import { BarChart3, FileText, Palette, CalendarClock } from "lucide-react";
import { shortDate } from "@/lib/format";
import { hits, type Content, type Metric } from "@/lib/marketing";
import { MetricCard, Panel, Empty } from "@/components/finance/overview";

/** "My week": what this person owes the marketing machine right now — so nobody has to ask. */
export function MyWeek({ me, items, metrics, briefs, designs, today }: {
  me: string; items: Content[]; metrics: Metric[]; briefs: { id: string; title: string; status: string; driver_id: string | null }[];
  designs: { id: string; title: string; status: string; assignee_id: string | null; requested_at: string }[]; today: string;
}) {
  const t = useTranslations("marketing.myWeek");
  const locale = useLocale();
  const now = Date.parse(today + "T12:00:00Z");
  const mine = items.filter((c) => c.owner_id === me);
  const due = mine.filter((c) => c.status !== "posted" && c.planned_for && c.planned_for <= new Date(now + 7 * 864e5).toISOString().slice(0, 10))
    .sort((a, b) => a.planned_for!.localeCompare(b.planned_for!));
  // Numbers to log: each posted item needs a 24h, 48h and 7-day reading once that age is reached
  const toLog = mine.filter((c) => c.posted_at).flatMap((c) => ([24, 48, 168] as const)
    .filter((a) => Date.parse(c.posted_at!) + a * 36e5 <= Date.now() && !metrics.some((m) => m.content_id === c.id && m.age_hours === a))
    .map((a) => ({ c, a })));
  const myBriefs = briefs.filter((b) => b.driver_id === me && b.status !== "reviewed");
  const myDesigns = designs.filter((d) => d.assignee_id === me && d.status !== "delivered");
  const h = hits(mine, metrics);
  const posted30 = mine.filter((c) => c.posted_at && Date.parse(c.posted_at) >= now - 30 * 864e5).length;
  const Row = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => <li className="flex items-start gap-2 rounded-lg bg-surface-2/60 px-3 py-2 text-sm">{icon}<span className="min-w-0">{children}</span></li>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label={t("posted30")} value={String(posted30)} explain={t("posted30Explain")} />
        <MetricCard label={t("hits")} value={String(h.filter((x) => x.hit).length)} explain={t("hitsExplain")} />
        <MetricCard label={t("open")} value={String(due.length + toLog.length + myBriefs.length + myDesigns.length)} explain={t("openExplain")} tone={toLog.length ? "warn" : undefined} />
      </div>
      <Panel title={t("todo")}>
        {due.length + toLog.length + myBriefs.length + myDesigns.length ? (
          <ul className="space-y-1.5">
            {toLog.map(({ c, a }) => <Row key={c.id + a} icon={<BarChart3 size={15} className="mt-0.5 shrink-0 text-warn-text" />}>{t("logFor", { title: c.title, age: t(`age.${a}`) })}</Row>)}
            {due.map((c) => <Row key={c.id} icon={<CalendarClock size={15} className="mt-0.5 shrink-0 text-muted" />}>{c.title} <span className="text-muted">· {t(`status.${c.status}`)} · {shortDate(c.planned_for!, locale)}</span></Row>)}
            {myBriefs.map((b) => <Row key={b.id} icon={<FileText size={15} className="mt-0.5 shrink-0 text-muted" />}>{b.title} <span className="text-muted">· {t(`brief.${b.status}`)}</span></Row>)}
            {myDesigns.map((d) => <Row key={d.id} icon={<Palette size={15} className="mt-0.5 shrink-0 text-muted" />}>{d.title} <span className="text-muted">· {t("designSince", { date: shortDate(d.requested_at, locale) })}</span></Row>)}
          </ul>
        ) : <Empty text={t("allClear")} />}
      </Panel>
    </div>
  );
}
