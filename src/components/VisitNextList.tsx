import Link from "next/link";
import { ChevronRight, Mic } from "lucide-react";
import { dueDescription, fmtMoney } from "@/lib/format";
import type { ClientDTO } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";

/** Plain-English one-liner explaining why this client is ranked here. */
function reasonLine(c: ClientDTO): string {
  const parts: string[] = [dueDescription(c.reminderState, c.daysUntilDue, c.daysOverdue)];
  if (c.intervalLabel === "Custom date") parts.push("date agreed with the client");
  else if (c.intervalLabel && c.intervalLabel !== "Paused")
    parts.push(`usually ${c.intervalLabel.toLowerCase()}`);
  if (c.annualValue != null) parts.push(`${fmtMoney(c.annualValue)}/year`);
  return parts.join(" · ");
}

/**
 * The dashboard's ranked "visit these first" list — one row per client,
 * ordered by priority score, with the reason spelled out in words.
 */
export function VisitNextList({ clients }: { clients: ClientDTO[] }) {
  return (
    <ol className="card divide-y divide-gray-100">
      {clients.map((c, i) => (
        <li key={c.id} className="group relative flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
              i === 0
                ? "bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-500/40"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {i + 1}
          </span>

          <div className="min-w-0 flex-1">
            <Link
              href={`/clients/${c.id}`}
              className="font-semibold text-gray-900 hover:text-brand-700"
            >
              {/* Stretch the main link over the whole row (buttons stay on top). */}
              <span className="absolute inset-0" aria-hidden />
              {c.clientName}
            </Link>
            <p
              className={`truncate text-sm ${
                c.reminderState === "overdue" ? "text-status-overdue" : "text-gray-500"
              }`}
            >
              {reasonLine(c)}
            </p>
          </div>

          <PriorityBadge level={c.priorityLevel} />

          <Link
            href={`/record?clientId=${c.id}`}
            className="btn-secondary relative hidden px-2.5 py-1.5 text-xs sm:inline-flex"
            title={`Record a meeting with ${c.clientName}`}
          >
            <Mic className="h-3.5 w-3.5" />
            Record
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 group-hover:text-gray-400" />
        </li>
      ))}
    </ol>
  );
}
