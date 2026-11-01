/**
 * JSON-LD helpers — typed structured data snippets for SEO.
 * Server-only helper functions returning schema.org compliant JSON-LD objects.
 */

export interface BreadcrumbItemData {
  label: string;
  href?: string;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.reachinternational.co.in';

/**
 * Build a BreadcrumbList JSON-LD object.
 * Home is always prepended automatically.
 */
export function buildBreadcrumbJsonLd(items: BreadcrumbItemData[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: BASE_URL + '/',
      },
      ...items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 2,
        name: item.label,
        ...(item.href ? { item: BASE_URL + item.href } : {}),
      })),
    ],
  };
}

/**
 * Build a FAQPage JSON-LD object.
 */
export function buildFaqJsonLd(faqs: Array<{ q: string; a: string }>) {
  const list = Array.isArray(faqs) ? faqs : [];
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: list.map((faq) => ({
      '@type': 'Question',
      name: faq?.q || '',
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq?.a || '',
      },
    })),
  };
}

/**
 * Build a Service JSON-LD object.
 */
export function buildServiceJsonLd(name: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url: BASE_URL + url,
    provider: {
      '@type': 'Organization',
      name: 'Reach International',
      url: BASE_URL,
    },
    areaServed: {
      '@type': 'Country',
      name: 'India',
    },
  };
}

/**
 * Build a Product JSON-LD schema for equipment models.
 * Complies strictly with schema.org/Product without fake prices or fake reviews.
 */
export function buildProductJsonLd(product: {
  name: string;
  description: string;
  image: string;
  brandName: string;
  modelNumber: string;
  categoryName: string;
  url: string;
  rentalAvailable: boolean;
  purchaseAvailable: boolean;
}) {
  const offers: any[] = [];

  if (product.rentalAvailable) {
    offers.push({
      '@type': 'Offer',
      businessFunction: 'http://purl.org/goodrelations/v1#LeaseOut',
      availability: 'https://schema.org/InStock',
      url: BASE_URL + product.url,
      seller: {
        '@type': 'Organization',
        name: 'Reach International',
        url: BASE_URL,
      },
    });
  }

  if (product.purchaseAvailable) {
    offers.push({
      '@type': 'Offer',
      businessFunction: 'http://purl.org/goodrelations/v1#Sell',
      availability: 'https://schema.org/InStock',
      url: BASE_URL + product.url,
      seller: {
        '@type': 'Organization',
        name: 'Reach International',
        url: BASE_URL,
      },
    });
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: product.image.startsWith('http') ? product.image : BASE_URL + product.image,
    model: product.modelNumber,
    category: product.categoryName,
    brand: {
      '@type': 'Brand',
      name: product.brandName,
    },
    offers: offers.length === 1 ? offers[0] : offers,
    url: BASE_URL + product.url,
  };
}

/**
 * Build an ItemList JSON-LD schema for category and segment listings.
 */
export function buildEquipmentItemListJsonLd(
  title: string,
  items: Array<{ name: string; url: string; image?: string; position: number }>
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    itemListElement: items.map((it) => ({
      '@type': 'ListItem',
      position: it.position,
      name: it.name,
      url: BASE_URL + it.url,
      ...(it.image ? { image: it.image.startsWith('http') ? it.image : BASE_URL + it.image } : {}),
    })),
  };
}

/**
 * Build ContactPage JSON-LD schema with dedicated Rental & Sales contact points.
 */
export function buildContactPageJsonLd(contactData: {
  rentalPhone: string;
  rentalEmail: string;
  salesPhone: string;
  salesEmail: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    name: 'Contact Reach International — Heavy Equipment Rental & Sales',
    description:
      'Contact Reach International for industrial boom lifts, scissor lifts, and forklift rentals & purchases across India.',
    url: `${BASE_URL}/contact`,
    mainEntity: {
      '@type': 'LocalBusiness',
      name: 'Reach International',
      url: BASE_URL,
      logo: `${BASE_URL}/images/reach-logo-dark.png`,
      image: `${BASE_URL}/images/hero_boom_lift.jpg`,
      priceRange: '₹₹₹',
      telephone: contactData.rentalPhone,
      email: contactData.rentalEmail,
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'IN',
      },
      contactPoint: [
        {
          '@type': 'ContactPoint',
          telephone: contactData.rentalPhone,
          email: contactData.rentalEmail,
          contactType: 'equipment rental',
          areaServed: 'IN',
          availableLanguage: ['English', 'Hindi'],
        },
        {
          '@type': 'ContactPoint',
          telephone: contactData.salesPhone,
          email: contactData.salesEmail,
          contactType: 'sales',
          areaServed: 'IN',
          availableLanguage: ['English', 'Hindi'],
        },
      ],
    },
  };
}


/**
 * Build a Google for Jobs compliant JobPosting JSON-LD object.
 */
export function buildJobPostingJsonLd(job: {
  title: string;
  summary: string;
  description_md?: string;
  published_at?: string;
  apply_by?: string | null;
  employment_type?: string;
  workplace_type?: string;
  city?: string;
  state_name?: string | null;
  country_code?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  salary_period?: string | null;
  show_salary?: boolean;
  slug: string;
}) {
  const employmentTypeMap: Record<string, string> = {
    full_time: 'FULL_TIME',
    part_time: 'PART_TIME',
    contract: 'CONTRACTOR',
    internship: 'INTERN',
    apprenticeship: 'OTHER',
    temporary: 'TEMPORARY',
  };

  const unitTextMap: Record<string, string> = {
    hour: 'HOUR',
    day: 'DAY',
    month: 'MONTH',
    year: 'YEAR',
  };

  const schema: any = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description_md || job.summary,
    datePosted: job.published_at || new Date().toISOString(),
    validThrough: job.apply_by ? `${job.apply_by}T23:59:59Z` : undefined,
    employmentType: employmentTypeMap[job.employment_type || 'full_time'] || 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: 'Reach International',
      sameAs: 'https://www.reachinternational.co.in',
      logo: 'https://www.reachinternational.co.in/images/reach-logo-dark.png',
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.city,
        addressRegion: job.state_name || undefined,
        addressCountry: job.country_code || 'IN',
      },
    },
    directApply: true,
  };

  if (job.workplace_type === 'remote') {
    schema.jobLocationType = 'TELECOMMUTE';
  }

  if (job.show_salary && job.salary_min) {
    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: job.salary_currency || 'INR',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salary_min,
        maxValue: job.salary_max || job.salary_min,
        unitText: unitTextMap[job.salary_period || 'month'] || 'MONTH',
      },
    };
  }

  return schema;
}
