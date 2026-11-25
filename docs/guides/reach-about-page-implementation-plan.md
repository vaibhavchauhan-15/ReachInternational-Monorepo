<USER_REQUEST>
# Reach International — About Page Implementation Plan

**Project:** reachinternational.co.in ("Reaching All Heights")
**Page:** `/about`
**Version:** 1.0 · **Date:** 1 Nov 2026
**Depends on:** PRD v2.1, DESIGN.md v1.0 (brand tokens, light/dark themes)

---

## 0. TL;DR

- One long, story-driven page: **Hero → Who we are → Numbers → Journey → Services → Mission/Vision/Values → Why Reach → Core Team → Safety → Partners → In action (gallery) → Industries → CTA.**
- Motion = **three tiers**: CSS/IO reveals (default) → GSAP ScrollTrigger (pin, scrub, parallax) → Lenis (inertial smooth scroll). Every tier degrades gracefully.
- Content is **server-rendered** (SEO + fast LCP). Animation code is **client islands**, lazy-loaded below the fold.
- Hard budgets: **LCP ≤ 2.0s (4G mid-phone), CLS ≤ 0.05, INP ≤ 200ms, page JS ≤ 170 KB gz first load.**
- Respect `prefers-reduced-motion`; no motion = still a complete, beautiful page.

---

## 1. Goals & Non-Goals

### Goals
1. Build trust with contractors, facility managers, and enterprise buyers who rent/buy AWP and MHE equipment.
2. Tell the company story clearly: who we are, what we do, who runs it, why we are safe and reliable.
3. Feel **modern and premium**: scroll-linked text, image, and section motion.
4. Fast and responsive on low/mid Android phones (primary Indian traffic).
5. Convert: every section points toward *Request a Quote / Contact*.

### Non-Goals (v1)
- No video background hero (heavy; revisit later with poster-first loading).
- No 3D/WebGL.
- No CMS for the whole page (only Team is admin-manageable, see §10).

---

## 2. Research Summary — What Strong About Pages Do

Reviewed: Awwwards About-page collection (scroll/parallax/timeline/team patterns), agency "best About pages" roundups, scrolling-site roundups, AWP/rental company about pages, and Next.js + Lenis + GSAP integration guides.

| Pattern seen | Applied to Reach |
|---|---|
| Opening statement states clearly what the company does | Hero headline + one-line sub-statement (§4.1) |
| Storytelling scroll: text reveals tied to scroll position | Scrubbed word-by-word reveal in "Who we are" (§4.2) |
| Timeline / "our journey" sections | Pinned horizontal timeline on desktop, vertical on mobile (§4.4) |
| Sticky/stacking cards for services | Stacking service cards (§4.5) |
| Team grid with image hover / spotlight | Team cards with hover + detail drawer (§4.8) |
| Parallax on photos, subtle (not nauseating) | ±8% image parallax, desktop/tablet only (§5) |
| Light/dark mode support | Reuse existing Reach themes |
| AWP/rental competitors are mostly text-heavy: years in business, fleet size, service coverage, maintenance included, safety/training emphasis | Our differentiator is **premium presentation** + the same trust signals (numbers, safety, service) |
| Lenis + GSAP ScrollTrigger on a **single shared RAF/ticker**, lag smoothing off, ScrollTrigger updated on Lenis scroll | Adopted exactly (§5.4) |
| `transform`/`opacity` only; `scrub` > 0 smooths jank; CSS for simple reveals, GSAP for pin/scrub/stagger | Adopted as motion rules (§5.1) |
| Smooth scroll on touch devices hurts performance/feel | Keep **native touch scroll** on mobile |

---

## 3. Assumptions & Stack

> Confirm these. If your stack differs, only §9–§11 change.

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Styling | Tailwind CSS using DESIGN.md tokens (CSS variables) |
| Animation | GSAP + ScrollTrigger (`@gsap/react` `useGSAP`), Lenis (`lenis`) |
| Images | `next/image` (AVIF/WebP), assets in `/public` or Supabase Storage |
| Data (Team) | Typed static data v1 → Supabase `team_members` v2 (matches Careers/Equipment admin direction) |
| Hosting | Vercel (or any CDN with image optimization) |

