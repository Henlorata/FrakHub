/** The database's size against the free plan, measured by the daily housekeeping (private.app_state "db_health"). */
export interface DbHealth {
  bytes: number;
  limit_bytes: number;
  measured_at: string;
  largest: {table: string; bytes: number}[];
}

/** Share of the free plan's database used (whole percent). */
export const dbUsedPercent = (health: Pick<DbHealth, "bytes" | "limit_bytes"> | null | undefined) =>
  health && health.limit_bytes > 0 ? Math.round((health.bytes / health.limit_bytes) * 100) : null;
