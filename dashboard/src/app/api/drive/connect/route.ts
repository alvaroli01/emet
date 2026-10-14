import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authUrl, driveConfigured } from "@/lib/drive";

/** Admins only: start "Connect Google Drive" with the team's Google account. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin || !driveConfigured()) return NextResponse.redirect(new URL("/meetings?drive=forbidden", request.url));
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(authUrl(state, new URL("/api/drive/callback", request.url).toString()));
  res.cookies.set("drive_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/drive" });
  return res;
}
