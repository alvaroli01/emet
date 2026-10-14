import { getTranslations } from "next-intl/server";
import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { LiveRefresh } from "@/components/live-refresh";
import { MeetingLog, type MeetingRow } from "@/components/meetings/meeting-log";
import { status as driveStatus } from "@/lib/drive";

/** Meeting log: recordings shared with the whole team. Leaders' meetings are only returned to leaders (database rule). */
export default async function MeetingsPage({ searchParams }: { searchParams: Promise<{ m?: string; drive?: string }> }) {
  const { m, drive: driveResult } = await searchParams;
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

  return (
    <div className="space-y-6">
      <LiveRefresh tables={["meetings"]} />
      <MeetingLog
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
