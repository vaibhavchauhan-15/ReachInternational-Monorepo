# Reach International — About Page (`/about`) Technical Handoff Guide

**Route:** `/about`  
**Version:** 1.0 (Production Release)  
**Date:** November 2026  
**Stack:** Next.js 16.2 App Router (Server Components + Client Islands), GSAP 3.12 + ScrollTrigger, Lenis Smooth Scroll, Vercel Geist Tokens.

---

## 1. File Map

```
apps/web/
├── app/(marketing)/
│   └── about/
│       └── page.tsx                     # Server Component: composes all 13 sections in plan order (§4.1–§4.13)
├── components/marketing/about/
│   ├── AboutHero.tsx                    # Section 1: H1, eyebrow, responsive <picture> art direction, line-mask reveal
│   ├── AboutHeroScroll.tsx              # Desktop GSAP scroll parallax island (scale 1.08→1, yPercent -12)
│   ├── WhoWeAre.tsx                     # Section 2: Statement paragraph with scrubbed opacity + fleet image parallax
│   ├── NumbersStrip.tsx                 # Section 3: 4/2x2 grid with rAF CountUp (bypassed on reduced motion)
│   ├── JourneyTimeline.tsx              # Section 4: Milestone timeline wrapper (bypasses content-visibility)
│   ├── JourneyTimelineMotion.tsx        # Pinned horizontal GSAP scrub on desktop (≥1024px); vertical on mobile/tablet
│   ├── ServicesStack.tsx                # Section 5: Stacked cards with deep links to /equipment
│   ├── ServicesStackMotion.tsx          # Card stack pin/scrub animation island
│   ├── MissionVisionValues.tsx          # Section 6: Mission, vision, and core company values
│   ├── WhyReach.tsx                     # Section 7: Sticky heading + proof point list with OEM certifications
│   ├── TeamSection.tsx                  # Section 8: Leadership / Core / Ops tabs, 4:5 portraits, drawer trigger
│   ├── TeamCard.tsx                     # Individual team portrait card with keyboard trigger
│   ├── TeamDrawer.tsx                   # Radix Dialog drawer for full bio, credentials, LinkedIn link
│   ├── SafetyCerts.tsx                  # Section 9: HSE & ISO certifications grid
│   ├── PartnersMarquee.tsx              # Section 10: Infinite CSS OEM partner logo marquee
│   ├── GalleryParallax.tsx              # Section 11: 3-column parallax machinery yard gallery
│   ├── GalleryLightbox.tsx              # Radix Dialog full-screen photo lightbox with keyboard navigation
│   ├── IndustriesServed.tsx             # Section 12: Metro, renewables, industrial, EPC industry cards
│   ├── AboutCTA.tsx                     # Section 13: High-contrast dual CTA (Request a Quote / Contact Us)
│   └── AboutScrollWrapper.tsx           # Lenis desktop inertial smooth scroll wrapper
├── components/motion/
│   ├── Reveal.tsx                       # Lightweight IntersectionObserver reveal island (translate-y, fade-in)
│   ├── ScrubWords.tsx                   # Word-level scrubbed opacity island
│   ├── CountUp.tsx                      # Zero-dependency rAF counter (40% threshold, 1.4s cubic ease-out)
│   ├── Parallax.tsx                     # Desktop parallax wrapper with clip-path reveal
│   └── SmoothScrollProvider.tsx         # Lenis + GSAP ticker synchronization island
└── lib/about/
    ├── content.ts                       # Single source of truth for copy, toggles, placeholders
    ├── team.ts                          # Static data provider getTeam() (v1) with Supabase v2 signature
    └── schema.ts                        # JSON-LD builders: Organization + AboutPage Schema
```

---

## 2. Editing Copy in `lib/about/content.ts`

All text copy, headings, eyebrow labels, stats, milestones, and CTA text are centralized in `apps/web/lib/about/content.ts`.

- Open `apps/web/lib/about/content.ts`.
- Locate the section object inside `aboutContent` (e.g. `hero`, `whoWeAre`, `numbers`, `journey`, `services`, `missionVisionValues`, `whyReach`, `safety`, `partners`, `gallery`, `industries`, `cta`).
- Update strings directly.
- **Safety invariant:** Fields containing `[FILL:` are recognized by `isPlaceholder()` and **never render in production**; unconfirmed cards/stats are automatically omitted at render time.

