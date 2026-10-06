/** @jsxImportSource @opentui/solid */
import { Plugin } from "@opencode/plugin/tui";
import { createSignal } from "solid-js";
import type { UsageDocument } from "./src/usagebar/types.ts";
import { fetchUsage } from "./src/usagebar/client.ts";
import { UsagePanel } from "./src/tui/usage-panel.tsx";

export default Plugin.define({
  id: "aiusage.tui",
  setup(context) {
    const options = (context.options ?? {}) as {
      binary?: unknown;
      args?: unknown;
      timeoutMs?: unknown;
      refreshSeconds?: unknown;
    };
    const binary = typeof options.binary === "string" && options.binary !== "" ? options.binary : "ai-usagebar";
    const args = Array.isArray(options.args) && options.args.every((arg) => typeof arg === "string")
      ? (options.args as string[])
      : [];
    const timeoutMs = typeof options.timeoutMs === "number" ? options.timeoutMs : undefined;
    const refreshSeconds = Math.max(
      typeof options.refreshSeconds === "number" ? options.refreshSeconds : 300,
      30,
    );

    const [doc, setDoc] = createSignal<UsageDocument | null>(null);
    const [error, setError] = createSignal<string | null>(null);
    const [loading, setLoading] = createSignal(false);
    let request: AbortController | undefined;

    async function refresh(): Promise<void> {
      if (loading()) return;
      const controller = new AbortController();
      request = controller;
      setLoading(true);
      try {
        setDoc(await fetchUsage({ binary, args, timeoutMs, signal: controller.signal }));
        setError(null);
      } catch (cause: unknown) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Failed to read ai-usagebar quotas");
        }
      } finally {
        if (request === controller) {
          request = undefined;
          setLoading(false);
        }
      }
    }

    const stopSidebar = context.ui.slot({
      append: "sidebar.content",
      render: () => <UsagePanel doc={doc()} error={error()} loading={loading()} fg={context.theme.text.muted} />,
    });
    const stopApp = context.ui.slot({
      append: "app",
      render: () => {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "aiusage.quotas.refresh",
              title: "Refresh AI usage quotas",
              group: "AI Usage",
              palette: true,
              run: () => void refresh(),
            },
          ],
        }));
        return null;
      },
    });

    void refresh();
    const timer = setInterval(() => void refresh(), refreshSeconds * 1000);

    return () => {
      clearInterval(timer);
      request?.abort();
      stopSidebar();
      stopApp();
    };
  },
});
