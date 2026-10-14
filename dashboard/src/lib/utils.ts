import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes (used by the Magic UI / shadcn components in components/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
