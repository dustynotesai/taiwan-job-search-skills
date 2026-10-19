// Data source: Yourator's public JSON API (the one its own job-search page calls).
// No authentication required. The HTML job pages sit behind a Cloudflare
// challenge, so this CLI never fetches them: search uses /api/v4/jobs and detail
// walks /api/v4/companies/<slug>/jobs until it finds the posting.

export const BASE = "https://www.yourator.co"
export const SEARCH_URL = `${BASE}/api/v4/jobs`
export const companyJobsUrl = (slug: string) =>
  `${BASE}/api/v4/companies/${encodeURIComponent(slug)}/jobs`

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; yourator-search-cli/1.0)"

/** Fetch JSON with exponential backoff on 429/5xx. Returns null on a 404. */
export async function jsonFetch<T = unknown>(url: string): Promise<T | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    const text = await response.text()
    try {
      return JSON.parse(text) as T
    } catch {
      // A Cloudflare challenge page is HTML with status 403/503; anything else
      // non-JSON means the endpoint changed.
      throw new Error(`Expected JSON from ${url}, got: ${text.slice(0, 80)}`)
    }
  }
  throw new Error("Request failed after max retries")
}

// Area codes verified live on 2026-10-19 (each returned postings in that city
// only). Unverified codes are rejected rather than passed through: an unknown
// code returns zero results, which reads as "no jobs here" instead of an error.
export const AREAS: Record<string, string> = {
  TPE: "臺北市",
  NWT: "新北市",
  TAO: "桃園市",
  HSZ: "新竹市",
  HSQ: "新竹縣",
  TXG: "臺中市",
  TNN: "臺南市",
  KHH: "高雄市",
  CYI: "嘉義市",
}

const AREA_ALIASES: Record<string, string> = {
  taipei: "TPE", "台北": "TPE", "臺北": "TPE", "台北市": "TPE", "臺北市": "TPE",
  "new taipei": "NWT", "新北": "NWT", "新北市": "NWT",
  taoyuan: "TAO", "桃園": "TAO", "桃園市": "TAO",
  hsinchu: "HSZ", "新竹": "HSZ", "新竹市": "HSZ",
  "hsinchu county": "HSQ", "新竹縣": "HSQ",
  taichung: "TXG", "台中": "TXG", "臺中": "TXG", "台中市": "TXG", "臺中市": "TXG",
  tainan: "TNN", "台南": "TNN", "臺南": "TNN", "台南市": "TNN", "臺南市": "TNN",
  kaohsiung: "KHH", "高雄": "KHH", "高雄市": "KHH",
  chiayi: "CYI", "嘉義": "CYI", "嘉義市": "CYI",
}

/** Map "TPE", "Taipei", "台北" or "臺北市" to an area code; null if unknown. */
export function areaCode(input: string): string | null {
  const t = input.trim()
  if (AREAS[t.toUpperCase()]) return t.toUpperCase()
  return AREA_ALIASES[t.toLowerCase()] ?? null
}

/**
 * Yourator gives no posting date, only a relative "last updated" bucket.
 * Map each bucket to its upper bound in days so --jobage can filter on it.
 * An unrecognised bucket returns null (older than a month, or new wording).
 */
export function updatedWithinDays(label: string | null | undefined): number | null {
  switch ((label || "").trim()) {
    case "一天內更新":
      return 1
    case "一週內更新":
      return 7
    case "兩週內更新":
      return 14
    case "一個月內更新":
      return 30
    default:
      return null
  }
}

export interface ApiCompany {
  path?: string
  brand?: string
  enName?: string
}

export interface ApiJob {
  id: number
  name: string
  path: string
  salary?: string | null
  lastActiveAt?: string | null
  location?: string | null
  category?: string | null
  content?: string | null
  thirdPartyUrl?: string | null
  company?: ApiCompany
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  updated: string | null
  companySlug: string | null
  applyUrl: string | null
}

export interface JobDetail extends JobCard {
  category: string | null
  summary: string | null
  summaryTruncated: boolean
  isActive: boolean
}

/** Company slug from a path like "/companies/Pinkoi/jobs/48495". */
export function slugFromPath(path: string | null | undefined): string | null {
  const m = (path || "").match(/\/companies\/([^/]+)/)
  return m ? decodeURIComponent(m[1]) : null
}

export function toCard(j: ApiJob, companyName?: string | null): JobCard {
  return {
    id: String(j.id),
    title: (j.name || "").trim() || "(untitled)",
    company: j.company?.brand?.trim() || companyName || null,
    location: j.location?.trim() || null,
    // No absolute date in the API; the relative bucket is in `updated`.
    date: null,
    url: `${BASE}${j.path}`,
    salary: j.salary?.trim() || null,
    updated: j.lastActiveAt?.trim() || null,
    companySlug: slugFromPath(j.company?.path ?? j.path),
    applyUrl: j.thirdPartyUrl?.trim() || null,
  }
}
