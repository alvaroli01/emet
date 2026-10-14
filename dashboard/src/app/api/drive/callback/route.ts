import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { connect } from "@/lib/drive";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  const state = request.cookies.get("drive_state")?.value;
  const code = url.searchParams.get("code");
  if (!isAdmin || !state || state !== url.searchParams.get("state") || !code) {
    return NextResponse.redirect(new URL("/meetings?drive=failed", request.url));
  }
  const r = await connect(code, new URL("/api/drive/callback", request.url).toString());
  const res = NextResponse.redirect(new URL(`/meetings?drive=${r.ok ? "connected" : "failed"}`, request.url));
  res.cookies.delete({ name: "drive_state", path: "/api/drive" });
  return res;
}
