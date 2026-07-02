// Centralised runtime configuration read from environment variables.

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  /** Default follow-up interval before enough history exists (PRD §7.1). */
  defaultIntervalDays: intEnv("DEFAULT_INTERVAL_DAYS", 30),
  /** Days before the suggested date that a client is flagged "due soon". */
  dueSoonLeadDays: intEnv("DUE_SOON_LEAD_DAYS", 7),
  /** Most recent N gaps used by the interval estimator (PRD §7.5). */
  intervalWindow: intEnv("INTERVAL_WINDOW", 5),
  /**
   * Yearly client value (£) that counts as a "top client" when scoring
   * priority — a client worth this much scores full marks on the value axis.
   */
  priorityValueReference: intEnv("PRIORITY_VALUE_REFERENCE", 100000),

  // Power BI dataset the client list & sales values are synced from.
  powerbi: {
    tenantId: process.env.POWERBI_TENANT_ID || "",
    clientId: process.env.POWERBI_CLIENT_ID || "",
    clientSecret: process.env.POWERBI_CLIENT_SECRET || "",
    workspaceId: process.env.POWERBI_WORKSPACE_ID || "",
    datasetId: process.env.POWERBI_DATASET_ID || "",
    /** Table + columns holding client name and monetary value. */
    table: process.env.POWERBI_CLIENT_TABLE || "",
    nameColumn: process.env.POWERBI_CLIENT_NAME_COLUMN || "",
    valueColumn: process.env.POWERBI_VALUE_COLUMN || "",
    /** Optional: full custom DAX query overriding the generated one. */
    daxQuery: process.env.POWERBI_DAX_QUERY || "",
  },

  ai: {
    anthropicKey: process.env.ANTHROPIC_API_KEY || "",
    model: process.env.AI_MODEL || "claude-haiku-4-5-20251001",
    openaiKey: process.env.OPENAI_API_KEY || "",
    transcribeModel: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
  },

  get aiSummaryEnabled() {
    return Boolean(this.ai.anthropicKey);
  },
  get serverTranscribeEnabled() {
    return Boolean(this.ai.openaiKey);
  },
  get powerbiEnabled() {
    const p = this.powerbi;
    return Boolean(
      p.tenantId &&
        p.clientId &&
        p.clientSecret &&
        p.datasetId &&
        (p.daxQuery || (p.table && p.nameColumn && p.valueColumn)),
    );
  },
};
