import { notFound } from "next/navigation";
import { getClient } from "@/lib/clients";
import { PageHeader } from "@/components/PageHeader";
import { ClientForm } from "@/components/ClientForm";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClient(id);
  if (!client) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={`Edit ${client.clientName}`} />
      <ClientForm client={client} />
    </div>
  );
}
