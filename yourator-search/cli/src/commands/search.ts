import {
  SEARCH_URL,
  jsonFetch,
  toCard,
  updatedWithinDays,
  writeError,
  type ApiJob,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  areas: string[]
  sort: "relevance" | "recent"
  jobage?: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

interface SearchResponse {
  payload?: { hasMore?: boolean; jobs?: ApiJob[] }
}

export function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.append("term[]", opts.query)
  for (const a of opts.areas) params.append("area[]", a)
  // Never send sort=recent_updated: Yourator loosens keyword matching under it
  // ("後端工程師" came back with 法務專員 first). Omitting sort keeps the default
  // relevance match; --sort recent reorders the fetched page client-side.
  params.set("page", String(opts.page))
  return `${SEARCH_URL}?${params.toString()}`
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const header =
    "ID".padEnd(7) + " " + "TITLE".padEnd(40) + " " + "COMPANY".padEnd(22) + " " +
    "LOCATION".padEnd(8) + " " + "UPDATED".padEnd(10) + " SALARY"
  const rows = cards.map((c) =>
    [
      c.id.padEnd(7),
      c.title.slice(0, 40).padEnd(40),
      (c.company || "—").slice(0, 22).padEnd(22),
      (c.location || "—").slice(0, 8).padEnd(8),
      (c.updated || "—").slice(0, 10).padEnd(10),
      c.salary || "—",
    ].join(" "),
  )
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const data = await jsonFetch<SearchResponse>(buildUrl(opts))
    let cards = (data?.payload?.jobs ?? []).map((j) => toCard(j))
    if (opts.jobage !== undefined) {
      const max = opts.jobage
      cards = cards.filter((c) => {
        const d = updatedWithinDays(c.updated)
        return d !== null && d <= max
      })
    }
    if (opts.sort === "recent") {
      // Stable sort by bucket; older-than-a-month and unknown buckets go last.
      const rank = (c: JobCard) => updatedWithinDays(c.updated) ?? Number.MAX_SAFE_INTEGER
      cards = [...cards].sort((a, b) => rank(a) - rank(b))
    }
    if (opts.limit !== undefined) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.updated || "—"}\n` +
              `  ${c.salary || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: { count: cards.length, page: opts.page, hasMore: data?.payload?.hasMore ?? false },
            results: cards,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
