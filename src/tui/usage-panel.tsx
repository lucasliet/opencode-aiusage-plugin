/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js";
import type { JSX } from "solid-js";
import type { UsageDocument } from "../usagebar/types.ts";
import {
  formatEntryError,
  formatEntryHeader,
  summarizeEntry,
} from "../usagebar/summary.ts";

export interface UsagePanelProps {
  doc: UsageDocument | null;
  error: string | null;
  loading: boolean;
}

export function UsagePanel(props: UsagePanelProps): JSX.Element {
  return (
    <box flexDirection="column" gap={1}>
      <Show when={props.loading && props.doc === null}>
        <text>Loading quotas…</text>
      </Show>
      <Show when={props.error !== null && props.error !== ""}>
        <text>{props.error ?? ""}</text>
      </Show>
      <Show when={props.doc !== null}>
        <For each={props.doc?.entries ?? []}>
          {(entry) => (
            <box flexDirection="column">
              <text>{formatEntryHeader(entry, props.doc?.primary)}</text>
              <For each={summarizeEntry(entry)}>
                {(row) => (
                  <text>
                    {row.label ? `${row.label} · ` : ""}
                    {row.text}
                  </text>
                )}
              </For>
              <Show when={formatEntryError(entry) !== null}>
                <text>{formatEntryError(entry) ?? ""}</text>
              </Show>
            </box>
          )}
        </For>
      </Show>
    </box>
  );
}