**Brand tokens (from DESIGN.md):** `--brand-blue #008CFC`, `--brand-charcoal #202329`, white; light + dark themes. Map every color below to a token, never hard-code hex.

---

## 4. Page Structure — Section by Section

Order is intentional: **emotion → proof → offering → people → trust → action.**

### 4.1 Hero
- **Purpose:** state who Reach is in one glance.
- **Content:** eyebrow `ABOUT REACH INTERNATIONAL`, H1 (e.g. "Reaching All Heights — for every project that works at height"), 1-line sub-statement, scroll cue.
- **Visual:** full-bleed photo of equipment at height (landscape, 2400×1350 source).
- **Desktop:** headline over image, image scale 1.08 → 1 as you scroll away; text lifts slightly (`yPercent: -12`).
- **Mobile:** headline stacked under a 4:5 cropped image; no parallax.
- **Motion:** on load, headline lines slide up from mask (CSS, 700ms stagger 80ms). Do **not** fade the LCP image from opacity 0 (hurts LCP). Reveal via clip-path on an overlay instead.
- **Perf:** `priority`, `fetchPriority="high"`, explicit `sizes`, blur placeholder.

### 4.2 Who We Are (Company Intro)
- **Purpose:** the "about the company" core.
- **Layout:** large statement paragraph (36–56px fluid) left/center + small supporting paragraph + image right.
- **Motion:** **scroll-scrubbed word reveal** — words go from 20% → 100% opacity as the paragraph crosses the viewport (scrub 0.6). Image: parallax ±8% + clip-path reveal on enter.
- **Content:** 60–90 words max. `[FILL: founding story, what Reach does in AWP / access equipment / MHE, rental + sales]`.
- **Note:** words are split **server-side** into `<span>`s so the full text exists in HTML (SEO, screen readers via `aria-label` on the parent).

### 4.3 Numbers Strip
- **Content (4 items, only real numbers):** `[FILL: years in business · machines in fleet · projects/clients served · cities/states covered]`.
- **Motion:** count-up when 40% visible, once only, 1.4s ease-out. Reduced motion → show final number.
- **Layout:** 4 cols desktop → 2×2 tablet → 2×2 mobile (smaller type).
- ⚠️ Never ship placeholder or estimated stats. Hide the strip if numbers aren't confirmed.

### 4.4 Our Journey (Timeline)
- **Purpose:** credibility through history.
- **Content:** 5–7 milestones `{ year, title, 1-line description, optional image }`. `[FILL]`
- **Desktop (≥1024px):** section **pinned**; milestones travel **horizontally** via scrubbed `x` translation; progress line fills with scroll.
- **Tablet/Mobile (<1024px):** plain **vertical timeline**, each item reveals on enter, progress line fills with scroll. *No pinning on mobile* (iOS/Android URL-bar resize makes pins janky).
- **Perf:** images lazy; pin only after fonts + images measured (`ScrollTrigger.refresh()` on load).

### 4.5 What We Do (Services)
- **Purpose:** "our services" — the commercial heart.
- **Cards (confirm which are offered):**
  1. Aerial Work Platform **Rental**
  2. Equipment **Sales** (AWP / access / MHE)
  3. Material Handling Equipment
  4. Service & Maintenance `[CONFIRM]`
  5. Operator Training / Safety Support `[CONFIRM]`
- **Each card:** icon or photo, title, 2-line description, "View equipment →" link to the Equipment page (or relevant page).
- **Desktop:** **sticky stacking cards** — each card sticks and the previous one scales to 0.94 and dims slightly as the next slides over (scrub).
- **Mobile:** simple vertical stack, enter-reveal only.

### 4.6 Mission · Vision · Values
- 3 cards (Mission, Vision, Values) then a values row (4–5 words each with 1-line meaning, e.g. Safety, Reliability, Service, Integrity). `[FILL real values]`
- **Motion:** staggered fade-up (CSS reveal), hover lift on desktop.

