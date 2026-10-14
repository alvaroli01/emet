import { getLocale, getTranslations } from "next-intl/server";
import { AudioLines, Mic } from "lucide-react";
import { PageHero } from "@/components/shell/page-hero";
import { MicRipple } from "@/components/shell/hero-visuals";
import { shortDate } from "@/lib/format";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { LiveRefresh } from "@/components/live-refresh";
import { MeetingLog, type MeetingRow } from "@/components/meetings/meeting-log";
import { status as driveStatus } from "@/lib/drive";

/** Meeting log: recordings shared with the whole team. Leaders' meetings are only returned to leaders (database rule). */
export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ m?: string; drive?: string; record?: string }> }) {
  const { m, drive: driveResult, record } = await searchParams;
  const t = await getTranslations("meetings");
  const { me, isAdmin } = await getSession();
  const supabase = await createClient();
  const [meetings, members, aiKey, storage, drive, archived] = await Promise.all([
    supabase.from("meetings").select("id, title, kind, meeting_date, status, minutes, audio_parts, created_by, created_at")
      .order("meeting_date", { ascending: false }).order("created_at", { ascending: false }).returns<MeetingRow[]>(),
    loadMembers(),
    supabase.from("ai_keys").select("last4").maybeSingle(),
    isAdmin ? supabase.rpc("audio_storage_bytes") : Promise.resolve({ data: null }),
    isAdmin ? driveStatus() : Promise.resolve(null),
    isAdmin ? supabase.rpc("archived_audio_bytes") : Promise.resolve({ data: null }),
  ]);

  const th = await getTranslations("hero");
  const tn = await getTranslations("nav");
  const locale = await getLocale();
  const all = meetings.data ?? [];
  const latest = all[0];
  const week = all.filter((x) => Date.parse(x.meeting_date) >= Date.now() - 7 * 864e5).length;
  const processing = all.filter((x) => x.status === "recording" && x.created_by === me.id).length;

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["meetings"]} />
      <PageHero
        section={{ label: tn("meetings"), icon: <AudioLines size={16} /> }}
        title={th("meetings.title")}
        subtitle={th("meetings.subtitle")}
        lines={[
          ...(latest ? [{ text: th("meetings.latest", { title: latest.title, date: shortDate(latest.meeting_date, locale) }), tone: "info" as const, href: `/meetings?m=${latest.id}` }] : [{ text: th("meetings.none"), tone: "info" as const }]),
          ...(processing ? [{ text: th("meetings.processing", { count: processing }), tone: "warn" as const }] : []),
        ]}
        stats={[
          { label: th("meetings.week"), value: week, kind: "num" },
          { label: th("meetings.total"), value: all.length, kind: "num" },
        ]}
        actions={[{ label: t("record"), href: "/meetings?record=1", icon: <Mic size={15} />, primary: true }]}
        visual={<MicRipple />}
      />
      <MeetingLog
        startRecording={record === "1"}
        meetings={meetings.data ?? []}
        names={Object.fromEntries(members.map((x) => [x.id, x.full_name]))}
        meId={me.id}
        isLeader={isAdmin}
        ai={{ connected: !!aiKey.data, last4: aiKey.data?.last4 ?? null }}
        storageBytes={typeof storage.data === "number" ? storage.data : null}
        initialOpen={m}
        drive={drive ? { ...drive, archivedBytes: typeof archived.data === "number" ? archived.data : 0, result: driveResult ?? null } : null}
        title={t("title")}
      />
    </div>
  );
}
