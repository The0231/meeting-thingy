import { confidenceLabel } from "@/lib/format";

export function ConfidenceMeter({
  confidence,
  score,
  className = "",
}: {
  confidence: "low" | "medium" | "high";
  score: number;
  className?: string;
}) {
  const color =
    confidence === "high"
      ? "bg-status-recent"
      : confidence === "medium"
        ? "bg-status-soon"
        : "bg-status-paused";
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100);
  return (
    <div className={className}>
      <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
        <span>{confidenceLabel(confidence)}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
