import { Crown, Wallet, Handshake, Megaphone, MessagesSquare, Users } from "lucide-react";

/** One icon per team (instead of emoji), drawn on the team's colour. */
const ICONS = { "team-leader": Crown, finance: Wallet, customer: Handshake, marketing: Megaphone, communications: MessagesSquare } as const;

export function GroupIcon({ slug, size = 16, className }: { slug: string; size?: number; className?: string }) {
  const Icon = ICONS[slug as keyof typeof ICONS] ?? Users;
  return <Icon size={size} className={className} aria-hidden />;
}

/** The team icon in a rounded colour chip (nav, headers, lists). */
export function GroupBadge({ slug, color, size = 28 }: { slug: string; color: string; size?: number }) {
  return (
    <span aria-hidden className="grid shrink-0 place-items-center rounded-[9px] text-white" style={{ width: size, height: size, background: color }}>
      <GroupIcon slug={slug} size={Math.round(size * 0.55)} />
    </span>
  );
}
