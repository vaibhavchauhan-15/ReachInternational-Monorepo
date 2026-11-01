import type { Metadata } from "next";
import {
  ContactHero,
  DepartmentCard,
  RegionalHubs,
  ContactFaq,
} from "@/components/marketing/contact";
import { CONTACT_FAQS } from "@/components/marketing/contact/data";
import {
  buildBreadcrumbJsonLd,
  buildContactPageJsonLd,
  buildFaqJsonLd,
} from "@/lib/seo/jsonld";

export const revalidate = 86400; // 24 hours ISR (marketing static page)

export const metadata: Metadata = {
  title: "Contact Us — Equipment Rental & Sales | REACH INTERNATIONAL — Reaching All Heights",
  description:
    "Contact Reach International for industrial boom lift, scissor lift, and forklift rentals (+91 88000 40308, rental@reachinternational.co.in) and sales (+91 98677 32204, sale@reachinternational.co.in) across India.",
  alternates: {
    canonical: "https://www.reachinternational.co.in/contact",
  },
  openGraph: {
    title: "Contact Equipment Rental & Sales | Reach International",
    description:
      "Direct access to Reach International heavy machinery specialists. Rental and sales support for boom lifts, scissor lifts, and forklifts across India.",
    url: "https://www.reachinternational.co.in/contact",
    siteName: "Reach International",
    images: [
      {
        url: "/images/hero_boom_lift.jpg",
        width: 1200,
        height: 630,
        alt: "Reach International Equipment Rental & Sales Desks",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Equipment Rental & Sales | Reach International",
    description:
      "Direct contact for heavy equipment rentals (+91 88000 40308) and machinery sales (+91 98677 32204) across India.",
    images: ["/images/hero_boom_lift.jpg"],
  },
};

export default function ContactPage() {
  const contactData = {
    rentalPhone: "+91-8800040308",
    rentalEmail: "rental@reachinternational.co.in",
    salesPhone: "+91-9867732204",
    salesEmail: "sale@reachinternational.co.in",
  };

  const breadcrumbsJsonLd = buildBreadcrumbJsonLd([
    { label: "Contact Us", href: "/contact" },
  ]);

  const contactPageJsonLd = buildContactPageJsonLd(contactData);
  const faqJsonLd = buildFaqJsonLd(CONTACT_FAQS);

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <article className="min-h-screen">
        {/* Hero Section with Breadcrumbs & Title */}
        <ContactHero />

        {/* Primary Department Contact Cards (Rental & Sale) */}
        <section
          aria-label="Department Contact Desks"
          className="pb-12 md:pb-16"
        >
          <div className="max-w-wide mx-auto px-4 md:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Department 1: Rental Desk */}
              <DepartmentCard type="rental" />

              {/* Department 2: Sales Desk */}
              <DepartmentCard type="sale" />
            </div>
          </div>
        </section>

        {/* Regional Hubs & Operational Depots */}
        <RegionalHubs />

        {/* Frequently Asked Questions */}
        <ContactFaq />
      </article>
    </>
  );
}
