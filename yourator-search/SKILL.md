---
name: yourator-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in Taiwan on Yourator
  (yourator.co), the Taiwan startup and tech job board: open positions, vacancies
  and hiring in Taipei, New Taipei, Taoyuan, Hsinchu, Taichung, Tainan, Kaohsiung
  or Chiayi, especially software, data, AI, product and design roles. Returns
  salary ranges. Trigger phrases: find a job in Taiwan, Taipei jobs, Yourator,
  找工作, 台灣職缺, 台北職缺, 工程師職缺, 新創職缺, 求職, 徵才, 有哪些職缺.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/yourator-search/cli/src/cli.ts *)
---

# Yourator Search Skill

Search live job listings on [Yourator](https://www.yourator.co), a Taiwan job board
focused on startups and tech companies. Uses the public JSON API behind Yourator's own
search page: no login, no API key, **zero runtime dependencies** (plain `bun`).

## ⚠️ Personal use only

Yourator's `robots.txt` permits these paths, but its terms of service page sits behind a
browser challenge and was not read when this skill was built. Read them yourself, keep
volume low (a handful of searches, not a crawl), and don't use it commercially or for
bulk data collection. Run it on your own responsibility.

## When to use this skill

- Search for jobs in Taiwan by keyword (Chinese or English) and city
- See salary ranges up front (Yourator shows one on every posting)
- Get the summary, category and apply link of a specific posting

## Commands

### Search job listings

```bash
bun run .agents/skills/yourator-search/cli/src/cli.ts search [flags]
```

- `--query` / `-q <text>` — keywords, Chinese or English (`後端工程師`, `backend`). Recommended.
- `--location` / `-l <list>` — comma-separated cities, as area code or name:
  `TPE` 臺北市 · `NWT` 新北市 · `TAO` 桃園市 · `HSZ` 新竹市 · `HSQ` 新竹縣 · `TXG` 臺中市 ·
  `TNN` 臺南市 · `KHH` 高雄市 · `CYI` 嘉義市. Names work too: `Taipei`, `台北`, `臺北市`.
  Omit for all of Taiwan. Other cities are rejected (their codes were not verified).
- `--sort <mode>` — `relevance` (default) or `recent`: reorders the fetched page by
  last-updated bucket. Applied client-side on purpose (see Notes).
- `--jobage <days>` — keep postings **updated** within N days. Yourator has no posting
  date, only a bucket (一天內／一週內／兩週內／一個月內更新, or 一個月前更新 = older), so this
  filters on the bucket's upper bound (1, 7, 14, 30; older is always dropped) and applies
  to the fetched page only.
- `--page <n>` — 1-indexed, 20 results per page.
- `--limit` / `-n <n>` — cap results emitted (client-side).
- `--format json|table|plain` — default `json`.

### Fetch job detail

```bash
bun run .agents/skills/yourator-search/cli/src/cli.ts detail <url|company-slug/id> [--format json|plain]
```

Pass the job URL from search results (`https://www.yourator.co/companies/Pinkoi/jobs/48495`)
or the short form `Pinkoi/48495`. A bare id is not enough: the only public route to one
posting goes through its company.

**The summary is truncated.** Yourator's API returns the first 200 characters of the
description, and the job pages themselves sit behind a browser challenge. For the full
text, in order:
1. If `applyUrl` is set (the employer's own ATS page, e.g. teamdoor), fetch that.
2. Otherwise ask the user to open the job URL in their browser and paste the posting
   into `documents/postings/<Company> - <Job Title>.txt`.
Never draft an application from the 200-character summary alone.

## Usage examples

```bash
# Backend roles in Taipei
bun run .agents/skills/yourator-search/cli/src/cli.ts search -q "backend" -l Taipei --format table

# 後端 roles in Taipei or New Taipei, most recently updated first
bun run .agents/skills/yourator-search/cli/src/cli.ts search -q "後端工程師" -l "台北,新北" --sort recent --format table

# AI roles in Taipei updated this week
bun run .agents/skills/yourator-search/cli/src/cli.ts search -q "AI engineer" -l TPE --jobage 7 --format table

# Data roles in Hsinchu (city and county)
bun run .agents/skills/yourator-search/cli/src/cli.ts search -q "data" -l "HSZ,HSQ" --format table

# Detail for one posting
bun run .agents/skills/yourator-search/cli/src/cli.ts detail https://www.yourator.co/companies/Pinkoi/jobs/48495 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default: programmatic use; each result carries `url` and `companySlug` for `detail` |
| `table` | Quick human-readable scanning (includes salary) |
| `plain` | Reading one posting (`detail`) |

Search results carry `id`, `title`, `company`, `location`, `date` (always `null`, see
below), `url`, plus `salary`, `updated` (the relative bucket), `companySlug` and
`applyUrl` (employer's own posting, when the company links one).

All errors are written to **stderr** as `{ "error": "...", "code": "..." }` and the process exits with code `1`.

## Notes

- No absolute posting date anywhere in the API; `date` is `null` and `updated` holds the bucket.
- An unknown `area[]` code returns zero results rather than an error, which is why the CLI
  only accepts the nine codes verified live.
- The API's own `sort=recent_updated` loosens keyword matching: `後端工程師` came back
  with 法務專員 and 產品設計師 on top, `backend` with an SMT equipment engineer. The CLI never
  sends it; `--sort recent` reorders the relevance-matched page instead. A bogus `sort`
  value behaves like `recent_updated`.
- Job pages, company pages and the terms page answer a Cloudflare challenge to non-browser
  clients; only `/api/v4/...` answers JSON. Do not route around the challenge.
- Salary text like `面議（經常性薪資達4萬元）` means "negotiable, at least NT$40,000/month".
