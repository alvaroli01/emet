import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyState } from "@/lib/notion/state";
import { exchangeCode, redirectUri, sealTokens } from "@/lib/notion/server";

/** Notion sends the member back here: check the signed state, swap the code for tokens, save them encrypted. */
export async function GET(request: NextRequest) {
  const sb = await createClient();
  const { data: me } = await sb.rpc("my_profile_id");
  if (!me) return NextResponse.redirect(new URL("/login", request.url));
  const back = (result: string) => NextResponse.redirect(new URL(`/team/${me}?notion=${result}#connections`, request.url));
  const p = request.nextUrl.searchParams;
  if (p.get("error")) return back("cancelled");
  const code = p.get("code"), state = p.get("state") ?? "";
  if (!code || !verifyState(state, me as string)) return back("failed");
  try {
    const t = await exchangeCode(code, redirectUri(request.nextUrl.origin));
    const { error } = await sb.from("notion_connections").upsert({
      owner_id: me, workspace_id: t.workspace_id, workspace_name: t.workspace_name ?? null, workspace_icon: t.workspace_icon ?? null,
      bot_id: t.bot_id ?? null, needs_reconnect: false, ...sealTokens({ access: t.access_token, refresh: t.refresh_token ?? null }),
    }, { onConflict: "owner_id,workspace_id" });
    return back(error ? "failed" : "ok");
  } catch {
    return back("failed");
  }
}
