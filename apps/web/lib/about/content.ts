/**
 * About Page Content Architecture
 * Strictly enforced against fabricated data.
 * Every section has an `enabled` flag and fields containing `[FILL:` are
 * automatically filtered out so placeholders never render in production.
 */

export type Milestone = {
  year: string;
  title: string;
  text: string;
  image?: string;
};

export type Service = {
  slug: string;
  title: string;
  text: string;
  icon: string;
  href: string;
};

export type Stat = {
  value: number;
  suffix?: string;
  label: string;
};

export type ValueItem = {
  title: string;
  description: string;
};

export type Differentiator = {
  title: string;
  proof: string;
  icon: string;
};

export type SafetyStandard = {
  name: string;
  description: string;
  badge?: string;
};

export type GalleryItem = {
  id: string;
  title: string;
  alt: string;
  src: string;
  aspectRatio: 'landscape' | 'portrait' | 'square';
};

/**
 * Checks if a string value is an unfilled placeholder.
 */
export function isPlaceholder(val?: string | null): boolean {
  if (!val) return true;
  return val.trim().startsWith('[FILL');
}

/**
 * Validates whether an object has any unfulfilled mandatory fields.
 */
export function containsPlaceholders(obj: Record<string, unknown>): boolean {
  for (const value of Object.values(obj)) {
    if (typeof value === 'string' && isPlaceholder(value)) {
      return true;
    }
  }
  return false;
}

export interface AboutContent {
  hero: {
    enabled: boolean;
    eyebrow: string;
    headline: string;
    subStatement: string;
    image: {
      src: string;
      alt: string;
    };
  };
  whoWeAre: {
    enabled: boolean;
    heading: string;
    leadStatement: string;
    supportingParagraph: string;
    image: {
      src: string;
      alt: string;
    };
  };
  numbers: {
    enabled: boolean;
    heading: string;
    stats: Stat[];
  };
  journey: {
    enabled: boolean;
    heading: string;
    subheading: string;
    milestones: Milestone[];
  };
  services: {
    enabled: boolean;
    heading: string;
    subheading: string;
    items: Service[];
  };
  mvv: {
    enabled: boolean;
    mission: { title: string; text: string };
    vision: { title: string; text: string };
    values: { title: string; text: string; items: ValueItem[] };
  };
  whyReach: {
    enabled: boolean;
    heading: string;
    subheading: string;
    items: Differentiator[];
  };
  safety: {
    enabled: boolean;
    heading: string;
    subheading: string;
    commitments: string[];
    standards: SafetyStandard[];
  };
  partners: {
    enabled: boolean;
    heading: string;
    subheading: string;
  };
  gallery: {
    enabled: boolean;
    heading: string;
    subheading: string;
    items: GalleryItem[];
  };
  industries: {
    enabled: boolean;
    heading: string;
    subheading: string;
  };
  cta: {
    enabled: boolean;
    heading: string;
    subheading: string;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
    careersLink: { label: string; href: string };
  };
}

