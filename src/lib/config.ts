// Centralised runtime configuration read from environment variables.

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function floatEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  /** Default follow-up interval before enough history exists (PRD §7.1). */
  defaultIntervalDays: intEnv("DEFAULT_INTERVAL_DAYS", 30),
  /** Days before the suggested date that a client is flagged "due soon". */
  dueSoonLeadDays: intEnv("DUE_SOON_LEAD_DAYS", 7),
  /**
   * How far ahead the Suggested Visits panel looks. Any client due within this
   * many days (or already overdue) is shown, so the rep sees the next few
   * weeks at a glance rather than only what's due right now.
   */
  suggestionHorizonDays: intEnv("SUGGESTION_HORIZON_DAYS", 28),
  /**
   * How far a suggested date may shift from the due date to batch a visit onto
   * a day the rep is already out visiting other clients.
   */
  suggestionBatchFlexDays: intEnv("SUGGESTION_BATCH_FLEX_DAYS", 6),
  /** Most recent N gaps used by the interval estimator (PRD §7.5). */
  intervalWindow: intEnv("INTERVAL_WINDOW", 5),
  /**
   * Yearly client value (£) that counts as a "top client" when scoring
   * priority — a client worth this much scores full marks on the value axis.
   */
  priorityValueReference: intEnv("PRIORITY_VALUE_REFERENCE", 100000),

  /**
   * Sales-health thresholds for spotting clients whose ordering has slipped.
   */
  sales: {
    /** Fractional fall in recent vs prior orders that counts as a drop. */
    dropThreshold: floatEnv("SALES_DROP_THRESHOLD", 0.3),
    /** Consecutive recent zero-order months that count as "stopped". */
    stoppedMonths: intEnv("SALES_STOPPED_MONTHS", 2),
  },

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
    /** Optional: column naming the account owner / sales rep. */
    repColumn: process.env.POWERBI_REP_COLUMN || "",
    /** Optional: full custom DAX query overriding the generated one. */
    daxQuery: process.env.POWERBI_DAX_QUERY || "",
    /**
     * Optional sales-history columns. When a date column is given, the sync
     * also pulls month-by-month sales per client to power the sales-health
     * alerts (volume drop / stopped ordering / product shift).
     */
    dateColumn: process.env.POWERBI_DATE_COLUMN || "",
    categoryColumn: process.env.POWERBI_CATEGORY_COLUMN || "",
    unitsColumn: process.env.POWERBI_UNITS_COLUMN || "",
    /** Optional: full custom DAX for the monthly sales-history query. */
    salesHistoryDax: process.env.POWERBI_SALES_HISTORY_DAX || "",
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
  /** Whether Power BI can also supply month-by-month sales history. */
  get salesHistoryEnabled() {
    const p = this.powerbi;
    return Boolean(
      this.powerbiEnabled &&
        (p.salesHistoryDax || (p.dateColumn && p.table && p.nameColumn && p.valueColumn)),
    );
  },
};
