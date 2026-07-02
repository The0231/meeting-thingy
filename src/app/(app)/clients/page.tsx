import Link from "next/link";
import { Plus } from "lucide-react";
import { getClients } from "@/lib/clients";
import { PageHeader } from "@/components/PageHeader";
import { ClientsExplorer, type FilterKey } from "@/components/ClientsExplorer";

const FILTER_KEYS: FilterKey[] = [
  "all",
  "attention",
  "overdue",
  "due_soon",
  "on_track",
  "no_history",
  "paused",
];

function isFilterKey(v: string | undefined): v is FilterKey {
  return FILTER_KEYS.includes(v as FilterKey);
}

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const sp = await searchParams;
  const clients = await getClients();
  const initialFilter = isFilterKey(sp.filter) ? sp.filter : "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} clients, sorted by visit priority — the ones to see first are at the top`}
        action={
          <Link href="/clients/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            New client
          </Link>
        }
      />
      <ClientsExplorer clients={clients} initialFilter={initialFilter} />
    </div>
  );
}
