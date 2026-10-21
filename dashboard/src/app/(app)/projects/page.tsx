import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMembers } from "@/lib/boards";
import { loadMyProjects } from "@/lib/projects-server";
import { todayISO } from "@/lib/format";
import { MyProjects } from "@/components/projects/my-projects";

/** Menu → Projects: the projects I'm in (leaders: all of them, plus New project). */
export default async function ProjectsPage() {
  const { me, isAdmin } = await getSession();
  const supabase = await createClient();
  const [projects, people] = await Promise.all([loadMyProjects(supabase, me.id, isAdmin), isAdmin ? loadMembers() : Promise.resolve([])]);
  return <div className="fade-in"><MyProjects projects={projects} isLeader={isAdmin} people={people} today={todayISO()} /></div>;
}
