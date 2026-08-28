import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { siteContent } from '../src/content.js';

const root = process.cwd();
const dist = path.join(root, 'dist');

function occurrences(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

async function checkPage(file, { lang, canonicalPath }) {
  const html = await readFile(path.join(dist, file), 'utf8');
  const otherLang = lang === 'ru' ? 'en' : 'ru';
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);

  assert.match(html, new RegExp(`<html lang="${lang}"`), `${file}: wrong document language`);
  assert.match(
    html,
    new RegExp(`<link rel="canonical" href="https://maxzolotoy\\.com/${canonicalPath}">`),
    `${file}: wrong canonical URL`,
  );
  assert.equal(occurrences(html, /<main\b/g), 1, `${file}: expected one main element`);
  assert.equal(occurrences(html, /<h1\b/g), 1, `${file}: expected one h1 element`);
  assert.equal(occurrences(html, /<div class="page"/g), 1, `${file}: expected one localized page`);
  assert.equal(occurrences(html, /aria-current="page"/g), 1, `${file}: expected one current language`);
  assert.equal(new Set(ids).size, ids.length, `${file}: duplicate id detected`);
  assert.match(html, new RegExp(`<title>${siteContent[lang].meta.title}</title>`), `${file}: wrong title`);
  assert.match(
    html,
    new RegExp(`<meta name="description" content="${siteContent[lang].meta.description}">`),
    `${file}: wrong description`,
  );
  assert.ok(
    html.includes(`<h1>${siteContent[lang].hero.title}</h1>`),
    `${file}: missing ${lang.toUpperCase()} heading`,
  );
  assert.ok(
    !html.includes(`<h1>${siteContent[otherLang].hero.title}</h1>`),
    `${file}: contains the alternate-language heading`,
  );
  assert.match(html, /<a class="language-edge language-edge--ru" href="\/ru\/"/, `${file}: missing crawlable RU link`);
  assert.match(html, /<a class="language-edge language-edge--en" href="\/en\/"/, `${file}: missing crawlable EN link`);
  assert.match(html, /<link rel="alternate" hreflang="ru" href="https:\/\/maxzolotoy\.com\/ru\/">/, `${file}: missing RU hreflang`);
  assert.match(html, /<link rel="alternate" hreflang="en" href="https:\/\/maxzolotoy\.com\/en\/">/, `${file}: missing EN hreflang`);
  assert.match(html, /<link rel="alternate" hreflang="x-default" href="https:\/\/maxzolotoy\.com\/">/, `${file}: missing x-default hreflang`);
  assert.match(html, new RegExp(`<a class="skip-link" href="#main-${lang}">`), `${file}: broken skip link`);
  assert.ok(ids.includes(`main-${lang}`), `${file}: skip-link target does not exist`);
  assert.match(html, /data-layer="primary">\s*<div class="page"/, `${file}: primary content was not prerendered`);
  assert.match(html, /data-layer="curtain"><\/div>/, `${file}: alternate curtain must start empty`);
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

console.log('Static localized HTML checks passed.');
