import type { Group, Session } from "@/lib/session";
import type { Member } from "@/lib/boards";

export type ToolProps = {
  group: Group;
  /** Can the viewer edit this group's data? (UI hint; the database enforces it) */
  editable: boolean;
  session: Session;
  allMembers: Member[];
};

/** One tab on a group page: its label and its content (rendered on the server). */
export type ToolTab = { id: string; label: string; node: React.ReactNode; group?: "work" | "plan" | "numbers" | "people" };
