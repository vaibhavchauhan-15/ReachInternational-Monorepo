import { aboutContent, isPlaceholder } from './content';

export function buildAboutJsonLd(baseUrl = 'https://www.reachinternational.co.in') {
  const isHeadlinePlaceholder = isPlaceholder(aboutContent.hero.headline);
  const headline = isHeadlinePlaceholder
    ? 'About Reach International'
    : aboutContent.hero.headline;

  const isSubPlaceholder = isPlaceholder(aboutContent.hero.subStatement);
  const description = isSubPlaceholder
    ? 'Learn about Reach International — India’s specialist in aerial work platform and material handling equipment rental and sales.'
    : aboutContent.hero.subStatement;

  const organization = {
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: 'Reach International',
    url: baseUrl,
    logo: `${baseUrl}/images/reach-logo-dark.png`,
    description:
      'Reach International provides aerial work platforms, boom lifts, scissor lifts, forklifts and material handling equipment for rental and sale across India.',
    slogan: 'Reaching All Heights',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'sales and equipment rental',
      availableLanguage: ['English', 'Hindi'],
    },
  };

  const aboutPage = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    '@id': `${baseUrl}/about#webpage`,
    url: `${baseUrl}/about`,
    name: 'About Reach International | AWP & Material Handling Rental and Sales',
    headline: headline,
    description: description,
    publisher: organization,
    mainEntity: organization,
    isPartOf: {
      '@type': 'WebSite',
      '@id': `${baseUrl}/#website`,
      url: baseUrl,
      name: 'Reach International',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: baseUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'About Us',
          item: `${baseUrl}/about`,
        },
      ],
    },
  };

  return aboutPage;
}
