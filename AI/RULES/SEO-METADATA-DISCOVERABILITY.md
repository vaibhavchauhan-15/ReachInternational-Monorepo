# ReachInternational Production SEO, Metadata & Discoverability Rules

> **AUTHORITATIVE SEO, METADATA & DISCOVERABILITY POLICY FOR AI AGENTS**  
> *This document establishes the binding search engine optimization, metadata, canonicalization, social preview, sitemap, robots, structured data, and discoverability engineering policy for all applications (`apps/web`, `apps/mobile`), shared packages (`packages/*`), route layouts (`app/layout.tsx`), and static assets within the ReachInternational monorepo. Every AI coding agent MUST read, obey, and enforce these rules before writing or modifying any metadata or discoverability code in this repository.*

---

## 1. Purpose

The purpose of ReachInternational's SEO, Metadata & Discoverability policy is to guarantee that **all public marketing and entry routes are search-engine understandable, correctly canonicalized, and rich in social previews, while strictly preventing private, authenticated operational application pages from being exposed or indexed by search engine crawlers**.

Every route MUST have an intentional discoverability policy:
```text
Public Route   → Indexable, Canonicalized, Rich Metadata & Open Graph Previews
Private Route  → Protected by Edge Auth Proxy + Explicit noindex Header Safeguards
```

---

## 2. Source of Truth

ReachInternational establishes authoritative canonical sources of truth for metadata and discoverability:
1. **Next.js Metadata API**: Root metadata configuration in `apps/web/app/layout.tsx`.
2. **Sitemap Generation**: Dynamic sitemap builder in `apps/web/app/sitemap.ts`.
3. **Edge Route Protection**: Edge Auth Proxy (`apps/web/proxy.ts`) blocking unauthenticated access to protected routes.
4. **Canonical Production Domain**: `NEXT_PUBLIC_APP_URL` environment variable defaulting to `https://reachinternation.com`.
5. **Design System Icons**: Bimodal favicon assets (`/light-favicon.ico`, `/dark-favicon.ico`, `/site.webmanifest`).

---

## 3. SEO Architecture

Search Engine Optimization is implemented natively via Next.js App Router Metadata API:
* **Server-Side Metadata**: Metadata is generated on the server using exportable `metadata` objects or `generateMetadata()` functions.
* **Zero Client SEO Libraries**: AI agents MUST NOT introduce third-party client-side SEO libraries (such as `react-helmet`).

---

## 4. Route Classification Matrix

ReachInternational partitions routes into strict discoverability tiers:

```text
ROUTE CATEGORY          INDEXING POLICY             METADATA TYPE & HANDLING
──────────────────────────────────────────────────────────────────────────────────────────
• Public Home (`/`)     INDEX, FOLLOW               Full Open Graph, Schema.org, Canonical
• Auth Pages (`/login`) INDEX, NOFOLLOW             Title, Minimal Description, Canonical
• Protected (`/dashboard`) NOINDEX, NOFOLLOW        Default layout `noindex` header flag
• Dynamic Operational   NOINDEX, NOFOLLOW           Private record scope protection
• API Endpoints (`/api`) NOINDEX, NOFOLLOW           Pure JSON responses (No HTML metadata)
```

---

## 5. Public vs Private Pages

1. **Public Marketing Pages**: Indexable by search engine crawlers with full metadata and canonical URLs.
2. **Private Application Pages**: Operational pages (`/dashboard`, `/tasks`, `/machines`, `/service`, `/finance`, `/hr`) MUST NOT accidentally become indexable.

---

## 6. Indexing Policy Standards

AI agents MUST assign explicit indexing flags:
```ts
// Protected layout metadata safeguard
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};
```

---

## 7. Page Title Architecture

1. **Title Format Standard**: Page titles MUST follow the canonical format:
   ```text
   [Page Title] | REACH INTERNATIONAL — Reaching All Heights
   ```
2. **Brand Consistency**: The brand suffix `REACH INTERNATIONAL — Reaching All Heights` MUST be preserved.

---

## 8. Meta Descriptions

Public pages MUST include a unique, descriptive meta description (150–160 characters) accurately summarizing page content without keyword stuffing.

---

## 9. Canonical URLs

1. **Canonical Metadata**: Public indexable routes MUST declare a canonical URL using `NEXT_PUBLIC_APP_URL`.
   ```ts
   alternates: {
     canonical: `${baseUrl}/login`,
   }
   ```
2. **Query Parameter Scrubbing**: Canonical URLs MUST exclude tracking parameters (`?utm_source=...`) or user filter queries.

---

## 10. URL Architecture Standards

1. **Clean Slugs**: URLs MUST be lowercase, hyphen-separated, human-readable strings (e.g. `/forgot-password`).
2. **No Trailing Slashes**: URL structure MUST remain consistent without trailing slashes.

---

## 11. Slug Generation Protocol

Dynamic record slugs MUST be lowercase and URL-safe. Changing production slug structures is FORBIDDEN as it breaks external incoming links.

