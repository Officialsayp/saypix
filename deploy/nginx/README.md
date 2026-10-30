# Nginx static-site profile

The shared policy follows the reviewed 30 October 2026 migration configuration.
It serves the existing release layout; the deployment workflow still uploads to
`/var/www/maxzolotoy/releases/<commit>` and atomically switches `current`.

- Load the installed headers-more module in the main configuration context;
  Ubuntu provides it through `libnginx-mod-http-headers-more-filter`.
- Include `http-maps.conf` once in the host's `http {}` context.
- Include `site.conf` in the content `server {}` for `maxzolotoy.com` and
  `origin.maxzolotoy.com`, after `root /var/www/maxzolotoy/current;`.
- The origin host receives `X-Robots-Tag: noindex, nofollow` from the host map.
- Keep the host's separately managed TLS certificates, HTTP-to-HTTPS redirects,
  `www`-to-apex redirect, ACME challenge webroot and TLS renewal configuration.
  These two includes do not provision certificates or change listeners.

`deploy/caddy/` remains a rollback/reference profile. Installing this profile or
switching the production web server is a separately authorized operation. The
historical Caddy procedures in the older recovery/network runbooks must not be
applied to an Nginx installation without the migration's recovery plan.

## Local and CI verification

```sh
npm ci
npm test
npm run check:nginx
```

The last command requires an installed Nginx binary (`NGINX_BIN` can select it).
`NGINX_MIME_TYPES` can override the installed `mime.types` path;
`NGINX_HEADERS_MORE_MODULE` selects the dynamic module. Ubuntu CI installs
`nginx` and `libnginx-mod-http-headers-more-filter` before this check.

The runner validates a temporary configuration with `nginx -t`, starts its own
unprivileged HTTP server on an unused loopback port, and runs the existing remote
smoke checker plus direct route/header/body checks. It verifies both language
documents, query-preserving aliases, language selection, HEAD, actual referenced
assets, caching, own-ETag revalidation, Range/416, hidden metadata and origin noindex.
Gzip is checked by decompressing its actual response; clients offering only zstd
must still receive the correct identity representation.
It terminates only the process it started and removes its temporary files.

This test does not modify or reload the installed Nginx service, contact public
sites, or verify production TLS/DNS. Live migration acceptance additionally uses
the recorded Caddy/Nginx HTTPS response matrix and public HTTPS checks.
