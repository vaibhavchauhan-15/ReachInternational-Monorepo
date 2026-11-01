import type { Metadata } from "next";
import { getSlimEquipmentList } from "@/lib/queries/rfq";
import { getEquipmentCategories } from "@/lib/queries/equipment";
import { RfqForm } from "@/components/rfq/RfqForm";
import {
  ShieldCheck,
  Clock,
  Truck,
  Headphones,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";

export const revalidate = 3600; // 1 hour ISR

export const metadata: Metadata = {
  title: "Request a Quote — Equipment Rental & Sales | Reach International",
  description:
    "Request competitive pricing and formal commercial quotations for boom lifts, scissor lifts, telehandlers, and industrial forklifts across India. 2 to 4 hour SLA response.",
  alternates: {
    canonical: "https://www.reachinternational.co.in/request-a-quote",
  },
  openGraph: {
    title: "Request an Equipment Quotation | Reach International",
    description:
      "Get instant, customized rental and purchase pricing for access platforms and heavy machinery across 36 Indian states and territories.",
    url: "https://www.reachinternational.co.in/request-a-quote",
    siteName: "Reach International",
    images: [
      {
        url: "/images/hero_boom_lift.jpg",
        width: 1200,
        height: 630,
        alt: "Reach International Industrial Equipment Fleet Quotations",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
};

interface RequestQuotePageProps {
  searchParams: Promise<{
    equipment?: string;
    category?: string;
    type?: "rental" | "purchase";
  }>;
}

export default async function RequestQuotePage({ searchParams }: RequestQuotePageProps) {
  const resolvedParams = await searchParams;
  const initialEquipmentId = resolvedParams.equipment;
  const initialCategoryId = resolvedParams.category;
  const initialType = resolvedParams.type === "purchase" ? "purchase" : "rental";

  const [slimEquipment, categories] = await Promise.all([
    getSlimEquipmentList(),
    getEquipmentCategories(),
  ]);

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Request an Industrial Equipment Quotation — Reach International",
    description:
      "Fast commercial quotation service for aerial work platforms, boom lifts, scissor lifts, and industrial forklifts across India.",
    url: "https://www.reachinternational.co.in/request-a-quote",
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: "https://www.reachinternational.co.in",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Request a Quote",
          item: "https://www.reachinternational.co.in/request-a-quote",
        },
      ],
    },
  };

  return (
    <div className="min-h-screen bg-neutral-50/60 pb-20 dark:bg-neutral-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Header & Breadcrumb */}
      <section className="border-b border-neutral-200/80 bg-white py-12 dark:border-neutral-800 dark:bg-neutral-900/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
            <Link href="/" className="hover:text-neutral-900 dark:hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/equipment" className="hover:text-neutral-900 dark:hover:text-white transition-colors">
              Equipment
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="font-semibold text-neutral-900 dark:text-neutral-100">
              Request a Quote
            </span>
          </nav>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                Fast Commercial Pricing Desk
              </span>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-neutral-950 sm:text-4xl dark:text-white">
                Request an Equipment Quotation
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                Receive an authoritative, itemized commercial quotation for boom lifts, scissor lifts, telehandlers, or forklifts. Fully compliant with India GST and project site standards.
              </p>
            </div>

            {/* Quick SLA Badge */}
            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-2.5 text-xs shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
              <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <div>
                <span className="block font-semibold text-neutral-900 dark:text-neutral-100">
                  2–4 Hour Response SLA
                </span>
                <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Mon–Sat 9:00 AM – 7:00 PM IST
                </span>
              </div>
            </div>
          </div>

          {/* Value Props Strip */}
          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-6 sm:grid-cols-4 dark:border-neutral-800/80">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Certified OEM Fleet
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
                <Truck className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Pan-India Mobilization
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                <Headphones className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Dedicated Sales Engineer
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Transparent GST Billing
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Form Section */}
      <main className="mx-auto mt-10 max-w-5xl px-4 sm:px-6 lg:px-8">
        <RfqForm
          equipmentList={slimEquipment}
          categories={categoryOptions}
          initialEquipmentId={initialEquipmentId}
          initialCategoryId={initialCategoryId}
          initialType={initialType}
        />

        {/* FAQs */}
        <section className="mt-16 rounded-2xl border border-neutral-200 bg-white p-8 shadow-xs dark:border-neutral-800 dark:bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            <h2 className="text-lg font-bold text-neutral-950 dark:text-neutral-100">
              Frequently Asked Questions About RFQs & Machinery Rental
            </h2>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-200">
                How quickly will I receive my formal commercial quotation?
              </h3>
              <p className="mt-1.5">
                Our sales engineers process RFQs within 2 to 4 business hours during working days. You will receive an official PDF quotation breakdown via email with HSN/SAC codes, machine specifications, and mobilization timelines.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-200">
                Can I request multiple machines with different durations?
              </h3>
              <p className="mt-1.5">
                Yes. Use the &quot;Add Another Machine&quot; button to combine boom lifts, scissor lifts, and material handlers in a single quote request. Each machine can have its own duration and requirement type.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-200">
                Do you provide certified equipment operators?
              </h3>
              <p className="mt-1.5">
                Yes. Reach International offers both bare rental (machinery only) and manned rental packages with certified, safety-trained heavy equipment operators. Mention your operator needs in the technical notes.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-200">
                What are the payment terms and security deposit policies?
              </h3>
              <p className="mt-1.5">
                Standard rental agreements require monthly advance payment plus mobilization/demobilization freight charges. For long-term contracts, custom credit and corporate billing lines are available subject to verification.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
