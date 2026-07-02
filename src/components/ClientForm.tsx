"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { INTERVAL_MODES, LABELS, type ClientDTO, type IntervalMode } from "@/lib/types";

export function ClientForm({ client }: { client?: ClientDTO }) {
  const router = useRouter();
  const editing = Boolean(client);

  const [form, setForm] = useState({
    clientName: client?.clientName ?? "",
    businessName: client?.businessName ?? "",
    contactName: client?.contactName ?? "",
    phone: client?.phone ?? "",
    email: client?.email ?? "",
    notes: client?.notes ?? "",
    tags: client?.tags.join(", ") ?? "",
    intervalMode: (client?.intervalMode ?? "automatic") as IntervalMode,
    manualIntervalDays: client?.manualIntervalDays?.toString() ?? "30",
    customNextDate: client?.customNextDate ? client.customNextDate.slice(0, 10) : "",
    expectedIntervalDays: client?.expectedIntervalDays?.toString() ?? "",
    annualValue:
      client?.annualValue != null ? String(Math.round(client.annualValue)) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clientName.trim()) {
      setError("Client name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        clientName: form.clientName.trim(),
        businessName: form.businessName.trim() || null,
        contactName: form.contactName.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        notes: form.notes.trim() || null,
        tags: form.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        intervalMode: form.intervalMode,
        manualIntervalDays:
          form.intervalMode === "manual"
            ? parseInt(form.manualIntervalDays, 10) || 30
            : null,
        customNextDate:
          form.intervalMode === "custom_date" && form.customNextDate
            ? new Date(`${form.customNextDate}T12:00:00`).toISOString()
            : null,
        expectedIntervalDays: form.expectedIntervalDays
          ? parseInt(form.expectedIntervalDays, 10) || null
          : null,
        annualValue: form.annualValue ? parseFloat(form.annualValue) || null : null,
        // Answering "usual visit rhythm" here counts as completing setup, so
        // the record-meeting form won't ask again.
        ...(form.expectedIntervalDays ? { setupCompleted: true } : {}),
      };

      const res = await fetch(
        editing ? `/api/clients/${client!.id}` : "/api/clients",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't save the client.");
      }
      const data = await res.json();
      router.push(`/clients/${data.client.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the client.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="card card-pad space-y-4">
        <div>
          <label className="label">Client name *</label>
          <input
            className="input"
            value={form.clientName}
            onChange={(e) => set("clientName", e.target.value)}
            placeholder="e.g. Acme Pasta Co"
            autoFocus
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Business name</label>
            <input
              className="input"
              value={form.businessName}
              onChange={(e) => set("businessName", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Contact person</label>
            <input
              className="input"
              value={form.contactName}
              onChange={(e) => set("contactName", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label">Tags (comma separated)</label>
          <input
            className="input"
            value={form.tags}
            onChange={(e) => set("tags", e.target.value)}
            placeholder="wholesale, london"
          />
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[90px]"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Usually visited every (days)</label>
            <input
              className="input"
              type="number"
              min={1}
              placeholder="e.g. 30"
              value={form.expectedIntervalDays}
              onChange={(e) => set("expectedIntervalDays", e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-400">
              Optional — asked automatically when the first meeting is recorded.
            </p>
          </div>
          <div>
            <label className="label">Value per year (£)</label>
            <input
              className="input"
              type="number"
              min={0}
              placeholder="e.g. 12000"
              value={form.annualValue}
              onChange={(e) => set("annualValue", e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-400">
              Feeds visit priority. Synced from Power BI when connected.
            </p>
          </div>
        </div>
      </div>

      <div className="card card-pad space-y-4">
        <div>
          <label className="label">Meeting rhythm</label>
          <select
            className="input"
            value={form.intervalMode}
            onChange={(e) => set("intervalMode", e.target.value as IntervalMode)}
          >
            {INTERVAL_MODES.map((m) => (
              <option key={m} value={m}>
                {LABELS.intervalMode[m]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-400">
            Automatic learns the interval from your meeting history.
          </p>
        </div>
        {form.intervalMode === "manual" && (
          <div>
            <label className="label">Meet every (days)</label>
            <input
              className="input w-40"
              type="number"
              min={1}
              value={form.manualIntervalDays}
              onChange={(e) => set("manualIntervalDays", e.target.value)}
            />
          </div>
        )}
        {form.intervalMode === "custom_date" && (
          <div>
            <label className="label">Next meeting date</label>
            <input
              className="input w-52"
              type="date"
              value={form.customNextDate}
              onChange={(e) => set("customNextDate", e.target.value)}
            />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-status-overdue">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => router.back()}
        >
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary px-6">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {editing ? "Save changes" : "Create client"}
        </button>
      </div>
    </form>
  );
}
