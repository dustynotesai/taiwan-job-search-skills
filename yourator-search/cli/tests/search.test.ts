import { describe, expect, test } from "bun:test"
import { parseJSON, runCLI } from "./helpers"
import { parseRef } from "../src/commands/detail"
import { buildUrl } from "../src/commands/search"
import { areaCode, updatedWithinDays } from "../src/helpers"

interface SearchOut {
  meta: { count: number; page: number }
  results: { id: string; title: string; url: string; companySlug: string | null }[]
}

describe("offline parsing", () => {
  test("areaCode accepts codes and names", () => {
    expect(areaCode("tpe")).toBe("TPE")
    expect(areaCode("Taipei")).toBe("TPE")
    expect(areaCode("台北")).toBe("TPE")
    expect(areaCode("臺中市")).toBe("TXG")
    expect(areaCode("Mars")).toBeNull()
  })

  test("updatedWithinDays maps the buckets", () => {
    expect(updatedWithinDays("一天內更新")).toBe(1)
    expect(updatedWithinDays("一個月內更新")).toBe(30)
    expect(updatedWithinDays("三個月前")).toBeNull()
  })

  test("buildUrl encodes repeatable params", () => {
    const url = buildUrl({ query: "後端", areas: ["TPE", "NWT"], sort: "recent", page: 2, format: "json" })
    const p = new URL(url).searchParams
    expect(p.getAll("term[]")).toEqual(["後端"])
    expect(p.getAll("area[]")).toEqual(["TPE", "NWT"])
    // recent is applied client-side; sort=recent_updated loosens Yourator's keyword match
    expect(p.get("sort")).toBeNull()
    expect(p.get("page")).toBe("2")
  })

  test("parseRef accepts URL and short form, rejects bare id and other hosts", () => {
    expect(parseRef("https://www.yourator.co/companies/Pinkoi/jobs/48495")).toEqual({ slug: "Pinkoi", id: "48495" })
    expect(parseRef("Pinkoi/48495")).toEqual({ slug: "Pinkoi", id: "48495" })
    expect(parseRef("48495")).toBeNull()
    expect(parseRef("https://yourator.co.evil.io/companies/x/jobs/1")).toBeNull()
  })
})

describe("live", () => {
  test("search returns real results", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "-q", "backend", "-l", "TPE", "--limit", "5"]))
    expect(out.results.length).toBeGreaterThan(0)
    for (const r of out.results) {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.url).toStartWith("https://www.yourator.co/companies/")
    }
  })

  test("detail resolves a search result", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "-q", "engineer", "-l", "TPE", "--limit", "1"]))
    const job = parseJSON<{ id: string; summary: string | null }>(await runCLI(["detail", out.results[0].url]))
    expect(job.id).toBe(out.results[0].id)
  })
})

describe("errors go to stderr as JSON with exit 1", () => {
  for (const args of [
    ["search", "--bogus", "x"],
    ["search", "-l", "Mars"],
    ["search", "--sort", "newest"],
    ["search", "--jobage", "0.5"],
    ["detail"],
    ["detail", "48495"],
  ]) {
    test(args.join(" "), async () => {
      const r = await runCLI(args)
      expect(r.exitCode).toBe(1)
      expect(r.stdout).toBe("")
      expect(JSON.parse(r.stderr).code).toBeTruthy()
    })
  }
})
