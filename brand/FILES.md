# Asset inventory

## Source and geometry

- `master/logo-master-v1.svg` — approved locked source.
- `master/logo-master-unoptimized.svg` — byte-identical source copy.
- `master/logo-master.svg` — optimized serialization.
- `master/master-lock.json` — approval date, hash and immutable bounds.
- `geometry-report.md`, `geometry/geometry-metrics.json`, `geometry/control-points.json` — geometry and optical analysis.

## SVG variants

- `svg/logo-silver.svg`, `logo-white.svg`, `logo-black.svg`, `logo-charcoal.svg` — transparent symbol-only fills.
- `svg/logo-brand.svg`, `logo-dark.svg`, `logo-light.svg` — symbol with context-safe backgrounds.
- `svg/logo-micro.svg`, `logo-micro-white.svg` — optical-size derivatives only.

## Raster and containers

- `png/transparent/` — silver, white, black and charcoal symbols at 512/1024/2048.
- `png/backgrounds/` — brand, dark and light context variants at 512/1024.
- `avatars/square/`, `avatars/circle/`, `avatars/rounded-square/` — SVG and PNG at 128/256/512/1024.
- Platform working exports: `github-500.png`, `linkedin-page-400.png`, `youtube-800.png`.

## Favicon, install and social

- `favicon/favicon.svg`, `favicon/favicon.ico`, `favicon/favicon-16x16.png`, `favicon-32x32.png`, `favicon-48x48.png`.
- `favicon/apple-touch-icon.png`, `pwa-192.png`, `pwa-512.png`, `pwa-maskable-192.png`, `pwa-maskable-512.png`, `site.webmanifest`.
- `social/opengraph.svg`, `social/opengraph-1200x630.png`.

## Previews and tests

- `previews/geometry-preview.html`, `geometry-preview.svg` — locked geometry review board.
- `previews/brand-preview.html` — color, optical-size, container, platform, favicon and social board.
- `tests/asset-qa.json`, `svg-validation.json`, `browser-qa.json`, `browser-micro-summary.json`, `browser-micro-qa.json`, `pdf-qa.json`, `micro-width-selection.json` — machine-readable QA. Summary is the current interpreted result; the raw micro snapshot is retained for audit.
- `tests/browser/` — desktop/mobile/favicon and before/after screenshots for Chromium, Firefox and WebKit.
- `tests/scale/` — master 16–2048 and micro 16–128 raster ladder.
- `tests/vector-proof.pdf`, `vector-proof.png` — locally rendered vector proof and inspected PNG.

Build scripts and their commands are in `package.json` and `README.md`.

`node_modules/` is intentionally ignored; dependencies are declared in `package-lock.json` and are not part of the asset pack.
