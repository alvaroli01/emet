import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@/components/ui";
import { eur, timeAgo } from "@/lib/format";

export type ActivityEntry = {
  id: number;
  user_id: string | null;
  group_id: string | null;
  action: "insert" | "update" | "delete";
  entity: string;
  summary: { label?: string | null; amount?: number | string; moved_to?: string };
  created_at: string;
};

const KNOWN = new Set(["cards", "card_comments", "sales", "expenses", "inventory", "prospects", "complaints", "content_posts",
  "campaigns", "design_requests", "experiments", "meeting_notes", "outreach", "decisions", "blockers", "kpi_targets"]);

function quote(s?: string | null) {
  if (!s) return "";
  return `“${s.length > 48 ? s.slice(0, 47) + "…" : s}”`;
}

/** Turns a log row into a short translated sentence: "logged a €120 sale", "moved “Book room” to Done" */
export function useDescribe() {
  const t = useTranslations("activity");
  const tl = useTranslations("board.lists");
  const locale = useLocale();
  return (e: ActivityEntry): string => {
    const { label, amount, moved_to } = e.summary ?? {};
    const thing = KNOWN.has(e.entity) ? t(`things.${e.entity}`) : e.entity;
    if ((e.entity === "sales" || e.entity === "expenses") && e.action === "insert" && amount !== undefined)
      return t(e.entity === "sales" ? "loggedSale" : "loggedExpense", { amount: eur(Number(amount), locale, 2) });
    if (e.entity === "card_comments" && e.action === "insert") return t("commented");
    if (e.entity === "cards" && moved_to) {
      const key = { "to do": "todo", doing: "doing", review: "review", done: "done" }[moved_to.toLowerCase()];
      return t("moved", { title: quote(label), list: key ? tl(key) : moved_to });
    }
    return t(e.action, { thing, title: quote(label) }).replace(/\s+/g, " ").trim();
  };
}

export function ActivityFeed({ entries, names, groups }: {
  entries: ActivityEntry[];
  names: Record<string, string>;
  groups: Record<string, { emoji: string; slug: string }>;
}) {
  const t = useTranslations("activity");
  const tg = useTranslations("group.names");
  const locale = useLocale();
  const describe = useDescribe();
  if (!entries.length) return <p className="py-6 text-center text-sm text-muted">{t("empty")}</p>;
  return (
    <ol className="space-y-3">
      {entries.map((e) => {
        const who = (e.user_id && names[e.user_id]) || t("someone");
        const g = e.group_id ? groups[e.group_id] : null;
        return (
          <li key={e.id} className="flex items-start gap-2.5">
            <Avatar name={who} size={26} />
            <div className="min-w-0 flex-1 text-sm leading-snug">
              <p><span className="font-medium">{who}</span> <span className="text-muted">{describe(e)}</span></p>
              <p className="text-xs text-muted">
                {g ? `${g.emoji} ${tg(g.slug)}` : `🏢 ${t("general")}`} · <time dateTime={e.created_at}>{timeAgo(e.created_at, locale)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
