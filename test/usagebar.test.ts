import { describe, expect, test } from "bun:test";
import {
  formatFooterLabel,
  getRiskyEntries,
  isMetricAtRisk,
  isPrimary,
  parsePace,
  riskiestMetric,
  severityRank,
} from "../src/usagebar/format";
import type {
  UsageDocument,
  UsageEntry,
  UsageMetric,
} from "../src/usagebar/types";

function metric(
  overrides: Partial<UsageMetric> & { label: string },
): UsageMetric {
  return {
    percent: 0,
    value: "",
    detail: null,
    reset_at: null,
    severity: "low",
    window_secs: null,
    headline: null,
    ...overrides,
  };
}

function entry(
  overrides: Partial<UsageEntry> & { id: string },
): UsageEntry {
  return {
    brand: null,
    name: null,
    display_name: "",
    short_name: null,
    icon: null,
    plan: null,
    error: null,
    status: "ready",
    stale: false,
    fetched_at: null,
    metrics: [],
    reset_credits: null,
    ...overrides,
  };
}

const openaiWeekly = metric({
  label: "Codex weekly",
  percent: 93,
  value: "93%",
  detail: "Resets in 4d 0h · 42% elapsed · 51pts ahead",
  reset_at: null,
  severity: "critical",
  window_secs: null,
  headline: null,
});

const openaiFiveHour = metric({
  label: "Codex 5h",
  percent: 0,
  value: "0%",
  detail: "Resets in 4h 59m · 0% elapsed · on track",
  reset_at: null,
  severity: "low",
  window_secs: null,
  headline: null,
});

const zaiSession = metric({
  label: "Session",
  percent: 1,
  value: "1%",
  detail: "Resets in 4h 38m · 7% elapsed · 3pts under",
  reset_at: null,
  severity: "low",
  window_secs: null,
  headline: null,
});

const kimiRolling = metric({
  label: "Rolling window",
  percent: 0,
  value: "0%",
  detail: "Resets in 0h 28m",
  reset_at: null,
  severity: "low",
  window_secs: null,
  headline: null,
});

const kimiWeekly = metric({
  label: "Weekly",
  percent: 80,
  value: "80%",
  detail: "Resets in 2d 15h",
  reset_at: null,
  severity: "high",
  window_secs: null,
  headline: null,
});

const openaiEntry = entry({
  id: "openai",
  brand: "openai",
  name: "Codex",
  display_name: "Codex",
  short_name: "Codex",
  icon: "󱢆",
  plan: null,
  error: null,
  status: "ready",
  stale: false,
  fetched_at: null,
  metrics: [openaiWeekly, openaiFiveHour],
  reset_credits: null,
});

const zaiEntry = entry({
  id: "zai",
  brand: "zai",
  name: "Z.AI",
  display_name: "Z.AI",
  short_name: "Z.AI",
  icon: "⚡",
  plan: null,
  error: null,
  status: "ready",
  stale: false,
  fetched_at: null,
  metrics: [zaiSession],
  reset_credits: null,
});

const kimiEntry = entry({
  id: "kimi",
  brand: "kimi",
  name: "Kimi",
  display_name: "Kimi",
  short_name: "Kimi",
  icon: "◍",
  plan: null,
  error: null,
  status: "ready",
  stale: false,
  fetched_at: null,
  metrics: [kimiRolling, kimiWeekly],
  reset_credits: null,
});

const commandcodeEntry = entry({
  id: "commandcode",
  brand: "commandcode",
  name: "Command Code",
  display_name: "Command Code",
  short_name: "Command Code",
  icon: null,
  plan: null,
  error: "credentials error: Command Code is not signed in.",
  status: "error",
  stale: false,
  fetched_at: null,
  metrics: [],
  reset_credits: null,
});

const doc: UsageDocument = {
  schema_version: 1,
  primary: "zai",
  entries: [openaiEntry, zaiEntry, kimiEntry, commandcodeEntry],
};

describe("parsePace", () => {
  test("ahead kind with points", () => {
    const pace = parsePace("Resets in 4d 0h · 42% elapsed · 51pts ahead");
    expect(pace).not.toBeNull();
    expect(pace?.kind).toBe("ahead");
    expect(pace?.points).toBe(51);
  });

  test("under kind with points", () => {
    const pace = parsePace("Resets in 4h 38m · 7% elapsed · 3pts under");
    expect(pace).not.toBeNull();
    expect(pace?.kind).toBe("under");
    expect(pace?.points).toBe(3);
  });

  test("ontrack kind for on track", () => {
    const pace = parsePace("Resets in 4h 59m · 0% elapsed · on track");
    expect(pace).not.toBeNull();
    expect(pace?.kind).toBe("ontrack");
  });

  test("null when detail carries no pace", () => {
    expect(parsePace("Resets in 0h 28m")).toBeNull();
    expect(parsePace("Resets in 2d 15h")).toBeNull();
  });

  test("null for null, undefined and empty string", () => {
    expect(parsePace(null)).toBeNull();
    expect(parsePace(undefined)).toBeNull();
    expect(parsePace("")).toBeNull();
  });
});

