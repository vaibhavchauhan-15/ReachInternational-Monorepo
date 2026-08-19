import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUserOrNull } from "@/lib/dal";
import { AnimatedBackground } from "@/components/landing/AnimatedBackground";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { HeroSection } from "@/components/landing/HeroSection";
import { TrustedSection } from "@/components/landing/TrustedSection";
import { EquipmentGallery } from "@/components/landing/EquipmentGallery";
import { WorkflowSection } from "@/components/landing/WorkflowSection";
import { FeatureShowcaseSection } from "@/components/landing/FeatureShowcaseSection";
import { AnalyticsShowcaseSection } from "@/components/landing/AnalyticsShowcaseSection";
import { NotificationEngineSection } from "@/components/landing/NotificationEngineSection";
import { EngineerMobileSection } from "@/components/landing/EngineerMobileSection";
import { EnterpriseSecuritySection } from "@/components/landing/EnterpriseSecuritySection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FaqSection } from "@/components/landing/FaqSection";
import { CtaSection } from "@/components/landing/CtaSection";
import { LandingFooter } from "@/components/landing/LandingFooter";

export const metadata: Metadata = {
  title: "REACH INTERNATIONAL — Reaching All Heights",
  description:
    "Automate machine service tracking, engineer dispatches, multi-channel reminders, predictive analytics, and enterprise compliance workflows.",
  keywords: [
    "Reach International",
    "Reaching All Heights",
    "Machine Service Management",
    "Preventive Maintenance Software",
    "Field Service Engineering",
    "Enterprise Asset Management",
    "Industrial Automation",
  ],
  openGraph: {
    title: "REACH INTERNATIONAL — Reaching All Heights",
    description:
      "Automate machine service tracking, engineer dispatches, multi-channel reminders, predictive analytics, and enterprise compliance workflows.",
    type: "website",
    siteName: "REACH INTERNATIONAL",
  },
  twitter: {
    card: "summary_large_image",
    title: "REACH INTERNATIONAL — Reaching All Heights",
    description:
      "Automate machine service tracking, engineer dispatches, multi-channel reminders, predictive analytics, and enterprise compliance workflows.",
  },
};

export default async function Home() {
  const user = await getCurrentUserOrNull();

  if (user) {
    if (user.status === "active") {
      redirect("/dashboard");
    } else {
      redirect("/login");
    }
  }

  // JSON-LD Structured Data for Enterprise Software Schema
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "REACH INTERNATIONAL",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Enterprise heavy machinery management platform by REACH INTERNATIONAL — Reaching All Heights.",
  };

  return (
    <div className="relative min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] selection:bg-[var(--color-link-soft)] selection:text-[var(--color-link-deep)] overflow-x-hidden">
      {/* Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* High Performance Ambient Mesh Background */}
      <AnimatedBackground />

      {/* Floating Header */}
      <LandingHeader isLoggedIn={!!user} />

      {/* Main Landing Flow */}
      <main className="relative z-10">
        <HeroSection />
        <TrustedSection />
        <EquipmentGallery />
        <WorkflowSection />
        <FeatureShowcaseSection />
        <AnalyticsShowcaseSection />
        <NotificationEngineSection />
        <EngineerMobileSection />
        <EnterpriseSecuritySection />
        <TestimonialsSection />
        <FaqSection />
        <CtaSection />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}