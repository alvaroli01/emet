import { getSession } from "@/lib/session";
import { ComingSoon } from "@/components/ui";

export default async function OverviewPage() {
  const { me } = await getSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hi {me.full_name} 👋</h1>
        <p className="text-sm text-muted">€30,000 revenue · €15,000 profit · June 2027</p>
      </div>
      <ComingSoon step={2} what="Goal progress, countdown, charts and group health" />
    </div>
  );
}
