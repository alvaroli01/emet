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
import type { ToolProps } from "@/components/tools/types";

const TOOLS: Record<string, (p: ToolProps) => Promise<React.ReactNode>> = {
  finance: FinanceTools,
  customer: CustomerTools,
  marketing: MarketingTools,
  communications: CommunicationsTools,
  "team-leader": TeamLeaderTools,
};

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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

  return (
    <div className="space-y-8">
      <LiveRefresh tables={[...BOARD_TABLES, "kpi_targets", "blockers", "sales", "expenses", "inventory", "prospects",
        "complaints", "content_posts", "campaigns", "design_requests", "experiments", "follower_snapshots",
        "decisions", "morale_checks", "meeting_notes", "outreach", "profiles"]} />

      <header className="rounded-2xl border border-line bg-surface p-5 shadow-sm" style={{ borderTop: `4px solid ${group.color}` }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl leading-none">{group.emoji}</span>
          <h1 className="text-2xl font-semibold tracking-tight">{t(`names.${slug}`)}</h1>
          {session.me.group_id === group.id && (
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: `${group.color}22`, color: group.color }}>
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
      </header>

      {kpis.some((k) => k.group_id === group.id) && (
        <section>
          <h2 className="mb-3 font-semibold">{t("kpis")}</h2>
          <KpiCards kpis={kpis.filter((k) => k.group_id === group.id)} canEdit={editable} />
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">{t("board")}</h2>
        <Suspense><Board data={board} viewer={session.viewer} /></Suspense>
      </section>

      {Tools && await Tools(props)}

      {slug !== "team-leader" && <BlockersTool {...props} onlyThisGroup />}
    </div>
  );
}
