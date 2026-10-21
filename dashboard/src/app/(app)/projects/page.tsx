import { getSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { loadMyProjects } from "@/lib/projects-server";
import { todayISO } from "@/lib/format";
import { MyProjects } from "@/components/projects/my-projects";

/** Menu → Projects: the projects I'm a member of (leaders create and manage projects in Team Leader → Projects). */
export default async function ProjectsPage() {
  const { me } = await getSession();
  const projects = await loadMyProjects(await createClient(), me.id);
  return <div className="fade-in"><MyProjects projects={projects} today={todayISO()} /></div>;
}