### 4.7 Why Reach (Differentiators)
- 4–6 items with icon + 1-line proof. Candidates: safety-first, well-maintained fleet, fast response, flexible rental terms, rental + sales under one roof, dedicated support. **Only keep what is true.**
- **Layout:** left sticky heading, right scrolling list (desktop); single column (mobile).

### 4.8 Core Team / Leadership
- **Purpose:** "core teams" — human trust.
- **Card:** portrait (4:5), name, role, 1-line bio, optional LinkedIn. `[FILL: names, roles, photos]`
- **Grouping:** *Leadership* (large cards) + *Core Team* (smaller grid). Add *Operations / Service* group if relevant.
- **Desktop:** 3–4 col grid; hover = image scale 1.04 + caption slide-up; click opens a **side drawer** with full bio (focus-trapped, ESC closes).
- **Mobile:** 2-col grid of compact cards; tap opens bottom sheet.
- **Motion:** row-wise stagger reveal; image mask reveal. Max 12 cards on initial render; "Show all" if more.
- **Photo consistency:** same background/crop/lighting, 1200×1500 source, desaturate-to-color on hover optional.

### 4.9 Safety & Certifications
- Badges/logos, standards followed, safety commitments. `[FILL: certifications, IPAF/ISO etc. only if held]`
- Layout: 2-col (text + badge grid). Subtle fade-in.

### 4.10 Partners & Brands
- Logo marquee of OEM/brand partners and key clients `[CONFIRM permissions to display logos]`.
- **Motion:** CSS-only infinite marquee, paused on hover and under reduced motion. Grayscale → color on hover. Logos as SVG/WebP < 8 KB each.

### 4.11 Reach In Action (Gallery)
- 6–9 photos of real jobs/yards/equipment. Asymmetric masonry (CSS grid), each image with different parallax speed (desktop only).
- Click → lightbox (lazy-loaded component, keyboard accessible).

### 4.12 Industries We Serve (optional)
- Chips/cards: Construction, Warehousing & Logistics, Manufacturing, Facility Maintenance, Events, etc. `[CONFIRM]`
- Simple reveal, no heavy motion.

### 4.13 Closing CTA
- Big statement ("Ready to reach new heights?") + primary button **Request a Quote**, secondary **Contact Us**, tertiary link **Careers →** (ties into the Careers page).
- **Motion:** background gradient shift + text reveal. Sticky mobile CTA bar appears after hero.

---

## 5. Motion System

### 5.1 Rules
1. Animate **only** `transform` and `opacity` (plus `clip-path` on small elements). Never `top/left/width/height/margin`.
2. Simple reveals → **CSS + IntersectionObserver** (zero JS animation cost).
3. Pin / scrub / parallax / stagger with logic → **GSAP ScrollTrigger**.
4. Smooth scroll feel → **Lenis**, desktop pointer devices only; touch stays native.
5. Use `scrub: 0.6–1` (not `true`) so scroll-linked motion feels smoothed.
6. `will-change: transform` only on elements actively animating; remove after.
7. Animate once (`once: true`) unless it is scroll-scrubbed.
8. Every animation has a no-JS / reduced-motion fallback = final visible state.

