import type { UsageEntry, UsageMetric } from "./types.ts";
import { parsePace } from "./format.ts";

const SHORT_WINDOW_SECS = 18000;
const WEEKLY_WINDOW_SECS = 604800;

export interface UsageRow {
  label: string;
  text: string;
  group?: string;
}

const WINDOW_UNITS: ReadonlyArray<{ suffix: string; secs: number }> = [
  { suffix: "d", secs: 86400 },
  { suffix: "h", secs: 3600 },
  { suffix: "m", secs: 60 },
];

/**
 * Humanizes a window length using the largest unit that fits, rounded to the nearest
 * whole number: 18000 → "5h", 604800 → "7d", 539419 → "6d" (vendors such as Grok Bot
 * report windows that are not exact multiples), 45 → "45s".
 */
export function windowLabel(secs: number | null | undefined): string {
  if (typeof secs !== "number" || !Number.isFinite(secs) || secs <= 0) return "";
  const unit = WINDOW_UNITS.find((candidate) => secs >= candidate.secs);
  if (!unit) return `${Math.round(secs)}s`;
  return `${Math.round(secs / unit.secs)}${unit.suffix}`;
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
 * Antigravity meters Gemini and Claude & GPT OSS as independent quotas per window,
 * and Cursor meters Cursor Models and Other Models as independent monthly quotas,
 * so each one gets its own row instead of being collapsed into the highest percent.
 */
const PER_MODEL_ENTRY_IDS: ReadonlySet<string> = new Set(["antigravity", "cursor"]);

function summarizePerModel(entry: UsageEntry): UsageRow[] {
  const models = [...new Set(entry.metrics.map((metric) => metric.label))];
  const windows = [...new Set(entry.metrics.map((metric) => metric.window_secs))].sort((a, b) => {
    if (a === b) return 0;
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;
    return a - b;
  });
  return models.flatMap((model) =>
    windows.flatMap((windowSecs) =>
      entry.metrics
        .filter((metric) => metric.label === model && metric.window_secs === windowSecs)
        .map((metric) => ({
          group: model,
          label: windowLabel(windowSecs),
          text: formatMetricLine(metric),
        })),
    ),
  );
}

/**
 * Compact per-vendor rows: at most the 5h and 7d windows (highest-percent metric each),
 * plus a 30d row exclusively for opencode-go. Antigravity and Cursor report
 * independent per-model quotas, so each model gets its own row.
 * Vendors with neither window fall back to a single row from their first metric.
 */
export function summarizeEntry(entry: UsageEntry): UsageRow[] {
  const metrics = entry.metrics ?? [];
  if (PER_MODEL_ENTRY_IDS.has(entry.id)) {
    const rows = summarizePerModel(entry);
    if (rows.length > 0) return rows;
  }
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
  const showPlan = entry.plan && entry.plan.toLowerCase() !== name.toLowerCase();
  const plan = showPlan ? ` · ${entry.plan}` : "";
  return `${name}${plan}`;
}

export function formatEntryError(entry: UsageEntry): string | null {
  if (!entry.error) return null;
  const text = entry.error.length > 80 ? `${entry.error.slice(0, 80)}…` : entry.error;
  return `${entry.display_name || entry.id} · ${text}`;
}
