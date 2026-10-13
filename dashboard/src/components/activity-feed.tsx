import { Avatar } from "@/components/ui";

export type ActivityEntry = {
  id: number;
  user_id: string | null;
  group_id: string | null;
  action: "insert" | "update" | "delete";
  entity: string;
  summary: { label?: string | null; amount?: number | string; moved_to?: string };
  created_at: string;
};

const NOUN: Record<string, string> = {
  cards: "card", card_comments: "comment", sales: "sale", expenses: "expense", inventory: "stock item",
  prospects: "prospect", complaints: "complaint", content_posts: "post", campaigns: "campaign",
  design_requests: "design request", experiments: "test", meeting_notes: "meeting note", outreach: "contact",
  decisions: "decision", blockers: "blocker", kpi_targets: "KPI target",
};

const eur = (v: number | string) =>
  new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(v));

function quote(s?: string | null) {
  if (!s) return "";
  return `“${s.length > 48 ? s.slice(0, 47) + "…" : s}”`;
}

/** Turns a log row into a short sentence: "logged a €120 sale", "moved “Book room” to Done" */
export function describe(e: ActivityEntry): string {
  const noun = NOUN[e.entity] ?? e.entity;
  const { label, amount, moved_to } = e.summary ?? {};
  if ((e.entity === "sales" || e.entity === "expenses") && e.action === "insert" && amount !== undefined)
    return `logged a ${eur(amount)} ${noun}`;
  if (e.entity === "card_comments" && e.action === "insert") return "commented on a card";
  if (e.entity === "cards" && moved_to) return `moved ${quote(label)} to ${moved_to}`;
  const verb = e.action === "insert" ? (e.entity === "cards" ? "added" : "added a " + noun) :
               e.action === "update" ? "updated" : "deleted";
  if (e.action === "insert" && e.entity !== "cards") return `${verb} ${quote(label)}`.trim();
  return `${verb} ${e.entity === "cards" ? "" : noun + " "}${quote(label)}`.replace(/\s+/g, " ").trim();
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.round((Date.parse(iso) - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const abs = Math.abs(s);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

export function ActivityFeed({ entries, names, groups }: {
  entries: ActivityEntry[];
  names: Record<string, string>;
  groups: Record<string, { emoji: string; name: string }>;
}) {
  if (!entries.length) {
    return <p className="py-6 text-center text-sm text-muted">Nothing yet — changes anyone makes show up here live.</p>;
  }
  return (
    <ol className="space-y-3">
      {entries.map((e) => {
        const who = (e.user_id && names[e.user_id]) || "Someone";
        const g = e.group_id ? groups[e.group_id] : null;
        return (
          <li key={e.id} className="flex items-start gap-2.5">
            <Avatar name={who} size={26} />
            <div className="min-w-0 flex-1 text-sm leading-snug">
              <p>
                <span className="font-medium">{who}</span> <span className="text-muted">{describe(e)}</span>
              </p>
              <p className="text-xs text-muted">
                {g ? `${g.emoji} ${g.name} · ` : "🏢 General · "}
                <time dateTime={e.created_at}>{timeAgo(e.created_at)}</time>
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
