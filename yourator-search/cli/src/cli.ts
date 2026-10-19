#!/usr/bin/env bun
// Self-contained CLI for searching jobs on Yourator (Taiwan startup / tech job
// board) through the public JSON API its own search page uses. No external CLI
// framework and zero runtime dependencies.
//
// Personal use only. Keep volume low (a handful of requests, not a crawl).

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { AREAS, areaCode } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("--") || a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const AREA_LIST = Object.entries(AREAS)
  .map(([code, name]) => `${code}=${name}`)
  .join(", ")

const HELP = `yourator-cli — search jobs on Yourator (Taiwan)

USAGE
  bun run src/cli.ts search [flags]
  bun run src/cli.ts detail <url|company-slug/id> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (title, skill, role; Chinese or English). Recommended.
  --location, -l <list>   Comma-separated cities: area codes or names, e.g. "TPE",
                          "Taipei", "台北", "TPE,NWT". Default: all of Taiwan.
                          Codes: ${AREA_LIST}
  --sort <mode>           relevance (default) | recent (reorders the fetched page by
                          last-updated; the API's own recent sort loosens matching).
  --jobage <days>         Keep postings UPDATED within N days (1, 7, 14, 30 buckets;
                          Yourator has no posting date). Filters the fetched page only.
  --page <n>              1-indexed page (20 results/page). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "backend" -l Taipei --format table
  bun run src/cli.ts search -q "後端工程師" -l "台北,新北" --sort recent --format table
  bun run src/cli.ts search -q "AI engineer" -l TPE --jobage 7 --format table
  bun run src/cli.ts detail https://www.yourator.co/companies/Pinkoi/jobs/48495 --format plain
  bun run src/cli.ts detail Pinkoi/48495

Personal use only — keep volume low.
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "sort", "jobage", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

function fail(error: string, code: string): number {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
  return 1
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  // Reject unknown flags instead of silently discarding them: a discarded
  // filter changes what the search returns with no error.
  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      return fail(
        `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
        "UNKNOWN_FLAG",
      )
    }
  }

  if (cmd === "search") {
    if (flags.query !== undefined && (typeof flags.query !== "string" || !flags.query.trim())) {
      return fail("--query requires a non-empty value", "BAD_ARG")
    }

    let areas: string[] = []
    if (flags.location !== undefined) {
      if (typeof flags.location !== "string" || !flags.location.trim()) {
        return fail("--location requires a value, e.g. -l TPE or -l Taipei", "BAD_ARG")
      }
      for (const part of flags.location.split(",").map((s) => s.trim()).filter(Boolean)) {
        const code = areaCode(part)
        if (!code) {
          return fail(`unknown location "${part}" - use one of: ${AREA_LIST}`, "BAD_ARG")
        }
        if (!areas.includes(code)) areas.push(code)
      }
    }

    const sort = flags.sort !== undefined ? String(flags.sort) : "relevance"
    if (!["relevance", "recent"].includes(sort)) {
      return fail(`--sort must be one of relevance|recent, got "${sort}"`, "BAD_ARG")
    }
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "table", "plain"].includes(fmt)) {
      return fail(`--format must be one of json|table|plain, got "${fmt}"`, "BAD_ARG")
    }

    // Number(), not parseInt(): parseInt truncates "0.5" to 0. Whole numbers >= 1 only.
    const intFlag = (name: string): number | undefined | null => {
      const raw = flags[name]
      if (raw === undefined) return undefined
      const val = typeof raw === "string" ? Number(raw.trim()) : NaN
      if (!Number.isInteger(val) || val < 1) {
        fail(`--${name} must be a whole number of at least 1, got "${raw}"`, "BAD_ARG")
        return null
      }
      return val
    }
    const jobage = intFlag("jobage")
    const page = intFlag("page")
    const limit = intFlag("limit")
    if (jobage === null || page === null || limit === null) return 1

    const opts: SearchOpts = {
      query: typeof flags.query === "string" ? flags.query.trim() : undefined,
      areas,
      sort: sort as SearchOpts["sort"],
      jobage,
      page: page ?? 1,
      limit,
      format: fmt as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  if (cmd === "detail") {
    const ref = (flags._ as string[])[1]
    if (!ref) return fail('detail requires a job URL or "<company-slug>/<id>"', "NO_ID")
    const fmt = flags.format !== undefined ? String(flags.format) : "json"
    if (!["json", "plain"].includes(fmt)) {
      return fail(`--format must be one of json|plain, got "${fmt}"`, "BAD_ARG")
    }
    const opts: DetailOpts = { ref, format: fmt as DetailOpts["format"] }
    return runDetail(opts)
  }

  return fail(`Unknown command "${cmd}"`, "BAD_CMD")
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
        code: "INTERNAL_ERROR",
      }) + "\n",
    )
    process.exit(1)
  })
