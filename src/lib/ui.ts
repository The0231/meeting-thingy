// Shared visual tokens. Class strings are written out in full (no runtime
// string-building) so Tailwind's content scanner keeps them.

export type Tone = "recent" | "scheduled" | "soon" | "overdue" | "paused";

export const TONE_CLASSES: Record<
  Tone,
  { badge: string; dot: string; bar: string; softBg: string; text: string }
> = {
  recent: {
    badge: "bg-green-50 text-green-700",
    dot: "bg-status-recent",
    bar: "bg-status-recent",
    softBg: "bg-green-50",
    text: "text-status-recent",
  },
  scheduled: {
    badge: "bg-blue-50 text-blue-700",
    dot: "bg-status-scheduled",
    bar: "bg-status-scheduled",
    softBg: "bg-blue-50",
    text: "text-status-scheduled",
  },
  soon: {
    badge: "bg-amber-50 text-amber-700",
    dot: "bg-status-soon",
    bar: "bg-status-soon",
    softBg: "bg-amber-50",
    text: "text-status-soon",
  },
  overdue: {
    badge: "bg-red-50 text-red-700",
    dot: "bg-status-overdue",
    bar: "bg-status-overdue",
    softBg: "bg-red-50",
    text: "text-status-overdue",
  },
  paused: {
    badge: "bg-gray-100 text-gray-600",
    dot: "bg-status-paused",
    bar: "bg-status-paused",
    softBg: "bg-gray-50",
    text: "text-status-paused",
  },
};
