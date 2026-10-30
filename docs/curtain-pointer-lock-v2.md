# Curtain V2 — pointer-locked drag (implemented)

## Status
- **Integrated into `main`:** PR [#36](https://github.com/Officialsayp/saypix/pull/36) was merged on 2026-10-29 (merge commit `143bd110a91ec80b44e985f78e302855e2c8bd23`). The `codex/curtain-pointer-lock-v2` branch was the original experiment, **not** an active release prerequisite.
- Production baseline at experiment creation: `fed7d9e4c23d6c4887e99072adf62d3c55604497`; historical measurement results below belong to that experiment and its follow-ups.
- The implementation preserves both RU/EN layers, semantic links, scroll restoration, snap/fling, keyboard navigation and reduced-motion behavior.
- Live Safari/trackpad physical pointer-to-display latency remains **unverified** by CI; do not reinterpret synthetic 0–0.75px DOM measurements as real-device latency results.

## Verified causes in V1
1. The divider starts at the inner edge of the language control, while grabbing
   near its center; the initial 22–24 CSS-px offset persists through dragging.
2. Movements of at least 48 CSS-px trigger a 1.6 CSS-px/ms artificial
   catch-up animation. The divider can be many frames behind a fast pointer.
3. Regular updates are scheduled using requestAnimationFrame; this adds
   browser scheduling latency. This experiment instead sets transform values
   on every delivered pointermove, without any layout reads inside that handler.
4. The native cursor may be composited outside the browser; physical zero-lag
   is not a meaningful guarantee. The practical correctness criterion is
   matching the latest delivered PointerEvent coordinate.

## V2
- `pointerProgress(clientX, stageLeft, stageWidth)` maps the event directly to the boundary.
- One-pixel divider is centered on the event hotspot.
- No `INPUT_JUMP_PX`, `inputCatchUp`, spring or input motion animation.
- Uses the actual `#site-shell` viewport origin.
- Floating language badge is independently kept inside the viewport.
- Original post-release easing remains; it is not applied while dragging.
- No new runtime libraries.

## Automated measurements (2026-10-29)
Workflow: Experimental V2 pointer-locked curtain.
- `npm test`: green, including size, SEO, accessibility invariants and deployment policy.
- Chromium: 375, 560, 768, 1024, 1512, 1920 CSS-px, both RU → EN and EN → RU:
  max DOM-position error 0 CSS-px at 8 measured points per drag.
- WebKit: same cases, max DOM-position error 0.75 CSS-px.
- All transitions ended at valid pages. Strict Compact B RU/EN geometry + dragging
  checks also passed in Chromium.
- These tests do **not** measure physical mouse-to-display latency or guarantee
  120Hz presentation on the owner's MacBook.

## Cancellation lifecycle and language indication

The disappearing `ТЯНУТЬ` / `DRAG` hint was reproduced in both Chromium and
WebKit: `showCurtain()` permanently added `has-used-curtain` on the first
horizontal preview, while every cancellation cleared only the temporary curtain
classes. The completed return left the hint at `opacity: 0`.

- The hint now follows `is-curtain-moving`: it fades out during the gesture and
  settling, then returns when cancellation cleanup runs. Successful navigation
  keeps it hidden until the destination document loads; that document has its own
  localized hint. At widths <=1450px, a static inward-facing chevron below the target language control replaces the text hint. It inherits the same cancellation lifecycle, is decorative, and does not intercept clicks.
- Current-language fill uses the static `aria-current="page"` attribute, so the
  selected RU/EN control has a quiet gray fill immediately, including without JS.
  The other control retains its dark background and thin outline. Previewing a
  language does not change which document is marked current.
- A release with an empty `getCoalescedEvents()` list now contributes its own
  sample. Pausing before release expires old fling velocity, so a stationary
  release below the midpoint returns to the original language.
- Cancellation also suppresses the trailing pointer click. WebKit can deliver it
  to the original language link after capture is lost and the mouse is released
  elsewhere. The guard lasts until that click or the next primary pointerdown;
  keyboard activation remains available immediately.

`scripts/check-curtain-lifecycle.mjs` runs in the regular Chromium and WebKit CI
jobs. It covers both languages at 375/1512/1920px, repeated return-to-origin,
below-threshold release after a pause, cancellation before/mid-preview/past the
threshold, native capture loss followed by a delayed release, vertical abandonment,
resize, successful completion and a subsequent fast fling. It also checks ordinary
click and keyboard activation after cancellation, reduced motion, no-JS links,
focus indication and current-language fill on desktop and mobile.

The `pointercancel` checks use complete synthetic touch sessions because
Playwright has no cross-browser native cancellation command. Fast-fling coverage
uses a synthetic 32ms touch sequence so CI command latency cannot turn it into a
paused release. Capture loss, snap-back, ordinary successful mouse drags, releases
and clicks use browser input. Real-device touch cancellation and physical
cursor-to-display latency still need owner testing.

The pointer-lock regression now also measures 24 rapid reversals **inside the
same pointermove dispatch**, after the application listener, at every tested
width and language. This detects a deferred rAF/catch-up loop even when the line
would catch up before a later test snapshot. The input-position/rendering path
remains unchanged: no new smoothing, scheduling, or layout reads during movement.

### Follow-up verification on macOS (2026-10-29)

- `npm test`: passed; generated output regenerated and asset budgets unchanged.
- Chromium and WebKit: all lifecycle/current-language checks above passed,
  including native capture loss followed by release and subsequent input reuse.
- Pointer lock at 375/560/768/1024/1512/1920px in both directions: maximum snapshot
  error 0px in Chromium and 0.75px in WebKit. All 288 rapid-reversal event samples
  per engine matched synchronously with 0px error.
- Strict bilingual geometry and curtain checks: passed in Chromium at all
  configured widths (320–1920px).
- Scroll restoration: all 12 bidirectional desktop/mobile cases passed in each
  engine. Desktop/mobile RU/EN indication, hover and pressed state were also
  visually inspected on local browser captures.
- No physical display-latency claim: further input/rendering changes were not
  justified by these measurements. Owner Safari/trackpad testing remains a release gate.

## Acceptance test on real Mac
1. Check out the current `main` (the experiment is merged). Run
   `npm ci && npm run preview`, open `http://127.0.0.1:4173/ru/` in Safari.
2. Compare **the same physical Mac** against production, in separate tabs:
   - drag EN → left in RU page; drag RU → right in EN page.
   - start at center/inner edge/outer edge of the language button.
   - move smoothly, then make rapid 400–800 px pointer jumps and sharp reversals.
   - full-screen Safari, half-screen side-by-side, resized windows, vertical scrolling.
   - test both standard scaling and the owner's normal system display scale.
3. Check first drag after cold load (no prior hover), then repeated warm drags.
4. Check trackpad drag and physical mouse, if available; no stuck divider on release.
5. Compare at 60Hz/120Hz where those refresh rates are accessible.
6. Confirm localized content is stationary while the curtain edge crosses it,
   especially paragraphs and project bullets.
7. Check keyboard-only language change, Escape/gesture cancellation where applicable,
   reduced motion, mobile portrait/landscape and zoom/resizing.

## Acceptance metrics / caveats
- During captured pointer events, line center deviates <=1 CSS-px from
  `clientX` when inside viewport; edge clamping near 0/W is allowed.
- No deliberate easing, catch-up frames, or positional lag during held drag.
- No visible new tears or frame stalls relative to the production baseline.
- No errors, stray event listeners, broken scroll restoration, or changed RU/EN layout.
- Physical pointer-to-light latency cannot be zero because of device and display pipelines.

## Next refinements, gated by real-device evidence
1. If first drag is delayed, prefetch curtain fragment/module and pre-measure geometry
   earlier. Evaluate initial payload/Lighthouse impact before accepting.
2. If fast movement still shows frame pacing problems, profile performance recordings:
   main-thread work, compositor rasterization and expensive
   `syncNavigation` updates on language-boundary crossings.
3. Compare immediate transform updates with one-rAF-per-refresh updates using
   controlled high-frequency input, retaining the one with better perceived
   tracking *on the real Mac*.
4. Do not depend on `pointerrawupdate` for Safari: browser support is limited;
   it can be an optional benchmark in Chromium, never a Safari requirement.

## Release history and future changes
The original experiment was reviewed and merged as PR #36 on 2026-10-29.
Future changes to curtain input, timing or visual geometry must follow the normal
PR workflow: reproduce on actual hardware when latency is the concern, preserve
permanent Chromium/WebKit regression checks, review, merge, atomic deploy and
production smoke-test. Do not redeploy the historical experiment branch as if it
were a newer version of `main`.