Example:
```ts
export const aboutContent: AboutContent = {
  hero: {
    enabled: true,
    eyebrow: "India's Aerial & Material Handling Specialists",
    headline: "Reaching All Heights — for every project that works at height",
    subStatement: "Access platforms, boom lifts, scissor lifts, and material handling solutions engineered for zero-incident safety and peak site productivity.",
    ...
  }
}
```

---

## 3. Adding and Reordering Team Members

Team records are managed via `apps/web/lib/about/team.ts` in v1.

### To Add a Member:
Add an entry to `STATIC_TEAM_MEMBERS`:
```ts
{
  id: 'tm-new-01',
  name: 'First Last',
  role: 'Chief Technology Officer',
  group: 'leadership', // 'leadership' | 'core' | 'operations'
  bio: '2-3 sentences describing professional background, equipment certifications, and operational scope.',
  photo: '/images/team/first_last.jpg', // 4:5 aspect ratio, WebP/JPG
  linkedin: 'https://linkedin.com/in/firstlast',
  sortOrder: 1, // Determines visual card sequence in tab
}
```

### To Reorder:
Change the `sortOrder` number. `getTeam()` sorts ascending (`a.sortOrder - b.sortOrder`).

---

## 4. Enabling and Disabling Sections

Every section includes an independent `enabled: boolean` toggle in `apps/web/lib/about/content.ts`:
- `hero.enabled`
- `whoWeAre.enabled`
- `numbers.enabled`
- `journey.enabled`
- `services.enabled`
- `missionVisionValues.enabled`
- `whyReach.enabled`
- `team.enabled`
- `safety.enabled`
- `partners.enabled`
- `gallery.enabled`
- `industries.enabled`
- `cta.enabled`

Setting any flag to `false` unmounts that section from the Server Component tree with zero layout shift and removes its associated assets from download.

---

## 5. Image & Media Specifications

| Asset Location | Target Section | Aspect Ratio | Dimensions | Max Weight | Notes |
|---|---|---|---|---|---|
| `/images/hero_boom_lift.jpg` | Hero (Mobile) | 4:5 | 800×1000 | ≤ 100 KB | Eager/fetchpriority="high", responsive `<picture>` |
| `/images/hero_fleet_desktop_v4.jpg` | Hero (Desktop) | 16:9 / 21:9 | 1920×1080 | ≤ 150 KB | Min-width: 1024px `<picture>`, 78% center crop |
| `/images/team/*.jpg` | Team Cards | 4:5 | 600×750 | ≤ 60 KB | WebP/JPG, neutral studio or yard background |
| `/images/gallery/*.jpg` | Gallery Yard | 16:9 / 4:3 | 1200×800 | ≤ 120 KB | Lazy loaded, opens in full lightbox |
| `/images/brands/*.svg` | Partner Logos | Fixed | Vector | ≤ 10 KB | Pure vector, dual light/dark SVGs |

---

## 6. How to Run the Bundle Analyzer

### Production Bundle Measurement:
```bash
# 1. Clean build
pnpm --filter @reachinternational/web build

# 2. Run dedicated /about first-load transfer size inspector
node apps/web/scripts/measure-about-bundle.mjs
```

### Interactive Next.js Bundle Visualizer:
```bash
# Set ANALYZE environment variable and build
ANALYZE=true pnpm --filter @reachinternational/web build
```
This launches interactive Treemap client and server bundle maps in your default browser.

---

## 7. Known Limitations & Motion Fallbacks

1. **Horizontal Pinned Journey Timeline:**
   - Active strictly on desktop (`(min-width: 1024px) and (prefers-reduced-motion: no-preference)`).
   - On mobile/tablet (<1024px) or when reduced motion is preferred, it automatically renders a responsive vertical timeline with an SVG progress line.
   - Pinned sections intentionally omit `content-visibility: auto` to prevent browser scroll container recalculations.
2. **Smooth Scroll (Lenis):**
   - Active only on desktop fine-pointer devices.
   - Touch devices (iOS / Android) use native hardware momentum scrolling for 120Hz responsiveness.
   - All modal dialogs (TeamDrawer, GalleryLightbox) include `data-lenis-prevent` to prevent outer page scroll locks.

---

## 8. v2 Migration Path: Supabase `team_members`

The data access layer in `apps/web/lib/about/team.ts` exports `getTeam(): Promise<TeamMember[]>` designed for drop-in replacement with Supabase without modifying any component props.

### 8.1 Database Migration (SQL)
Run on Supabase Development Project (`vlmxciuogczumumrwyot`):

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

create index team_members_published_grp_order_idx
  on public.team_members (is_published, grp, sort_order);

