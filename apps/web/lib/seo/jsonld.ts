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
