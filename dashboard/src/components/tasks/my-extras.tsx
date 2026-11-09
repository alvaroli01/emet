import { getLocale, getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { loadBoardById } from "@/lib/boards";
import { LazyBoard } from "@/components/board/board-lazy";
import { loadMyNotionDeadlinesFast } from "@/lib/notion/server";

/** Under "My tasks" on the Tasks page (moved from the old My Tasks page): my private board and my Notion deadlines. */
export async function MyExtras() {
  const t = await getTranslations("myTasks");
  const locale = await getLocale();
  const { me, viewer } = await getSession();
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: myBoardId }, notionAll] = await Promise.all([
    supabase.rpc("my_board"),
    // Late + next 60 days, not done (if I picked a deadlines database)
    loadMyNotionDeadlinesFast(supabase, new Date(Date.parse(today) - 14 * 864e5).toISOString().slice(0, 10), new Date(Date.parse(today) + 60 * 864e5).toISOString().slice(0, 10)),
  ]);
  const myBoard = myBoardId ? await loadBoardById(myBoardId as string, [me.id]) : null;
  const notion = notionAll.items.filter((n) => !n.done).sort((a, b) => a.day.localeCompare(b.day));
  return (
    <>
      {myBoard && (
        <section id="my-board" className="scroll-mt-20">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Lock size={14} /> {t("myBoard")} <span className="font-normal text-muted">· {t("myBoardHint")}</span></h2>
          <div className="panel p-3 sm:p-4"><LazyBoard data={myBoard} viewer={viewer} /></div>
        </section>
      )}
      {notion.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">{t("fromNotion")} <span className="text-muted tabular-nums">· {notion.length}</span></h2>
          <Card className="p-0">
            <ul className="divide-y divide-line">
              {notion.map((n) => (
                <li key={n.id}>
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2/60">
                    <span aria-hidden className="size-2 shrink-0 rounded-full bg-[#a78bfa]" />
                    <span className="min-w-0 flex-1 truncate">{n.title}</span>
                    <span className={`shrink-0 text-xs tabular-nums ${n.day < today ? "text-bad-text" : "text-muted"}`}>
                      {new Date(n.day + "T12:00:00Z").toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}{n.start ? ` · ${n.start}` : ""}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </>
  );
}
