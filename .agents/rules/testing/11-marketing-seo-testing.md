# Marketing SEO, Metadata & Discoverability Testing Standards

> **PUBLIC MARKETING SEARCH ENGINE OPTIMIZATION & DISCOVERABILITY STANDARDS**  
> *This document applies EXCLUSIVELY to public marketing routes. Operational Admin, internal employee, and private customer routes MUST NEVER be exposed to public search engines or indexing crawlers.*

---

## 1. Purpose

The purpose of ReachInternational's Marketing SEO Testing standards is to ensure that **public marketing and equipment catalogue pages achieve maximum organic search visibility, rich social sharing previews, and flawless canonical indexing**, while strictly guaranteeing that private application routes are shielded behind zero-indexation security boundaries.

---

## 2. Applicable Applications & Packages

- `apps/web`:
  * Public Marketing Routes ONLY: Home (`/`), Equipment Catalogue (`/equipment`), Brands, Industry pages, Contact.
  * SEO Primitives: Metadata layout (`app/layout.tsx`), Dynamic Sitemap (`app/sitemap.ts`), Dynamic Robots (`app/robots.ts`), JSON-LD schemas (`lib/seo/jsonld.ts`).

---

## 3. SEO Testing Invariants & Boundaries

### A. Strict Public vs Private Boundary (MANDATORY)
```text
┌───────────────────────────────────────┬──────────────────────────────────────────┐
│ ROUTE CATEGORY                        │ MANDATORY INDEXING & ROBOTS POLICY       │
├───────────────────────────────────────┼──────────────────────────────────────────┤
│ Public Marketing Routes (/, /equipment)│ INDEX, FOLLOW + Full Canonical & OG Meta│
│ Auth Routes (/login, /signup)         │ INDEX, NOFOLLOW + Canonical              │
│ Protected Admin Routes (/dashboard/*) │ NOINDEX, NOFOLLOW + Edge Auth Proxy Block│
│ Internal API Routes (/api/*)          │ NOINDEX, NOFOLLOW + JSON payloads only   │
└───────────────────────────────────────┴──────────────────────────────────────────┘
```

### B. Core SEO Verification Targets
1. **Title & Meta Descriptions**:
   - Every public page must have a unique, descriptive `<title>` (under 60 characters).
   - Every public page must have a compelling `<meta name="description">` (120–160 characters).
2. **Canonical URL Integrity**:
   - All canonical links must point to the authoritative domain (`https://www.reachinternational.co.in`).
   - URLs must maintain trailing-slash consistency to prevent duplicate indexing.
3. **Open Graph & Social Cards**:
   - `og:title`, `og:description`, `og:image`, `og:url`, `og:type="website"` must be defined.
   - `twitter:card="summary_large_image"` with optimized dimensions ($1200 \times 630\text{ px}$).
4. **Dynamic Sitemap (`sitemap.ts`)**:
   - Must dynamically include all active equipment models from the database.
   - Must NEVER include private admin routes (`/dashboard`, `/tasks`, `/machines`, `/finance`).
   - Must return valid XML with correct `lastModified` timestamps.
5. **Robots.txt (`robots.ts`)**:
   - Explicitly disallow `/dashboard`, `/api/`, `/(app)/`, `/admin`.
   - Explicitly reference `https://www.reachinternational.co.in/sitemap.xml`.
6. **Structured Data (Schema.org / JSON-LD)**:
   - Homepage: `Organization` schema with legal name, logo, contact points, and social profiles.
   - Equipment pages: `Product` schema with name, brand, model, image, and category.
   - FAQ sections: `FAQPage` schema with questions and accepted answers.
7. **Semantic HTML & Headings**:
   - Exactly one `<h1>` per page representing the primary topic.
   - Strict hierarchical heading order (`<h1>` $\to$ `<h2>` $\to$ `<h3>`).
8. **Image Accessibility**:
   - Every public marketing image must have a descriptive, non-empty `alt` attribute.

---

## 4. Required Testing Approach

```text
[ VALIDATE PUBLIC METADATA GENERATION ]
  ├── Inspect HTML head of / and /equipment via curl or browser DevTools
  ├── Confirm title, description, canonical, and OG tags exist and are populated
  └── Verify private routes (/dashboard) render <meta name="robots" content="noindex, nofollow">

[ VALIDATE SITEMAP & ROBOTS ]
  ├── Fetch /robots.txt → Confirm private routes are disallowed
  └── Fetch /sitemap.xml → Confirm only public URLs appear; 0 private routes exist

[ VALIDATE STRUCTURED DATA (JSON-LD) ]
  ├── Extract script type="application/ld+json" from page HTML
  └── Validate JSON against schema.org specifications via Schema Markup Validator
```

---

## 5. Recommended Tools

- **Google Rich Results Test / Schema Validator**: Online structured data validation
- **Headless Browser / Curl**: CLI verification of rendered SSR HTML headers
- **Lighthouse SEO Audit**: Comprehensive SEO score check ($\ge 95$)

---

## 6. Actual Project Commands

```bash
# 1. Verify dynamic sitemap and robots generation
pnpm --filter @reachinternational/web build

# 2. Verify landing page feedback and asset health
node apps/web/scripts/verify-landing-feedback.mjs
node apps/web/scripts/verify-brand-logos.mjs
```

---

## 7. Success Criteria

1. **Zero Private Routes in Sitemap**: `sitemap.xml` contains 100% public routes; 0 admin routes.
2. **Canonicalization**: Every public page defines a canonical URL on `reachinternational.co.in`.
3. **Structured Data Valid**: JSON-LD scripts are syntactically valid and contain zero schema errors.
4. **Single H1**: Every public marketing page contains exactly one `<h1>`.

---

## 8. Failure Handling

- If a private route appears in `sitemap.ts`: filter the route out immediately.
- If Schema.org reports a missing required property (e.g. `brand` or `name` in `Product`): update `lib/seo/jsonld.ts` with the required database attribute.
- If duplicate canonical URLs are found: normalize paths using lowercase and remove trailing slashes.

---

## 9. Evidence & Reporting

The test report must provide:
- Public routes checked.
- Robots.txt and Sitemap.xml verification status.
- Structured data (JSON-LD) verification status.
- Confirmation that zero private routes were indexed or exposed.
