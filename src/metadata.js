import { contactLinks, siteContent } from './content.js';

const SITE_URL = 'https://maxzolotoy.com';
const WEBSITE_ID = `${SITE_URL}/#website`;
const PERSON_ID = `${SITE_URL}/#maxim-zolotoy`;
const PERSON_ALIASES = [
  'Максим Золотой',
  'Макс Золотой',
  'Maxim Zolotoy',
  'Max Zolotoy',
  'maxzolotoy',
  '@max_zolotoy',
  'Officialsayp',
];
const KNOWS_ABOUT = [
  'Go',
  'Golang',
  'Backend development',
  'PostgreSQL',
  'REST APIs',
  'Docker',
  'Domain-driven design',
];

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function pageUrl(canonicalPath) {
  return `${SITE_URL}/${canonicalPath}`;
}

export function buildStructuredData({ lang, canonicalPath }) {
  const content = siteContent[lang];
  if (!content) throw new Error(`Unsupported metadata language: ${lang}`);

  const canonicalUrl = pageUrl(canonicalPath);
  const profileId = `${canonicalUrl}#profile`;
  const sameAs = [contactLinks.github, contactLinks.telegram].filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        url: `${SITE_URL}/`,
        name: 'Maxim Zolotoy',
        alternateName: ['Максим Золотой', 'Max Zolotoy', 'maxzolotoy.com'],
        inLanguage: ['ru', 'en'],
      },
      {
        '@type': 'ProfilePage',
        '@id': profileId,
        url: canonicalUrl,
        name: content.meta.title,
        description: content.meta.description,
        inLanguage: lang,
        isPartOf: { '@id': WEBSITE_ID },
        mainEntity: { '@id': PERSON_ID },
      },
      {
        '@type': 'Person',
        '@id': PERSON_ID,
        name: content.hero.title,
        alternateName: PERSON_ALIASES.filter(alias => alias !== content.hero.title),
        url: `${SITE_URL}/`,
        jobTitle: 'Go Backend Developer',
        description: content.hero.lead,
        knowsAbout: KNOWS_ABOUT,
        sameAs,
        email: contactLinks.email,
      },
    ],
  };
}

export function renderSeoMetadata({ lang, canonicalPath }) {
  const content = siteContent[lang];
  if (!content) throw new Error(`Unsupported metadata language: ${lang}`);

  const canonicalUrl = pageUrl(canonicalPath);
  const imageUrl = `${SITE_URL}${content.meta.socialImage}`;
  const alternateLocale = lang === 'ru' ? siteContent.en.meta.locale : siteContent.ru.meta.locale;
  const jsonLd = JSON.stringify(buildStructuredData({ lang, canonicalPath }))
    .replaceAll('<', '\\u003c');
  const attributes = [
    ['name', 'author', content.hero.title],
    ['name', 'robots', 'max-image-preview:large'],
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'Maxim Zolotoy'],
    ['property', 'og:title', content.meta.title],
    ['property', 'og:description', content.meta.description],
    ['property', 'og:url', canonicalUrl],
    ['property', 'og:locale', content.meta.locale],
    ['property', 'og:locale:alternate', alternateLocale],
    ['property', 'og:image', imageUrl],
    ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:image:alt', content.meta.socialImageAlt],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', content.meta.title],
    ['name', 'twitter:description', content.meta.description],
    ['name', 'twitter:image', imageUrl],
    ['name', 'twitter:image:alt', content.meta.socialImageAlt],
  ];

  const meta = attributes
    .map(([attribute, key, value]) => `<meta ${attribute}="${key}" content="${escapeAttribute(value)}">`)
    .join('\n  ');

  return `${meta}\n  <script type="application/ld+json">${jsonLd}</script>`;
}