describe("isMetricAtRisk", () => {
  test("true for 93% critical ahead of pace", () => {
    expect(isMetricAtRisk(openaiWeekly)).toBe(true);
  });

  test("false for metric under pace", () => {
    expect(isMetricAtRisk(zaiSession)).toBe(false);
  });

  test("false for metric on track", () => {
    expect(isMetricAtRisk(openaiFiveHour)).toBe(false);
  });

  test("true for 80% high without pace", () => {
    expect(isMetricAtRisk(kimiWeekly)).toBe(true);
  });

  test("false for 0% low without pace", () => {
    expect(isMetricAtRisk(kimiRolling)).toBe(false);
  });

  test("false when percent is null", () => {
    const nullPercent = metric({
      label: "Credits",
      percent: null,
      value: "",
      detail: "Resets in 2d 15h",
      severity: "critical",
    });
    expect(isMetricAtRisk(nullPercent)).toBe(false);
  });
});

describe("getRiskyEntries", () => {
  test("returns openai then kimi ordered by percent desc", () => {
    const risky = getRiskyEntries(doc);
    expect(risky.length).toBe(2);
    expect(risky[0]?.entry.id).toBe("openai");
    expect(risky[0]?.metric.percent).toBe(93);
    expect(risky[1]?.entry.id).toBe("kimi");
    expect(risky[1]?.metric.percent).toBe(80);
  });

  test("excludes zai and commandcode", () => {
    const risky = getRiskyEntries(doc);
    const ids = risky.map((r) => r.entry.id);
    expect(ids).not.toContain("zai");
    expect(ids).not.toContain("commandcode");
  });

  test("empty for a clean doc", () => {
    const clean: UsageDocument = {
      schema_version: 1,
      primary: "zai",
      entries: [zaiEntry, commandcodeEntry],
    };
    expect(getRiskyEntries(clean)).toEqual([]);
  });

  test("empty for null and undefined", () => {
    expect(getRiskyEntries(null)).toEqual([]);
    expect(getRiskyEntries(undefined)).toEqual([]);
  });
});

describe("riskiestMetric", () => {
  test("picks 93% weekly for openai", () => {
    const best = riskiestMetric(openaiEntry);
    expect(best?.percent).toBe(93);
    expect(best?.label).toBe("Codex weekly");
  });

  test("picks 80% weekly for kimi", () => {
    const best = riskiestMetric(kimiEntry);
    expect(best?.percent).toBe(80);
  });

  test("null when nothing is at risk", () => {
    expect(riskiestMetric(zaiEntry)).toBeNull();
    expect(riskiestMetric(commandcodeEntry)).toBeNull();
  });
});

describe("formatFooterLabel", () => {
  test("icon from entry plus value", () => {
    const label = formatFooterLabel(openaiEntry, openaiWeekly);
    expect(label).toContain("󱢆");
    expect(label).toContain("93%");
  });

  test("fallback to display_name without icon", () => {
    const bare = entry({
      id: "zai",
      brand: "zai",
      name: "Z.AI",
      display_name: "Z.AI",
      short_name: "Z.AI",
      icon: null,
      plan: null,
      error: null,
      status: "ready",
      stale: false,
      fetched_at: null,
      metrics: [zaiSession],
      reset_credits: null,
    });
    const label = formatFooterLabel(bare, zaiSession);
    expect(label).toContain("Z.AI");
  });
});

describe("isPrimary", () => {
  test("true for the primary entry", () => {
    expect(isPrimary(zaiEntry, doc)).toBe(true);
  });

  test("false for a non-primary entry", () => {
    expect(isPrimary(openaiEntry, doc)).toBe(false);
  });
});

describe("severityRank", () => {
  test("exact ranks low 0, mid 1, high 2, critical 3", () => {
    expect(severityRank("low")).toBe(0);
    expect(severityRank("mid")).toBe(1);
    expect(severityRank("high")).toBe(2);
    expect(severityRank("critical")).toBe(3);
  });

  test("orders low < mid < high < critical", () => {
    expect(severityRank("low")).toBeLessThan(severityRank("mid"));
    expect(severityRank("mid")).toBeLessThan(severityRank("high"));
    expect(severityRank("high")).toBeLessThan(severityRank("critical"));
  });
});
