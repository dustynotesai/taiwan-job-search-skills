# Yourator URL Reference

Public, unauthenticated JSON endpoints used by this skill (the same ones Yourator's own
search page calls). Verified live 2026-10-19 with the honest User-Agent
`Mozilla/5.0 (compatible; yourator-search-cli/1.0)`.

> Personal use only — keep volume low. `robots.txt` (`User-agent: *`, `Disallow: /r/*`)
> permits these paths; the terms page is behind a browser challenge and was not read.

## Search

```
GET https://www.yourator.co/api/v4/jobs
```

| Param | Meaning | Example |
|-------|---------|---------|
| `term[]` | Keyword (repeatable) | `backend`, `後端工程師` |
| `area[]` | City code (repeatable; OR) | `TPE`, `NWT` |
| `sort` | `most_related` (default when omitted) · `recent_updated` — **not used**: it loosens the keyword match (`後端工程師` returned 法務專員 first) | — |
| `page` | 1-indexed, 20 per page; past the end returns `jobs: []` | `2` |

Verified area codes: `TPE` 臺北市, `NWT` 新北市, `TAO` 桃園市, `HSZ` 新竹市, `HSQ` 新竹縣,
`TXG` 臺中市, `TNN` 臺南市, `KHH` 高雄市, `CYI` 嘉義市. Tried and returned nothing for
`engineer` (so unverified, not necessarily invalid): `TYC TYU KEE MIA CHA YUN CYQ PIF TTT HUA PEN KIN LIE REMOTE`.
An invalid code (`XYZ`) also returns zero results, not an error.

Response:

```json
{ "payload": {
    "hasMore": true, "currentPage": 1, "nextPage": 2,
    "recommendedJobs": [], "trendingKeywords": [],
    "jobs": [ {
      "id": 48227, "name": "研發中心 - Sr. SRE (DBA)",
      "path": "/companies/langlive/jobs/48227",
      "salary": "NT$ 1,040,000 - 1,800,000 (年薪)",
      "lastActiveAt": "一天內更新", "location": "臺北市",
      "company": { "path": "/companies/langlive", "brand": "浪LIVE", "enName": "langlive", ... },
      "thirdPartyUrl": "https://langlive.teamdoor.io/s/...", "externalSource": "teamdoor"
    } ] } }
```

`lastActiveAt` values seen: `一天內更新`, `一週內更新`, `兩週內更新`, `一個月內更新`, `一個月前更新` (older).
`thirdPartyUrl` was set on 3 of 20 results in the sample (employer's own ATS page).

## Detail (via the company's open jobs)

```
GET https://www.yourator.co/api/v4/companies/<slug>/jobs?page=<n>
```

Returns `{ "payload": { "currentPage", "totalPages", "perPage": 16, "jobs": [...] } }`.
Each job adds `category` and `content` (the description, **truncated to 200 characters**
ending in `...`). A page past `totalPages` repeats the last page. An unknown slug returns 404.
The CLI walks pages until it finds the id (cap 20 pages); not found means closed or wrong id.

## Not usable

- `https://www.yourator.co/companies/<slug>/jobs/<id>` (the job page), `/jobs`, `/terms`:
  Cloudflare challenge (`403`, "Just a moment...") for non-browser clients, including with
  browser headers via `tools/fetch_page.py`.
- `/api/v4/jobs/<id>`, `/api/v2|v3/jobs/<id>`, `/api/v4/companies/<slug>/jobs/<id>`: 404.
