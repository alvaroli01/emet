import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamFile } from "@/lib/drive";

export const maxDuration = 60;

/** Plays an archived part from Drive — only for people allowed to see the meeting (checked by the database). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; part: string }> }) {
  const { id, part } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("meeting_audio").select("drive_file_id").eq("meeting_id", id).eq("part", decodeURIComponent(part)).maybeSingle();
  if (!data) return NextResponse.json({ error: "not-found" }, { status: 404 });
  return streamFile(data.drive_file_id, request.headers.get("range"));
}
