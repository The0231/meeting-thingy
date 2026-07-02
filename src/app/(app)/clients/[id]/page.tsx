import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, Mic, Pencil, Phone } from "lucide-react";
import { getClient } from "@/lib/clients";
import { getMeetings } from "@/lib/meetings";
import { dueDescription, fmtDate, fmtMoney } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { PriorityBadge } from "@/components/PriorityBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfidenceMeter } from "@/components/ConfidenceMeter";
import { MeetingTimeline } from "@/components/MeetingTimeline";
import { ScheduleMeetingButton } from "@/components/ScheduleMeetingButton";
import { IntervalControl } from "@/components/IntervalControl";
import { DeleteButton } from "@/components/DeleteButton";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();
  const meetings = await getMeetings({ clientId: id });

  const hasDetails =
    client.phone ||
    client.email ||
    client.tags.length > 0 ||
    client.notes;

  return (
    <div className="space-y-6">
      <PageHeader
        title={client.clientName}
        subtitle={client.businessName ?? client.contactName ?? undefined}
        action={
          <div className="flex gap-2">
            <Link href={`/record?clientId=${id}`} className="btn-primary">
              <Mic className="h-4 w-4" />
              Record meeting
            </Link>
            <Link href={`/clients/${id}/edit`} className="btn-secondary">
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
            <DeleteButton
              url={`/api/clients/${id}`}
              redirectTo="/clients"
              label="Delete"
              confirmText="Delete this client and all its meetings?"
              className="btn-secondary text-status-overdue"
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="section-title">Meeting history</h2>
          <MeetingTimeline
            meetings={meetings}
            emptyHint="No meetings logged yet. Record one to start learning this client's rhythm."
          />
        </div>

        <div className="space-y-4">
          <div className="card card-pad">
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge state={client.reminderState} />
              <PriorityBadge level={client.priorityLevel} />
            </div>
            {client.priorityLevel !== "none" && (
              <p className="mt-2 text-xs text-gray-400">
                Visit priority {client.priorityScore}/100 — from how overdue the
                visit is, what the client is worth and how often you usually meet.
              </p>
            )}
            <p className="mt-3 text-xl font-semibold text-gray-900">
              {dueDescription(
                client.reminderState,
                client.daysUntilDue,
                client.daysOverdue,
              )}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-500">Next suggested</dt>
                <dd className="text-gray-900">{fmtDate(client.nextSuggestedDate)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-500">Last met</dt>
                <dd className="text-gray-900">{fmtDate(client.lastMeetingDate)}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-500">Rhythm</dt>
                <dd className="text-gray-900">{client.intervalLabel}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-500">Meetings logged</dt>
                <dd className="text-gray-900">{client.meetingCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-gray-500">Value per year</dt>
                <dd className="text-gray-900">
                  {fmtMoney(client.annualValue, "Not set")}
                  {client.valueSource === "powerbi" && (
                    <span className="ml-1 text-xs text-gray-400">(Power BI)</span>
                  )}
                </dd>
              </div>
            </dl>
            {!client.setupCompleted && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Not set up yet — you&apos;ll be asked how often you normally visit
                them when you record the first meeting.
              </p>
            )}
            {client.learnedIntervalDays != null && (
              <ConfidenceMeter
                confidence={client.confidence}
                score={client.confidenceScore}
                className="mt-3"
              />
            )}
          </div>

          <ScheduleMeetingButton clientId={id} suggestedDate={client.nextSuggestedDate} />

          <IntervalControl client={client} />

          {hasDetails && (
            <div className="card card-pad">
              <h2 className="section-title mb-3">Details</h2>
              <div className="space-y-3 text-sm">
                {client.phone && (
                  <a
                    href={`tel:${client.phone}`}
                    className="flex items-center gap-2 text-gray-700 hover:text-brand-700"
                  >
                    <Phone className="h-4 w-4 text-gray-400" />
                    {client.phone}
                  </a>
                )}
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="flex items-center gap-2 text-gray-700 hover:text-brand-700"
                  >
                    <Mail className="h-4 w-4 text-gray-400" />
                    {client.email}
                  </a>
                )}
                {client.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {client.tags.map((tag) => (
                      <span key={tag} className="badge bg-gray-100 text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {client.notes && (
                  <p className="whitespace-pre-wrap text-gray-600">{client.notes}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
