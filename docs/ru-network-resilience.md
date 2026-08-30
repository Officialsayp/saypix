# Resilience plan for Russian networks and direct-origin deployment

## Scope and diagnosis

The production site is static. Its current request path is:

```text
GitHub main -> Cloudflare build -> dist/ -> Workers Static Assets -> Cloudflare proxy -> visitor
```

Repository and production checks do not show a slow Worker, backend, DNS, TCP,
TLS, or HTML-generation problem. The supplied Russian-IP measurements isolate a
failure in which HTTP/2 delivery of the former 21,742-byte `app.js` stops around
17-18 KB and times out, while HTTP/1.1 completes. Cloudflare has documented
Russian ISP throttling of Cloudflare traffic after the first 16 KB. Frontend
changes can reduce the probability and impact of this failure, but cannot repair
an ISP/Cloudflare network path.

Keep these two outcomes separate:

- **Mitigation:** prerendered no-JS pages, a very small bootstrap, lazy curtain
  code/content, fingerprinted assets, and immutable browser caching.
- **Definitive network fix:** serve web traffic from a direct VPS origin with the
  Cloudflare DNS records set to **DNS only**, after an unproxied origin hostname
  passes Russian and European tests.

## Baseline (commit `76aa624`)

`npm test` and `npm run build` both passed before changes. The original initial
request graph was:

```text
/ru/ or /en/
├── /styles.css                     12,561 B
└── /app.js                         21,742 B
    ├── /render.js                   4,428 B
    │   └── /content.js              8,962 B
    └── /curtain-math.js               938 B
```

Although `app.js` alone was 21.7 KB, the browser's static module graph made
36,070 bytes of JavaScript mandatory on first load. All assets used stable file
names and production returned `Cache-Control: public, max-age=0,
must-revalidate` for HTML, CSS, and JavaScript.

Baseline asset sizes:

| File | Raw | Gzip | Brotli | Initial? |
|---|---:|---:|---:|---|
| `ru/index.html` | 14,536 B | 3,713 B | 3,010 B | yes |
| `en/index.html` | 12,619 B | 3,248 B | 2,559 B | yes |
| `styles.css` | 12,561 B | 3,647 B | 3,122 B | yes |
| `app.js` | 21,742 B | 5,789 B | 5,004 B | yes |
| `render.js` | 4,428 B | 1,360 B | 1,115 B | yes, imported |
| `content.js` | 8,962 B | 2,995 B | 2,427 B | yes, imported |
| `curtain-math.js` | 938 B | 399 B | 347 B | yes, imported |

The main localized content was already prerendered into HTML. The primary defect
was that all enhancement code and alternate-language data were still in the
initial JavaScript dependency graph.

## Implemented frontend architecture

```text
/ru/ or /en/
├── fingerprinted, minified base CSS
├── full localized HTML (usable without JavaScript)
└── tiny fingerprinted boot module
    └── only after pointerenter, focus, or pointerdown:
        ├── dynamic import: fingerprinted curtain module
        └── fetch: fingerprinted alternate-language HTML fragment
```

The module import and fragment request start in parallel. The bootstrap never
prevents an ordinary language-link navigation while enhancement is unavailable.
If either lazy request fails, `/ru/` and `/en/` remain normal links. With
`prefers-reduced-motion: reduce`, the curtain is not loaded and semantic link
navigation is used directly.

The generated HTML still contains:

- all visible page copy;
- About, Stack, Projects, and Contacts sections;
- anchor navigation and project/contact links;
- genuine `/ru/` and `/en/` links;
- canonical, hreflang, Open Graph, Twitter, and JSON-LD metadata.

The alternate fragment is inert until the curtain module inserts it into the
existing `aria-hidden`/`inert` layer. The existing 50% threshold,
velocity-aware snap, Pointer Events, keyboard fallback, geometry synchronization,
Safari workarounds, and local language preference are retained.

## Asset and cache policy

Build output is minified without minifying source files. CSS, bootstrap,
curtain code, and alternate-language fragments use content-fingerprinted names.

Current budgets enforced by `scripts/check-sizes.mjs`:

| Resource | Raw budget | Loading class |
|---|---:|---|
| RU HTML | 14 KiB | initial |
| EN HTML | 12 KiB | initial |
| CSS | 12 KiB | initial |
| bootstrap JS | 2 KiB | initial |
| curtain JS | 12 KiB | lazy |
| each language fragment | 8 KiB | lazy |

The RU document needs a 14 KiB budget because UTF-8 Russian copy and the complete
SEO/JSON-LD graph are intentionally preserved. Removing that information merely
to hit an arbitrary 12 KiB target would weaken the no-JS and SEO requirements.

Browser cache policy:

