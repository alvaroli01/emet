import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Group = { id: string; slug: string; name: string; emoji: string; color: string; position: number };

export type Profile = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  avatar_url: string | null;
  group_id: string | null;
  role_title: string | null;
  is_admin: boolean;
  is_coach?: boolean;
  is_leader?: boolean;
  locale: string | null;
  active: boolean;
};

export type Session = {
  me: Profile;
  myGroup: Group | null;
  groups: Group[];
  /** Team Leader group or is_admin flag — mirrors public.is_admin() in the database */
  isAdmin: boolean;
  isLeader: boolean;
  /** UI hint only. The database (RLS) is what actually enforces this. */
  canEditGroup: (groupId: string | null | undefined) => boolean;
  /** Plain object (safe to pass to client components) */
  viewer: { meId: string; isAdmin: boolean; myGroupId: string | null; isCoach: boolean };
};

/** Loads the logged-in member once per request. Redirects to /login if not logged in or not on the team. */
export const getSession = cache(async (): Promise<Session> => {
  const supabase = await createClient();
  // Verified locally (see middleware); the database checks the same token on every query.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: me }, { data: groups }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle<Profile>(),
    supabase.from("groups").select("*").order("position").returns<Group[]>(),
  ]);
  if (!me || !me.active) redirect("/auth/not-on-team");

  const allGroups = groups ?? [];
  const myGroup = allGroups.find((g) => g.id === me.group_id) ?? null;
  const isAdmin = me.is_admin || myGroup?.slug === "team-leader";

  return {
    me,
    myGroup,
    groups: allGroups,
    isAdmin,
    /** Group leaders + admins: the Team Leaders tools (strikes, giving tasks, training leaders) */
    isLeader: isAdmin || !!me.is_leader,
    canEditGroup: (gid) => isAdmin || (!!gid && gid === me.group_id),
    viewer: { meId: me.id, isAdmin, myGroupId: me.group_id, isCoach: !!me.is_coach },
  };
});
