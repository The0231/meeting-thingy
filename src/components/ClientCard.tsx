import Link from "next/link";
import { Banknote, CalendarClock, Repeat } from "lucide-react";
import { fmtDate, fmtMoney, dueDescription } from "@/lib/format";
import { REMINDER_STATE_COLOR, type ClientDTO } from "@/lib/types";
import { TONE_CLASSES } from "@/lib/ui";
import { PriorityBadge } from "./PriorityBadge";
import { StatusBadge } from "./StatusBadge";

export function ClientCard({ client }: { client: ClientDTO }) {
  const tone = REMINDER_STATE_COLOR[client.reminderState];
  const c = TONE_CLASSES[tone];
  return (
    <Link
      href={`/clients/${client.id}`}
      className="card group block overflow-hidden transition-shadow hover:shadow-cardhover"
    >
      <div className={`h-1 w-full ${c.bar}`} />
      <div className="card-pad">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-gray-900 group-hover:text-brand-700">
              {client.clientName}
            </h3>
            {client.businessName && (
              <p className="truncate text-sm text-gray-500">{client.businessName}</p>
            )}
          </div>
          <StatusBadge state={client.reminderState} />
        </div>

        <div className="mt-4 space-y-1.5 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 shrink-0 text-gray-400" />
            <span className={tone === "overdue" ? "font-medium text-status-overdue" : ""}>
              {dueDescription(client.reminderState, client.daysUntilDue, client.daysOverdue)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Repeat className="h-4 w-4 shrink-0 text-gray-400" />
            <span>{client.intervalLabel}</span>
            {client.meetingCount > 0 && (
              <span className="text-gray-400">· last met {fmtDate(client.lastMeetingDate)}</span>
            )}
          </div>
          {client.annualValue != null && (
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 shrink-0 text-gray-400" />
              <span>{fmtMoney(client.annualValue)}/year</span>
            </div>
          )}
        </div>

        {(client.priorityLevel !== "none" || client.tags.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <PriorityBadge level={client.priorityLevel} />
            {client.tags.slice(0, 4).map((t) => (
              <span key={t} className="badge bg-gray-100 text-gray-600">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
