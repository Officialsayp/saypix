// Exercise the shared Nginx profile on loopback without touching a system service.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { gunzipSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
const nginx = process.env.NGINX_BIN || 'nginx';
const version = spawnSync(nginx, ['-V'], { encoding: 'utf8' });
assert.ifError(version.error ? new Error(`Nginx is unavailable: ${version.error.message}. Install nginx or set NGINX_BIN.`) : null);
assert.equal(version.status, 0, 'nginx -V failed');
const configured = version.stderr.match(/--conf-path=([^\s]+)/)?.[1];
const mimeCandidates = [process.env.NGINX_MIME_TYPES,
  configured && path.join(path.dirname(configured), 'mime.types'),
  '/etc/nginx/mime.types', '/opt/homebrew/etc/nginx/mime.types', '/usr/local/etc/nginx/mime.types'].filter(Boolean);
let mimeTypes;
for (const candidate of mimeCandidates) {
  try { await access(candidate); mimeTypes = candidate; break; } catch { /* Try the next installed location. */ }
}
assert.ok(mimeTypes, 'Installed mime.types not found; set NGINX_MIME_TYPES.');
const modulesPath = version.stderr.match(/--modules-path=([^\s]+)/)?.[1];
const moduleCandidates = [process.env.NGINX_HEADERS_MORE_MODULE,
  modulesPath && path.join(modulesPath, 'ngx_http_headers_more_filter_module.so'),
  '/usr/lib/nginx/modules/ngx_http_headers_more_filter_module.so',
  '/opt/homebrew/lib/nginx/modules/ngx_http_headers_more_filter_module.so'].filter(Boolean);
let headersModule;
for (const candidate of moduleCandidates) {
  try { await access(candidate); headersModule = candidate; break; } catch { /* Try the next installed location. */ }
}
const staticHeadersMore = /--add-module=[^\s]*headers.more/.test(version.stderr);
assert.ok(headersModule || staticHeadersMore, 'headers-more module not found; install libnginx-mod-http-headers-more-filter or set NGINX_HEADERS_MORE_MODULE.');
await access(path.join(dist, 'ru/index.html'));
await access(path.join(dist, 'en/index.html'));

const listener = net.createServer();
await new Promise((resolve, reject) => { listener.once('error', reject); listener.listen(0, '127.0.0.1', resolve); });
const port = listener.address().port;
await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
const temp = await mkdtemp(path.join(os.tmpdir(), 'saypix-nginx-'));
const quote = value => `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('$', '\\$')}"`;
const config = path.join(temp, 'nginx.conf');
let server;
let logs = '';
let count = 0;

function request(urlPath, { method = 'GET', host = 'maxzolotoy.com', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: urlPath, method,
      headers: { Host: host, 'Accept-Encoding': 'identity', ...headers } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error(`Timeout: ${method} ${urlPath}`)));
    req.end();
  });
}

