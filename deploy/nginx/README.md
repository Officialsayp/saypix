# Nginx static-site profile — production

**Status (2026-10-31):** Nginx is the active production web-server profile on the Selectel VPS according to the completed migration and deployment history. Caddy is an inactive historical/rollback reference. A successful GitHub Actions deploy and origin smoke test confirm the site route, **not** the on-host process inventory, TLS renewal mechanism, certificate/key locations, or backup inclusion. Inspect those over SSH before maintenance or disaster recovery.

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
historical Caddy procedures in the older network-research document must not be
applied to an Nginx installation. The current operator entry point is
[Recovery Runbook](../../docs/recovery-runbook.md).

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

## Read-only production verification

Run on the VPS **before** making operational changes:

```sh
sudo nginx -t
systemctl status nginx --no-pager
systemctl is-active caddy || true
ss -lntp | grep -E ':80|:443'
systemctl list-timers --all | grep -Ei 'certbot|acme|letsencrypt|certificate|nginx' || true
readlink -f /var/www/maxzolotoy/current
```

Confirm the active Nginx host files and enabled snippets with `nginx -T` only on the trusted VPS; review the output locally because it can include sensitive server configuration. Check that `http-maps.conf` is included once in the `http` context and `site.conf` within the relevant content `server` blocks. The repository does **not** contain the complete host configuration or the TLS/renewal setup; never guess paths or reload a newly restored configuration without verifying it.

The deploy workflow uses a shared release lock at `/var/www/maxzolotoy/releases/.deploy-maxzolotoy.lock` while extracting and switching `current`. Release cleanup and any manual rollback must take the same lock to avoid racing a deployment. Review the active cleanup unit and script on the VPS; the repository cannot prove their current contents.

## Current CSS layout regression protection

The existing Chromium and WebKit CI runs include `scripts/check-stack-browser.mjs`, which verifies the About/Contacts content axes against their headings, Stack/Projects alignment and code containment at narrow widths (including 320/333/334px). `scripts/check-compact-density.mjs` adds Chromium coverage for the same alignment constraints. These checks are independent of the web-server profile.
