export type Severity = "low" | "mid" | "high" | "critical";

export interface UsageMetric {
  label: string;
  percent: number | null;
  value: string;
  detail: string | null;
  reset_at: string | null;
  severity: Severity;
  window_secs: number | null;
  headline: string | null;
}

export interface ResetCredit {
  title: string;
  expires_at: string | null;
}

export interface UsageEntry {
  id: string;
  brand: string | null;
  name: string | null;
  display_name: string;
  short_name: string | null;
  icon: string | null;
  plan: string | null;
  error: string | null;
  status: string;
  stale: boolean;
  fetched_at: string | null;
  metrics: UsageMetric[];
  reset_credits: { available: number; credits: ResetCredit[] } | null;
}

export interface UsageDocument {
  schema_version: number;
  primary: string | null;
  entries: UsageEntry[];
}

/** Ready when the vendor fetched cleanly (surfaces in footer + panel metrics). */
export function isReadyEntry(e: UsageEntry): boolean {
  return e.status === "ready" && !e.error;
}

/** True when the vendor carries its own credential/fetch error. */
export function hasError(e: UsageEntry): boolean {
  return e.status === "error" || e.error != null;
}
