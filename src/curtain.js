import { clamp, curtainFrame, snapProgress, pointerProgress } from './curtain-math.js';

let installedApi = null;

export function installCurtain(fragmentHtml) {
  if (installedApi) return installedApi;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
const body = document.body;
const shell = document.querySelector('#site-shell');
const primaryLayer = document.querySelector('[data-layer="primary"]');
const curtainLayer = document.querySelector('[data-layer="curtain"]');
const curtainReveal = document.querySelector('[data-reveal]');
const ruButton = document.querySelector('[data-lang-target="ru"]');
const enButton = document.querySelector('[data-lang-target="en"]');
const ghost = document.querySelector('.language-ghost');
const divider = document.querySelector('.curtain-divider');
const navItems = [...document.querySelectorAll('.nav a[data-ru][data-en]')];

const DRAG_START_PX = 8;
const MIN_FLING_TRAVEL_PX = 12;
const FLING_VELOCITY = 0.45;
const VELOCITY_WINDOW_MS = 96;
const MOUSE_FALLBACK_GUARD_MS = 10;

let activeLang = root.dataset.initialLang === 'en' ? 'en' : 'ru';
let curtainLang = activeLang === 'en' ? 'ru' : 'en';
const curtainTemplate = document.createElement('template');
curtainTemplate.innerHTML = fragmentHtml;
let progress = activeLang === 'en' ? 1 : 0; // 0 = RU, 1 = EN
let pendingProgress = progress;
let pendingGhostX = null;
let dragging = false;
let dragTarget = null;
let pointerId = null;
let dragSource = null;
let dragSamples = [];
let settleFrame = 0;
let geometryFrame = 0;
let geometryLang = null;
let dragOriginX = 0;
let dragOriginY = 0;
let dragMoved = false;
let dragPreviewed = false;
let dragPointerType = '';
let lastPointerMoveAt = -Infinity;
let lostCaptureFrame = 0;
let stageWidth = 1;
let stageLeft = 0;
let ghostHalfWidth = 24;
let navCenters = [];
let navVisualLangs = navItems.map(() => activeLang);
let lastViewportWidth = 0;
let suppressNextClick = false;

function syncGeometry() {
  const pairs = [
    ['.header', '.header'],
    ['.hero', '.hero'],
    [`#about-${activeLang}`, `#about-${curtainLang}`],
    [`#stack-${activeLang}`, `#stack-${curtainLang}`],
    [`#projects-${activeLang}`, `#projects-${curtainLang}`],
    [`#contacts-${activeLang}`, `#contacts-${curtainLang}`]
  ];

  const elements = pairs
    .map(([primarySelector, curtainSelector]) => [
      primaryLayer.querySelector(primarySelector),
      curtainLayer.querySelector(curtainSelector),
    ])
    .filter(([primary, curtain]) => primary && curtain);

  // Batch writes, reads, and final writes. Interleaving those operations forces
  // repeated layout passes in Safari, especially after its browser chrome resizes.
  elements.flat().forEach(element => { element.style.minHeight = ''; });
  const heights = elements.map(([primary, curtain]) => Math.max(
    primary.getBoundingClientRect().height,
    curtain.getBoundingClientRect().height,
  ));
  elements.forEach(([primary, curtain], index) => {
    const height = `${heights[index]}px`;
    primary.style.minHeight = height;
    curtain.style.minHeight = height;
  });

  updateStageWidth();
  paintCurtain(progress);
  geometryLang = curtainLayer.dataset.lang || null;
}

function scheduleGeometry() {
  if (geometryFrame || dragging) return;
  geometryFrame = requestAnimationFrame(() => {
    geometryFrame = 0;
    if (dragging) return;
    syncGeometry();
  });
}

function ensureCurtainContent(targetLang) {
  if (curtainLayer.dataset.lang === targetLang) return false;
  curtainLang = targetLang;
  if (curtainTemplate.content.firstElementChild?.lang !== targetLang) {
    throw new Error(`Curtain fragment language mismatch: expected ${targetLang}`);
  }
  curtainLayer.replaceChildren(curtainTemplate.content.cloneNode(true));
  // `inert` is the primary guard. Removing the cloned controls from the tab
  // order also protects older Safari versions where inert support is partial.
  curtainLayer.querySelectorAll('a, button, input, select, textarea, [tabindex]')
    .forEach(element => element.setAttribute('tabindex', '-1'));
  curtainLayer.dataset.lang = targetLang;
  geometryLang = null;
  return true;
}

function updateA11y() {
  const ruActive = activeLang === 'ru';
  ruButton.classList.toggle('is-active', ruActive);
  enButton.classList.toggle('is-active', !ruActive);
  if (ruActive) {
    ruButton.setAttribute('aria-current', 'page');
    enButton.removeAttribute('aria-current');
  } else {
    enButton.setAttribute('aria-current', 'page');
    ruButton.removeAttribute('aria-current');
  }
  body.dataset.lang = activeLang;
}

function updateStageWidth() {
  const stageRect = shell.getBoundingClientRect();
  stageLeft = stageRect.left;
  const width = stageRect.width || document.documentElement.clientWidth || window.innerWidth;
  stageWidth = Math.max(1, width);
  ghostHalfWidth = (ghost.getBoundingClientRect().width || 48) / 2;
  navCenters = navItems.map(item => {
    const rect = item.getBoundingClientRect();
    return clamp(rect.left + rect.width / 2 - stageLeft, 0, stageWidth);
  });
  return stageWidth;
}

function paintGhostAt(clientX) {
  const maxX = Math.max(ghostHalfWidth, window.innerWidth - ghostHalfWidth);
  const x = clamp(clientX, ghostHalfWidth, maxX);
  ghost.style.transform = `translate3d(${(x - ghostHalfWidth).toFixed(3)}px, 0, 0)`;
}

// The dock stays physically whole. Only a label changes language when the
// curtain boundary crosses that navigation item's center.
function syncNavigation(dividerX) {
  navItems.forEach((item, index) => {
    const centerX = navCenters[index];
    if (!Number.isFinite(centerX)) return;
    const nextLang = curtainLang === 'en'
      ? (centerX >= dividerX ? 'en' : 'ru')
      : (centerX <= dividerX ? 'ru' : 'en');
    if (navVisualLangs[index] === nextLang) return;
    navVisualLangs[index] = nextLang;
    item.textContent = item.dataset[nextLang];
  });
}

function paintCurtain(p, { ghostX = null, retainPending = false } = {}) {
  const frame = curtainFrame(p, stageWidth, curtainLang);
  progress = frame.progress;
  if (!retainPending) pendingProgress = progress;
  // Keep a visible divider inside the viewport at the fully closed endpoints.
  // The reveal itself still uses the exact edge coordinate above.
  const dividerX = clamp(stageLeft + frame.dividerPosition, stageLeft + .5,
    stageLeft + Math.max(.5, stageWidth - .5));

  // These are local compositor transforms. Do not update an inherited CSS custom
  // property here: that invalidates both full language trees on every pointer frame.
  curtainReveal.style.transform = `translate3d(${frame.revealX.toFixed(3)}px, 0, 0)`;
  curtainLayer.style.transform = `translate3d(${frame.layerX.toFixed(3)}px, 0, 0)`;
  // 1px divider center (not its left border) overlays the pointer hotspot.
  divider.style.transform = `translate3d(${(dividerX - .5).toFixed(3)}px, 0, 0)`;
  syncNavigation(frame.dividerPosition);
  if (Number.isFinite(ghostX)) paintGhostAt(ghostX);
}

function prepareCurtain(targetLang) {
  curtainLang = targetLang;
  ensureCurtainContent(targetLang);
  if (geometryLang !== targetLang) syncGeometry();
  const label = targetLang.toUpperCase();
  if (ghost.textContent !== label) ghost.textContent = label;
  body.classList.add('is-curtain-prepared');
}

function showCurtain(targetLang, { showGhost = true } = {}) {
  prepareCurtain(targetLang);
  root.classList.toggle('is-page-top', window.scrollY <= 24);
  body.classList.add('has-used-curtain', 'is-curtain-moving');
  ghost.classList.toggle('is-visible', showGhost && !reducedMotion.matches);
  divider.classList.toggle('is-visible', !reducedMotion.matches);
}

function hideCurtain() {
  ghost.classList.remove('is-visible');
  divider.classList.remove('is-visible');
  body.classList.remove('is-curtain-moving', 'is-curtain-prepared');
}

function canonicalPath(lang) { return lang === 'en' ? '/en/' : '/ru/'; }

function storeLanguage(lang) {
  try {
    localStorage.setItem('preferred-language', lang);
  } catch {
    // Safari private/blocked storage must not interrupt a completed transition.
  }
}

function localizedHash(lang) {
  if (!location.hash) return '';
  return location.hash.replace(/-(?:ru|en)$/, `-${lang}`);
}

function completeLanguageChange(lang) {
  if (lang === activeLang) {
    cleanupCurtain();
    return;
  }
  storeLanguage(lang);
  // Read from the visible source, not the off-screen translated layer. Section
  // proportions survive different translated text heights on the next document.
  const sections = [...primaryLayer.querySelectorAll('section[id]')];
  const section = sections.filter(item => item.getBoundingClientRect().top <= 1).at(-1) || sections[0];
  let hash = localizedHash(lang);
  if (section) {
    const id = section.id.replace(/-(?:ru|en)$/, `-${lang}`);
    const rect = section.getBoundingClientRect();
    hash = `#${id}`;
    try {
      sessionStorage.setItem('language-scroll', JSON.stringify({
        path: canonicalPath(lang), id, time: Date.now(),
        ratio: clamp(-rect.top / rect.height, 0, 1),
      }));
      hash = ''; // A stale section hash must not override the restored position.
    } catch { /* Without storage, retain the section through a semantic anchor. */ }
  }
  location.assign(canonicalPath(lang) + hash);
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function detachPointerListeners() {
  window.removeEventListener('pointermove', moveDrag);
  window.removeEventListener('pointerup', endPointerSession);
  window.removeEventListener('pointercancel', cancelDrag);
  window.removeEventListener('mousemove', moveMouseFallback);
  window.removeEventListener('mouseup', endMouseSession);
}

function finishPointerSession() {
  detachPointerListeners();
  if (lostCaptureFrame) {
    cancelAnimationFrame(lostCaptureFrame);
    lostCaptureFrame = 0;
  }
  const source = dragSource;
  const capturedPointerId = pointerId;
  dragging = false;
  pointerId = null;
  dragSource = null;
  dragSamples = [];
  dragPointerType = '';
  lastPointerMoveAt = -Infinity;
  ruButton.classList.remove('is-drag-source');
  enButton.classList.remove('is-drag-source');
  if (source?.hasPointerCapture?.(capturedPointerId)) {
    source.releasePointerCapture(capturedPointerId);
  }
}

function cleanupCurtain() {
  finishPointerSession();
  hideCurtain();
  dragTarget = null;
}

function animateTo(target, { duration, showGhost = false } = {}) {
  cancelAnimationFrame(settleFrame);
  settleFrame = 0;
  const start = progress;
  const distance = Math.abs(target - start);
  const targetLang = target >= .5 ? 'en' : 'ru';
  showCurtain(dragTarget ?? targetLang, { showGhost });

  if (reducedMotion.matches || distance < 0.002) {
    paintCurtain(target);
    completeLanguageChange(targetLang);
    return;
  }

  const startTime = performance.now();
  const ms = duration ?? clamp(160 + distance * 200, 180, 360);

  const tick = now => {
    const t = clamp((now - startTime) / ms, 0, 1);
    const p = start + (target - start) * easeOutCubic(t);
    paintCurtain(p);
    if (t < 1) {
      settleFrame = requestAnimationFrame(tick);
      return;
    }
    settleFrame = 0;
    completeLanguageChange(targetLang);
  };
  settleFrame = requestAnimationFrame(tick);
}

function recordPointerSamples(event) {
  const events = event.getCoalescedEvents?.() || [event];
  for (const sample of events) {
    const time = Number.isFinite(sample.timeStamp) ? sample.timeStamp : performance.now();
    dragSamples.push({ x: clamp(sample.clientX - stageLeft, 0, stageWidth), time });
  }
  const lastTime = dragSamples.at(-1)?.time ?? performance.now();
  dragSamples = dragSamples.filter(sample => lastTime - sample.time <= VELOCITY_WINDOW_MS);
}

function currentVelocity() {
  if (dragSamples.length < 2) return 0;
  const first = dragSamples[0];
  const last = dragSamples.at(-1);
  const elapsed = Math.max(1, last.time - first.time);
  return (last.x - first.x) / elapsed;
}

function startDrag(event, targetLang) {
  if (targetLang === activeLang) return;
  if (reducedMotion.matches) return;
  if (event.isPrimary === false) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  cancelAnimationFrame(settleFrame);
  settleFrame = 0;
  hideCurtain();
  dragging = true;
  dragTarget = targetLang;
  dragOriginX = event.clientX;
  dragOriginY = event.clientY;
  dragMoved = false;
  dragPreviewed = false;
  dragPointerType = event.pointerType || '';
  lastPointerMoveAt = -Infinity;
  pointerId = event.pointerId;
  pendingGhostX = event.clientX;
  paintGhostAt(pendingGhostX);
  dragSamples = [{ x: clamp(event.clientX - stageLeft, 0, stageWidth), time: performance.now() }];
  dragSource = targetLang === 'en' ? enButton : ruButton;
  dragSource.classList.add('is-drag-source');
  // Promote the transform layers before the first visible pixel moves. This
  // keeps Safari from doing its expensive layer/filter switch on that frame.
  prepareCurtain(targetLang);
  // Exact pointer lock: start from the hotspot under the actual initial grab.
  pendingProgress = pointerProgress(event.clientX, stageLeft, stageWidth);
  paintCurtain(pendingProgress, { ghostX: pendingGhostX });
  // The ghost still waits for movement; the divider confirms capture now.
  divider.classList.toggle('is-visible', !reducedMotion.matches);
  try {
    dragSource.setPointerCapture?.(pointerId);
  } catch {
    // A lazy first interaction may finish before WebKit accepts pointer capture.
    // Window-level terminal listeners still provide a safe completion path.
  }
  window.addEventListener('pointermove', moveDrag, { passive: false });
  window.addEventListener('pointerup', endPointerSession);
  window.addEventListener('pointercancel', cancelDrag);
  if (dragPointerType === 'mouse') {
    window.addEventListener('mousemove', moveMouseFallback, { passive: false });
    window.addEventListener('mouseup', endMouseSession);
  }
}

function queueDragPosition(event) {
  // Paint the newest pointer position directly. No spring, no 48px jump detector,
  // no speed cap and no deferred rAF cursor-chasing loop.
  pendingProgress = pointerProgress(event.clientX, stageLeft, stageWidth);
  pendingGhostX = event.clientX;
  paintCurtain(pendingProgress, { ghostX: pendingGhostX });
}

function isActiveDragEvent(event) {
  if (!dragging) return false;
  return event.type.startsWith('pointer')
    ? event.pointerId === pointerId
    : dragPointerType === 'mouse';
}

function moveDrag(event) {
  if (!isActiveDragEvent(event)) return;
  if (event.type === 'pointermove') lastPointerMoveAt = performance.now();
  const deltaX = event.clientX - dragOriginX;
  const deltaY = event.clientY - dragOriginY;
  const horizontalDistance = Math.abs(deltaX);
  const verticalDistance = Math.abs(deltaY);

  if (!dragMoved) {
    const isHorizontal = horizontalDistance > 0 && horizontalDistance >= verticalDistance;
    let queuedPreview = false;

    // Give immediate visual feedback from the first horizontal pixel, but keep
    // the 8px threshold for deciding whether this is a drag or a normal click.
    if (isHorizontal) {
      const firstPreview = !dragPreviewed;
      if (firstPreview) {
        dragPreviewed = true;
        showCurtain(dragTarget);
      }
      recordPointerSamples(event);
      queueDragPosition(event);
      queuedPreview = true;
    }

    if (horizontalDistance < DRAG_START_PX && verticalDistance < DRAG_START_PX) return;
    if (verticalDistance > horizontalDistance) {
          paintCurtain(activeLang === 'en' ? 1 : 0);
      cleanupCurtain();
      suppressOneClick();
      return;
    }
    dragMoved = true;
    if (!dragPreviewed) {
      dragPreviewed = true;
      showCurtain(dragTarget);
    }
    if (!queuedPreview) {
      recordPointerSamples(event);
      queueDragPosition(event);
    }
    event.preventDefault();
    return;
  }

  recordPointerSamples(event);
  queueDragPosition(event);
  event.preventDefault();
}

function moveMouseFallback(event) {
  if (!dragging || dragPointerType !== 'mouse') return;
  // Pointer Events remain the preferred channel. Only use mouse events after
  // Safari has stopped delivering them for more than roughly two frames.
  if (performance.now() - lastPointerMoveAt <= MOUSE_FALLBACK_GUARD_MS) return;
  moveDrag(event);
}

function recoverTerminalDrag(event) {
  if (dragMoved) return false;
  const deltaX = event.clientX - dragOriginX;
  const deltaY = event.clientY - dragOriginY;
  if (Math.abs(deltaX) < DRAG_START_PX || Math.abs(deltaX) < Math.abs(deltaY)) return false;
  moveDrag(event);
  return dragMoved;
}

function endPointerSession(event) {
  if (!isActiveDragEvent(event)) return;
  recoverTerminalDrag(event);
  if (!dragMoved) {
      finishPointerSession();
    paintCurtain(activeLang === 'en' ? 1 : 0);
    hideCurtain();
    dragTarget = null;
    return;
  }

  recordPointerSamples(event);
  queueDragPosition(event);
  const velocity = currentVelocity();
  const travelled = Math.abs(event.clientX - dragOriginX);
  const target = snapProgress({
    progress: pendingProgress,
    targetLang: dragTarget,
    velocity,
    travelled,
    flingVelocity: FLING_VELOCITY,
    minimumFlingTravel: MIN_FLING_TRAVEL_PX,
  });

  ghost.classList.remove('is-visible');
  finishPointerSession();
  suppressOneClick();
  animateTo(target);
}

function endMouseSession(event) {
  if (!dragging || dragPointerType !== 'mouse') return;
  endPointerSession(event);
}

function cancelDrag(event) {
  if (!dragging || (event && event.pointerId !== pointerId)) return;
  finishPointerSession();
  animateTo(activeLang === 'en' ? 1 : 0);
}

function handleLostPointerCapture(event) {
  if (!dragging || event.pointerId !== pointerId) return;
  // WebKit can dispatch lostpointercapture beside pointerup. Let the terminal
  // event win when both arrive in the same frame; otherwise safely cancel.
  cancelAnimationFrame(lostCaptureFrame);
  lostCaptureFrame = requestAnimationFrame(() => {
    lostCaptureFrame = 0;
    if (dragging && event.pointerId === pointerId) cancelDrag(event);
  });
}

function suppressOneClick() {
  suppressNextClick = true;
  window.setTimeout(() => { suppressNextClick = false; }, 0);
}

function switchByClick(targetLang) {
  if (targetLang === activeLang || dragging) return;
  dragTarget = targetLang;
  animateTo(targetLang === 'en' ? 1 : 0);
}

for (const button of [ruButton, enButton]) {
  const targetLang = button.dataset.langTarget;
  const warmCurtain = () => {
    if (targetLang === activeLang || dragging || reducedMotion.matches) return;
    curtainLang = targetLang;
    if (ensureCurtainContent(targetLang)) scheduleGeometry();
  };
  button.addEventListener('pointerenter', warmCurtain);
  button.addEventListener('focus', warmCurtain);
  button.addEventListener('pointerdown', event => startDrag(event, targetLang));
  button.addEventListener('lostpointercapture', handleLostPointerCapture);
  button.addEventListener('click', event => {
    if (suppressNextClick) {
      event.preventDefault();
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (targetLang === activeLang) {
      event.preventDefault();
      return;
    }
    // With reduced motion the semantic link is already the ideal fallback:
    // navigate immediately, without constructing or animating a curtain.
    if (reducedMotion.matches) return;
    event.preventDefault();
    switchByClick(targetLang);
  });
}

window.addEventListener('resize', () => {
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  if (Math.abs(viewportWidth - lastViewportWidth) < 1) return;
  lastViewportWidth = viewportWidth;
  if (dragging || settleFrame) {
      cancelAnimationFrame(settleFrame);
    settleFrame = 0;
    finishPointerSession();
    paintCurtain(activeLang === 'en' ? 1 : 0);
    cleanupCurtain();
  }
  scheduleGeometry();
});
progress = activeLang === 'en' ? 1 : 0;
pendingProgress = progress;
lastViewportWidth = document.documentElement.clientWidth || window.innerWidth;

updateStageWidth();
paintCurtain(progress);
updateA11y();
if (document.fonts?.ready) {
  document.fonts.ready.then(scheduleGeometry).catch(() => {});
}

function queuedEvent(snapshot, type) {
  return {
    ...snapshot,
    type,
    isPrimary: true,
    button: 0,
    preventDefault() {},
    getCoalescedEvents() { return [this]; },
  };
}

function startQueuedDrag(session) {
  if (!session || session.ended || session.targetLang === activeLang) return;
  startDrag(queuedEvent(session.down, 'pointerdown'), session.targetLang);
  if (!dragging || !session.current) return;
  const moved = session.current.clientX !== session.down.clientX
    || session.current.clientY !== session.down.clientY;
  if (moved) moveDrag(queuedEvent(session.current, 'pointermove'));
}

function endQueuedDrag(session, cancelled = false) {
  if (!dragging || !session?.current) return;
  const event = queuedEvent(session.current, cancelled ? 'pointercancel' : 'pointerup');
  if (cancelled) cancelDrag(event);
  else endPointerSession(event);
}

installedApi = { startQueuedDrag, endQueuedDrag };
return installedApi;
}
