"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteButton({
  url,
  redirectTo,
  label = "Delete",
  confirmText = "Delete this? This can't be undone.",
  className = "btn-ghost text-status-overdue hover:bg-red-50",
  iconOnly = false,
}: {
  url: string;
  redirectTo?: string;
  label?: string;
  confirmText?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (!window.confirm(confirmText)) return;
    setBusy(true);
    try {
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error();
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch {
      window.alert("Sorry — that couldn't be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={onClick} disabled={busy} className={className} title={label}>
      <Trash2 className="h-4 w-4" />
      {!iconOnly && <span>{busy ? "Deleting…" : label}</span>}
    </button>
  );
}