### 5.2 Tokens

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--dur-fast / base / slow` | 200 / 600 / 900 ms |
| Reveal distance | 24px (mobile 16px) |
| Stagger | 60–90 ms |
| Parallax range | ±8% desktop, ±4% tablet, off on phones |
| Scrub smoothing | 0.6–1 |

### 5.3 Per-section animation map

| Section | Effect | Engine | Mobile |
|---|---|---|---|
| Hero | Line mask reveal, image scale-out on scroll | CSS + GSAP | Reveal only |
| Who we are | Scrubbed word opacity, image parallax + clip reveal | GSAP | Words reveal on enter (no scrub), no parallax |
| Numbers | Count-up once | JS (rAF) | Same |
| Journey | Pinned horizontal scrub + progress line | GSAP | Vertical + progress line |
| Services | Sticky stacking cards, scale/dim | CSS sticky + GSAP | Stack + reveal |
| MVV / Why | Staggered fade-up | CSS/IO | Same |
| Team | Row stagger, hover, drawer | CSS/IO | Same |
| Safety / Industries | Fade-up | CSS/IO | Same |
| Partners | Marquee | CSS | Same |
| Gallery | Multi-speed parallax | GSAP | Reveal only |
| CTA | Gradient + text reveal | CSS | Same |

### 5.4 Lenis + GSAP integration (single ticker)

```tsx
// components/motion/SmoothScrollProvider.tsx
'use client';
import { useEffect, useRef } from 'react';
import { ReactLenis, useLenis, type LenisRef } from 'lenis/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    const tick = (t: number) => lenisRef.current?.lenis?.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => gsap.ticker.remove(tick);
  }, []);

  useLenis(ScrollTrigger.update);

  return (
    <ReactLenis root ref={lenisRef} options={{ autoRaf: false, lerp: 0.1 }}>
      {children}
    </ReactLenis>
  );
}
```

> Verify option names against the Lenis version you install (API has changed between releases). Lenis is mounted via a **dynamic import** so it never blocks first paint. Mount it in the marketing layout so Home/About/Careers feel consistent.

### 5.5 Responsive motion with `gsap.matchMedia()`

```ts
const mm = gsap.matchMedia();
mm.add('(min-width: 1024px) and (prefers-reduced-motion: no-preference)', () => {
  // pinned horizontal timeline, parallax, stacking cards
});
mm.add('(max-width: 1023px) and (prefers-reduced-motion: no-preference)', () => {
  // lightweight reveals only
});
// useGSAP cleanup reverts everything on unmount / route change
```

### 5.6 CSS reveal utility (zero-JS-cost default)

```css
.reveal { opacity: 0; transform: translateY(var(--reveal-y, 24px));
  transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
.reveal.is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } }
/* No-JS: content visible */
.no-js .reveal { opacity: 1; transform: none; }
```

A tiny shared `useReveal` (one `IntersectionObserver` for all `.reveal` nodes, `rootMargin: "0px 0px -10% 0px"`, unobserve after first hit).

---

## 6. Performance Plan

### 6.1 Budgets

| Metric | Target |
|---|---|
| LCP | ≤ 2.0 s (mobile, 4G) |
| CLS | ≤ 0.05 |
| INP | ≤ 200 ms |
| TBT | ≤ 200 ms |
| JS first load (page) | ≤ 170 KB gz |
| Hero image | ≤ 140 KB (AVIF, mobile variant ≤ 70 KB) |
| Lighthouse (mobile) | ≥ 90 Performance, 100 Accessibility, 100 SEO |

### 6.2 Tactics
- **Server Components** for all content; client components only for: SmoothScroll, Timeline, StackingServices, TeamDrawer, Gallery lightbox, Counters.
- **Lazy-load animation code:** `dynamic(() => import(...), { ssr: false })` for GSAP-heavy islands below the fold; GSAP/ScrollTrigger not in the hero's critical path.
- **Images:** `next/image` with accurate `sizes`, AVIF/WebP, `placeholder="blur"`, explicit width/height or `aspect-ratio` (zero CLS). Only the hero is `priority`. Everything else `loading="lazy"`.
- **Fonts:** `next/font`, subset Latin, `display: swap`, max 2 families / 3 weights; preload only the heading font.
- **Rendering:** `content-visibility: auto; contain-intrinsic-size: 800px` on below-fold sections.
- **Static generation:** page is SSG; Team via ISR (`revalidate: 3600`) once on Supabase.
- **No layout animation**, no huge blur/box-shadow animation, no `backdrop-filter` on scrolling large areas (Android jank).
- **Cleanup:** all ScrollTriggers killed on unmount (`useGSAP` scope); call `ScrollTrigger.refresh()` after fonts + images settle (`document.fonts.ready`, image `onLoad` for pinned sections).
- **Third-party:** none on this page except analytics (deferred, `afterInteractive`).
- **Lightbox, drawer, marquee** only hydrate on interaction/visibility.
- **Bundle guard:** `@next/bundle-analyzer` in CI; fail PR if page JS > budget.

---

## 7. Responsive Plan

| Breakpoint | Layout notes |
|---|---|
| < 480 | Single column, 16px gutters, 2-col stats, 2-col team (compact), bottom-sheet team detail, sticky CTA bar |
| 480–767 | Same, larger type |
| 768–1023 | 2-col splits, vertical timeline, reduced parallax (±4%) |
| 1024–1439 | Full layout: pinned timeline, stacking cards, 3–4 col team |
| ≥ 1440 | Max container 1280px, extra whitespace, larger hero type |

- **Type:** fluid `clamp()` (e.g. H1 `clamp(2.25rem, 5vw + 1rem, 5rem)`).
- **Touch targets:** ≥ 44×44 px.
- **Images:** art-directed crops (`<picture>`/`object-position`) for hero and team on mobile.
- **No horizontal page scroll** ever (only the pinned timeline track, which is contained).
- **Safe areas:** `env(safe-area-inset-*)` for sticky CTA bar.
- Use **`100svh`/`100dvh`**, never `100vh`, for hero height.

---

## 8. Accessibility & SEO

### Accessibility
- One `<h1>`, logical `h2/h3` per section; landmarks (`header/main/footer/section[aria-labelledby]`).
- Skip-to-content link.
- Split-word text: parent has `aria-label` with the full sentence; spans `aria-hidden`.
- `prefers-reduced-motion` disables Lenis, pins, parallax, scrubs, marquee, count-up.
- Team drawer/lightbox: focus trap, ESC close, return focus, `role="dialog"` + `aria-modal`.
- Color contrast ≥ 4.5:1 in both themes (check text over hero image with a gradient scrim).
- Meaningful `alt` on photos (team: "Name, Role"), decorative = `alt=""`.
- Marquee has a static fallback list for screen readers.

### SEO
- Title: `About Reach International | AWP & Material Handling Rental and Sales`
- Meta description (150–160 chars), canonical, OG/Twitter image (1200×630).
- **JSON-LD:** `Organization` (name, url, logo, sameAs, contactPoint, address) + `AboutPage`; optional `Person` for leadership.
- Internal links: services → Equipment, CTA → Contact/Quote, → Careers.
- Included in `sitemap.xml`; clean headings so Google can read all text (text is in HTML, not injected by JS).

---

## 9. Code Structure

```
app/(site)/about/
  page.tsx                  # server component, composes sections, metadata, JSON-LD
  loading.tsx               # optional skeleton
