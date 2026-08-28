import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { siteContent } from '../src/content.js';

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
  assert.match(html, /<a class="language-edge language-edge--ru" href="\/ru\/"/, `${file}: missing crawlable RU link`);
  assert.match(html, /<a class="language-edge language-edge--en" href="\/en\/"/, `${file}: missing crawlable EN link`);
  assert.match(html, /<link rel="alternate" hreflang="ru" href="https:\/\/maxzolotoy\.com\/ru\/">/, `${file}: missing RU hreflang`);
  assert.match(html, /<link rel="alternate" hreflang="en" href="https:\/\/maxzolotoy\.com\/en\/">/, `${file}: missing EN hreflang`);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/maxzolotoy\.com\/">/, `${file}: missing x-default hreflang`);
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
  assert.doesNotMatch(html, /__[A-Z][A-Z0-9_]+__/, `${file}: unresolved template placeholder`);
}

await Promise.all([
  checkPage('index.html', { lang: 'ru', canonicalPath: '' }),
  checkPage(path.join('ru', 'index.html'), { lang: 'ru', canonicalPath: 'ru/' }),
  checkPage(path.join('en', 'index.html'), { lang: 'en', canonicalPath: 'en/' }),
]);

const [robots, sitemap] = await Promise.all([
  readFile(path.join(dist, 'robots.txt'), 'utf8'),
  readFile(path.join(dist, 'sitemap.xml'), 'utf8'),
]);
assert.match(robots, /Sitemap: https:\/\/maxzolotoy\.com\/sitemap\.xml/, 'robots.txt: missing sitemap URL');
assert.match(sitemap, /<loc>https:\/\/maxzolotoy\.com\/ru\/<\/loc>/, 'sitemap.xml: missing RU URL');
assert.match(sitemap, /<loc>https:\/\/maxzolotoy\.com\/en\/<\/loc>/, 'sitemap.xml: missing EN URL');

for (const image of ['og-ru.png', 'og-en.png']) {
  const png = await readFile(path.join(dist, image));
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${image}: invalid PNG signature`);
  assert.equal(png.readUInt32BE(16), 1200, `${image}: width must be 1200px`);
  assert.equal(png.readUInt32BE(20), 630, `${image}: height must be 630px`);
}

console.log('Static localized HTML checks passed.');