---

## 12. Query Parameters & Crawling

Query parameter variations (`?page=2`, `?filter=active`) MUST NOT be indexed as separate canonical URLs.

---

## 13. Redirect Architecture

1. **301 Permanent Redirects**: Used for legacy route migrations.
2. **302 Temporary Redirects**: Executed by Edge Auth Proxy (`proxy.ts`) for unauthenticated user redirects to `/login`.
3. **No Redirect Chains**: AI agents MUST avoid multi-step redirect chains (`A → B → C`).

---

## 14. Robots.txt Configuration

`public/robots.txt` specifies crawler access policies:
```text
User-agent: *
Allow: /
Allow: /login
Disallow: /api/
Disallow: /dashboard/
Disallow: /machines/
Disallow: /service/
Disallow: /finance/
Sitemap: https://reachinternation.com/sitemap.xml
```

---

## 15. Robots Security Boundary Mandate

AI agents MUST observe that `robots.txt` is an indexing guide, NOT a security control. Private routes MUST continue to enforce full server-side authentication (`verifySession()`).

---

## 16. Sitemap Generation (`app/sitemap.ts`)

`apps/web/app/sitemap.ts` dynamically generates the XML sitemap referencing `NEXT_PUBLIC_APP_URL`. Only public indexable routes (`/`, `/login`) shall be included. Private routes MUST NEVER be exposed in `sitemap.xml`.

---

## 17. Open Graph (OG) Previews

Public pages MUST declare Open Graph tags for social media sharing:
```ts
openGraph: {
  title: "REACH INTERNATIONAL — Reaching All Heights",
  description: "Enterprise heavy machinery fleet management & field service platform.",
  url: "https://reachinternation.com",
  siteName: "Reach International",
  images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Reach International" }],
  locale: "en_US",
  type: "website",
}
```

---

## 18. Twitter / X Cards

Public pages MUST declare Twitter card metadata (`twitter:card: "summary_large_image"`).

---

## 19. Favicon & Icon System

`apps/web/app/layout.tsx` manages light and dark mode favicons automatically:
* `/light-favicon.ico` & `/dark-favicon.ico`
* `/light-favicon-96x96.png` & `/dark-favicon-96x96.png`
* `/light-apple-touch-icon.png` & `/dark-apple-touch-icon.png`

---

## 20. Web App Manifest (`site.webmanifest`)

`public/site.webmanifest` defines progressive web app metadata including `name: "Reach International"`, `short_name: "Reach"`, and Geist design system theme colors (`theme_color: "#171717"`).

---

## 21. Structured Data (JSON-LD)

Public marketing pages SHOULD embed structured JSON-LD scripts (`<script type="application/ld+json">`) following Schema.org standards.

---

## 22. Organization Schema

`Organization` schema embedded on the landing page MUST use verified corporate details:
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Reach International",
  "url": "https://reachinternation.com",
  "logo": "https://reachinternation.com/light-favicon.png"
}
```

---

## 23. Product & Service Schema Rules

Fake reviews, artificial ratings, or unverified pricing data in structured JSON-LD scripts are **STRICTLY FORBIDDEN**.

---

## 24. Breadcrumbs & Structured Data

When rendering visual breadcrumbs on public catalog views, JSON-LD `BreadcrumbList` schema MUST match the visible navigation sequence.

---

## 25. Internationalization & Language Declaration

The root HTML element in `apps/web/app/layout.tsx` MUST specify `lang="en"`. Multilingual `hreflang` tags MUST ONLY be added if localized route translations exist.

---

## 26. Semantic HTML Mandate

Pages MUST be constructed using semantic HTML5 elements:
```text
<header> → <nav> → <main> → <section> → <article> → <aside> → <footer>
```
Using generic `<div>` elements for all containers is FORBIDDEN.

---

## 27. Heading Hierarchy (`<h1>` to `<h6>`)

1. **Single `<h1>` Rule**: Every page MUST contain exactly one primary `<h1>` element representing the main topic of the page.
2. **Sequential Order**: Headings MUST descend logically (`<h1>` → `<h2>` → `<h3>`) without skipping levels.

---

## 28. Image SEO & Alt Text

1. **Descriptive Alt Text**: All `<img>` and Next.js `<Image>` components MUST include descriptive `alt` attributes.
2. **Keyword Stuffing Prohibition**: Stuffing alt attributes with repetitive keywords is FORBIDDEN.

---

## 29. Internal Linking & Anchor Text

Internal links MUST use descriptive link text (e.g. `href="/login"` with text "Log in to Reach International") rather than generic "click here" text.

---

## 30. Duplicate Content Prevention

1. **Canonical Enforcement**: Duplicate route aliases MUST specify a single canonical URL.
2. **No Thin Pages**: Creating low-value public pages solely for search engine keyword targeting is FORBIDDEN.

---

## 31. Dynamic Metadata Generation

Dynamic routes MUST generate resource-specific metadata using `generateMetadata()`:
```ts
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const machine = await getMachineByCode(params.code);
  return {
    title: `${machine.code} — ${machine.name} | Reach International`,
    description: `Specifications and operational status for ${machine.name}.`,
  };
}
```

---

## 32. SEO + Authentication Integration

Edge Auth Proxy (`proxy.ts`) and protected server layouts MUST enforce `verifySession()` before serving content, ensuring crawlers cannot access unauthenticated operational pages.

---

## 33. SEO + Security Boundaries

Public metadata MUST NEVER reveal server secrets, database schemas, internal API routes, or admin user credentials in HTML headers.

---

## 34. SEO + Data Privacy Standards

Public page metadata, Open Graph previews, and structured JSON-LD MUST adhere to `AI/RULES/DATA-PROTECTION-PRIVACY.md`, scrubbing employee Aadhaar/PAN PII, passwords, and private financial data.

---

## 35. SEO + Performance Integration

Metadata generation MUST NOT introduce slow database queries or un-cached external API requests that degrade Server Response Times (TTFB).

---

## 36. SEO + Accessibility Synergy

Semantic HTML5 elements and alt text serve both SEO indexability and screen-reader accessibility (`AI/RULES/ACCESSIBILITY.md`).

---

## 37. SEO + Responsive Design Integration

Canonical metadata and Open Graph social share previews MUST remain 100% identical across Mobile, Tablet, and Desktop viewports.

---

## 38. SEO + Design System Compliance

Social preview images (`/og-image.png`) and web manifests MUST observe `DESIGN.md` tokens (Geist fonts, `#171717` ink, `#fafafa` canvas).

