/** @jsxImportSource @opentui/solid */
import type { UsageDocument } from "../usagebar/types";
import { formatFooterLabel, getRiskyEntries } from "../usagebar/format";

export function FooterText(props: { doc: UsageDocument | null }): string {
  if (props.doc === null) return "";
  const risky = getRiskyEntries(props.doc);
  if (risky.length === 0) return "";
  return risky.map(({ entry, metric }) => formatFooterLabel(entry, metric)).join(" · ");
}
