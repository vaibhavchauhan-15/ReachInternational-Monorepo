# Marketing AI Crawler & LLM Discoverability Standards

> **AI ENGINE ACCESSIBILITY, CRAWLER POLICIES, AND LLM DISCOVERABILITY STANDARDS**  
> *Applies EXCLUSIVELY to public marketing and equipment catalogue content. Private operational data, employee information, and client records must NEVER be accessible to AI crawlers.*

---

## 1. Purpose

The purpose of ReachInternational's AI Crawler & LLM Discoverability standards is to ensure that **public marketing, heavy equipment specifications, and brand offerings are clearly structured, easily extractable, and factually accurate for modern AI search engines (ChatGPT Search, Perplexity, Copilot, Gemini)**, while maintaining strict privacy firewalls around proprietary operational databases.

---

## 2. Applicable Applications & Packages

- `apps/web`:
  * Public Marketing Routes ONLY: Home (`/`), Equipment Catalogue (`/equipment`), Brands, Industry pages.
  * Static & SSR Content: Dynamic `robots.ts`, structured data (`jsonld.ts`), optional `llms.txt` routes.

---

## 3. Core AI Crawler & Discoverability Invariants

### A. Privacy & Security Perimeter (MANDATORY)
1. **Zero Private Exposure**: AI crawlers must NEVER have access to internal dashboards (`/dashboard`), tasks, shift logs, user documents, employee records, or API endpoints.
2. **Explicit robots.txt Blocking**: Disallow all AI crawlers from internal routes.

### B. Distinguishing Search Crawlers vs Training Crawlers
ReachInternational maintains separate policies for AI search indexing vs general LLM training scraping:
- **AI Search Crawlers (ALLOWED for public routes)**:
  * `OAI-SearchBot` (OpenAI Search)
  * `PerplexityBot` (Perplexity AI)
  * `Bingbot` (Microsoft Copilot / Bing)
  * `Googlebot` (Google Search / Gemini)
- **Model Training Scrapers (CONTROLLED via robots.txt)**:
  * `GPTBot`, `CCBot`, `anthropic-ai`, `ClaudeBot`

### C. Server-Rendered Text Extraction
AI crawlers do not execute complex client-side JavaScript or interactive React states:
1. **Server-Side Rendering (SSR)**: All equipment titles, models, operating weights, lift capacities, and brand associations must be present in the raw server-rendered HTML.
2. **Clean Textual Hierarchy**: Use standard semantic tags (`<article>`, `<section>`, `<header>`, `<table>`, `<dl>`, `<dt>`, `<dd>`) for machine-readable text extraction.
3. **Structured Data Cross-Referencing**: Combine schema.org JSON-LD with clear visible text to provide disambiguated entity information.

### D. The `llms.txt` Convention
1. **Optional Convention Only**: If provided, an `llms.txt` file serves as a structured Markdown sitemap for language models, summarizing the company background, equipment categories, and direct links to public spec sheets.
2. **No Ranking Guarantee**: Agents must NEVER claim or document that `llms.txt` guarantees AI citations, rankings, or preferential inclusion in LLM answers. It is purely an accessibility aid for text-based extraction.

---

## 4. Required Testing Approach

```text
[ STAGE 1: RAW SSR HTML EXTRACTION ]
  ├── Fetch public route HTML using curl (without JavaScript execution)
  │     curl -s https://www.reachinternational.co.in/equipment | grep "JCB"
  └── Confirm equipment models, specs, and categories are readable in raw markup

[ STAGE 2: ROBOTS.TXT CRAWLER POLICY AUDIT ]
  ├── Inspect /robots.txt directives
  ├── Verify AI search bots (OAI-SearchBot, PerplexityBot) can crawl public routes
  └── Verify private routes (/(app)/*, /dashboard/*, /api/*) are strictly blocked

[ STAGE 3: FACTUAL ACCURACY AUDIT ]
  ├── Verify rendered specs (tonnage, reach height, engine type) match catalog truth
  └── Confirm zero hallucinated or placeholder equipment data exists in production
```

---

## 5. Recommended Tools

- **Raw HTML Extraction**: `curl` or `fetch` without DOM hydration
- **Robots.txt Testers**: Google Search Console robots tester or online bot simulation tools
- **Markdown / LLM Extractors**: Jina Reader (`r.jina.ai`) or similar text-extraction proxies

---

## 6. Actual Project Commands

```bash
# 1. Verify dynamic robots and sitemap build
pnpm --filter @reachinternational/web build

# 2. Verify public brand logos and equipment metadata
node apps/web/scripts/verify-brand-logos.mjs
node apps/web/scripts/verify-landing-feedback.mjs
```

---

## 7. Success Criteria

1. **Server-Side Discoverability**: Key equipment specifications are extractable directly from raw HTML without JavaScript.
2. **Robots Compliance**: `robots.txt` correctly configures AI search bot permissions for public pages while sealing private routes.
3. **Entity Disambiguation**: Schema.org JSON-LD clearly identifies ReachInternational as an equipment rental and operational provider.
4. **Zero Proprietary Leaks**: No internal business metrics, operator names, or database UUIDs appear in public crawler paths.

---

## 8. Failure Handling

- If equipment data is missing from raw curl output: the component is relying on client-side `useEffect` or client state; refactor to a React Server Component (RSC) to fetch data during SSR.
- If private admin routes appear in AI crawler paths: immediately add explicit `Disallow: /dashboard/` rules to `apps/web/app/robots.ts`.

---

## 9. Evidence & Reporting

The test report must provide:
- Status of raw SSR text extraction on public routes.
- Confirmation of robots.txt crawler policies.
- Confirmation that no private operational or employee data is exposed to crawlers.
