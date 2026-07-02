"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { fmtDate } from "@/lib/format";

interface Status {
  configured: boolean;
  missing: string[];
  linked: number;
  withValue: number;
  total: number;
  lastSyncedAt: string | null;
}

interface SyncSuggestion {
  clientId: string;
  clientName: string;
  score: number;
}

interface SyncResult {
  rowsFetched: number;
  updated: { clientId: string; clientName: string; powerBiName: string; value: number | null }[];
  created: { clientId: string; clientName: string; value: number | null }[];
  unmatched: { powerBiName: string; value: number | null; suggestions: SyncSuggestion[] }[];
}

function fmtValue(v: number | null): string {
  if (v == null) return "—";
  return `£${Math.round(v).toLocaleString("en-GB")}/yr`;
}

export function PowerBiPanel({ status }: { status: Status }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [createMissing, setCreateMissing] = useState(false);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  async function runSync() {
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/powerbi/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createMissing }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed.");
      setResult(data.result);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function linkRow(
    row: SyncResult["unmatched"][number],
    clientId: string,
  ) {
    setBusyRow(row.powerBiName);
    setError(null);
    try {
      const res = await fetch("/api/powerbi/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, powerBiName: row.powerBiName, value: row.value }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Couldn't link the client.");
      }
      setResult((r) =>
        r
          ? { ...r, unmatched: r.unmatched.filter((u) => u.powerBiName !== row.powerBiName) }
          : r,
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't link the client.");
    } finally {
      setBusyRow(null);
    }
  }

  async function createRow(row: SyncResult["unmatched"][number]) {
    setBusyRow(row.powerBiName);
    setError(null);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName: row.powerBiName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create the client.");
      await linkRow(row, data.client.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the client.");
      setBusyRow(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Connection status */}
      <div className="card card-pad">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <BarChart3 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold text-gray-900">Connection</h2>
              <p className="flex items-center gap-1.5 text-sm">
                {status.configured ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-status-recent" />
                    <span className="text-gray-600">Ready to sync</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-status-overdue" />
                    <span className="text-gray-600">Not configured yet</span>
                  </>
                )}
              </p>
            </div>
          </div>
          {status.configured && (
            <button onClick={runSync} disabled={syncing} className="btn-primary">
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync now
            </button>
          )}
        </div>

        {status.configured ? (
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-gray-50 py-3">
              <div className="text-lg font-semibold text-gray-900">
                {status.linked}/{status.total}
              </div>
              <div className="text-gray-500">clients linked</div>
            </div>
            <div className="rounded-lg bg-gray-50 py-3">
              <div className="text-lg font-semibold text-gray-900">{status.withValue}</div>
              <div className="text-gray-500">with a value</div>
            </div>
            <div className="rounded-lg bg-gray-50 py-3">
              <div className="text-lg font-semibold text-gray-900">
                {fmtDate(status.lastSyncedAt, "Never")}
              </div>
              <div className="text-gray-500">last synced</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Missing settings in <code className="font-mono">.env</code>:{" "}
            <span className="font-mono">{status.missing.join(", ")}</span>. Follow the
            step-by-step guide below, then restart the app.
          </div>
        )}

        {status.configured && (
          <label className="mt-4 flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={createMissing}
              onChange={(e) => setCreateMissing(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Also create clients that are in Power BI but not in this app yet
          </label>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-status-overdue">
          {error}
        </div>
      )}

      {/* Sync results */}
      {result && (
        <div className="card card-pad space-y-4">
          <h2 className="section-title">Sync results</h2>
          <p className="text-sm text-gray-600">
            {result.rowsFetched} rows from Power BI — {result.updated.length} matched
            {result.created.length > 0 && <>, {result.created.length} created</>}
            {result.unmatched.length > 0 && <>, {result.unmatched.length} need a decision</>}.
          </p>

          {result.unmatched.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-900">
                Couldn&apos;t match automatically
              </h3>
              {result.unmatched.map((row) => (
                <div key={row.powerBiName} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-900">{row.powerBiName}</span>
                    <span className="text-gray-500">{fmtValue(row.value)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {row.suggestions.map((s) => (
                      <button
                        key={s.clientId}
                        onClick={() => linkRow(row, s.clientId)}
                        disabled={busyRow === row.powerBiName}
                        className="btn-secondary text-xs"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Link to {s.clientName} ({Math.round(s.score * 100)}%)
                      </button>
                    ))}
                    <button
                      onClick={() => createRow(row)}
                      disabled={busyRow === row.powerBiName}
                      className="btn-secondary text-xs"
                    >
                      {busyRow === row.powerBiName ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Create new client
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.updated.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-900">
                Show the {result.updated.length} matched clients
              </summary>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {result.updated.map((u) => (
                  <li key={u.clientId} className="flex justify-between gap-3">
                    <span>
                      {u.powerBiName}
                      {u.powerBiName !== u.clientName && <> → {u.clientName}</>}
                    </span>
                    <span className="text-gray-400">{fmtValue(u.value)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Setup guide */}
      <details className="card card-pad group" open={!status.configured}>
        <summary className="flex cursor-pointer items-center justify-between font-semibold text-gray-900">
          How to connect Power BI (one-time setup)
          <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180" />
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-gray-600">
          <li>
            Go to <span className="font-medium">portal.azure.com</span> → Microsoft Entra ID →
            App registrations → <span className="font-medium">New registration</span>. Name it
            e.g. &ldquo;Client Calendar&rdquo;.
          </li>
          <li>
            Copy the <span className="font-medium">Application (client) ID</span> and{" "}
            <span className="font-medium">Directory (tenant) ID</span> into{" "}
            <code className="font-mono text-xs">POWERBI_CLIENT_ID</code> and{" "}
            <code className="font-mono text-xs">POWERBI_TENANT_ID</code> in the app&apos;s{" "}
            <code className="font-mono text-xs">.env</code> file.
          </li>
          <li>
            In the app registration → Certificates &amp; secrets →{" "}
            <span className="font-medium">New client secret</span>. Copy the secret{" "}
            <em>value</em> into <code className="font-mono text-xs">POWERBI_CLIENT_SECRET</code>.
          </li>
          <li>
            In <span className="font-medium">app.powerbi.com</span> → Settings → Admin portal →
            Tenant settings → Developer settings → enable{" "}
            <span className="font-medium">Service principals can use Power BI APIs</span>.
          </li>
          <li>
            Open the workspace with your sales report → Manage access →{" "}
            <span className="font-medium">Add the app as a Member</span>.
          </li>
          <li>
            Copy the workspace and dataset IDs from the dataset&apos;s URL
            (app.powerbi.com/groups/<em>workspace-id</em>/datasets/<em>dataset-id</em>) into{" "}
            <code className="font-mono text-xs">POWERBI_WORKSPACE_ID</code> and{" "}
            <code className="font-mono text-xs">POWERBI_DATASET_ID</code>.
          </li>
          <li>
            Set <code className="font-mono text-xs">POWERBI_CLIENT_TABLE</code>,{" "}
            <code className="font-mono text-xs">POWERBI_CLIENT_NAME_COLUMN</code> and{" "}
            <code className="font-mono text-xs">POWERBI_VALUE_COLUMN</code> to the table and
            columns that hold the client name and the sales amount. Sales are summed per
            client automatically.
          </li>
          <li>Restart the app, come back here and press Sync now.</li>
        </ol>
      </details>
    </div>
  );
}