- `/assets/*`: `public, max-age=31536000, immutable`;
- HTML and stable-name files: `public, max-age=0, must-revalidate`.

Cloudflare Workers Static Assets supports overriding its default cache header via
the generated `_headers` file. Immutable caching is safe only because every file
under `/assets/` is content fingerprinted.

## Canonical redirect policy

The repository is the source of truth for language-path aliases:

- `/` -> `/en/`;
- `/ru`, `/ru.html`, `/ru/index`, `/ru/index.html` -> `/ru/`;
- `/en`, `/en.html`, `/en/index`, `/en/index.html` -> `/en/`.

The hosting layer is responsible only for host/protocol normalization:

- HTTP -> HTTPS, preserving URI;
- `www.maxzolotoy.com` -> `maxzolotoy.com`, preserving URI.

Do not add another dashboard rule for `/`, `/ru`, or `/en`. In Cloudflare,
manually verify that any older root redirect rule is disabled so it cannot
conflict with `src/_redirects`. Additional Cloudflare redirect layers do not fix
the Russian ISP failure.

## Direct-origin files

The repository contains two plain-Caddy profiles:

- `deploy/caddy/Caddyfile.origin` for `origin.maxzolotoy.com`;
- `deploy/caddy/Caddyfile.production` for the final apex/www cutover;
- `deploy/caddy/site.caddy` for shared static-site behavior.

Both profiles:

- serve `/var/www/maxzolotoy/current`;
- support HTTP/1.1 and HTTP/2 only during diagnosis;
- use Caddy automatic HTTPS;
- preserve canonical localized URLs and query strings;
- serve security and cache headers;
- expose `/_health`;
- do not expose `_headers` or `_redirects`;
- compress text responses with Zstandard or gzip.

The origin profile also sends `X-Robots-Tag: noindex, nofollow` so the diagnostic
hostname cannot compete with the production canonical pages.

## VPS provisioning

Use a current supported Debian or Ubuntu release. Commands below describe the
required state; adjust package commands to the chosen distribution.

1. Create a non-root deployment user (for example `deploy`) with an SSH key.
2. Confirm a second key-authenticated SSH session works, then set:
   `PermitRootLogin no`, `PasswordAuthentication no`, and
   `KbdInteractiveAuthentication no` in the SSH server configuration.
3. Enable a firewall for TCP ports 22, 80, and 443 only. UDP 443 is not required
   while HTTP/3 is disabled.
4. Enable automatic security updates.
5. Install Caddy from its official package repository.
6. Prepare release directories readable by the `caddy` service user:

   ```bash
   sudo install -d -o deploy -g caddy -m 0755 /var/www/maxzolotoy
   sudo install -d -o deploy -g caddy -m 0755 /var/www/maxzolotoy/releases
   ```

7. Copy `site.caddy` and `Caddyfile.origin` to `/etc/caddy`; install the origin
   file as `/etc/caddy/Caddyfile`.
8. Validate before reload:

   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
   sudo systemctl reload caddy
   ```

The Caddy service reads files from `/var/www`, not from a home directory. It
runs without application secrets and without a Node production server.

With key-only SSH and a restricted firewall, fail2ban is optional rather than a
prerequisite. Re-evaluate it if logs show sustained authentication attacks.

## Staging DNS and GitHub Actions

Before any apex change, create:

```text
origin.maxzolotoy.com  A     <VPS IPv4>   DNS only
origin.maxzolotoy.com  AAAA  <VPS IPv6>   DNS only (only if IPv6 is configured)
```

The Cloudflare cloud must be grey (**DNS only**), not orange. Do not create an
AAAA record unless the VPS firewall/routing and Caddy listener work over IPv6.

Configure the GitHub `direct-origin` environment with:

- `VPS_HOST` — SSH hostname or IP;
- `VPS_USER` — non-root deployment user;
- `VPS_SSH_KEY` — private deploy key;
- `VPS_KNOWN_HOSTS` — host key verified out of band;
- `VPS_ORIGIN_HOST` — `origin.maxzolotoy.com`.

Set the repository variable `DIRECT_ORIGIN_DEPLOY_ENABLED=true` only after the
VPS, DNS-only origin record, TLS, and permissions are ready. Until then the
workflow runs verification but skips deployment, so the current Cloudflare
production path is not disturbed.

Deployment sequence:

```text
push main -> npm ci -> npm test -> build -> tar dist
          -> upload release -> extract to releases/<commit>
          -> atomic current symlink replacement -> remote smoke test
