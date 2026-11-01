import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Phone,
  MessageSquare,
  ArrowRight,
  FileText,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Quote Request Received | Reach International",
  description:
    "Thank you for submitting your equipment quote request to Reach International. Our sales desk is processing your technical specifications.",
  robots: {
    index: false,
    follow: false,
  },
};

interface ThankYouPageProps {
  searchParams: Promise<{
    ref?: string;
  }>;
}

export default async function ThankYouPage({ searchParams }: ThankYouPageProps) {
  const resolvedParams = await searchParams;
  const refNumber = resolvedParams.ref || "RFQ-PENDING";

  const whatsappMessage = encodeURIComponent(
    `Hello Reach International Sales Desk, I have submitted equipment quote request ${refNumber} via your website. Could you please share an update on commercial availability?`
  );

  return (
    <div className="min-h-screen bg-neutral-50/60 pb-20 dark:bg-neutral-950">
      <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 sm:pt-16 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          <Link href="/" className="hover:text-neutral-900 dark:hover:text-white transition-colors">
            Home
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/request-a-quote" className="hover:text-neutral-900 dark:hover:text-white transition-colors">
            Request a Quote
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="font-semibold text-neutral-900 dark:text-neutral-100">
            Confirmation
          </span>
        </nav>

        {/* Confirmation Card */}
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs sm:p-10 dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Quote Request Logged Successfully
            </span>

            <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl dark:text-white">
              Thank You! Your Request Has Been Received.
            </h1>

            <p className="mt-2 max-w-lg text-sm text-neutral-600 dark:text-neutral-400">
              Our sales engineering desk is reviewing your equipment specifications and site parameters. An official quotation will be sent to your email.
            </p>

            {/* Reference Number Pill */}
            <div className="mt-6 inline-flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 px-6 py-3 dark:border-neutral-800 dark:bg-neutral-950">
              <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
                Official RFQ Reference Number
              </span>
              <span className="mt-0.5 font-mono text-xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
                {refNumber}
              </span>
            </div>
          </div>

          {/* SLA Timeline */}
          <div className="mt-10 border-t border-neutral-100 pt-8 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Next Steps & Dispatch Timeline (2 to 4 Business Hours)
              </h2>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 text-xs dark:border-neutral-800/80 dark:bg-neutral-950/40">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-xs font-semibold text-white">
                  1
                </div>
                <h3 className="mt-3 font-semibold text-neutral-900 dark:text-neutral-200">
                  Engineering Review
                </h3>
                <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                  We verify machine reach, platform weight limits, and terrain suitability for your project site.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 text-xs dark:border-neutral-800/80 dark:bg-neutral-950/40">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-950">
                  2
                </div>
                <h3 className="mt-3 font-semibold text-neutral-900 dark:text-neutral-200">
                  Quotation Dispatch
                </h3>
                <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                  A formal itemized PDF quotation with HSN/SAC codes, GST, and freight terms is delivered to your inbox.
                </p>
              </div>

              <div className="rounded-xl border border-neutral-100 bg-neutral-50/70 p-4 text-xs dark:border-neutral-800/80 dark:bg-neutral-950/40">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-950">
                  3
                </div>
                <h3 className="mt-3 font-semibold text-neutral-900 dark:text-neutral-200">
                  Site Mobilization
                </h3>
                <p className="mt-1 text-neutral-500 dark:text-neutral-400">
                  Upon purchase order sign-off, equipment is mobilized with safety certification and pre-dispatch checklists.
                </p>
              </div>
            </div>
          </div>

          {/* Urgent Enquiry CTA */}
          <div className="mt-8 rounded-xl border border-sky-100 bg-sky-50/50 p-5 dark:border-sky-950/60 dark:bg-sky-950/20">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  Need urgent machine mobilization today?
                </h3>
                <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                  Connect directly with our 24/7 priority equipment coordination desk.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`https://wa.me/918800040308?text=${whatsappMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-500 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp Desk
                </a>

                <a
                  href="tel:+918800040308"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-neutral-800 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 transition-colors"
                >
                  <Phone className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  +91 88000 40308
                </a>
              </div>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-neutral-100 pt-6 text-xs sm:flex-row dark:border-neutral-800">
            <Link
              href="/equipment"
              className="inline-flex items-center gap-1.5 text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white transition-colors"
            >
              <span>Explore full equipment fleet catalogue</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>

            <Link
              href="/"
              className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
            >
              Return to Homepage
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
