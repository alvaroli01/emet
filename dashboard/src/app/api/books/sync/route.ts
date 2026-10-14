import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncBooks } from "@/lib/books";

export const maxDuration = 60;

/** Mirror queued Finance changes to the "emet Books" Google Sheet. Any team member's write can trigger it. */
export async function POST() {
  const supabase = await createClient();
  const { data: member } = await supabase.rpc("is_member");
  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await syncBooks());
}
