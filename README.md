# opencode-aiusage-plugin

Show `ai-usagebar` subscription quotas in the OpenCode TUI's right sidebar.

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
| `timeoutMs` | `30000` | Maximum time to wait for `ai-usagebar` |

## Commands

- Palette `Refresh AI usage quotas` — force a refresh.
- The sidebar shows each configured vendor, plan, quota percentage, reset/pacing details, and credential errors.
- Auto-refresh runs every `refreshSeconds`.

## License

MIT — see [LICENSE](./LICENSE).
