# opencode-aiusage-plugin

Show `ai-usagebar` subscription quotas in the OpenCode TUI: a risk footer plus a session panel via `/usage`.

## Prerequisite

`ai-usagebar` must be on `PATH`:

```sh
which ai-usagebar
ai-usagebar usage --json | head -c 500
```

## Configuration

Config key is `plugins` (with an **s**). Minimal example:

```jsonc
{ "plugins": [{ "package": "./opencode-aiusage-plugin", "options": { "refreshSeconds": 120 } }] }
```

Options:

| Key | Default | Meaning |
| --- | ------- | ------- |
| `binary` | `"ai-usagebar"` | Binary to execute |
| `args` | `[]` | Extra args appended after `usage --json` |
| `refreshSeconds` | `300` | Poll interval in seconds (minimum `30`) |
| `footer` | `"risk"` | Footer mode; `"off"` disables it |

## Commands

- `/usage` (aliases: `quotas`) — opens a session panel with per-vendor quotas, resets, and pace. Requires an open session; outside a session it shows a toast.
- Palette `Show AI usage quotas` — same panel as `/usage`.
- Palette `Refresh AI usage quotas` — force a refresh.
- Auto-refresh on `refreshSeconds` plus a refresh on `session.execution.succeeded`.

## License

MIT — see [LICENSE](./LICENSE).
