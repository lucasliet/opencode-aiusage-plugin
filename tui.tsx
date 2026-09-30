/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import { createSignal, Show } from "solid-js";
import type { UsageDocument } from "./src/usagebar/types";
import { fetchUsage } from "./src/usagebar/client";
import { getRiskyEntries, severityRank } from "./src/usagebar/format";
import { FooterText } from "./src/tui/footer";
import { UsagePanel } from "./src/tui/usage-panel";

export default Plugin.define({
  id: "aiusage.tui",
  setup(context) {
    const rawOptions = (context.options ?? {}) as {
      binary?: unknown;
      args?: unknown;
      timeoutMs?: unknown;
      footer?: unknown;
      refreshSeconds?: unknown;
    };
    const binary = typeof rawOptions.binary === "string" && rawOptions.binary !== "" ? rawOptions.binary : "ai-usagebar";
    const args =
      Array.isArray(rawOptions.args) && rawOptions.args.every((a) => typeof a === "string")
        ? (rawOptions.args as string[])
        : [];
    const timeoutMs = typeof rawOptions.timeoutMs === "number" ? rawOptions.timeoutMs : undefined;
    const footerMode = rawOptions.footer === "off" ? "off" : "risk";
    const refreshSeconds = Math.max(
      typeof rawOptions.refreshSeconds === "number" ? rawOptions.refreshSeconds : 300,
      30,
    );

    const [doc, setDoc] = createSignal<UsageDocument | null>(null);
    const [error, setError] = createSignal<string | null>(null);
    const [loading, setLoading] = createSignal<boolean>(false);

    let inFlight: AbortController | null = null;

    function refresh(): void {
      if (loading()) return;
      if (inFlight !== null) inFlight.abort();
      const controller = new AbortController();
      inFlight = controller;
      setLoading(true);
      void fetchUsage({ binary, args, timeoutMs, signal: controller.signal }).then(
        (next) => {
          if (inFlight !== controller) return;
          setDoc(next);
          setError(null);
        },
        (cause: unknown) => {
          if (inFlight !== controller) return;
          setError(cause instanceof Error ? cause.message : "Failed to fetch usage quotas");
        },
      ).finally(() => {
        if (inFlight !== controller) return;
        inFlight = null;
        setLoading(false);
      });
    }

    const footerText = (): string => FooterText({ doc: doc() });

    function footerColor(): string {
      const text = footerText();
      if (text === "") return context.theme.text.muted;
      const stressed = getRiskyEntries(doc()).some(
        ({ metric }) => severityRank(metric.severity) >= severityRank("high"),
      );
      return stressed ? context.theme.text.base : context.theme.text.muted;
    }

    function renderFooter() {
      const text = footerText();
      if (text === "") return <></>;
      return <text fg={footerColor()}>{text}</text>;
    }

    const cleanups: Array<() => void> = [];
    function track(cleanup: unknown): void {
      if (typeof cleanup === "function") cleanups.push(cleanup as () => void);
    }

    if (footerMode !== "off") {
      track(context.ui.slot({ append: "home.footer.status", render: () => renderFooter() }));
      track(context.ui.slot({ append: "prompt.footer.status", render: () => renderFooter() }));
    }

    track(
      context.ui.slot({
        append: "session.panel",
        render: (panel: { name: string }) => (
          <Show when={panel.name === "aiusage.quotas"}>
            <UsagePanel
              doc={doc()}
              error={error()}
              loading={loading()}
              onRefresh={refresh}
              refreshSeconds={refreshSeconds}
            />
          </Show>
        ),
      }),
    );

    track(
      context.keymap.layer(() => ({
        mode: "global",
        commands: [
          {
            id: "aiusage.quotas.open",
            title: "Show AI usage quotas",
            group: "AI Usage",
            palette: true,
            slash: { name: "usage", aliases: ["quotas"] },
            run: () => {
              const opened = context.ui.panel.open("aiusage.quotas");
              if (!opened) context.ui.toast.show({ message: "Open a session to view quotas", variant: "info" });
            },
          },
          {
            id: "aiusage.quotas.refresh",
            title: "Refresh AI usage quotas",
            group: "AI Usage",
            palette: true,
            run: () => {
              refresh();
            },
          },
        ],
        bindings: ["aiusage.quotas.open"],
      })),
    );

    let lastEventRefresh = 0;
    track(
      context.data.on("session.execution.succeeded", () => {
        const now = Date.now();
        if (now - lastEventRefresh < 1000) return;
        lastEventRefresh = now;
        refresh();
      }),
    );

    refresh();
    const timer = setInterval(refresh, refreshSeconds * 1000);

    return () => {
      clearInterval(timer);
      if (inFlight !== null) inFlight.abort();
      for (const cleanup of cleanups) cleanup();
    };
  },
});
