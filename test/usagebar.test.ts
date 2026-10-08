import { describe, expect, test } from "bun:test";
import {
  formatFooterLabel,
  getRiskyEntries,
  isMetricAtRisk,
  parsePace,
  riskiestMetric,
  severityRank,
} from "../src/usagebar/format";
import {
  formatEntryError,
  formatEntryHeader,
  formatMetricLine,
  summarizeEntry,
  windowLabel,
} from "../src/usagebar/summary";
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

describe("windowLabel", () => {
  test("humanizes common windows", () => {
    expect(windowLabel(18000)).toBe("5h");
    expect(windowLabel(604800)).toBe("7d");
    expect(windowLabel(2592000)).toBe("30d");
  });

  test("rounds non-exact windows to the nearest unit of the largest fitting magnitude", () => {
    expect(windowLabel(539419)).toBe("6d");
    expect(windowLabel(2678400)).toBe("31d");
    expect(windowLabel(5400)).toBe("2h");
    expect(windowLabel(3600)).toBe("1h");
    expect(windowLabel(90)).toBe("2m");
    expect(windowLabel(45)).toBe("45s");
  });

  test("empty for null, undefined and non-positive", () => {
    expect(windowLabel(null)).toBe("");
    expect(windowLabel(undefined)).toBe("");
    expect(windowLabel(0)).toBe("");
  });
});

describe("formatMetricLine", () => {
  test("value, resets and pace, dropping the elapsed segment", () => {
    const line = formatMetricLine(
      metric({
        label: "Weekly",
        percent: 62,
        value: "62%",
        detail: "Resets in 3d 9h · 51% elapsed · 11pts ahead",
        severity: "mid",
      }),
    );
    expect(line).toBe("62% · Resets in 3d 9h · ↑ 11pts");
  });

  test("value and resets only when there is no pace", () => {
    const line = formatMetricLine(
      metric({
        label: "Rolling window (5h)",
        percent: 0,
        value: "0%",
        detail: "Resets in 0h 28m",
        severity: "low",
      }),
    );
    expect(line).toBe("0% · Resets in 0h 28m");
  });

  test("uses a down arrow for under-pace usage", () => {
    const line = formatMetricLine(zaiSession);
    expect(line).toContain("↓ 3pts");
    expect(line).not.toContain("under");
  });

  test("on track wording", () => {
    const line = formatMetricLine(
      metric({
        label: "Codex 5h",
        percent: 0,
        value: "0%",
        detail: "Resets in 4h 59m · 0% elapsed · on track",
        severity: "low",
      }),
    );
    expect(line).toBe("0% · Resets in 4h 59m · on track");
  });
});