export const aboutContent: AboutContent = {
  hero: {
    enabled: true,
    eyebrow: 'ABOUT REACH INTERNATIONAL',
    headline: 'Reaching All Heights — for every project that works at height',
    subStatement:
      'India’s trusted specialist in aerial work platforms and material handling equipment rental, sales, and full-lifecycle support.',
    image: {
      src: '/images/hero_boom_lift.jpg',
      alt: 'Reach International heavy aerial work platform elevated at industrial worksite',
    },
  },
  whoWeAre: {
    enabled: true,
    heading: 'Who We Are',
    leadStatement:
      'Built on engineering discipline, stringent safety protocols, and nationwide deployment capabilities.',
    supportingParagraph:
      'Reach International provides modern aerial work platforms (AWP), boom lifts, scissor lifts, forklifts, and specialized material handling equipment (MHE) for landmark infrastructure, industrial manufacturing, and warehousing projects across India.',
    image: {
      src: '/images/hero_fleet_desktop_v4.jpg',
      alt: 'Reach International certified aerial access fleet ready for deployment',
    },
  },
  numbers: {
    // Disabled until confirmed by stakeholder per Hard Rule 1
    enabled: false,
    heading: 'Reach International by the Numbers',
    stats: [
      { value: 0, suffix: '+', label: '[FILL: Verified years in business]' },
      { value: 0, suffix: '+', label: '[FILL: Verified machines in fleet]' },
      { value: 0, suffix: '+', label: '[FILL: Verified projects served]' },
      { value: 0, suffix: '+', label: '[FILL: Verified cities/states covered]' },
    ],
  },
  journey: {
    // Disabled until verified milestones with years are supplied
    enabled: false,
    heading: 'Our Journey',
    subheading: 'A history of elevating safety, reliability, and access engineering.',
    milestones: [
      {
        year: '[FILL: Year]',
        title: '[FILL: Milestone Title]',
        text: '[FILL: Milestone Description]',
      },
    ],
  },
  services: {
    enabled: true,
    heading: 'What We Do',
    subheading: 'Integrated access equipment rental, equipment sales, and technical fleet solutions.',
    items: [
      {
        slug: 'awp-rental',
        title: 'Aerial Work Platform Rental',
        text: 'Articulated booms, telescopic boom lifts, and electric & rough-terrain scissor lifts with 100% certified maintenance.',
        icon: 'Truck',
        href: '/equipment/awp',
      },
      {
        slug: 'equipment-sales',
        title: 'Equipment Sales',
        text: 'New and certified pre-owned aerial work platforms and material handling units from global OEM leaders.',
        icon: 'Wrench',
        href: '/equipment',
      },
      {
        slug: 'mhe',
        title: 'Material Handling Equipment',
        text: 'Counterbalanced electric & diesel forklifts, reach trucks, and high-density warehouse lifting solutions.',
        icon: 'Package',
        href: '/equipment/mhe',
      },
      {
        slug: 'service-maintenance',
        title: 'Field Service & Maintenance',
        text: '24/7 on-site technical support, preventative service tracking, genuine OEM parts, and minimal downtime.',
        icon: 'ShieldCheck',
        href: '/contact',
      },
      {
        slug: 'safety-training',
        title: 'Operator Training & Safety Support',
        text: 'Standardized certified operator training, daily pre-operation inspection rigor, and site safety audits.',
        icon: 'Award',
        href: '/contact',
      },
    ],
  },
  mvv: {
    enabled: true,
    mission: {
      title: 'Our Mission',
      text: 'To empower industrial, infrastructure, and commercial operations across India with zero-compromise access safety, reliable heavy machinery, and dependable on-ground service.',
    },
    vision: {
      title: 'Our Vision',
      text: 'To be India’s most trusted, technologically disciplined access equipment and material handling partner, setting the benchmark for zero-harm worksite productivity.',
    },
    values: {
      title: 'Our Core Values',
      text: 'The operating standards that govern every machine handover, maintenance check, and customer relationship.',
      items: [
        {
          title: 'Safety First',
          description: 'Zero tolerance for compromised machinery or shortcuts in worksite safety protocols.',
        },
        {
          title: 'Engineering Reliability',
          description: 'Rigorous preventative maintenance schedules ensuring high availability and zero surprises.',
        },
        {
          title: 'Speed & Responsiveness',
          description: 'Rapid dispatch, transparent SLA tracking, and dedicated on-site technical resolution.',
        },
        {
          title: 'Integrity & Compliance',
          description: 'Transparent rental agreements, certified operator standards, and complete statutory compliance.',
        },
      ],
    },
  },
  whyReach: {
    enabled: true,
    heading: 'Why Reach International',
    subheading: 'Engineered for reliability, built for heavy-duty operational demands.',
    items: [
      {
        title: 'Modern OEM Fleet',
        proof: 'Access equipment from world-leading OEMs (JCB, Genie, JLG, BYD, Toyota) inspected to factory standards.',
        icon: 'Cpu',
      },
      {
        title: 'Rigorous Preventative Maintenance',
        proof: 'Every unit undergoes systematic pre-delivery inspection (PDI) and logged meter-interval servicing.',
        icon: 'CheckCircle2',
      },
      {
        title: 'Flexible Rental & Sales Options',
        proof: 'Short-term project rentals, multi-year dry/wet leases, and certified capital sales under one roof.',
        icon: 'Layers',
      },
      {
        title: 'Dedicated Rapid Support',
        proof: 'Field-service engineers dispatched promptly with OEM spares to maximize machine uptime on site.',
        icon: 'Clock',
      },
    ],
  },
  safety: {
    enabled: true,
    heading: 'Safety & Operational Rigor',
    subheading: 'Safe machines, trained operators, zero compromise.',
    commitments: [
      'Comprehensive Pre-Delivery Inspection (PDI) before every mobilization',
      'Digital shift logs & hour-meter tracking across operating machinery',
      'Operator licensing and site-specific PPE protocol enforcement',
      'Regular hydraulic, structural, and load-limiting system calibrations',
    ],
    standards: [
      {
        name: 'OEM Factory Standards',
        description: 'Serviced strictly with genuine OEM filters, fluids, and calibrated replacement parts.',
      },
      {
        name: 'Statutory Safety Compliance',
        description: 'Third-party fitness certifications, load test reports, and statutory inspection documentation.',
      },
    ],
  },
  partners: {
    enabled: true,
    heading: 'OEM Brands & Enterprise Clients',
    subheading: 'Trusted by India’s leading infrastructure, automotive, and industrial pioneers.',
  },
  gallery: {
    enabled: true,
    heading: 'Reach In Action',
    subheading: 'A glimpse of our machinery operating across landmark facilities nationwide.',
    items: [
      {
        id: 'gal-1',
        title: 'Telescopic Boom Lift at Industrial Facility',
        alt: 'High-reach boom lift working at heavy manufacturing facility',
        src: '/images/hero_boom_lift.jpg',
        aspectRatio: 'landscape',
      },
      {
        id: 'gal-2',
        title: 'Rough-Terrain Scissor Lift in Logistics Hub',
        alt: 'Scissor lift platform working in warehouse aisle',
        src: '/images/awp_scissor_lift.jpg',
        aspectRatio: 'portrait',
      },
      {
        id: 'gal-3',
        title: 'Heavy Electric Counterbalanced Forklift',
        alt: 'MHE forklift lifting pallet in manufacturing plant',
        src: '/images/mhe_forklift.jpg',
        aspectRatio: 'square',
      },
      {
        id: 'gal-4',
        title: 'High-Density Reach Truck in High-Bay Warehouse',
        alt: 'Reach truck operating in narrow warehouse aisle',
        src: '/images/mhe_reach_truck.jpg',
        aspectRatio: 'portrait',
      },
      {
        id: 'gal-5',
        title: 'Articulated Boom Lift in Infrastructure Project',
        alt: 'Articulated boom lift operating on construction site',
        src: '/images/industry_construction.jpg',
        aspectRatio: 'landscape',
      },
      {
        id: 'gal-6',
        title: 'Certified Aerial Work Platform Fleet Yard',
        alt: 'Reach International fleet line-up ready for project mobilization',
        src: '/images/hero_fleet_desktop_v4.jpg',
        aspectRatio: 'landscape',
      },
    ],
  },
  industries: {
    enabled: true,
    heading: 'Industries We Serve',
    subheading: 'Purpose-matched aerial and material handling equipment across major sectors.',
  },
  cta: {
    enabled: true,
    heading: 'Ready to Reach All Heights?',
    subheading:
      'Connect with our machinery specialists today for project rental quotes, equipment sales, or custom fleet requirements.',
    primaryCta: {
      label: 'Request a Quote',
      href: '/#quote-promo',
    },
    secondaryCta: {
      label: 'Contact Us',
      href: '/contact',
    },
    careersLink: {
      label: 'Explore Careers at Reach →',
      href: '/careers',
    },
  },
};
