import { ComingSoon } from "@/components/ui";

export default function MyTasksPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
      <ComingSoon step={3} what="Every card assigned to you across all 6 boards" />
    </div>
  );
}
