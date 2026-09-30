/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js";
import type { JSX } from "solid-js";
import type { UsageDocument } from "../usagebar/types";

export interface UsagePanelProps {
  doc: UsageDocument | null;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
  refreshSeconds?: number;
}

export function UsagePanel(props: UsagePanelProps): JSX.Element {
  const interval = (): number => props.refreshSeconds ?? 300;
  return (
    <>
      <Show when={props.loading && props.doc === null}>
        <text>Loading usage quotas…</text>
      </Show>
      <Show when={props.error !== null && props.error !== ""}>
        <text>{props.error ?? ""}</text>
      </Show>
      <Show when={props.doc !== null}>
        <For each={props.doc?.entries ?? []}>
          {(entry) => (
            <>
              <text>
                {entry.display_name || entry.id}
                {entry.plan ? ` — ${entry.plan}` : ""}
                {props.doc?.primary === entry.id ? " (primary)" : ""}
                {entry.stale === true ? " [stale]" : ""}
              </text>
              <Show when={entry.error !== null && entry.error !== ""}>
                <text>{entry.error ?? ""}</text>
              </Show>
              <For each={entry.metrics}>
                {(metric) => (
                  <text>
                    {metric.label} {metric.value}
                    {metric.detail !== null && metric.detail !== "" ? ` · ${metric.detail}` : ""}
                    {` [${metric.severity}]`}
                  </text>
                )}
              </For>
              <Show when={entry.reset_credits !== null}>
                <text>reset credits available {entry.reset_credits?.available ?? 0}</text>
                <For each={entry.reset_credits?.credits ?? []}>
                  {(credit) => (
                    <text>
                      {credit.title}
                      {credit.expires_at !== null && credit.expires_at !== "" ? ` · expires ${credit.expires_at}` : ""}
                    </text>
                  )}
                </For>
              </Show>
            </>
          )}
        </For>
      </Show>
      <text>auto-refresh every {interval()}s · palette: AI Usage: Refresh quotas</text>
    </>
  );
}
