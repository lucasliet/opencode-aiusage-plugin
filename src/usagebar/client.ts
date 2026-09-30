import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { UsageDocument } from "./types.ts";

const execFileAsync = promisify(execFile);

export interface FetchOptions {
  binary?: string;
  args?: string[];
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 30000;
const STDOUT_PREVIEW_CHARS = 500;

const inFlight = new Map<string, Promise<UsageDocument>>();

export async function fetchUsage(opts?: FetchOptions): Promise<UsageDocument> {
  const binary = opts?.binary ?? "ai-usagebar";
  const extraArgs = opts?.args ?? [];
  const key = JSON.stringify([binary, extraArgs]);
  const ongoing = inFlight.get(key);
  if (ongoing) return ongoing;
  const task = runFetch(binary, extraArgs, opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS, opts?.signal);
  const tracked: Promise<UsageDocument> = task.finally(() => {
    if (inFlight.get(key) === tracked) inFlight.delete(key);
  });
  inFlight.set(key, tracked);
  return tracked;
}

async function runFetch(
  binary: string,
  extraArgs: string[],
  timeoutMs: number,
  signal: AbortSignal | undefined,
): Promise<UsageDocument> {
  const fullArgs = ["usage", "--json", ...extraArgs];
  const controller = new AbortController();
  const onExternalAbort = (): void => {
    controller.abort(signal?.reason);
  };
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener("abort", onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => {
    const timeoutErr: Error & { code?: string } = new Error(`${binary} timed out after ${timeoutMs}ms`);
    timeoutErr.code = "ETIMEDOUT";
    controller.abort(timeoutErr);
  }, timeoutMs);
  try {
    let stdout: string;
    try {
      const result = await execFileAsync(binary, fullArgs, {
        signal: controller.signal,
        timeout: timeoutMs,
      });
      stdout = result.stdout;
    } catch (e: unknown) {
      if (isTimeoutError(e)) {
        const err: Error & { code?: string; cause?: unknown } = new Error(
          `${binary} ${fullArgs.join(" ")} timed out after ${timeoutMs}ms. Check binary responsiveness or raise timeoutMs.`,
        );
        err.code = "ETIMEDOUT";
        err.cause = e;
        throw err;
      }
      throw new Error(
        `Failed to run ${binary} ${fullArgs.join(" ")}: ${messageOf(e)}. Ensure the binary is installed and on PATH.`,
      );
    }
    return parseDocument(stdout, binary);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

function parseDocument(stdout: string, binary: string): UsageDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch (e: unknown) {
    throw new Error(
      `Failed to parse ${binary} JSON output: ${messageOf(e)}. stdout (truncated): ${truncate(stdout)}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as { entries?: unknown }).entries)) {
    throw new Error(
      `Unexpected ${binary} JSON shape: expected object with entries[]. stdout (truncated): ${truncate(stdout)}`,
    );
  }
  return parsed as UsageDocument;
}

function truncate(s: string, max = STDOUT_PREVIEW_CHARS): string {
  return s.length > max ? `${s.slice(0, max)}… (${s.length} chars total)` : s;
}

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "unknown error";
}

export function isTimeoutError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  let current: unknown = e;
  for (let depth = 0; depth < 5 && current !== null && typeof current === "object"; depth += 1) {
    const record = current as Record<string, unknown>;
    if (record["code"] === "ETIMEDOUT" || record["code"] === "ERR_USAGE_FETCH_TIMEOUT") return true;
    if (record["name"] === "TimeoutError") return true;
    const message = record["message"];
    if (typeof message === "string" && /timed?\s*out|ETIMEDOUT/i.test(message)) return true;
    if (record["killed"] === true && record["code"] !== "ABORT_ERR" && record["name"] !== "AbortError") {
      return true;
    }
    current = record["cause"];
  }
  return false;
}
