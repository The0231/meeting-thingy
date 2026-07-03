// ============================================================================
// Pull a visit frequency out of free text.
//
// "I meet with them every week" → 7, "we see them fortnightly" → 14,
// "visit every three days" → 3, "catch up monthly" → 30 …
//
// Used to auto-fill the one-time setup answer from meeting notes, so reps
// don't have to answer a question they already answered in passing.
// Pure function — usable from both client and server code.
// ============================================================================

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, couple: 2, few: 3,
};

const UNIT_DAYS: Record<string, number> = { day: 1, week: 7, month: 30, year: 365 };

// Words suggesting the sentence is about MEETING them (not e.g. "they order
// bread every day") — required for the generic "every N unit" patterns.
const MEET_CONTEXT = /(meet|visit|see|catch\s*up|check\s*in|drop\s*(?:in|by)|come|go|call\s+on|pop\s+(?:in|by|round)|swing\s+by)/i;

function num(raw: string): number | null {
  const n = parseInt(raw, 10);
  if (Number.isFinite(n) && n > 0) return n;
  return WORD_NUMBERS[raw.toLowerCase()] ?? null;
}

/**
 * Returns the visit interval in days found in `text`, or null.
 * Conservative: generic "every …" phrases only count when the sentence is
 * about meeting/visiting; unambiguous words (weekly, fortnightly…) always count.
 */
export function parseFrequencyDays(text: string): number | null {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return null;

  // Split into rough sentences so context checks stay local.
  const sentences = t.split(/[.!?\n;]+/);

  for (const s of sentences) {
    const aboutMeeting = MEET_CONTEXT.test(s);

    // "every (other|N)? day(s)/week(s)/month(s)"
    const every = s.match(/every\s+(?:(other)\s+)?(?:(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|couple|few)\s+(?:of\s+)?)?(day|week|month|year)s?\b/);
    if (every && aboutMeeting) {
      const unit = UNIT_DAYS[every[3]];
      if (every[1]) return unit * 2; // "every other week"
      const n = every[2] ? num(every[2]) : 1;
      if (n) return n * unit;
    }

    // "once/twice a week|month", "once every two weeks"
    const perPeriod = s.match(/\b(once|twice)\s+(?:a|per|every)\s+(day|week|month)\b/);
    if (perPeriod && aboutMeeting) {
      const unit = UNIT_DAYS[perPeriod[2]];
      return perPeriod[1] === "twice" ? Math.max(1, Math.round(unit / 2)) : unit;
    }

    // Unambiguous frequency words stand on their own.
    if (/\bfortnightly\b|\bevery\s+fortnight\b|\bbi-?weekly\b/.test(s)) return 14;
    if (/\bweekly\b/.test(s) && (aboutMeeting || /\bweekly\s+(visit|meeting|catch)/.test(s) || s.trim().split(/\s+/).length <= 6)) return 7;
    if (/\bmonthly\b/.test(s) && (aboutMeeting || /\bmonthly\s+(visit|meeting|catch)/.test(s) || s.trim().split(/\s+/).length <= 6)) return 30;
    if (/\bquarterly\b/.test(s)) return 91;
    if (/\bdaily\b/.test(s) && aboutMeeting) return 1;
  }
  return null;
}
