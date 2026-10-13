import type { Group, Session } from "@/lib/session";
import type { Member } from "@/lib/boards";

export type ToolProps = {
  group: Group;
  /** Can the viewer edit this group's data? (UI hint; the database enforces it) */
  editable: boolean;
  session: Session;
  allMembers: Member[];
};
