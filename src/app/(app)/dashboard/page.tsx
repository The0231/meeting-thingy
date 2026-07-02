import Link from "next/link";
import { CheckCircle2, Mic, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { EmptyState } from "@/components/EmptyState";
import { MeetingTypeIcon } from "@/components/MeetingTypeIcon";
import { VisitNextList } from "@/components/VisitNextList";
import { getDashboard } from "@/lib/dashboard";
import { fmtDate } from "@/lib/format";

export default async function DashboardPage() {
  const data = await getDashboard();
  // Overdue and due-soon clients merged into one priority-ranked list.
  const visitNext = [...data.overdue, ...data.dueSoon]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Your client relationships at a glance"
        action={
          <Link href="/record" className="btn-primary">
            <Mic className="h-4 w-4" />
            Record meeting
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Overdue"
          value={data.totals.overdue}
          tone="overdue"
          href="/clients?filter=overdue"
          hint="past their usual visit"
        />
        <StatCard
          label="Due soon"
          value={data.totals.dueSoon}
          tone="soon"
          href="/clients?filter=due_soon"
          hint="coming up this week"
        />
        <StatCard
          label="On track"
          value={data.totals.onTrack}
          tone="recent"
          href="/clients?filter=on_track"
          hint="recently visited"
        />
        <StatCard
          label="Not visited yet"
          value={data.totals.noHistory}
          tone="paused"
          href="/clients?filter=no_history"
          hint="no meetings recorded"
        />
        <StatCard
          label="All clients"
          value={data.totals.clients}
          tone="scheduled"
          href="/clients"
          hint="view the full list"
        />
      </div>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="section-title">Who to visit next</h2>
          <p className="muted hidden sm:block">
            Ranked by how overdue they are, their value and their usual rhythm
          </p>
        </div>
        {visitNext.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10" />}
            title="All caught up"
            hint="No clients are overdue or due soon."
          />
        ) : (
          <VisitNextList clients={visitNext} />
        )}
      </section>

      {data.intervalChanged.length > 0 && (
        <section>
          <h2 className="section-title mb-3">Rhythm changes</h2>
          <div className="card card-pad">
            <ul className="space-y-3">
              {data.intervalChanged.map(({ client, fromLabel, toLabel }) => (
                <li key={client.id} className="flex items-center gap-3 text-sm">
                  <TrendingUp className="h-4 w-4 shrink-0 text-gray-400" />
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-medium text-gray-900 hover:text-brand-700"
                  >
                    {client.clientName}
                  </Link>
                  <span className="text-gray-500">
                    was {fromLabel} &rarr; now {toLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card card-pad">
          <h2 className="section-title mb-3">Upcoming meetings</h2>
          {data.upcomingMeetings.length === 0 ? (
            <p className="muted">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-3">
              {data.upcomingMeetings.map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <MeetingTypeIcon type={m.meetingType} className="h-4 w-4 shrink-0 text-gray-400" />
                  <Link
                    href={`/clients/${m.clientId}`}
                    className="font-medium text-gray-900 hover:text-brand-700"
                  >
                    {m.clientName}
                  </Link>
                  <span className="ml-auto text-gray-500">{fmtDate(m.meetingDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card card-pad">
          <h2 className="section-title mb-3">Recently logged</h2>
          {data.recentMeetings.length === 0 ? (
            <p className="muted">No meetings logged yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentMeetings.map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-sm">
                  <MeetingTypeIcon type={m.meetingType} className="h-4 w-4 shrink-0 text-gray-400" />
                  <Link
                    href={`/clients/${m.clientId}`}
                    className="font-medium text-gray-900 hover:text-brand-700"
                  >
                    {m.clientName}
                  </Link>
                  <span className="ml-auto text-gray-500">{fmtDate(m.meetingDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
