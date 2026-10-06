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
  fg: string;
}

export function UsagePanel(props: UsagePanelProps): JSX.Element {
  return (
    <box flexDirection="column" gap={1}>
      <Show when={props.loading && props.doc === null}>
        <text fg={props.fg}>Loading quotas…</text>
      </Show>
      <Show when={props.error !== null && props.error !== ""}>
        <text fg={props.fg}>{props.error ?? ""}</text>
      </Show>
      <Show when={props.doc !== null}>
        <For each={props.doc?.entries ?? []}>
          {(entry) => (
            <box flexDirection="column">
              <text fg={props.fg}>{formatEntryHeader(entry)}</text>
              <For each={summarizeEntry(entry)}>
                {(row, index) => (
                  <>
                    <Show when={row.group && row.group !== summarizeEntry(entry)[index() - 1]?.group}>
                      <text fg={props.fg}>{row.group}</text>
                    </Show>
                    <text fg={props.fg}>
                      {row.group ? "  " : ""}
                      {row.label ? `${row.label} · ` : ""}
                      {row.text}
                    </text>
                  </>
                )}
              </For>
              <Show when={formatEntryError(entry) !== null}>
                <text fg={props.fg}>{formatEntryError(entry) ?? ""}</text>
              </Show>
            </box>
          )}
        </For>
      </Show>
    </box>
  );
}
