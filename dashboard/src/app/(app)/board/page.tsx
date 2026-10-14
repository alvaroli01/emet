import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { loadBoard, BOARD_TABLES } from "@/lib/boards";
import { LazyBoard as Board } from "@/components/board/board-lazy";
import { LiveRefresh } from "@/components/live-refresh";
import { PageHero } from "@/components/shell/page-hero";
import { ProgressRing } from "@/components/shell/hero-visuals";
import { KanbanSquare } from "lucide-react";

export default async function GeneralBoardPage() {
  const t = await getTranslations("board");
  const { viewer, me } = await getSession();
  const data = await loadBoard("general");
  if (!data) notFound();
  const th = await getTranslations("hero");
  const tn = await getTranslations("nav");
  const today = new Date().toISOString().slice(0, 10);
  const open = data.cards.filter((c) => !c.completed_at);
  const done = data.cards.length - open.length;
  const mine = open.filter((c) => c.assignees.includes(me.id)).length;
  const late = open.filter((c) => c.due_at && c.due_at.slice(0, 10) < today).length;
  return (
    <div className="space-y-4">
      <LiveRefresh tables={BOARD_TABLES} />
      <PageHero
        section={{ label: tn("generalBoard"), icon: <KanbanSquare size={16} /> }}
        title={th("board.title", { name: me.full_name.split(" ")[0] })}
        subtitle={t("generalHint")}
        lines={[
          ...(late ? [{ text: th("board.late", { count: late }), tone: "bad" as const }] : []),
          ...(mine ? [{ text: th("board.mine", { count: mine }), tone: "info" as const, href: "/my-tasks" }] : [{ text: th("board.none"), tone: "ok" as const }]),
        ]}
        stats={[
          { label: th("board.open"), value: open.length, kind: "num" },
          { label: th("board.done"), value: done, kind: "num" },
        ]}
        visual={<ProgressRing value={done} max={data.cards.length} label={th("board.ring")} />}
      />
      <Suspense>
        <Board data={data} viewer={viewer} />
      </Suspense>
    </div>
  );
}
