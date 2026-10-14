import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { loadBoard, BOARD_TABLES } from "@/lib/boards";
import { loadKpis } from "@/lib/kpi-data";
import { Avatar, ViewOnlyBadge } from "@/components/ui";
import { LazyBoard as Board } from "@/components/board/board-lazy";
import { KpiCards } from "@/components/kpi-cards";
import { LiveRefresh } from "@/components/live-refresh";
import { BlockersTool } from "@/components/tools/blockers";
import { FinanceTools } from "@/components/tools/finance";
import { CustomerTools } from "@/components/tools/customer";
import { MarketingTools } from "@/components/tools/marketing";
import { CommunicationsTools } from "@/components/tools/communications";
import { TeamLeaderTools } from "@/components/tools/team-leader";
import type { ToolProps, ToolTab } from "@/components/tools/types";
import { SectionTabs } from "@/components/section-tabs";

const TOOLS: Record<string, (p: ToolProps) => Promise<ToolTab[]>> = {
  finance: FinanceTools,
  customer: CustomerTools,
  marketing: MarketingTools,
  communications: CommunicationsTools,
  "team-leader": TeamLeaderTools,
};

export default async function GroupPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const t = await getTranslations("group");
  const session = await getSession();
  const group = session.groups.find((g) => g.slug === slug);
  if (!group) notFound();

  const [board, kpis] = await Promise.all([
    loadBoard(slug),
    loadKpis(session.groups.find((g) => g.slug === "customer")?.id),
  ]);
  if (!board) notFound();
  const members = board.members.filter((m) => m.group_id === group.id);
  const editable = session.canEditGroup(group.id);
  const Tools = TOOLS[slug];
  const props: ToolProps = { group, editable, session, allMembers: board.members };
  const groupKpis = kpis.filter((k) => k.group_id === group.id);
  const tt = await getTranslations("tools");

  return (
    <div className="space-y-6">
      <LiveRefresh tables={[...BOARD_TABLES, "kpi_targets", "blockers", "sales", "expenses", "inventory", "prospects",
        "complaints", "content_posts", "campaigns", "design_requests", "experiments", "follower_snapshots",
        "decisions", "morale_checks", "meeting_notes", "outreach", "profiles"]} />

      <header className="panel contours contours-corner p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span aria-hidden className="grid size-12 place-items-center rounded-xl text-2xl leading-none"
                style={{ background: `color-mix(in srgb, ${group.color} 16%, transparent)` }}>{group.emoji}</span>
          <h1 className="text-2xl font-semibold tracking-tight">{t(`names.${slug}`)}</h1>
          {session.me.group_id === group.id && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">
              <span aria-hidden className="size-1.5 rounded-full" style={{ background: group.color }} />
              {t("yourTeam")}
            </span>
          )}
          {!editable && <ViewOnlyBadge />}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {members.length ? members.map((m) => (
            <div key={m.id} className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pr-3 pl-1">
              <Avatar name={m.full_name} src={m.avatar_url} size={26} />
              <span className="text-sm">{m.full_name}</span>
              {m.role_title && <span className="text-xs text-muted">· {m.role_title}</span>}
            </div>
          )) : <p className="text-sm text-muted">{t("noMembers")}</p>}
        </div>
        {groupKpis.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <KpiCards kpis={groupKpis} canEdit={editable} inline />
          </div>
        )}
      </header>

      <SectionTabs label={t("sections")} initial={tab} tabs={[
        { id: "board", label: t("board"), node: <Suspense><Board data={board} viewer={session.viewer} /></Suspense> },
        ...(Tools ? await Tools(props) : []),
        ...(slug !== "team-leader" ? [{ id: "blockers", label: tt("blockers.title"), node: await BlockersTool({ ...props, onlyThisGroup: true }) }] : []),
      ]} />
    </div>
  );
}
