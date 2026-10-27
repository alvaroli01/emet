"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, AlarmClockOff } from "lucide-react";
import { shortDate } from "@/lib/format";
import { memberTaskLists, type MemberTaskItem } from "@/lib/member-tasks";

const SHOW = 12;

/** On anyone's page: the tasks they still have to finish, and the ones they didn't finish on time. */
export function MemberTasks({ tasks, name, isMe }: { tasks: MemberTaskItem[]; name: string; isMe: boolean }) {
  const t = useTranslations("memberTasks");
  const locale = useLocale();
  const { todo, late } = memberTaskLists(tasks);
  const now = Date.now();
  const row = (x: MemberTaskItem, right: React.ReactNode) => {
    const body = <><span className="min-w-0 flex-1 truncate text-sm">{x.title}</span>{right}</>;
    return (
      <li key={x.id}>
        {x.href ? <Link href={x.href} className="flex items-center gap-3 py-2 hover:text-link">{body}</Link> : <div className="flex items-center gap-3 py-2">{body}</div>}
      </li>
    );
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel p-5">
        <h2 className="flex items-center gap-2 font-semibold"><CalendarClock size={16} /> {isMe ? t("todoMe") : t("todo", { name })} <span className="text-sm font-normal text-muted tabular-nums">· {todo.length}</span></h2>
        {todo.length ? (
          <ul className="mt-2 divide-y divide-line">
            {todo.slice(0, SHOW).map((x) => {
              const overdue = !!x.due && Date.parse(x.due.length > 10 ? x.due : `${x.due}T21:59:00Z`) < now;
              return row(x, <span className={`shrink-0 text-xs tabular-nums ${overdue ? "font-semibold text-bad-text" : "text-muted"}`}>{x.due ? (overdue ? t("overdue", { date: shortDate(x.due, locale) }) : shortDate(x.due, locale)) : t("noDate")}</span>);
            })}
          </ul>
        ) : <p className="mt-3 text-sm text-muted">{t("todoNone")}</p>}
        {todo.length > SHOW && <p className="mt-1 text-xs text-muted">{t("more", { count: todo.length - SHOW })}</p>}
      </section>
      <section className="panel p-5">
        <h2 className="flex items-center gap-2 font-semibold"><AlarmClockOff size={16} /> {t("late")} <span className="text-sm font-normal text-muted tabular-nums">· {late.length}</span></h2>
        <p className="text-xs text-muted">{t("lateHint")}</p>
        {late.length ? (
          <ul className="mt-2 divide-y divide-line">
            {late.slice(0, SHOW).map((x) => row(x, <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${x.done ? "bg-warn/15 text-warn-text" : "bg-bad/15 text-bad-text"}`}>
              {x.done ? t("finishedLate", { n: x.daysLate }) : t("stillOpen", { n: x.daysLate })}</span>))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted">{t("lateNone")}</p>}
        {late.length > SHOW && <p className="mt-1 text-xs text-muted">{t("more", { count: late.length - SHOW })}</p>}
      </section>
    </div>
  );
}
