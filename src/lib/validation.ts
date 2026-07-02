import { z } from "zod";
import {
  INTERVAL_MODES,
  MEETING_STATUSES,
  MEETING_TYPES,
} from "./types";

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

// Long free-text (a full meeting transcript / summary / notes can be many KB —
// several minutes of speech easily exceeds 2000 chars).
const longText = z
  .string()
  .trim()
  .max(100000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const clientCreateSchema = z.object({
  clientName: z.string().trim().min(1, "Client name is required").max(200),
  businessName: optionalText,
  contactName: optionalText,
  phone: optionalText,
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      "Enter a valid email or leave blank",
    ),
  notes: optionalText,
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  intervalMode: z.enum(INTERVAL_MODES).default("automatic"),
  manualIntervalDays: z.number().int().positive().max(3650).nullable().optional(),
  customNextDate: z.string().datetime().nullable().optional(),
  // First-visit setup answers (see RecordMeetingForm) & client value.
  setupCompleted: z.boolean().optional(),
  expectedIntervalDays: z
    .number()
    .int()
    .positive()
    .max(3650)
    .nullable()
    .optional(),
  annualValue: z.number().min(0).max(1_000_000_000).nullable().optional(),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export const intervalOverrideSchema = z
  .object({
    intervalMode: z.enum(INTERVAL_MODES),
    manualIntervalDays: z.number().int().positive().max(3650).nullable().optional(),
    customNextDate: z.string().datetime().nullable().optional(),
  })
  .refine(
    (v) => v.intervalMode !== "manual" || !!v.manualIntervalDays,
    { message: "Manual mode needs a number of days", path: ["manualIntervalDays"] },
  )
  .refine(
    (v) => v.intervalMode !== "custom_date" || !!v.customNextDate,
    { message: "Custom mode needs a date", path: ["customNextDate"] },
  );

export const meetingCreateSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  meetingDate: z.string().datetime(),
  meetingType: z.enum(MEETING_TYPES).default("in_person"),
  status: z.enum(MEETING_STATUSES).default("completed"),
  transcript: longText,
  aiSummary: longText,
  manualNotes: longText,
  actionItems: z.array(z.string().trim().min(1)).optional().default([]),
  followUpRequired: z.boolean().optional().default(false),
  // Reference to an already-uploaded audio file (from /api/meetings/upload).
  audioFileUrl: optionalText,
  audioMimeType: optionalText,
});

export const meetingUpdateSchema = meetingCreateSchema.partial().omit({
  clientId: true,
});

export type ClientCreateInput = z.infer<typeof clientCreateSchema>;
export type MeetingCreateInput = z.infer<typeof meetingCreateSchema>;
