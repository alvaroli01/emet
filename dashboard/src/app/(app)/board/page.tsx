import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { loadBoard, BOARD_TABLES } from "@/lib/boards";
import { LazyBoard as Board } from "@/components/board/board-lazy";
import { LiveRefresh } from "@/components/live-refresh";

export default async function GeneralBoardPage() {
  const t = await getTranslations("board");
  const { viewer } = await getSession();
  const data = await loadBoard("general");
  if (!data) notFound();
  return (
    <div className="space-y-4">
      <LiveRefresh tables={BOARD_TABLES} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("generalTitle")}</h1>
        <p className="text-sm text-muted">{t("generalHint")}</p>
      </div>
      <Suspense>
        <Board data={data} viewer={viewer} />
      </Suspense>
    </div>
  );
}