alter table public.team_members enable row level security;

-- Public read access for published team profiles
create policy "public can read published team members" on public.team_members
  for select using (is_published = true);

-- Write access restricted to super_admin and admin roles
create policy "admins can manage team members" on public.team_members
  for all using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('super_admin', 'admin')
    )
  );
```

### 8.2 Data Layer Update (`apps/web/lib/about/team.ts`)
Replace the static array return with the Supabase SSR client:

```ts
import { createServerClient } from '@/lib/supabase/server';
import { unstable_cache } from 'next/cache';

export async function getTeam(): Promise<TeamMember[]> {
  return unstable_cache(
    async () => {
      const supabase = await createServerClient();
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, role, grp, bio, photo_path, linkedin_url, sort_order')
        .eq('is_published', true)
        .order('sort_order', { ascending: true });

      if (error || !data) return STATIC_TEAM_MEMBERS;

      return data.map((row) => ({
        id: row.id,
        name: row.name,
        role: row.role,
        group: row.grp as 'leadership' | 'core' | 'operations',
        bio: row.bio || '',
        photo: row.photo_path || '/images/team/placeholder.jpg',
        linkedin: row.linkedin_url || undefined,
        sortOrder: row.sort_order,
      }));
    },
    ['about-team-members'],
    { revalidate: 3600, tags: ['team'] }
  )();
}
```

### 8.3 On-Demand Invalidation
When an administrator publishes or modifies a team member in the admin portal:
```ts
import { revalidateTag } from 'next/cache';

export async function publishTeamMemberAction(id: string) {
  // ... mutation logic ...
  revalidateTag('team');
}
```

---

## 9. Files Changed Outside the About Feature

The following files outside `apps/web/app/(marketing)/about` and `components/marketing/about` were modified to support global bundle optimization, WCAG AA compliance, and cross-platform consistency:

1. **`apps/web/components/ui/Button.tsx`**:
   - Upgraded `primary` and `primary-sm` button background to `bg-sky-700` (`#0369a1`), elevating text contrast from 4.02:1 to 5.58:1 to achieve 100/100 WCAG AA compliance in Lighthouse.
2. **`apps/web/components/analytics/GoogleAnalytics.tsx`**:
   - Changed Google Tag script loading strategy from `afterInteractive` to `lazyOnload` to defer third-party GTM scripts off the mobile critical rendering path.
3. **`apps/web/app/layout.tsx`**:
   - Removed monolithic `TooltipProvider`, `ToastProvider`, and `PullToRefresh` wrappers from root layout; dynamically imported `CookieConsent` and `AgentationWrapper` to reduce first-load marketing JS payload.
4. **`apps/web/app/(app)/layout.tsx`**:
   - Re-wrapped authenticated dashboard application layout with `ToastProvider`, `TooltipProvider`, and `PullToRefresh`, preserving field mobile refresh and UI toasts where they are needed while completely isolating marketing pages.
5. **`apps/web/tsconfig.json`**:
   - Removed `"lucide-react": ["./components/ui/empty-icons.tsx"]` path alias that was intercepting standard icon imports and forcing all 65 animated icons and `framer-motion` into marketing bundles.
6. **`apps/web/app/not-found.tsx`**:
   - Decoupled from the `@/components/ui` barrel and migrated to standard Lucide icons and direct button import.
7. **`apps/web/components/marketing/navigation/Navigation.tsx`**:
   - Replaced shader-heavy `LiquidMetalButton` with high-performance Link CTA button, eliminating `@paper-design/shaders`.

---

## 10. Required Content Still Needed (Plan §12)

The following content fields in `apps/web/lib/about/content.ts` currently use safe fallback text or `[FILL]` placeholders and require client/management approval before production launch:

1. **`whoWeAre.leadStatement`**: Needs client confirmation of exact founding narrative and fleet scale numbers.
2. **`journey.milestones`**: Needs confirmed historical founding years and milestone accomplishments (e.g. 2012, 2015, 2018, 2021, 2024, 2026).
3. **`numbers.stats`**: Needs confirmed fleet count (e.g. 250+ AWPs), active clients, and states covered.
4. **`safety.standards`**: Needs official ISO/OSHA/IPAF certification numbers and issuing body names.
5. **`partners.brands`**: Needs verified list of authorized OEM dealership and rental partnerships with logo usage rights.
6. **`gallery.items`**: Needs 6–9 high-resolution photos of Reach International equipment on active client job sites.
7. **`team`**: High-resolution photography and approved 2-sentence bios for leadership and operations personnel.