components/about/
  AboutHero.tsx
  WhoWeAre.tsx              # uses <SplitWords/> + <ScrubWords/>
  NumbersStrip.tsx          # <CountUp/>
  JourneyTimeline.tsx       # client; matchMedia (pin vs vertical)
  ServicesStack.tsx         # client; sticky stacking
  MissionVisionValues.tsx
  WhyReach.tsx
  TeamSection.tsx           # server; renders <TeamCard/>
  TeamCard.tsx
  TeamDrawer.tsx            # client, lazy
  SafetyCerts.tsx
  PartnersMarquee.tsx
  GalleryParallax.tsx       # client; lightbox lazy
  IndustriesServed.tsx
  AboutCTA.tsx
components/motion/
  SmoothScrollProvider.tsx
  Reveal.tsx                # CSS/IO reveal wrapper
  useReveal.ts
  SplitWords.tsx            # server-side word split
  ScrubWords.tsx            # client; scrub opacity
  CountUp.tsx
  Parallax.tsx              # client; wrapper for image parallax
lib/about/
  content.ts                # copy: hero, intro, values, services, timeline, why
  team.ts                   # typed static team data (v1)
  schema.ts                 # JSON-LD builders
public/about/               # optimized source images
```

### Types

```ts
// lib/about/content.ts
export type Milestone = { year: string; title: string; text: string; image?: string };
export type Service = { slug: string; title: string; text: string; icon: string; href: string };
export type Stat = { value: number; suffix?: string; label: string };

