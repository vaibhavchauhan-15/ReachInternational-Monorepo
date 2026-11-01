import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { getTeam } from '@/lib/about/team';
import { buildAboutJsonLd } from '@/lib/about/schema';
import { AboutScrollWrapper } from '@/components/marketing/about/AboutScrollWrapper';
import { AboutHero } from '@/components/marketing/about/AboutHero';
import { WhoWeAre } from '@/components/marketing/about/WhoWeAre';
import { NumbersStrip } from '@/components/marketing/about/NumbersStrip';
import { JourneyTimeline } from '@/components/marketing/about/JourneyTimeline';
import { ServicesStack } from '@/components/marketing/about/ServicesStack';
import { MissionVisionValues } from '@/components/marketing/about/MissionVisionValues';
import { WhyReach } from '@/components/marketing/about/WhyReach';
import { SafetyCerts } from '@/components/marketing/about/SafetyCerts';
import { PartnersMarquee } from '@/components/marketing/about/PartnersMarquee';
import { IndustriesServed } from '@/components/marketing/about/IndustriesServed';

const TeamSection = dynamic(
  () => import('@/components/marketing/about/TeamSection').then((m) => m.TeamSection)
);
const GalleryParallax = dynamic(
  () => import('@/components/marketing/about/GalleryParallax').then((m) => m.GalleryParallax)
);
const AboutCTA = dynamic(
  () => import('@/components/marketing/about/AboutCTA').then((m) => m.AboutCTA)
);

export const metadata: Metadata = {
  title: 'About Reach International | AWP & Material Handling Rental and Sales',
  description:
    "Discover Reach International — India's trusted specialist in aerial work platforms and material handling equipment rental, certified fleet sales, and service.",
  alternates: {
    canonical: 'https://www.reachinternational.co.in/about',
  },
  openGraph: {
    title: 'About Reach International | AWP & Material Handling Rental and Sales',
    description:
      "Discover Reach International — India's trusted specialist in aerial work platforms and material handling equipment rental, certified fleet sales, and service.",
    url: 'https://www.reachinternational.co.in/about',
    siteName: 'Reach International',
    type: 'website',
    images: [
      {
        url: '/images/hero_boom_lift.jpg',
        width: 1200,
        height: 630,
        alt: 'About Reach International Fleet & Capabilities',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Reach International | AWP & Material Handling Rental and Sales',
    description:
      "Discover Reach International — India's trusted specialist in aerial work platforms and material handling equipment rental, certified fleet sales, and service.",
    images: ['/images/hero_boom_lift.jpg'],
  },
};

export default async function AboutPage() {
  const teamMembers = await getTeam();
  const jsonLd = buildAboutJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <AboutScrollWrapper>
        <div className="relative min-h-[100svh] bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50">
          {/* §4.1 Hero */}
          <AboutHero />

          {/* §4.2 Who We Are */}
          <WhoWeAre />

          {/* §4.3 Numbers Strip */}
          <NumbersStrip />

          {/* §4.4 Our Journey */}
          <JourneyTimeline />

          {/* §4.5 Services Stack */}
          <ServicesStack />

          {/* §4.6 Mission · Vision · Values */}
          <MissionVisionValues />

          {/* §4.7 Why Reach */}
          <WhyReach />

          {/* §4.8 Core Team / Leadership */}
          <TeamSection teamMembers={teamMembers} />

          {/* §4.9 Safety & Certifications */}
          <SafetyCerts />

          {/* §4.10 Partners & Brands */}
          <PartnersMarquee />

          {/* §4.11 Reach In Action (Gallery) */}
          <GalleryParallax />

          {/* §4.12 Industries We Serve */}
          <IndustriesServed />

          {/* §4.13 Closing CTA */}
          <AboutCTA />
        </div>
      </AboutScrollWrapper>
    </>
  );
}
