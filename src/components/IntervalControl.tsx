"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, SlidersHorizontal } from "lucide-react";
import { INTERVAL_MODES, LABELS, type ClientDTO, type IntervalMode } from "@/lib/types";

export function IntervalControl({ client }: { client: ClientDTO }) {
  const router = useRouter();
  const [mode, setMode] = useState<IntervalMode>(client.intervalMode);
  const [manualDays, setManualDays] = useState(
    client.manualIntervalDays?.toString() ?? "30",
  );
  const [customDate, setCustomDate] = useState(
    client.customNextDate ? client.customNextDate.slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload: Record<string, unknown> = { intervalMode: mode };
      if (mode === "manual") payload.manualIntervalDays = parseInt(manualDays, 10) || 30;
      if (mode === "custom_date")
        payload.customNextDate = customDate
          ? new Date(`${customDate}T12:00:00`).toISOString()
          : null;

      const res = await fetch(`/api/clients/${client.id}/interval`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't update.");
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update.");
    } finally {
      setSaving(false);
    }
  }

  const dirty =
    mode !== client.intervalMode ||
    (mode === "manual" &&
      parseInt(manualDays, 10) !== (client.manualIntervalDays ?? 0)) ||
    (mode === "custom_date" &&
      customDate !== (client.customNextDate?.slice(0, 10) ?? ""));

  return (
    <div className="card card-pad">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        <SlidersHorizontal className="h-4 w-4 text-gray-400" />
        Reminder schedule
      </div>

      <select
        className="input"
        value={mode}
        onChange={(e) => setMode(e.target.value as IntervalMode)}
      >
        {INTERVAL_MODES.map((m) => (
          <option key={m} value={m}>
            {LABELS.intervalMode[m]}
          </option>
        ))}
      </select>

      {mode === "automatic" && (
        <p className="mt-2 text-xs text-gray-500">
          {client.learnedIntervalDays
            ? `Learned rhythm: ${client.intervalLabel} (${client.confidence} confidence).`
            : "Will learn the rhythm once there are more meetings. Using the default for now."}
        </p>
      )}

      {mode === "manual" && (
        <div className="mt-3">
          <label className="label">Meet every (days)</label>
          <input
            className="input w-40"
            type="number"
            min={1}
            value={manualDays}
            onChange={(e) => setManualDays(e.target.value)}
          />
        </div>
      )}

      {mode === "custom_date" && (
        <div className="mt-3">
          <label className="label">Next meeting date</label>
          <input
            className="input w-52"
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
          />
        </div>
      )}

      {mode === "paused" && (
        <p className="mt-2 text-xs text-gray-500">No reminders while paused.</p>
      )}

      {error && <p className="mt-2 text-xs text-status-overdue">{error}</p>}

      <button
        onClick={save}
        disabled={saving || !dirty}
        className="btn-primary mt-4 w-full"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : saved ? (
          <Check className="h-4 w-4" />
        ) : null}
        {saved ? "Saved" : "Update schedule"}
      </button>
    </div>
  );
}