// lib/about/team.ts
export type TeamMember = {
  id: string; name: string; role: string; group: 'leadership' | 'core' | 'operations';
  bio: string; photo: string; linkedin?: string; order: number;
};
```

---

## 10. Team Data — v1 Static → v2 Admin-Managed

**v1 (launch):** `lib/about/team.ts`, so the page ships without waiting on backend work.

**v2 (matches your admin panel direction):** Supabase table, managed from Admin → Marketing → Team.

```sql
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  grp text not null check (grp in ('leadership','core','operations')),
  bio text,
  photo_path text,            -- Supabase Storage: team-photos/
  linkedin_url text,
  sort_order int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on public.team_members (is_published, grp, sort_order);

alter table public.team_members enable row level security;
create policy "public can read published" on public.team_members
  for select using (is_published = true);
-- writes: admin role only (reuse existing admin policy helper)
```

- Fetch server-side with ISR (`revalidate: 3600`) + on-demand `revalidateTag('team')` when admin publishes.
- Storage bucket `team-photos` (public read), upload constraint: JPG/PNG/WebP ≤ 2 MB, resize to 1200×1500 on upload.
- Keep the data layer behind `getTeam()` so switching v1 → v2 does not touch components.

---

## 11. Assets Checklist

| Asset | Spec |
|---|---|
| Hero photo | 2400×1350, equipment at height, clear sky/space for text, AVIF/WebP + JPG fallback |
| Intro photo | 1600×1200 |
| Timeline images (optional) | 1200×800, 5–7 |
| Service images/icons | 1200×900 photos or 64px SVG icons, consistent style |
| Team portraits | 1200×1500, same backdrop/lighting/crop |
| Gallery | 6–9 photos, mix of 3:2, 4:5, 1:1; 1600px long edge |
| Partner logos | SVG preferred, mono + color |
| Cert badges | SVG/PNG ≤ 20 KB |
| OG image | 1200×630 |

Naming: `about-hero.jpg`, `team-firstname-lastname.jpg`, `gallery-01.jpg`. Strip EXIF, compress before commit.

---

## 12. Content You Need To Provide

- [ ] Company story (founding year, founders, growth) — 120–200 words
- [ ] Hero headline + sub-statement (or approve suggested)
- [ ] 4 verified numbers (years, fleet, clients/projects, coverage)
- [ ] 5–7 timeline milestones with years
- [ ] Confirmed list of services (esp. service/maintenance, training)
- [ ] Mission, Vision, 4–5 Values
- [ ] 4–6 "Why Reach" proof points
- [ ] Team: names, roles, 1-line bios, photos, consent to publish
- [ ] Certifications/safety standards actually held
- [ ] Partner/client logos with permission
- [ ] 6–9 real job/yard photos
- [ ] Office address, phone, email for schema + CTA

> No fabricated stats, certifications, or client logos. Any section without confirmed content is **hidden**, not filled with placeholders.

---

## 13. Build Phases

| Phase | Work | Est. |
|---|---|---|
| 0. Prep | Confirm stack, collect content/photos, map DESIGN.md tokens | 0.5–1 d |
| 1. Foundation | Route, metadata, layout, section shells, typography, motion tokens, `Reveal`, `SmoothScrollProvider` | 1 d |
| 2. Static build (no animation) | All sections responsive, light/dark, real content, images optimized | 3 d |
| 3. Motion layer | SplitWords/ScrubWords, parallax, counters, timeline pin, stacking cards, team hover/drawer, gallery lightbox | 2–3 d |
| 4. Perf, a11y, SEO | Budgets, bundle analysis, lazy islands, JSON-LD, reduced-motion pass, keyboard pass | 1–2 d |
| 5. QA & launch | Device matrix, Lighthouse/WebPageTest, fixes, deploy, Search Console submit | 1 d |
| **Total** | | **~9–11 working days** |

**Order of risk:** build Phase 2 complete **before** Phase 3 so the page is shippable without motion at any point.

---

## 14. QA Checklist

### Performance
- [ ] Lighthouse mobile ≥ 90 (run 3×, median)
- [ ] CPU 4× throttle + Slow 4G: hero visible < 2s, scroll stays smooth
- [ ] CLS ≈ 0 (images, fonts, pinned sections)
- [ ] Bundle analyzer: page JS within budget
- [ ] No long tasks > 50ms during scroll (Performance panel)

### Motion
- [ ] Lenis + ScrollTrigger in sync (no jitter on pinned section)
- [ ] Back/forward navigation and route change leave no stray triggers
- [ ] Resize/orientation change → `ScrollTrigger.refresh()` works
- [ ] Reduced motion: no pin, no parallax, no scrub, content fully visible
- [ ] Anchor links and browser find-in-page work with smooth scroll

### Responsive / Devices
- [ ] iPhone Safari (URL bar collapse), Android Chrome (low-end), iPad, 1366×768 laptop, 1440p, 4K
- [ ] Light + dark theme on every section
- [ ] No horizontal scroll at any width 320–2560px

### Accessibility / SEO
- [ ] Keyboard only: all interactive items reachable, drawer/lightbox trap focus
- [ ] Screen reader reads split-word paragraphs as full sentences
- [ ] Contrast OK over images
- [ ] Rich Results Test passes for JSON-LD
- [ ] Title/description/OG verified, canonical set, in sitemap

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Heavy motion hurts low-end Android | Tiered motion; matchMedia; no parallax/pin on phones; native touch scroll |
| Pinned timeline breaks with late-loading images/fonts | Fixed aspect ratios, `refresh()` after `fonts.ready`, vertical fallback |
| Split text hurts SEO/a11y | Server-side split, full text in DOM, `aria-label` |
| Lenis conflicts (modals, nested scroll) | `data-lenis-prevent` on drawer/lightbox scroll areas; `lenis.stop()` while modal open |
| Missing real content delays launch | Section-level hide flags in `content.ts`; ship with confirmed sections only |
| Team photos inconsistent | Photo brief + crop guide; enforce crop in upload step (v2) |
| Library API drift (Lenis/GSAP) | Pin versions; verify against current docs at install |

---

## 16. Definition of Done

1. All confirmed sections live, responsive, light + dark.
2. Budgets in §6.1 met on production URL.
3. Reduced-motion and keyboard checks pass.
4. JSON-LD valid, metadata correct, page in sitemap.
5. Team section works from `getTeam()` (static v1; Supabase-ready).
6. No console errors, no leaked ScrollTriggers, no CLS regressions.
7. Analytics events set: CTA clicks (`about_cta_quote`, `about_cta_contact`), team drawer opens, service card clicks.

---

## 17. Suggested Follow-ups (after launch)
- Admin-managed Team (v2, §10).
- Short hero video (poster-first, ≤ 1.5 MB, only on desktop + fast connection).
- Customer testimonials/case studies section once real quotes are available.
- Reuse `Reveal`, `SplitWords`, `Parallax`, `SmoothScrollProvider` on Home and Careers for one consistent motion language.

You are a senior Next.js engineer building the About page for Reach International
(reachinternational.co.in, tagline "Reaching All Heights" — aerial work platforms,
access equipment and material handling; rental and sales).

SOURCE OF TRUTH
- Read /docs/reach-about-page-implementation-plan.md fully before writing code.
- Also read the repo's PRD (v2.1) and DESIGN.md (v1.0) if present. DESIGN.md tokens
  (colors #008CFC blue, #202329 charcoal, white; light + dark themes) override any
  color or spacing in the plan. If the plan and DESIGN.md conflict, follow DESIGN.md
  and tell me.

FIRST, INSPECT THE REPO (do not assume)
- Detect: framework + version, router (App Router vs Pages), TypeScript, Tailwind
  config, existing layout/header/footer, theme switching mechanism, existing
  components (Button, Container, Section, Reveal, Card), image handling, fonts,
  Supabase client usage, how the Careers/Equipment pages are structured.
- REUSE existing components, tokens and patterns. Do not create a parallel design
  system. Only add what is missing.
- Report a 10-line summary of what you found and any deviations from the plan's
  assumptions BEFORE building.

STACK FOR THIS FEATURE
- Route: /about (inside the existing marketing layout group).
- Animation: gsap + ScrollTrigger (@gsap/react useGSAP), lenis. Install only what
  is missing; pin versions; verify API names against the installed versions' docs
  (Lenis options have changed between releases).
- Content sections are Server Components. Only animation/interaction islands are
  client components.

HARD RULES
1. NO fabricated content. Never invent stats, founding year, client names, logos,
   certifications, team names, bios, or quotes. Use a typed content file with clearly
   marked placeholders, and add a per-section `enabled` flag so any section without
   confirmed content is hidden (not shown with fake data). Placeholder text must be
   obviously placeholder (e.g. "[FILL: …]") and must not render in production
   builds (hide section if any required field still starts with "[FILL").
2. Animate only transform and opacity (clip-path on small elements allowed). Never
   animate layout properties.
3. Simple reveals = CSS + one shared IntersectionObserver. GSAP only for pin, scrub,
   parallax, stagger-with-logic. Lenis only on desktop/pointer devices; touch stays
   native scroll.
4. Every animation must have a final-state fallback for: no-JS, and
   prefers-reduced-motion (disable Lenis, pin, parallax, scrub, marquee, count-up).
5. Do not fade the LCP/hero image from opacity 0. Hero image uses next/image with
   priority, fetchPriority="high", correct sizes.
6. Split-word text must be rendered server-side, with the full sentence in the DOM
   and aria-label on the parent (spans aria-hidden).
7. Use 100svh/100dvh, never 100vh. No horizontal page scroll at 320–2560px.
8. All GSAP code uses useGSAP scoped cleanup and gsap.matchMedia(); no leaked
   ScrollTriggers on route change. Call ScrollTrigger.refresh() after
   document.fonts.ready and after pinned-section images load.
9. No new third-party scripts. No console errors/warnings.
10. Colors via tokens/CSS variables only. Both light and dark themes must work.
11. Never modify unrelated pages/components except minimal, necessary wiring
    (nav link, sitemap entry, shared provider mount). List every file you touched
    outside the About feature.

WORKFLOW
- Create a task list from the phases I send. Work phase by phase; stop at the end
  of each phase and show: files created/changed, how to run/verify, and anything
  that needs my input. Do not start the next phase until I say so.
- Run typecheck, lint and build at the end of every phase and fix failures.
- Keep commits small and phase-scoped (conventional commit messages).
- If something in the plan is ambiguous or blocked by missing content, make the
  smallest safe choice, note it, and continue — don't stall.

Reply now with only the repo inspection summary and your proposed file list. Then wait.

i want to go phase by phase
so complete phase 0 then i will give you next phase task
</USER_REQUEST>
<ADDITIONAL_METADATA>
The current local time is: 2026-11-01T11:43:55+05:30.

The user's current state is as follows:
Active Document: c:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\apps\web\components\marketing\contact\ContactHero.tsx (LANGUAGE_TSX)
Cursor is on line: 1
Other open documents:
- c:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\apps\web\components\layout\MobilePageHeader.tsx (LANGUAGE_TSX)
- c:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\apps\mobile\components\operations\RunningLogDayGroup.tsx (LANGUAGE_TSX)
- c:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\apps\mobile\app\(app)\profile\edit.tsx (LANGUAGE_TSX)
- c:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\apps\mobile\components\clients\ClientCardSkeleton.tsx (LANGUAGE_TSX)
- c:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\apps\mobile\components\operations\RunningLogShiftCard.tsx (LANGUAGE_TSX)
Running terminal commands:
- pnpm dev (in c:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\apps\web, running for 35m3s)
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from None to Gemini 3.8 Flash (High). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>