import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { status } from "@/lib/drive";

export async function GET() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await status());
}
