import type { UsageEntry, UsageMetric } from "./types.ts";
import { parsePace } from "./format.ts";

const SHORT_WINDOW_SECS = 18000;
const WEEKLY_WINDOW_SECS = 604800;

export interface UsageRow {
  label: string;
  text: string;
}

/** Humanizes a window length: 18000 → "5h", 604800 → "7d", 2592000 → "30d". */
export function windowLabel(secs: number | null | undefined): string {
  if (typeof secs !== "number" || !Number.isFinite(secs) || secs <= 0) return "";
  if (secs >= 86400 && secs % 86400 === 0) return `${secs / 86400}d`;
  if (secs >= 3600 && secs % 3600 === 0) return `${secs / 3600}h`;
  if (secs >= 60 && secs % 60 === 0) return `${secs / 60}m`;
  return `${secs}s`;
}

function highestPercent(metrics: UsageMetric[]): UsageMetric | null {
  let best: UsageMetric | null = null;
  for (const metric of metrics) {
    if (typeof metric.percent !== "number") continue;
    if (best === null || metric.percent > (best.percent ?? -Infinity)) best = metric;
  }
  return best ?? metrics[0] ?? null;
}

/** Formats the metric value, reset countdown, and compact pace indicator. */
export function formatMetricLine(metric: UsageMetric): string {
  const parts: string[] = [];
  if (metric.value) parts.push(metric.value);
  const detail = metric.detail ?? "";
  const resets = detail
    .split("·")
    .map((part) => part.trim())
    .find((part) => /^resets/i.test(part));
  if (resets) parts.push(resets);
  const pace = parsePace(detail);
  if (pace) {
    if (pace.kind === "ontrack") parts.push("on track");
    else parts.push(`${pace.kind === "ahead" ? "↑" : "↓"} ${pace.points}pts`);
  }
  return parts.join(" · ");
}

/**
 * opencode-go reports its monthly LLM quota with window_secs null, so the 30d row
 * is matched by label. Scoped to this entry only: z.ai's "MCP tools (monthly)" is
 * an MCP quota and must not surface.
 */
const MONTHLY_LLM_ENTRY_ID = "opencode-go";

function monthlyLlmMetric(entry: UsageEntry): UsageMetric | null {
  if (entry.id !== MONTHLY_LLM_ENTRY_ID) return null;
  return entry.metrics.find((m) => /monthly/i.test(m.label)) ?? null;
}

/**
 * Compact per-vendor rows: at most the 5h and 7d windows (highest-percent metric each),
 * plus a 30d row exclusively for opencode-go.
 * Vendors with neither window fall back to a single row from their first metric.
 */
export function summarizeEntry(entry: UsageEntry): UsageRow[] {
  const metrics = entry.metrics ?? [];
  const short = highestPercent(metrics.filter((m) => m.window_secs === SHORT_WINDOW_SECS));
  const weekly = highestPercent(metrics.filter((m) => m.window_secs === WEEKLY_WINDOW_SECS));
  const monthly = monthlyLlmMetric(entry);
  const picked = [short, weekly, monthly].filter((m): m is UsageMetric => m !== null);
  const rows = picked.length > 0 ? picked : metrics.length > 0 ? [metrics[0]!] : [];
  return rows.map((metric) => ({
    label: metric === monthly ? "30d" : windowLabel(metric.window_secs),
    text: formatMetricLine(metric),
  }));
}

export function formatEntryHeader(entry: UsageEntry): string {
  const name = entry.display_name || entry.id;
  const plan = entry.plan ? ` · ${entry.plan}` : "";
  return `${name}${plan}`;
}

export function formatEntryError(entry: UsageEntry): string | null {
  if (!entry.error) return null;
  const text = entry.error.length > 80 ? `${entry.error.slice(0, 80)}…` : entry.error;
  return `${entry.display_name || entry.id} · ${text}`;
}
