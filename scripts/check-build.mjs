import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { contactLinks, projectLinks, siteContent } from '../src/content.js';

const root = process.cwd();
const dist = path.join(root, 'dist');

function occurrences(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectMeta(html, attribute, key, value, file) {
  const tag = `<meta ${attribute}="${key}" content="${value}">`;
  assert.equal(occurrences(html, new RegExp(escapeRegExp(tag), 'g')), 1, `${file}: invalid ${key} metadata`);
}

async function checkPage(file, { lang, canonicalPath }) {
  const html = await readFile(path.join(dist, file), 'utf8');
  const otherLang = lang === 'ru' ? 'en' : 'ru';
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const canonicalUrl = `https://maxzolotoy.com/${canonicalPath}`;
  const socialImageUrl = `https://maxzolotoy.com${siteContent[lang].meta.socialImage}`;

  assert.match(html, new RegExp(`<html lang="${lang}"`), `${file}: wrong document language`);
  assert.match(
    html,
    new RegExp(`<link rel="canonical" href="${escapeRegExp(canonicalUrl)}">`),
    `${file}: wrong canonical URL`,
  );
  assert.equal(occurrences(html, /<main\b/g), 1, `${file}: expected one main element`);
  assert.equal(occurrences(html, /<h1\b/g), 1, `${file}: expected one h1 element`);
  assert.equal(occurrences(html, /<div class="page"/g), 1, `${file}: expected one localized page`);
  assert.equal(occurrences(html, /aria-current="page"/g), 1, `${file}: expected one current language`);
  assert.equal(new Set(ids).size, ids.length, `${file}: duplicate id detected`);
  assert.match(html, new RegExp(`<title>${escapeRegExp(siteContent[lang].meta.title)}</title>`), `${file}: wrong title`);
  assert.match(
    html,
    new RegExp(`<meta name="description" content="${escapeRegExp(siteContent[lang].meta.description)}">`),
    `${file}: wrong description`,
  );
  expectMeta(html, 'name', 'author', siteContent[lang].hero.title, file);
  expectMeta(html, 'name', 'robots', 'max-image-preview:large', file);
  expectMeta(html, 'property', 'og:type', 'website', file);
  expectMeta(html, 'property', 'og:site_name', 'Maxim Zolotoy', file);
  expectMeta(html, 'property', 'og:title', siteContent[lang].meta.title, file);
  expectMeta(html, 'property', 'og:description', siteContent[lang].meta.description, file);
  expectMeta(html, 'property', 'og:url', canonicalUrl, file);
  expectMeta(html, 'property', 'og:locale', siteContent[lang].meta.locale, file);
  expectMeta(html, 'property', 'og:locale:alternate', siteContent[otherLang].meta.locale, file);
  expectMeta(html, 'property', 'og:image', socialImageUrl, file);
  expectMeta(html, 'property', 'og:image:type', 'image/png', file);
  expectMeta(html, 'property', 'og:image:width', '1200', file);
  expectMeta(html, 'property', 'og:image:height', '630', file);
  expectMeta(html, 'property', 'og:image:alt', siteContent[lang].meta.socialImageAlt, file);
  expectMeta(html, 'name', 'twitter:card', 'summary_large_image', file);
  expectMeta(html, 'name', 'twitter:title', siteContent[lang].meta.title, file);
  expectMeta(html, 'name', 'twitter:description', siteContent[lang].meta.description, file);
  expectMeta(html, 'name', 'twitter:image', socialImageUrl, file);
  expectMeta(html, 'name', 'twitter:image:alt', siteContent[lang].meta.socialImageAlt, file);
  assert.ok(
    html.includes(`<h1>${siteContent[lang].hero.title}</h1>`),
    `${file}: missing ${lang.toUpperCase()} heading`,
  );
  assert.ok(
    !html.includes(`<h1>${siteContent[otherLang].hero.title}</h1>`),
    `${file}: contains the alternate-language heading`,
  );
  assert.ok(html.includes(lang === 'ru' ? 'Макс Золотой' : 'Max Zolotoy'), `${file}: missing visible name variant`);
  assert.ok(html.includes('Golang'), `${file}: missing visible Golang terminology`);
  assert.doesNotMatch(html, /Repository link coming soon|Репозиторий будет добавлен/i, `${file}: project placeholder leaked into production`);
  for (const project of siteContent[lang].projects.cards) {
    assert.match(project.url, /^https:\/\//, `${file}: project URL must be absolute HTTPS`);
    assert.ok(html.includes(`<h3>${project.name}</h3>`), `${file}: missing visible project ${project.id}`);
    assert.ok(
      html.includes(`<a class="project-card__link" href="${project.url}" target="_blank" rel="noreferrer">${project.linkLabel}`),
      `${file}: missing crawlable project link ${project.id}`,
    );
    assert.ok(!/^https?:\/\//.test(project.linkLabel), `${file}: project link needs descriptive anchor text`);
    for (const highlight of project.highlights) {
      assert.ok(html.includes(`<li>${highlight}</li>`), `${file}: missing project evidence for ${project.id}`);
    }
  }
  assert.match(html, /<a class="language-edge language-edge--ru" href="\/ru\/"/, `${file}: missing crawlable RU link`);
  assert.match(html, /<a class="language-edge language-edge--en" href="\/en\/"/, `${file}: missing crawlable EN link`);
  for (const [, id] of siteContent[lang].nav) {
    assert.ok(ids.includes(`${id}-${lang}`), `${file}: missing ${id} section`);
    assert.match(html, new RegExp(`href="#${id}-${lang}"`), `${file}: ${id} anchor navigation is not usable without JS`);
  }
  assert.ok(html.includes(`href="mailto:${contactLinks.email}"`), `${file}: email is not usable without JS`);
  assert.ok(html.includes(`href="${contactLinks.telegram}"`), `${file}: Telegram is not usable without JS`);
  assert.ok(html.includes(`href="${contactLinks.github}"`), `${file}: GitHub is not usable without JS`);
  assert.match(html, /<link rel="stylesheet" href="\/assets\/styles\.[a-f0-9]{12}\.css">/, `${file}: missing fingerprinted CSS`);
  assert.match(html, /<script type="module" src="\/assets\/boot\.[A-Z0-9]{8}\.js"><\/script>/, `${file}: missing fingerprinted bootstrap`);
  assert.match(html, /data-curtain-fragment="\/assets\/page-(?:ru|en)\.[a-f0-9]{12}\.html"/, `${file}: missing lazy curtain fragment`);
  assert.doesNotMatch(html, /(?:src|href)="\/(?:app|content|render|curtain-math|styles)\.(?:js|css)"/, `${file}: legacy critical asset leaked into HTML`);
  assert.ok(
    html.indexOf(`<main id="main-${lang}">`) < html.lastIndexOf('<script type="module"'),
    `${file}: primary content must precede enhancement JavaScript`,
  );
  assert.match(html, /<link rel="alternate" hreflang="ru" href="https:\/\/maxzolotoy\.com\/ru\/">/, `${file}: missing RU hreflang`);
  assert.match(html, /<link rel="alternate" hreflang="en" href="https:\/\/maxzolotoy\.com\/en\/">/, `${file}: missing EN hreflang`);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/maxzolotoy\.com\/en\/">/, `${file}: missing x-default hreflang`);
  assert.match(html, new RegExp(`<a class="skip-link" href="#main-${lang}">`), `${file}: broken skip link`);
  assert.ok(ids.includes(`main-${lang}`), `${file}: skip-link target does not exist`);
  assert.match(html, /data-layer="primary">\s*<div class="page"/, `${file}: primary content was not prerendered`);
  assert.match(html, /data-layer="curtain"><\/div>/, `${file}: alternate curtain must start empty`);
  const jsonLdScripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(jsonLdScripts.length, 1, `${file}: expected one JSON-LD graph`);
  const structuredData = JSON.parse(jsonLdScripts[0][1]);
  assert.equal(structuredData['@context'], 'https://schema.org', `${file}: wrong schema context`);
  assert.ok(Array.isArray(structuredData['@graph']), `${file}: JSON-LD graph is missing`);
  const website = structuredData['@graph'].find(item => item['@type'] === 'WebSite');
  const profile = structuredData['@graph'].find(item => item['@type'] === 'ProfilePage');
  const person = structuredData['@graph'].find(item => item['@type'] === 'Person');
  const softwareProjects = structuredData['@graph'].filter(item => item['@type'] === 'SoftwareSourceCode');
  assert.equal(website?.url, 'https://maxzolotoy.com/', `${file}: wrong WebSite URL`);
  assert.equal(profile?.url, canonicalUrl, `${file}: wrong ProfilePage URL`);
  assert.equal(profile?.inLanguage, lang, `${file}: wrong ProfilePage language`);
  assert.equal(profile?.mainEntity?.['@id'], 'https://maxzolotoy.com/#maxim-zolotoy', `${file}: missing Person link`);
  assert.equal(person?.name, siteContent[lang].hero.title, `${file}: wrong Person name`);
  assert.equal(person?.jobTitle, 'Go Backend Developer', `${file}: wrong Person job title`);
  const recognizedNames = [person?.name, ...(person?.alternateName || [])];
  for (const alias of ['Максим Золотой', 'Макс Золотой', 'Maxim Zolotoy', 'Max Zolotoy', 'maxzolotoy']) {
    assert.ok(recognizedNames.includes(alias), `${file}: missing Person name ${alias}`);
  }
  assert.ok(person?.knowsAbout?.includes('Go'), `${file}: missing Go expertise`);
  assert.ok(person?.knowsAbout?.includes('Golang'), `${file}: missing Golang expertise`);
  assert.ok(person?.sameAs?.includes('https://github.com/Officialsayp'), `${file}: missing GitHub identity`);
  assert.equal(softwareProjects.length, siteContent[lang].projects.cards.length, `${file}: wrong SoftwareSourceCode count`);
  for (const project of siteContent[lang].projects.cards) {
    const projectId = `${project.url}#software-source-code`;
    const softwareProject = softwareProjects.find(item => item['@id'] === projectId);
    assert.equal(softwareProject?.name, project.name, `${file}: wrong project name in JSON-LD`);
    assert.equal(softwareProject?.description, project.description, `${file}: wrong project description in JSON-LD`);
    assert.equal(softwareProject?.codeRepository, project.url, `${file}: wrong codeRepository in JSON-LD`);
    assert.deepEqual(softwareProject?.programmingLanguage, project.programmingLanguages, `${file}: wrong project languages in JSON-LD`);
    assert.equal(softwareProject?.author?.['@id'], 'https://maxzolotoy.com/#maxim-zolotoy', `${file}: project author is not linked`);
    assert.ok(profile?.hasPart?.some(item => item['@id'] === projectId), `${file}: ProfilePage is not linked to ${project.id}`);
    assert.ok(person?.subjectOf?.some(item => item['@id'] === projectId), `${file}: Person is not linked to ${project.id}`);
  }
  assert.doesNotMatch(html, /__[A-Z][A-Z0-9_]+__/, `${file}: unresolved template placeholder`);
}

const ruProjectIdentity = siteContent.ru.projects.cards.map(({ id, url }) => ({ id, url }));
const enProjectIdentity = siteContent.en.projects.cards.map(({ id, url }) => ({ id, url }));
assert.deepEqual(ruProjectIdentity, enProjectIdentity, 'RU and EN project identities must stay aligned');
assert.deepEqual(
  ruProjectIdentity.map(project => project.url).sort(),
  Object.values(projectLinks).sort(),
  'projectLinks must be the single URL source for visible projects',
);

await Promise.all([
  checkPage(path.join('ru', 'index.html'), { lang: 'ru', canonicalPath: 'ru/' }),
  checkPage(path.join('en', 'index.html'), { lang: 'en', canonicalPath: 'en/' }),
]);

await assert.rejects(
  () => access(path.join(dist, 'index.html')),
  error => error?.code === 'ENOENT',
  'dist/index.html must not expose a third, duplicate canonical page',
);

const assetNames = await readdir(path.join(dist, 'assets'));
const styleAssets = assetNames.filter(file => /^styles\.[a-f0-9]{12}\.css$/.test(file));
const bootAssets = assetNames.filter(file => /^boot\.[A-Z0-9]{8}\.js$/.test(file));
const curtainAssets = assetNames.filter(file => /^curtain\.[A-Z0-9]{8}\.js$/.test(file));
const fragmentAssets = assetNames.filter(file => /^page-(?:ru|en)\.[a-f0-9]{12}\.html$/.test(file));
assert.equal(styleAssets.length, 1, 'dist/assets: expected one fingerprinted stylesheet');
assert.equal(bootAssets.length, 1, 'dist/assets: expected one fingerprinted bootstrap');
assert.equal(curtainAssets.length, 1, 'dist/assets: expected one lazy curtain module');
assert.equal(fragmentAssets.length, 2, 'dist/assets: expected one lazy fragment per language');
for (const lang of ['ru', 'en']) {
  const fragmentName = fragmentAssets.find(file => file.startsWith(`page-${lang}.`));
  const fragment = await readFile(path.join(dist, 'assets', fragmentName), 'utf8');
  assert.match(fragment, new RegExp(`^<div class="page" lang="${lang}">`), `${fragmentName}: wrong fragment language`);
  assert.ok(fragment.includes(`<h1>${siteContent[lang].hero.title}</h1>`), `${fragmentName}: missing localized curtain content`);
  assert.doesNotMatch(fragment, /<script\b/i, `${fragmentName}: lazy fragment must remain inert markup`);
}

const [robots, sitemap, redirects, sourceRedirects, headers, wranglerSource, styles, sourceStyles] = await Promise.all([
  readFile(path.join(dist, 'robots.txt'), 'utf8'),
  readFile(path.join(dist, 'sitemap.xml'), 'utf8'),
  readFile(path.join(dist, '_redirects'), 'utf8'),
  readFile(path.join(root, 'src', '_redirects'), 'utf8'),
  readFile(path.join(dist, '_headers'), 'utf8'),
  readFile(path.join(root, 'wrangler.jsonc'), 'utf8'),
  readFile(path.join(dist, 'assets', styleAssets[0]), 'utf8'),
  readFile(path.join(root, 'src', 'styles.css'), 'utf8'),
]);
assert.match(robots, /Sitemap: https:\/\/maxzolotoy\.com\/sitemap\.xml/, 'robots.txt: missing sitemap URL');
assert.match(sitemap, /<loc>https:\/\/maxzolotoy\.com\/ru\/<\/loc>/, 'sitemap.xml: missing RU URL');
assert.match(sitemap, /<loc>https:\/\/maxzolotoy\.com\/en\/<\/loc>/, 'sitemap.xml: missing EN URL');
assert.equal(occurrences(sitemap, /<loc>/g), 2, 'sitemap.xml: expected exactly two canonical URLs');
assert.doesNotMatch(sitemap, /<loc>https:\/\/maxzolotoy\.com\/<\/loc>/, 'sitemap.xml: redirecting root must not be listed');
assert.equal(redirects, sourceRedirects, 'dist/_redirects must match src/_redirects');
assert.ok(styles.length < sourceStyles.length, 'fingerprinted CSS must be minified at build time');
assert.match(styles, /\.language-edge/, 'minified CSS is missing language controls');

for (const legacyAsset of ['app.js', 'content.js', 'render.js', 'curtain-math.js', 'styles.css']) {
  await assert.rejects(
    () => access(path.join(dist, legacyAsset)),
    error => error?.code === 'ENOENT',
    `dist/${legacyAsset} must not remain as an unfingerprinted asset`,
  );
}

function pixelCustomProperty(source, name) {
  const match = source.match(new RegExp(`--${name}:\\s*(\\d+)px`));
  assert.ok(match, `styles.css: missing --${name}`);
  return Number(match[1]);
}

const languageControlSize = pixelCustomProperty(sourceStyles, 'language-control-size');
const languageEdgeOffset = pixelCustomProperty(sourceStyles, 'language-edge-offset');
const headerControlGap = pixelCustomProperty(sourceStyles, 'header-control-gap');
const contentWidth = pixelCustomProperty(sourceStyles, 'content-w');
const mobileOffsetMatch = sourceStyles.match(
  /@media \(max-width: 560px\)[\s\S]*?--language-edge-offset:\s*(\d+)px/,
);
assert.ok(mobileOffsetMatch, 'styles.css: missing mobile language edge offset');
const mobileEdgeOffset = Number(mobileOffsetMatch[1]);

assert.match(
  sourceStyles,
  /\.header__inner\s*\{\s*width:\s*min\(\s*var\(--content-w\),\s*calc\(100% - var\(--header-edge-clearance\) - var\(--header-edge-clearance\)\)\s*\);/,
  'styles.css: header must reserve both language-control gutters',
);
assert.match(
  sourceStyles,
  /@media \(max-width: 1450px\)\s*\{\s*\.drag-hint\s*\{\s*display:\s*none;/,
  'styles.css: decorative drag hint must not overlap the header navigation',
);

for (const viewportWidth of [320, 560, 561, 860, 861, 930, 1160, 1280, 1450]) {
  const edgeOffset = viewportWidth <= 560 ? mobileEdgeOffset : languageEdgeOffset;
  const clearance = edgeOffset + languageControlSize + headerControlGap;
  const headerWidth = Math.min(contentWidth, viewportWidth - (clearance * 2));
  const headerLeft = (viewportWidth - headerWidth) / 2;
  const headerRight = headerLeft + headerWidth;
  const leftControlRight = edgeOffset + languageControlSize;
  const rightControlLeft = viewportWidth - edgeOffset - languageControlSize;

  assert.ok(
    headerLeft - leftControlRight >= headerControlGap,
    `styles.css: left language control overlaps header at ${viewportWidth}px`,
  );
  assert.ok(
    rightControlLeft - headerRight >= headerControlGap,
    `styles.css: right language control overlaps header at ${viewportWidth}px`,
  );
}

const parsedRedirectRules = redirects
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'))
  .map(line => {
    const [source, destination, status, ...extra] = line.split(/\s+/);
    assert.equal(extra.length, 0, `_redirects: malformed rule ${line}`);
    assert.ok(['301', '308'].includes(status), `_redirects: ${source} must use a permanent redirect`);
    return [source, { destination, status }];
  });
const redirectRules = new Map(parsedRedirectRules);
assert.equal(redirectRules.size, parsedRedirectRules.length, '_redirects: duplicate source rule');

for (const [source, destination] of Object.entries({
  '/': '/en/',
  '/index': '/en/',
  '/index.html': '/en/',
  '/ru': '/ru/',
  '/ru.html': '/ru/',
  '/ru/index': '/ru/',
  '/ru/index.html': '/ru/',
  '/en': '/en/',
  '/en.html': '/en/',
  '/en/index': '/en/',
  '/en/index.html': '/en/',
})) {
  assert.equal(redirectRules.get(source)?.destination, destination, `_redirects: ${source} must lead directly to ${destination}`);
}
assert.equal(parsedRedirectRules.length, 11, '_redirects: unexpected rule count');
assert.match(
  headers,
  /\/assets\/\*[\s\S]*?Cache-Control: public, max-age=31536000, immutable/,
  '_headers: fingerprinted assets need immutable browser caching',
);
assert.match(
  headers,
  /\/\*[\s\S]*?Cache-Control: public, max-age=0, must-revalidate/,
  '_headers: HTML and stable assets need revalidation',
);
assert.match(
  headers,
  /https:\/\/:version\.:subdomain\.workers\.dev\/\*[\s\S]*?X-Robots-Tag: noindex/,
  '_headers: workers.dev duplicate must be excluded from search results',
);

assert.match(wranglerSource, /"preview_urls"\s*:\s*false/, 'wrangler.jsonc: public preview URLs must be disabled');
assert.match(
  wranglerSource,
  /"html_handling"\s*:\s*"force-trailing-slash"/,
  'wrangler.jsonc: localized HTML must use the trailing-slash URL policy',
);

for (const image of ['og-ru.png', 'og-en.png']) {
  const png = await readFile(path.join(dist, image));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${image}: invalid PNG signature`);
  assert.equal(png.readUInt32BE(16), 1200, `${image}: width must be 1200px`);
  assert.equal(png.readUInt32BE(20), 630, `${image}: height must be 630px`);
}

console.log('Static localized HTML checks passed.');
