import { ComingSoon } from "@/components/ui";

export default function GeneralBoardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">🏢 General board</h1>
      <ComingSoon step={3} what="The company-wide task board" />
    </div>
  );
}