```

No secrets are stored in the repository.

## Origin comparison test

Run from both a Russian IP and a European IP/VPN. Repeat each request several
times and keep the complete byte count. Replace the asset path with the current
fingerprinted bootstrap and lazy curtain paths printed by `npm run build`.

```bash
curl --http1.1 -sS -o /dev/null -w 'code=%{http_code} bytes=%{size_download} ttfb=%{time_starttransfer} total=%{time_total}\n' https://maxzolotoy.com/ru/
curl --http2 -sS -o /dev/null -w 'code=%{http_code} bytes=%{size_download} ttfb=%{time_starttransfer} total=%{time_total}\n' https://maxzolotoy.com/ru/
curl --http1.1 -sS -o /dev/null -w 'code=%{http_code} bytes=%{size_download} ttfb=%{time_starttransfer} total=%{time_total}\n' https://origin.maxzolotoy.com/ru/
curl --http2 -sS -o /dev/null -w 'code=%{http_code} bytes=%{size_download} ttfb=%{time_starttransfer} total=%{time_total}\n' https://origin.maxzolotoy.com/ru/
node scripts/check-remote.mjs https://origin.maxzolotoy.com
```

Also download every referenced `/assets/*` URL with both protocol versions.
Success means the expected byte size arrives without timeout in repeated runs.
If the DNS-only origin is stable from Russia while the proxied hostname still
stalls, the network diagnosis is confirmed.

Cloudflare HTTP/3 may be temporarily turned off during comparison to remove one
variable, but the known failure also occurs over HTTP/2. Do not treat HTTP/3 as
the sole cause or promise that disabling it fixes the issue.

## Safe production cutover

Proceed only after the origin comparison passes.

1. Record/export current Cloudflare DNS and redirect settings.
2. Verify MX, SPF, DKIM, DMARC, and Proton verification records. Do not edit them.
3. Lower only the web A/AAAA/CNAME TTL in advance.
4. Deploy and test the exact candidate release on `origin.maxzolotoy.com`.
5. Install and validate `Caddyfile.production` on the VPS. Do not reload it until
   apex/www DNS can satisfy automatic HTTPS, or pre-stage certificates safely.
6. Change only web records:
   - apex A/AAAA -> VPS, **DNS only**;
   - `www` -> VPS/apex, **DNS only**.
7. Reload Caddy and verify certificate issuance, `/ru/`, `/en/`, `/robots.txt`,
   `/sitemap.xml`, assets, redirects, and `/_health`.
8. Repeat HTTP/1.1/HTTP/2 and browser tests from Russia and Europe.
9. Recheck Yandexbot/Googlebot access and Webmaster/Search Console status.
10. Keep the previous Cloudflare Workers deployment available during the
    observation window.

Root language selection remains a fixed `/` -> `/en/` default. `/ru/` and `/en/`
are never geo-forced. Do not add an external GeoIP API to the request path. A
future geo-aware root may use `Accept-Language` or a local GeoIP database, with a
deterministic fallback.

## Rollback

Frontend rollback:

1. Revert the change through Git and deploy the last known-good commit.
2. Fingerprinted names prevent mixed old/new HTML and assets; atomic releases
   prevent partial copies.

Direct-origin release rollback:

1. Point `/var/www/maxzolotoy/current` atomically to the previous release.
2. Reload is not required when only the symlink target changes.
3. Run `node scripts/check-remote.mjs` against the origin.

DNS cutover rollback:

1. Restore the saved apex/www Cloudflare-proxied web records only.
2. Leave all Proton Mail records untouched.
3. Verify the Workers deployment, TLS, `/ru/`, and `/en/` before declaring
   rollback complete.

DNS caches can make rollback non-instantaneous; this is why TTL is lowered and
both origins remain healthy through the observation period.

## Remaining external work

Repository work cannot by itself:

- provision or secure the VPS;
- create the DNS-only origin record;
- issue the first public TLS certificate before DNS points to the VPS;
- test from a real Russian ISP path;
- inspect or remove conflicting Cloudflare Dashboard redirect rules;
- toggle Cloudflare HTTP/3;
- perform the final apex cutover safely without owner credentials.

Those steps deliberately remain owner-controlled. They are the boundary between
the completed mitigation and the definitive network fix.

## Primary references

- [Cloudflare: Russian users and the 16 KB ISP throttling pattern](https://blog.cloudflare.com/russian-internet-users-are-unable-to-access-the-open-internet/)
- [Cloudflare Workers Static Assets: custom `_headers`](https://developers.cloudflare.com/workers/static-assets/headers/)
- [Caddy server protocols (`h1`, `h2`, `h3`)](https://caddyserver.com/docs/caddyfile/options#protocols)
- [Caddy static file server](https://caddyserver.com/docs/caddyfile/directives/file_server)
- [Caddy redirect URI preservation](https://caddyserver.com/docs/caddyfile/directives/redir)
