"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import type { ClientDTO, ReminderState } from "@/lib/types";
import { ClientCard } from "./ClientCard";
import { EmptyState } from "./EmptyState";

export type FilterKey =
  | "all"
  | "attention"
  | "overdue"
  | "due_soon"
  | "on_track"
  | "no_history"
  | "paused";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "overdue", label: "Overdue" },
  { key: "due_soon", label: "Due soon" },
  { key: "on_track", label: "On track" },
  { key: "no_history", label: "Not visited yet" },
  { key: "paused", label: "Paused" },
];

function matchesFilter(c: ClientDTO, key: FilterKey): boolean {
  switch (key) {
    case "all":
      return true;
    case "attention":
      return (
        c.reminderState === "overdue" ||
        c.reminderState === "due_today" ||
        c.reminderState === "upcoming"
      );
    case "overdue":
      return c.reminderState === "overdue";
    case "due_soon":
      return c.reminderState === "upcoming" || c.reminderState === "due_today";
    case "on_track":
      return c.reminderState === "recent";
    case "no_history":
      return c.reminderState === "no_history";
    case "paused":
      return c.reminderState === "paused";
    default:
      return true;
  }
}

export function ClientsExplorer({
  clients,
  initialFilter = "all",
}: {
  clients: ClientDTO[];
  initialFilter?: FilterKey;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>(initialFilter);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: clients.length,
      attention: 0,
      overdue: 0,
      due_soon: 0,
      on_track: 0,
      no_history: 0,
      paused: 0,
    };
    for (const cl of clients) {
      for (const f of FILTERS) {
        if (f.key !== "all" && matchesFilter(cl, f.key)) c[f.key]++;
      }
    }
    return c;
  }, [clients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (!matchesFilter(c, filter)) return false;
      if (!q) return true;
      return (
        c.clientName.toLowerCase().includes(q) ||
        (c.businessName ?? "").toLowerCase().includes(q) ||
        (c.contactName ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [clients, query, filter]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search clients by name, business, contact, email or tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`badge border px-3 py-1 ${
              filter === f.key
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f.label}
            <span className="text-gray-400">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No clients match"
          hint="Try a different search or filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <ClientCard key={c.id} client={c} />
          ))}
        </div>
      )}
    </div>
  );
}