function security(response, host) {
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.equal(response.headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.equal(response.headers['x-robots-tag'], host === 'origin.maxzolotoy.com' ? 'noindex, nofollow' : undefined);
}

async function probe(urlPath, expectedStatus, options = {}) {
  const result = await request(urlPath, options);
  assert.equal(result.status, expectedStatus, `${options.method || 'GET'} ${urlPath}`);
  security(result, options.host || 'maxzolotoy.com');
  count += 1;
  return result;
}

try {
  await writeFile(config, `${headersModule ? `load_module ${quote(headersModule)};\n` : ''}worker_processes 1;
pid ${quote(path.join(temp, 'nginx.pid'))};
error_log ${quote(path.join(temp, 'error.log'))} warn;
events { worker_connections 64; }
http {
  include ${quote(mimeTypes)};
  default_type application/octet-stream;
  access_log off;
  client_body_temp_path ${quote(path.join(temp, 'client-body'))};
  proxy_temp_path ${quote(path.join(temp, 'proxy'))};
  fastcgi_temp_path ${quote(path.join(temp, 'fastcgi'))};
  uwsgi_temp_path ${quote(path.join(temp, 'uwsgi'))};
  scgi_temp_path ${quote(path.join(temp, 'scgi'))};
  include ${quote(path.join(root, 'deploy/nginx/http-maps.conf'))};
  server {
    listen 127.0.0.1:${port};
    server_name maxzolotoy.com origin.maxzolotoy.com;
    root ${quote(dist)};
    include ${quote(path.join(root, 'deploy/nginx/site.conf'))};
  }
}
`);
  const checked = spawnSync(nginx, ['-t', '-p', temp + path.sep, '-c', config], { encoding: 'utf8' });
  assert.ifError(checked.error);
  assert.equal(checked.status, 0, checked.stderr || 'nginx -t failed');
  server = spawn(nginx, ['-p', temp + path.sep, '-c', config, '-g', 'daemon off; master_process off;'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise(resolve => server.once('exit', resolve));
  server.stdout.on('data', data => { logs = (logs + data).slice(-16000); });
  server.stderr.on('data', data => { logs = (logs + data).slice(-16000); });
  server.on('error', error => { logs += error.message; });
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Nginx exited before readiness: ${logs}`);
    try { ready = (await request('/_health')).status === 200; } catch { /* Wait for our process to bind. */ }
    if (ready) break;
    await delay(50);
  }
  assert.ok(ready, `Nginx did not become ready: ${logs}`);

  const smoke = spawnSync(process.execPath, [path.join(root, 'scripts/check-remote.mjs'), `http://127.0.0.1:${port}`], { encoding: 'utf8', timeout: 30000 });
  assert.ifError(smoke.error);
  assert.equal(smoke.status, 0, smoke.stderr || smoke.stdout);
  const query = '?probe=nginx&next=%2Fru%2F&probe=a+b&empty=';
  const assets = new Set();
  for (const host of ['maxzolotoy.com', 'origin.maxzolotoy.com']) {
    const health = await probe('/_health', 200, { host });
    assert.deepEqual(health.body, Buffer.from('ok\\n'), 'Health must preserve its four literal bytes');
    assert.equal(health.headers.vary, undefined, 'Health does not negotiate compression');
    for (const language of ['ru', 'en']) {
      const body = await readFile(path.join(dist, language, 'index.html'));
      for (const suffix of ['', query]) {
        const response = await probe(`/${language}/${suffix}`, 200, { host });
        assert.deepEqual(response.body, body, `/${language}/ must serve its exact document`);
        assert.equal(response.headers['cache-control'], 'public, max-age=0, must-revalidate');
      }
      const head = await probe(`/${language}/`, 200, { host, method: 'HEAD' });
      assert.equal(head.body.length, 0);
      assert.equal(Number(head.headers['content-length']), body.length);
      for (const alias of [`/${language}`, `/${language}.html`, `/${language}/index`, `/${language}/index.html`]) {
        for (const method of ['GET', 'HEAD']) {
          const response = await probe(alias + query, 308, { host, method });
          assert.equal(response.headers.location, `/${language}/${query}`, 'Alias must preserve raw query');
        }
      }
      for (const match of body.toString().matchAll(/(?:href|src|data-curtain-fragment)="(\/assets\/[^"]+)"/g)) {
        assets.add(match[1].split('#')[0]);
      }
    }
    for (const [accept, language] of [['ru-RU,ru;q=0.9,en;q=0.8', 'ru'], ['RU', 'ru'], ['ru;q=0.2,en;q=1', 'ru'], ['en,ru;q=0.9', 'en'], ['russian', 'en'], ['de', 'en']]) {
      const response = await probe('/' + query, 302, { host, headers: { 'Accept-Language': accept } });
      assert.equal(response.headers.location, `/${language}/${query}`);
    }
    for (const resource of ['/robots.txt', '/sitemap.xml', '/favicon.svg']) {
      const response = await probe(resource, 200, { host });
      assert.deepEqual(response.body, await readFile(path.join(dist, resource.slice(1))));
    }
    for (const resource of ['/_headers', '/_redirects', '/no-such-document/', '/assets/missing-file.js', '/app.js']) {
      const response = await probe(resource, 404, { host });
      assert.equal(response.headers['cache-control'], resource.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate');
    }
    for (const method of ['POST', 'OPTIONS']) {
      const rejected = await probe('/ru/', 405, { host, method });
      assert.equal(rejected.headers.allow, 'GET, HEAD');
      assert.equal(rejected.headers.vary, 'Accept-Encoding');
    }
    for (const asset of assets) {
      const response = await probe(asset, 200, { host });
      const expected = await readFile(path.join(dist, asset.slice(1)));
      assert.deepEqual(response.body, expected);
      assert.equal(response.headers['cache-control'], 'public, max-age=31536000, immutable');
      const head = await probe(asset, 200, { host, method: 'HEAD' });
      assert.equal(head.body.length, 0);
      assert.equal(Number(head.headers['content-length']), expected.length);
      const partial = await probe(asset, 206, { host, headers: { Range: 'bytes=0-19' } });
      assert.deepEqual(partial.body, expected.subarray(0, 20));
      assert.equal(partial.headers['content-range'], `bytes 0-19/${expected.length}`);
      assert.ok(response.headers.etag, `${asset}: missing ETag`);
      const fresh = await probe(asset, 304, { host, headers: { 'If-None-Match': response.headers.etag } });
      assert.equal(fresh.body.length, 0);
      assert.equal(fresh.headers.vary, 'Accept-Encoding');
      const unsatisfiable = await probe(asset, 416, { host, headers: { Range: 'bytes=999999999999-' } });
      assert.equal(unsatisfiable.headers['cache-control'], undefined);
      assert.equal(unsatisfiable.headers.vary, 'Accept-Encoding');
      assert.equal(unsatisfiable.headers['content-range'], `bytes */${expected.length}`);
      const compressed = await probe(asset, 200, { host, headers: { 'Accept-Encoding': 'gzip' } });
      assert.equal(compressed.headers['content-encoding'], 'gzip');
      assert.equal(compressed.headers.vary, 'Accept-Encoding');
      assert.deepEqual(gunzipSync(compressed.body), expected);
      const zstdOnly = await probe(asset, 200, { host, headers: { 'Accept-Encoding': 'zstd' } });
      assert.equal(zstdOnly.headers['content-encoding'], undefined, 'Nginx falls back to identity when only zstd is offered');
      assert.deepEqual(zstdOnly.body, expected);
    }
  }
  console.log(smoke.stdout.trim());
  console.log(`Nginx loopback profile checks passed: ${count} responses, ${assets.size} referenced assets, nginx -t.`);
  server.kill('SIGTERM');
  await exited;
  server = undefined;
} finally {
  if (server && server.exitCode === null) {
    const ended = new Promise(resolve => server.once('exit', resolve));
    server.kill('SIGTERM');
    await Promise.race([ended, delay(2000)]);
    if (server.exitCode === null) {
      server.kill('SIGKILL');
      await ended;
    }
  }
  await rm(temp, { recursive: true, force: true });
}
