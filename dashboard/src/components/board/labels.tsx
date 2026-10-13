"use client";

import { useTranslations } from "next-intl";

/** Preset labels: stored by key, shown translated. Any other label is shown as typed. */
export const PRESET_LABELS: Record<string, string> = {
  urgent: "#d03b3b",
  important: "#eb6834",
  idea: "#6250d6",
  waiting: "#c98500",
  question: "#2a78d6",
};

/** Default list names are translated; lists people renamed keep their own words. */
export function useListName() {
  const t = useTranslations("board.lists");
  return (name: string) => {
    const key = ({ "to do": "todo", doing: "doing", review: "review", done: "done" } as Record<string, string>)[name.toLowerCase()];
    return key ? t(key) : name;
  };
}

export function LabelChip({ label }: { label: string }) {
  const t = useTranslations("board.labels");
  const color = PRESET_LABELS[label];
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink">
      <span className="size-1.5 rounded-full" style={{ background: color ?? "var(--muted)" }} aria-hidden />
      {color ? t(label) : label}
    </span>
  );
}
