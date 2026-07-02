// Shared domain types & enum-like string unions.
// SQLite has no native enums, so these unions define the allowed values and
// give us human-readable labels + option lists for forms/filters.
// No users/auth in this app — it's a single shared workspace.

export const INTERVAL_MODES = [
  "automatic",
  "manual",
  "paused",
  "custom_date",
] as const;
export type IntervalMode = (typeof INTERVAL_MODES)[number];

export const MEETING_TYPES = [
  "in_person",
  "phone",
  "video",
  "site_visit",
] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_STATUSES = ["completed", "scheduled", "cancelled"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

// Where a client's monetary value came from.
export const VALUE_SOURCES = ["manual", "powerbi"] as const;
export type ValueSource = (typeof VALUE_SOURCES)[number];

// Computed (never stored) visit priority for a client.
export const PRIORITY_LEVELS = ["high", "medium", "low", "none"] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

// Computed (never stored) follow-up state for a client.
export const REMINDER_STATES = [
  "no_history",
  "recent",
  "upcoming",
  "due_today",
  "overdue",
  "paused",
] as const;
export type ReminderState = (typeof REMINDER_STATES)[number];

// ---- Display labels ---------------------------------------------------------

export const LABELS = {
  intervalMode: {
    automatic: "Automatic (learns from history)",
    manual: "Manual interval",
    paused: "Paused (no reminders)",
    custom_date: "Custom next date",
  } as Record<IntervalMode, string>,
  meetingType: {
    in_person: "In person",
    phone: "Phone",
    video: "Video",
    site_visit: "Site visit",
  } as Record<MeetingType, string>,
  meetingStatus: {
    completed: "Completed",
    scheduled: "Scheduled",
    cancelled: "Cancelled",
  } as Record<MeetingStatus, string>,
  reminderState: {
    no_history: "No history",
    recent: "On track",
    upcoming: "Due soon",
    due_today: "Due today",
    overdue: "Overdue",
    paused: "Paused",
  } as Record<ReminderState, string>,
  priorityLevel: {
    high: "High priority",
    medium: "Medium priority",
    low: "Low priority",
    none: "No priority",
  } as Record<PriorityLevel, string>,
} as const;

// Map a reminder state to a status colour token (matches tailwind `status.*`).
export const REMINDER_STATE_COLOR: Record<
  ReminderState,
  "recent" | "scheduled" | "soon" | "overdue" | "paused"
> = {
  no_history: "paused",
  recent: "recent",
  upcoming: "soon",
  due_today: "soon",
  overdue: "overdue",
  paused: "paused",
};

// ---- Client-facing DTOs (dates serialised as ISO strings) -------------------

export interface ClientDTO {
  id: string;
  clientName: string;
  businessName: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  tags: string[];
  intervalMode: IntervalMode;
  manualIntervalDays: number | null;
  customNextDate: string | null;
  setupCompleted: boolean;
  expectedIntervalDays: number | null;
  annualValue: number | null;
  valueSource: ValueSource | null;
  powerBiName: string | null;
  powerBiSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // derived
  meetingCount: number;
  lastMeetingDate: string | null;
  nextSuggestedDate: string | null;
  effectiveIntervalDays: number | null;
  intervalSource: string;
  intervalLabel: string;
  reminderState: ReminderState;
  daysUntilDue: number | null;
  daysOverdue: number | null;
  confidence: "low" | "medium" | "high";
  confidenceScore: number;
  learnedIntervalDays: number | null;
  priorityScore: number; // 0-100, see src/lib/priority.ts
  priorityLevel: PriorityLevel;
}

export interface MeetingDTO {
  id: string;
  clientId: string;
  clientName: string;
  meetingDate: string;
  meetingType: MeetingType;
  status: MeetingStatus;
  hasAudio: boolean;
  audioMimeType: string | null;
  transcript: string | null;
  aiSummary: string | null;
  manualNotes: string | null;
  actionItems: string[];
  followUpRequired: boolean;
  createdAt: string;
  updatedAt: string;
}
