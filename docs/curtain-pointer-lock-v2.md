# Curtain V2 — pointer-locked drag (experimental)

## Status
- Independent branch only. **Never deploy this experiment automatically**.
- Production baseline at branch creation: `fed7d9e4c23d6c4887e99072adf62d3c55604497`.
- This experiment keeps the two RU/EN layers, semantic links, scroll persistence,
  snap/fling on release, keyboard navigation and reduced-motion behavior.

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

## Acceptance test on real Mac
1. Clone / switch to `codex/curtain-pointer-lock-v2`. Run
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

## Release process
Review experiment in local Safari -> collect owner feedback -> refine -> 
standard PR with permanent regression checks -> approve -> merge -> 
Selectel atomic deploy -> production smoke tests -> keep old release for rollback.
