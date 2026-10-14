import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportXlsx, buildXlsx } from "@/lib/books";

export const maxDuration = 60;

/** "Download as Excel": the live sheet when Google is connected, otherwise the same workbook built here. */
export async function GET() {
  const supabase = await createClient();
  const { data: member } = await supabase.rpc("is_member");
  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const file = (await exportXlsx()) ?? (await buildXlsx());
  return new NextResponse(file, { headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename="emet Books ${new Date().toISOString().slice(0, 10)}.xlsx"`,
    "Cache-Control": "no-store",
  } });
}
