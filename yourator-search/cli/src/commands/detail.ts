import { companyJobsUrl, jsonFetch, toCard, writeError, type ApiJob, type JobDetail } from "../helpers.js"

export interface DetailOpts {
  ref: string
  format: "json" | "plain"
}

interface CompanyJobsResponse {
  payload?: { currentPage?: number; totalPages?: number; jobs?: ApiJob[] }
}

const YOURATOR_HOST = /(^|\.)yourator\.co$/i
// The API truncates `content` to this many characters.
const SUMMARY_CAP = 200
const MAX_PAGES = 20

/**
 * Accept a Yourator job URL (https://www.yourator.co/companies/<slug>/jobs/<id>)
 * or the short form "<slug>/<id>". A bare numeric id is rejected: the only
 * public route to one posting goes through its company, so the slug is needed.
 */
export function parseRef(input: string): { slug: string; id: string } | null {
  const trimmed = input.trim()
  const hasScheme = /^https?:\/\//i.test(trimmed)
  if (hasScheme || /^[a-z0-9.-]+\.[a-z]{2,}\//i.test(trimmed)) {
    let parsed: URL
    try {
      parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    } catch {
      return null
    }
    if (!YOURATOR_HOST.test(parsed.hostname)) return null
    const m = parsed.pathname.match(/^\/companies\/([^/]+)\/jobs\/(\d+)\/?$/)
    return m ? { slug: decodeURIComponent(m[1]), id: m[2] } : null
  }
  const short = trimmed.match(/^([A-Za-z0-9_.-]+)\/(?:jobs\/)?(\d+)$/)
  return short ? { slug: short[1], id: short[2] } : null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const ref = parseRef(opts.ref)
  if (!ref) {
    const hint = /^\d+$/.test(opts.ref.trim())
      ? ' - a bare id is not enough; pass the job URL or "<company-slug>/<id>" (both are in search results)'
      : ""
    writeError(`Could not parse a Yourator job reference from "${opts.ref}"${hint}`, "BAD_ID")
    return 1
  }
  try {
    let found: ApiJob | undefined
    let totalPages = 1
    for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
      const data = await jsonFetch<CompanyJobsResponse>(`${companyJobsUrl(ref.slug)}?page=${page}`)
      if (!data) {
        writeError(`Company "${ref.slug}" not found on Yourator`, "NOT_FOUND")
        return 1
      }
      totalPages = data.payload?.totalPages ?? 1
      found = (data.payload?.jobs ?? []).find((j) => String(j.id) === ref.id)
      if (found) break
    }
    if (!found) {
      // The company's open-jobs list no longer carries it: closed, or a wrong id.
      writeError(`Job ${ref.id} is not among ${ref.slug}'s open postings (closed or wrong id)`, "NOT_FOUND")
      return 1
    }

    const summary = found.content?.trim() || null
    const job: JobDetail = {
      ...toCard(found),
      companySlug: ref.slug,
      category: found.category?.trim() || null,
      summary,
      summaryTruncated: !!summary && (summary.endsWith("...") || summary.length >= SUMMARY_CAP),
      isActive: true,
    }

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.companySlug} · ${job.location || "—"} · ${job.updated || "—"}`,
        "",
        job.category ? `Category: ${job.category}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        "Status: ACTIVE (listed among the company's open postings)",
        "",
        job.summary || "(no summary)",
        job.summaryTruncated
          ? "\n[Summary truncated by Yourator's API. Full text: open the URL below in a browser" +
            (job.applyUrl ? ", or the employer's own posting (Apply URL)." : ".") + "]"
          : "",
        "",
        `URL: ${job.url}`,
        job.applyUrl ? `Apply URL: ${job.applyUrl}` : "",
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
