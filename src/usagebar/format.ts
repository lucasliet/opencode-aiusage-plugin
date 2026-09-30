import type { Severity, UsageDocument, UsageEntry, UsageMetric } from "./types.ts";

export interface PaceInfo {
  kind: "ahead" | "under" | "ontrack";
  points: number;
}

/** Extrai pace do detail: "Npts ahead|under" (tolera espaço entre número e "pt"/"pts", case-insensitive) ou "on track" = em ritmo. */
export function parsePace(detail: string | null | undefined): PaceInfo | null {
  if (!detail) return null;
  const m = detail.match(/(\d+)\s*pts?\s+(ahead|under)/i);
  if (m) {
    const points = Number.parseInt(m[1] ?? "0", 10);
    const kind = (m[2] ?? "ahead").toLowerCase() === "under" ? "under" : "ahead";
    return { kind, points: Number.isNaN(points) ? 0 : points };
  }
  if (/on track/i.test(detail)) return { kind: "ontrack", points: 0 };
  return null;
}

/** Risco = pace "ahead"; sem pace no detail, fallback para severity high/critical. Sem percent numérico nunca é risco. */
export function isMetricAtRisk(m: UsageMetric): boolean {
  if (typeof m.percent !== "number" || Number.isNaN(m.percent)) return false;
  const pace = parsePace(m.detail);
  if (pace !== null) return pace.kind === "ahead";
  return m.severity === "high" || m.severity === "critical";
}

export function riskiestMetric(entry: UsageEntry): UsageMetric | null {
  let best: UsageMetric | null = null;
  let bestPct = -Infinity;
  for (const m of entry.metrics ?? []) {
    if (!isMetricAtRisk(m)) continue;
    const pct = typeof m.percent === "number" && !Number.isNaN(m.percent) ? m.percent : -Infinity;
    if (pct > bestPct) {
      bestPct = pct;
      best = m;
    }
  }
  return best;
}

export function getRiskyEntries(
  doc: UsageDocument | null | undefined,
): Array<{ entry: UsageEntry; metric: UsageMetric }> {
  if (!doc) return [];
  const out: Array<{ entry: UsageEntry; metric: UsageMetric }> = [];
  for (const entry of doc.entries ?? []) {
    if (entry.status !== "ready") continue;
    if (entry.error) continue;
    const metric = riskiestMetric(entry);
    if (metric !== null) out.push({ entry, metric });
  }
  out.sort((a, b) => {
    const pa = typeof a.metric.percent === "number" && !Number.isNaN(a.metric.percent) ? a.metric.percent : -Infinity;
    const pb = typeof b.metric.percent === "number" && !Number.isNaN(b.metric.percent) ? b.metric.percent : -Infinity;
    return pb - pa;
  });
  return out;
}

export function isPrimary(entry: UsageEntry, doc: UsageDocument): boolean {
  return doc.primary === entry.id;
}

export function formatFooterLabel(entry: UsageEntry, metric: UsageMetric): string {
  const rawValue = metric.value;
  const value =
    typeof rawValue === "string" && rawValue !== ""
      ? rawValue
      : typeof metric.percent === "number" && !Number.isNaN(metric.percent)
        ? `${metric.percent}%`
        : "";
  const icon = entry.icon;
  if (typeof icon === "string" && icon !== "") return value === "" ? icon : `${icon} ${value}`;
  const name = entry.short_name || entry.display_name || entry.id || "";
  return value === "" ? name : `${name} ${value}`;
}

export function severityRank(s: Severity): number {
  if (s === "critical") return 3;
  if (s === "high") return 2;
  if (s === "mid") return 1;
  return 0;
}