describe("summarizeEntry", () => {
  test("shows Gemini and Claude & GPT OSS quotas separately for antigravity", () => {
    const vendor = entry({
      id: "antigravity",
      display_name: "Antigravity",
      metrics: [
        metric({ label: "Gemini", percent: 5, value: "5%", detail: "Resets in 3h 14m", severity: "low", window_secs: 18000 }),
        metric({ label: "Claude & GPT OSS", percent: 0, value: "0%", detail: "Resets in 4h 24m", severity: "low", window_secs: 18000 }),
        metric({ label: "Gemini", percent: 12, value: "12%", detail: "Resets in 1d 22h", severity: "low", window_secs: 604800 }),
        metric({ label: "Claude & GPT OSS", percent: 48, value: "48%", detail: "Resets in 5d 16h", severity: "low", window_secs: 604800 }),
      ],
    });
    const rows = summarizeEntry(vendor);
    expect(rows.map((r) => `${r.group} ${r.label}`)).toEqual([
      "Gemini 5h",
      "Gemini 7d",
      "Claude & GPT OSS 5h",
      "Claude & GPT OSS 7d",
    ]);
    expect(rows[3]?.text).toContain("48%");
  });

  test("shows Cursor Models and Other Models separately for cursor", () => {
    const vendor = entry({
      id: "cursor",
      display_name: "Cursor",
      metrics: [
        metric({ label: "Cursor Models", percent: 49, value: "49%", detail: "Auto + Composer · 21% elapsed · 28pts ahead", severity: "low", window_secs: 2678400 }),
        metric({ label: "Other Models", percent: 100, value: "100%", detail: "Named / API models · on-demand off · 21% elapsed · 79pts ahead", severity: "critical", window_secs: 2678400 }),
      ],
    });
    const rows = summarizeEntry(vendor);
    expect(rows.map((r) => `${r.group} ${r.label}`)).toEqual([
      "Cursor Models 31d",
      "Other Models 31d",
    ]);
    expect(rows[0]?.text).toContain("49%");
    expect(rows[0]?.text).toContain("↑ 28pts");
    expect(rows[1]?.text).toContain("100%");
    expect(rows[1]?.text).toContain("↑ 79pts");
  });

  test("keeps the 5h, 7d and 30d windows for opencode-go", () => {
    const vendor = entry({
      id: "opencode-go",
      display_name: "OpenCode Go",
      metrics: [
        metric({ label: "Rolling (5h)", percent: 0, value: "0%", detail: "Resets in 2h 31m", severity: "low", window_secs: 18000 }),
        metric({ label: "Weekly (7d)", percent: 3, value: "3%", detail: "Resets in 4d 4h", severity: "low", window_secs: 604800 }),
        metric({ label: "Monthly", percent: 53, value: "53%", detail: "Resets in 2d 0h", severity: "mid", window_secs: null }),
      ],
    });
    const rows = summarizeEntry(vendor);
    expect(rows.map((r) => r.label)).toEqual(["5h", "7d", "30d"]);
    expect(rows[0]?.text).toContain("0%");
    expect(rows[1]?.text).toContain("3%");
    expect(rows[2]?.text).toContain("53%");
  });

  test("ignores MCP monthly quotas from other vendors", () => {
    const vendor = entry({
      id: "zai",
      display_name: "Z.AI",
      metrics: [
        metric({ label: "Session (5h)", percent: 7, value: "7%", detail: "Resets in 4h 38m", severity: "low", window_secs: 18000 }),
        metric({ label: "Weekly", percent: 72, value: "72%", detail: "Resets in 2d 1h", severity: "high", window_secs: 604800 }),
        metric({ label: "MCP tools (monthly)", percent: 16, value: "16%", detail: "Resets in 12d 0h", severity: "low", window_secs: 2592000 }),
      ],
    });
    const rows = summarizeEntry(vendor);
    expect(rows.map((r) => r.label)).toEqual(["5h", "7d"]);
    expect(JSON.stringify(rows)).not.toContain("16%");
  });

  test("picks the highest-percent metric within a window category", () => {
    const vendor = entry({
      id: "multi-model",
      display_name: "Multi Model",
      metrics: [
        metric({ label: "Gemini", percent: 4, value: "4%", detail: "Resets in 4h 21m", severity: "low", window_secs: 18000 }),
        metric({ label: "Claude & GPT OSS", percent: 40, value: "40%", detail: "Resets in 4h 59m", severity: "mid", window_secs: 18000 }),
        metric({ label: "Gemini weekly", percent: 16, value: "16%", detail: "Resets in 21h 28m", severity: "low", window_secs: 604800 }),
        metric({ label: "Claude weekly", percent: 2, value: "2%", detail: "Resets in 6d 23h", severity: "low", window_secs: 604800 }),
      ],
    });
    const rows = summarizeEntry(vendor);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.text).toContain("40%");
    expect(rows[1]?.text).toContain("16%");
  });

  test("single-window fallback for vendors without 5h/7d", () => {
    const vendor = entry({
      id: "weird",
      display_name: "Weird",
      metrics: [
        metric({ label: "Daily", percent: 10, value: "10%", detail: "Resets in 3h", severity: "low", window_secs: 86400 }),
        metric({ label: "Monthly", percent: 20, value: "20%", detail: "Resets in 10d", severity: "low", window_secs: 2592000 }),
      ],
    });
    const rows = summarizeEntry(vendor);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.label).toBe("1d");
    expect(rows[0]?.text).toContain("10%");
  });

  test("empty for vendor without metrics", () => {
    expect(summarizeEntry(commandcodeEntry)).toEqual([]);
  });
});

describe("formatEntryHeader", () => {
  test("name and plan", () => {
    const withPlan = entry({ ...zaiEntry, plan: "GLM Coding Pro" });
    expect(formatEntryHeader(withPlan)).toBe("Z.AI · GLM Coding Pro");
  });

  test("no plan segment when null", () => {
    expect(formatEntryHeader(commandcodeEntry)).toBe("Command Code");
  });
});

describe("formatEntryError", () => {
  test("null for ready vendors", () => {
    expect(formatEntryError(zaiEntry)).toBeNull();
  });

  test("compact single line with vendor name", () => {
    const line = formatEntryError(commandcodeEntry);
    expect(line).toContain("Command Code");
    expect(line).toContain("credentials error");
    expect(line?.length).toBeLessThan(120);
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
