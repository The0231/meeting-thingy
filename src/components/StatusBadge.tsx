import { LABELS, REMINDER_STATE_COLOR, type ReminderState } from "@/lib/types";
import { TONE_CLASSES } from "@/lib/ui";

export function StatusBadge({ state }: { state: ReminderState }) {
  const tone = REMINDER_STATE_COLOR[state];
  const c = TONE_CLASSES[tone];
  return (
    <span className={`badge ${c.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {LABELS.reminderState[state]}
    </span>
  );
}
