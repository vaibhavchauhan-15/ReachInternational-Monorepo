import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  getEquipmentSegments,
  getEquipmentCategories,
  getEquipmentBrands,
  getFeaturedEquipment,
} from "@/lib/queries/equipment";
import {
  EquipmentSearch,
  EquipmentSegmentCard,
  EquipmentCategoryCard,
  EquipmentCard,
  EquipmentEnquiryForm,
} from "@/components/equipment";
import { primaryIndustries } from "@/lib/data/industries";
import { buildBreadcrumbJsonLd, buildEquipmentItemListJsonLd } from "@/lib/seo/jsonld";
import {
  Truck,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Headphones,
  Wrench,
  Sparkles,
} from "lucide-react";

export const revalidate = 3600; // 1 hour tag-invalidated ISR

export const metadata: Metadata = {
  title: "Industrial Equipment Fleet — Boom Lifts, Scissor Lifts & Forklifts | Reach International",
  description:
    "Explore professional aerial work platforms (AWP) and material handling equipment (MHE) for rental and purchase across India. Certified fleets from JLG, Genie, JCB, Toyota, Hyundai & BYD.",
  alternates: {
    canonical: "https://www.reachinternational.co.in/equipment",
  },
  openGraph: {
    title: "Industrial Equipment Fleet | Reach International",
    description:
      "Explore professional aerial work platforms and material handling equipment for rental and purchase across India.",
    url: "https://www.reachinternational.co.in/equipment",
    siteName: "Reach International",
    images: [
      {
        url: "/images/hero_boom_lift.jpg",
        width: 1200,
        height: 630,
        alt: "Reach International Equipment Fleet",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
};

export default async function EquipmentLandingPage() {
  const [segments, categories, brands, featured] = await Promise.all([
    getEquipmentSegments(),
    getEquipmentCategories(),
    getEquipmentBrands(),
    getFeaturedEquipment(6),
  ]);

  const awpSegment = segments.find((s) => s.slug === "awp") || {
    id: "awp",
    name: "Aerial Work Platforms",
    slug: "awp",
    description: "Equipment for elevated access and working safely at height across construction, maintenance, and industrial facilities.",
    sort_order: 1,
    created_at: "",
  };

  const mheSegment = segments.find((s) => s.slug === "mhe") || {
    id: "mhe",
    name: "Material Handling Equipment",
    slug: "mhe",
    description: "Equipment for lifting, transporting, and high-density stacking of materials across warehouses, yards, and factories.",
    sort_order: 2,
    created_at: "",
  };

  const breadcrumbsJsonLd = buildBreadcrumbJsonLd([
    { label: "Equipment Catalogue", href: "/equipment" },
  ]);

  const featuredItemListJsonLd = buildEquipmentItemListJsonLd(
    "Featured Industrial Equipment",
    featured.map((m, i) => ({
      name: m.model_name,
      url: `/equipment/${m.category.slug}/${m.slug}`,
      image: m.primary_image_url,
      position: i + 1,
    }))
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(featuredItemListJsonLd) }}
      />

      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] min-h-screen">
        {/* ==================================================================== */}
        {/* Section 1: Hero Stage                                                */}
        {/* ==================================================================== */}
        <section
          aria-labelledby="hero-heading"
          className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 border-b border-neutral-200/80 dark:border-neutral-800/80 overflow-hidden bg-radial-[at_top] from-sky-500/5 via-transparent to-transparent"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-semibold uppercase tracking-wider bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xs mb-6 text-neutral-800 dark:text-neutral-200">
                <span className="size-2 rounded-full bg-[#0284c7] animate-pulse" />
                <span>Pan-India Fleet Operations</span>
              </div>

              <h1
                id="hero-heading"
                className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-950 dark:text-white leading-[1.1] mb-6"
              >
                The Right Equipment for Every Project.
              </h1>

              <p className="text-base sm:text-xl text-neutral-600 dark:text-neutral-300 leading-relaxed mb-8 max-w-2xl mx-auto">
                Explore professional aerial work platforms and material handling equipment for rental and purchase across India.
              </p>

              {/* Quick Segment Jump Actions */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-10">
                <Link
                  href="/equipment/awp"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white shadow-xs transition-colors"
                >
                  <span>Explore Aerial Platforms (AWP)</span>
                  <ArrowRight className="size-4" />
                </Link>

                <Link
                  href="/equipment/mhe"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold bg-white dark:bg-[#141414] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-900 dark:text-white border border-neutral-300 dark:border-neutral-700 shadow-2xs transition-colors"
                >
                  <span>Explore Material Handling (MHE)</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              {/* Prominent Search Bar */}
              <EquipmentSearch />
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* Section 2: Equipment Segments (AWP & MHE Cards)                      */}
        {/* ==================================================================== */}
        <section aria-labelledby="segments-heading" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#0284c7] font-semibold block mb-1">
                Equipment Divisions
              </span>
              <h2
                id="segments-heading"
                className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white"
              >
                Two Specialized Divisions, One Trusted Fleet
              </h2>
            </div>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md">
              Whether reaching heights or stacking high-density storage, our machines are fully certified and ready for immediate deployment.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            <EquipmentSegmentCard
              segment={awpSegment}
              imageSrc="/images/awp_boom_lift.jpg"
              keyCategories={["Boom Lifts", "Scissor Lifts", "Vertical Mast Lifts", "Material Lifts"]}
              priority
            />
            <EquipmentSegmentCard
              segment={mheSegment}
              imageSrc="/images/mhe_reach_truck.jpg"
              keyCategories={["Counterbalanced Forklifts", "Reach Trucks", "Pallet Trucks", "Stackers"]}
            />
          </div>
        </section>

        {/* ==================================================================== */}
        {/* Section 3: Equipment Categories                                      */}
        {/* ==================================================================== */}
        <section
          aria-labelledby="categories-heading"
          className="py-16 sm:py-20 bg-white dark:bg-[#0f0f0f] border-y border-neutral-200/80 dark:border-neutral-800/80"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-[#0284c7] font-semibold block mb-1">
                  Machine Classes
                </span>
                <h2
                  id="categories-heading"
                  className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white"
                >
                  Explore Equipment by Category
                </h2>
              </div>
              <span className="text-xs sm:text-sm font-mono text-neutral-500 dark:text-neutral-400">
                {categories.length} Verified Categories Available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {categories.map((cat, idx) => (
                <EquipmentCategoryCard
                  key={cat.id}
                  category={cat}
                  priority={idx < 4}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* Section 5: Featured Equipment (Published Only)                       */}
        {/* ==================================================================== */}
        <section aria-labelledby="featured-heading" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-[#0284c7] font-semibold block mb-1">
                Featured Machinery
              </span>
              <h2
                id="featured-heading"
                className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white"
              >
                High-Performance Machinery in Stock
              </h2>
            </div>

            <Link
              href="/equipment/awp"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#0284c7] hover:underline"
            >
              <span>View full inventory</span>
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-7">
            {featured.map((eq, idx) => (
              <EquipmentCard key={eq.id} equipment={eq} priorityImage={idx < 3} />
            ))}
          </div>
        </section>

        {/* ==================================================================== */}
        {/* Section 6: Rental and Purchase Offerings                             */}
        {/* ==================================================================== */}
        <section
          aria-labelledby="offerings-heading"
          className="py-16 sm:py-20 bg-neutral-100 dark:bg-[#121212] border-y border-neutral-200/80 dark:border-neutral-800/80"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-mono uppercase tracking-wider text-[#0284c7] font-semibold block mb-1">
                Flexible Acquisition
              </span>
              <h2
                id="offerings-heading"
                className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white"
              >
                Equipment Rental &amp; Direct Sales
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mt-2">
                Tailored commercial terms designed to optimize capital allocation and ensure uptime on jobsites.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {/* Rental Card */}
              <div className="p-8 rounded-3xl bg-white dark:bg-[#171717] border border-neutral-200/90 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6">
                    <Truck className="size-6" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">
                    Equipment Rental Fleet
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
                    Zero maintenance headaches. Access late-model, certified boom lifts, scissors, and forklifts with flexible rental durations from single-month leases to multi-year contracts.
                  </p>

                  <ul className="space-y-3 mb-8">
                    {[
                      "Fully certified machines with valid third-party inspection logs",
                      "Preventive maintenance and breakdown response under 2 hours",
                      "Trained and licensed equipment operators available on demand",
                      "Transparent rental billing and Hour Meter (HMR) verified logging",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300">
                        <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href="#quote-assistance"
                  className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-semibold bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 transition-colors"
                >
                  <span>Request Rental Quotation</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              {/* Purchase Card */}
              <div className="p-8 rounded-3xl bg-white dark:bg-[#171717] border border-neutral-200/90 dark:border-neutral-800 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="size-12 rounded-2xl bg-sky-500/10 text-[#0284c7] flex items-center justify-center mb-6">
                    <Wrench className="size-6" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white mb-2">
                    Equipment Sales &amp; Fleet Ownership
                  </h3>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-6">
                    Acquire brand-new or certified refurbished heavy machinery directly from authorized OEM partners with complete documentation, manufacturer warranties, and spare parts supply.
                  </p>

                  <ul className="space-y-3 mb-8">
                    {[
                      "Authorized sales partner for JCB, Toyota, Hyundai, JLG, Genie, BYD",
                      "Full OEM warranty and verified machine maintenance pedigree",
                      "Annual Maintenance Contracts (AMC) and factory spares support",
                      "Financing and structured lease-to-own assistance",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300">
                        <CheckCircle2 className="size-4 text-[#0284c7] shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href="#quote-assistance"
                  className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl text-sm font-semibold bg-[#0284c7] hover:bg-[#0369a1] text-white transition-colors"
                >
                  <span>Inquire for Equipment Purchase</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* Section 7: Authorized OEM Brands                                     */}
        {/* ==================================================================== */}
        <section aria-labelledby="brands-heading" className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-mono uppercase tracking-wider text-[#0284c7] font-semibold block mb-1">
              Authorized Partnerships
            </span>
            <h2
              id="brands-heading"
              className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white"
            >
              World-Class Machinery Manufacturers
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-2">
              Every machine in our catalogue is sourced from certified global OEMs with genuine parts and safety compliance.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {brands.map((b) => (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#141414] border border-neutral-200/90 dark:border-neutral-800/90 shadow-2xs flex flex-col items-center justify-center text-center gap-2 group hover:border-[#0284c7]/40 transition-colors"
              >
                <div className="relative h-10 w-24">
                  <Image
                    src={b.logo_url || "/images/brands/jcb.svg"}
                    alt={`${b.name} logo`}
                    fill
                    className="object-contain dark:hidden"
                  />
                  <Image
                    src={b.dark_logo_url || b.logo_url || "/images/brands/jcb_dark.svg"}
                    alt={`${b.name} logo`}
                    fill
                    className="object-contain hidden dark:block"
                  />
                </div>
                <span className="text-xs font-bold text-neutral-900 dark:text-white">
                  {b.name}
                </span>
                <span className="text-[10px] font-mono text-neutral-400">
                  {b.models_count} {b.models_count === 1 ? "Model" : "Models"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ==================================================================== */}
        {/* Section 8: Industry Applications                                     */}
        {/* ==================================================================== */}
        <section
          aria-labelledby="applications-heading"
          className="py-16 sm:py-20 bg-white dark:bg-[#0f0f0f] border-t border-neutral-200/80 dark:border-neutral-800/80"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="text-xs font-mono uppercase tracking-wider text-[#0284c7] font-semibold block mb-1">
                Verified Deployments
              </span>
              <h2
                id="applications-heading"
                className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white"
              >
                Engineered for Critical Industries
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 mt-2">
                Certified heavy access platforms and material handling equipment deployed across high-rise infrastructure, automated logistics, and continuous plant turnarounds across India.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {primaryIndustries.map((ind) => (
                <div
                  key={ind.id}
                  className="group relative rounded-2xl bg-neutral-50 dark:bg-[#141414] border border-neutral-200/80 dark:border-neutral-800 p-6 flex flex-col justify-between hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors shadow-2xs"
                >
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#0284c7] font-semibold block mb-1">
                      {ind.eyebrow}
                    </span>
                    <h3 className="text-lg font-bold text-neutral-950 dark:text-white mb-2 group-hover:text-[#0284c7] transition-colors">
                      {ind.label}
                    </h3>
                    <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-4">
                      {ind.desc}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {ind.equipment.map((eq) => (
                        <span
                          key={eq}
                          className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200/60 dark:border-neutral-700"
                        >
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-neutral-200/60 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
                    <span className="font-mono text-[11px] text-[#0284c7]">{ind.stats}</span>
                    <span className="font-semibold text-neutral-800 dark:text-neutral-200">{ind.brands.join(", ")}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ==================================================================== */}
        {/* Section 9: Equipment Assistance CTA                                  */}
        {/* ==================================================================== */}
        <section
          id="quote-assistance"
          aria-labelledby="assistance-heading"
          className="py-16 sm:py-24 bg-white dark:bg-[#0c0c0c] border-t border-neutral-200/80 dark:border-neutral-800/80"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-xs font-mono uppercase tracking-wider text-[#0284c7] font-semibold block mb-1">
                Equipment Advisory
              </span>
              <h2
                id="assistance-heading"
                className="text-2xl sm:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white"
              >
                Not Sure Which Equipment Is Right for Your Project?
              </h2>
              <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 mt-3 leading-relaxed">
                Tell us your project requirements and our equipment specialists will help you identify suitable machinery.
              </p>
            </div>

            <EquipmentEnquiryForm />
          </div>
        </section>
      </div>
    </>
  );
}
