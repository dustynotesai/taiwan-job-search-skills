# yourator-cli

CLI for searching jobs on [Yourator](https://www.yourator.co), the Taiwan startup and tech job board.

**Data source**: Yourator's public JSON API (`/api/v4/jobs` and `/api/v4/companies/<slug>/jobs`).
**Authentication**: None required.
**Dependencies**: None (plain `bun` + `fetch`). `bun install` is optional and only pulls dev type defs.

> **Personal use only.** Keep volume low, don't use it commercially or for bulk data
> collection, and run it on your own responsibility.

## Installation

```bash
cd .agents/skills/yourator-search/cli
bun install   # optional — only installs TypeScript dev types
```

If Windows blocks `bun.exe` (Smart App Control), the CLI also runs under Node:
`npx tsx src/cli.ts search ...`.

## Commands

| Command | Description |
|---------|-------------|
| `search` | Search job listings (keyword, city, sort, updated-within) |
| `detail` | Summary, category, salary and apply link for one posting |

`search` accepts `--format json|table|plain` (default `json`); `detail` accepts `--format json|plain`.
All errors are written to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Quick examples

```bash
bun run src/cli.ts search -q "backend" -l Taipei --format table
bun run src/cli.ts search -q "後端工程師" -l "台北,新北" --sort recent --format table
bun run src/cli.ts detail Pinkoi/48495 --format plain
```

The detail summary is capped at 200 characters by the API; see `../SKILL.md` for how to
get the full posting. Endpoint notes are in `../url-reference.md`.