---

## 39. SEO Testing Protocols

1. **Metadata Audit**: Verify HTML `<head>` tags match required title, description, and canonical values.
2. **Sitemap Audit**: Verify `sitemap.xml` returns valid URLs and HTTP 200 responses.
3. **Typecheck Audit**: `pnpm typecheck` across all 9 monorepo workspace packages.

---

## 40. SEO Regression Protection

Before modifying public route structures or `sitemap.ts`:
* Verify canonical URLs resolve without broken link errors.
* Verify `noindex` flags remain active on private `/dashboard` layout trees.

---

## 41. Environment-Aware SEO

1. **Production Domain**: Production metadata MUST use `https://reachinternation.com`.
2. **Preview & Staging Environments**: Non-production environments (Vercel previews, local dev) MUST inject `noindex, nofollow` headers to prevent indexing duplicate staging sites.

---

## 42. SEO Configuration Centralization

Metadata configurations MUST be declared inside framework-native Next.js App Router files (`layout.tsx`, `page.tsx`, `sitemap.ts`). Creating duplicate helper scripts is FORBIDDEN.

---

## 43. Forbidden SEO Anti-Patterns (NEVER INTRODUCE)

AI agents MUST NEVER introduce any of the following SEO anti-patterns:
* ❌ **Indexing Private Pages**: Failing to add `noindex` to protected dashboard routes.
* ❌ **Duplicate `<h1>` Tags**: Rendering multiple `<h1>` elements on a single page.
* ❌ **Fake Structured Data**: Embedding fake JSON-LD ratings, prices, or user reviews.
* ❌ **Keyword Stuffing**: Repetitive, unnatural keyword insertions in descriptions or alt text.
* ❌ **CSS-Hidden Keyword Hacks**: Inserting visually hidden text (`display: none`) purely for search engines.
* ❌ **Hardcoded Staging URLs**: Referencing `localhost` or staging domains in production sitemaps.

---

## 44. Change Policy

Before updating metadata or route discoverability:
1. Verify route classification (Public vs Private).
2. Formulate the smallest correct metadata code change.
3. Perform post-implementation verification.

---

## 45. AI Agent Pre-Implementation SEO Checklist

Before writing code, every AI agent MUST complete this mental checklist:

* [ ] Is the route explicitly classified as Public or Private?
* [ ] Does the page title follow `[Page Title] | REACH INTERNATIONAL — Reaching All Heights`?
* [ ] Is `NEXT_PUBLIC_APP_URL` referenced for canonical URLs?
* [ ] Are private operational pages safeguarded with `noindex, nofollow`?
* [ ] Are image `alt` attributes descriptive and keyword-free?
* [ ] Does the HTML structure use a single `<h1>` with logical heading hierarchy?

---

## 46. AI Agent Post-Implementation SEO Audit

After completing code modifications, every AI agent MUST perform the following verification protocol:

1. **Compilation Audit**: Run `pnpm typecheck` across all 9 monorepo workspace packages.
2. **Sitemap & Robots Audit**: Confirm `sitemap.ts` and `robots.txt` reflect accurate public routes.
3. **Design & Responsive Audit**: Confirm visual compliance with `DESIGN.md` across Mobile, Tablet, and Desktop.
4. **Memory Synchronization**: Update `AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md`.

---
