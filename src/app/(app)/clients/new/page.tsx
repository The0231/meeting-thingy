import { PageHeader } from "@/components/PageHeader";
import { ClientForm } from "@/components/ClientForm";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New client"
        subtitle="Add a client — only the name is required."
      />
      <ClientForm />
    </div>
  );
}
