import assert from 'node:assert/strict';

const baseUrl = process.argv[2];
if (!baseUrl) throw new Error('Usage: node scripts/check-remote.mjs https://origin.example.com');
const origin = new URL(baseUrl).origin;

async function get(path, options = {}) {
  const response = await fetch(`${origin}${path}`, options);
  assert.ok(response.ok, `${path}: expected success, got ${response.status}`);
  return response;
}

assert.equal((await get('/_health')).status, 200, 'health check failed');
await get('/robots.txt');
await get('/sitemap.xml');

for (const lang of ['ru', 'en']) {
  const response = await get(`/${lang}/`);
  assert.match(response.headers.get('cache-control') || '', /max-age=0|no-cache/, `/${lang}/: HTML must revalidate`);
  const html = await response.text();
  assert.match(html, new RegExp(`<html lang="${lang}"`), `/${lang}/: wrong language`);
  assert.match(html, new RegExp(`<main id="main-${lang}">`), `/${lang}/: missing prerendered content`);

  const assetPaths = [...html.matchAll(/(?:href|src|data-curtain-fragment)="(\/assets\/[^"]+)"/g)]
    .map(match => match[1]);
  assert.equal(assetPaths.length, 3, `/${lang}/: expected three referenced assets`);
  for (const assetPath of assetPaths) {
    const assetResponse = await get(assetPath);
    assert.match(assetResponse.headers.get('cache-control') || '', /immutable/, `${assetPath}: missing immutable cache policy`);
    assert.ok((await assetResponse.arrayBuffer()).byteLength > 0, `${assetPath}: empty or truncated asset`);
  }
}

for (const [path, expected] of [['/', '/en/'], ['/ru', '/ru/'], ['/en', '/en/']]) {
  const response = await fetch(`${origin}${path}?source=remote-smoke`, { redirect: 'manual' });
  assert.equal(response.status, 308, `${path}: expected 308`);
  const location = new URL(response.headers.get('location'), origin);
  assert.equal(`${location.pathname}${location.search}`, `${expected}?source=remote-smoke`, `${path}: redirect lost path or query`);
}

console.log(`Remote smoke checks passed for ${origin}.`);
