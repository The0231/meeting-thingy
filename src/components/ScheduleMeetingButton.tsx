"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, Loader2 } from "lucide-react";
import { LABELS, MEETING_TYPES } from "@/lib/types";

export function ScheduleMeetingButton({
  clientId,
  suggestedDate,
}: {
  clientId: string;
  suggestedDate?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(
    (suggestedDate ?? new Date().toISOString()).slice(0, 10),
  );
  const [type, setType] = useState("in_person");
  const [busy, setBusy] = useState<"log" | "schedule" | null>(null);

  async function create(status: "completed" | "scheduled", when: string) {
    setBusy(status === "completed" ? "log" : "schedule");
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          meetingDate: new Date(`${when}T12:00:00`).toISOString(),
          meetingType: type,
          status,
        }),
      });
      if (!res.ok) throw new Error();
      setOpen(false);
      router.refresh();
    } catch {
      window.alert("Couldn't save that meeting.");
    } finally {
      setBusy(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-secondary"
          onClick={() => create("completed", today)}
          disabled={busy !== null}
        >
          {busy === "log" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          Mark met today
        </button>
        <button className="btn-secondary" onClick={() => setOpen((o) => !o)}>
          <CalendarPlus className="h-4 w-4" />
          Schedule a meeting
        </button>
      </div>

      {open && (
        <div className="card card-pad space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {MEETING_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {LABELS.meetingType[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => create("scheduled", date)}
            disabled={busy !== null}
          >
            {busy === "schedule" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            Add to calendar
          </button>
        </div>
      )}
    </div>
  );
}
