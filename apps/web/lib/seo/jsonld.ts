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
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
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
