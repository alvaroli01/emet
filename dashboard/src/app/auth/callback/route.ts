import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Fallback for links that come back with a ?code= (PKCE flow). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && next.startsWith("/") && !next.startsWith("//")) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  // No ?code: the login may be in the URL fragment (standard free-plan emails). Browsers keep the
  // fragment across this redirect, so the client page can finish the login.
  if (!code) return NextResponse.redirect(`${origin}/auth/finish?next=${encodeURIComponent(next)}`);
  return NextResponse.redirect(`${origin}/login?error=link`);
}
