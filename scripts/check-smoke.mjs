import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.join(process.cwd(), 'dist');
const redirectSource = await readFile(path.join(dist, '_redirects'), 'utf8');
const redirects = new Map(
  redirectSource
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const [source, destination, status] = line.split(/\s+/);
      return [source, { destination, status: Number(status) }];
    }),
);

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.xml')) return 'application/xml; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  return 'text/plain; charset=utf-8';
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const redirect = redirects.get(url.pathname);
    if (redirect) {
      response.writeHead(redirect.status, { Location: `${redirect.destination}${url.search}` });
      response.end();
      return;
    }

    let relative;
    if (url.pathname === '/ru/' || url.pathname === '/en/') relative = `${url.pathname.slice(1)}index.html`;
    else relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const absolute = path.resolve(dist, relative);
    if (!absolute.startsWith(`${dist}${path.sep}`)) throw new Error('Unsafe test path');
    const contents = await readFile(absolute);
    response.writeHead(200, { 'Content-Type': contentType(relative), 'Content-Length': contents.length });
    response.end(contents);
  } catch (error) {
    response.writeHead(error?.code === 'ENOENT' ? 404 : 500);
    response.end();
  }
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;

try {
  for (const route of ['/ru/', '/en/', '/robots.txt', '/sitemap.xml']) {
    const response = await fetch(`${origin}${route}`, { redirect: 'manual' });
    assert.equal(response.status, 200, `${route}: expected 200`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${route}: empty response`);
  }

  for (const [route, destination] of [['/', '/en/'], ['/ru', '/ru/'], ['/en', '/en/']]) {
    const response = await fetch(`${origin}${route}?source=smoke`, { redirect: 'manual' });
    assert.equal(response.status, 308, `${route}: expected permanent redirect`);
    assert.equal(response.headers.get('location'), `${destination}?source=smoke`, `${route}: query string was not preserved`);
  }

  for (const lang of ['ru', 'en']) {
    const html = await (await fetch(`${origin}/${lang}/`)).text();
    const assets = [...html.matchAll(/(?:href|src|data-curtain-fragment)="(\/assets\/[^"]+)"/g)]
      .map(match => match[1]);
    assert.equal(assets.length, 3, `/${lang}/: expected CSS, bootstrap, and lazy fragment`);
    for (const asset of assets) {
      const response = await fetch(`${origin}${asset}`);
      assert.equal(response.status, 200, `${asset}: expected 200`);
      assert.ok((await response.arrayBuffer()).byteLength > 0, `${asset}: truncated response`);
    }
  }

  assert.equal((await fetch(`${origin}/app.js`)).status, 404, 'legacy app.js must not be deployed');
  console.log('Static HTTP smoke checks passed.');
} finally {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
