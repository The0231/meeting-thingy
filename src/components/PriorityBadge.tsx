import { Flame } from "lucide-react";
import type { PriorityLevel } from "@/lib/types";

// Visit priority chip (see src/lib/priority.ts for how the score is built).
const STYLES: Record<PriorityLevel, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-gray-100 text-gray-500",
  none: "bg-gray-100 text-gray-400",
};

const TEXT: Record<PriorityLevel, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
  none: "—",
};

export function PriorityBadge({
  level,
  score,
}: {
  level: PriorityLevel;
  score?: number;
}) {
  if (level === "none") return null;
  return (
    <span className={`badge ${STYLES[level]}`} title="Visit priority — based on how overdue the visit is, the client's value and how often you normally see them">
      <Flame className="h-3 w-3" />
      {TEXT[level]}
      {score != null && <span className="opacity-60">{score}</span>}
    </span>
  );
}
