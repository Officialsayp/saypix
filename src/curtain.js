import { clamp, curtainFrame, snapProgress } from './curtain-math.js';

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

const DRAG_START_PX = 8;
const MIN_FLING_TRAVEL_PX = 12;
const FLING_VELOCITY = 0.45;
const VELOCITY_WINDOW_MS = 96;
const GHOST_HALF_WIDTH = 24;
const MOUSE_FALLBACK_GUARD_MS = 32;
const INPUT_JUMP_PX = 48;
const INPUT_CATCHUP_SPEED_PX_PER_MS = 1.6;

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
let moveFrame = 0;
let settleFrame = 0;
let geometryFrame = 0;
let geometryLang = null;
let dragOriginX = 0;
let dragOriginY = 0;
let dragStartProgress = progress;
let dragMoved = false;
let dragPreviewed = false;
let dragPointerType = '';
let lastPointerMoveAt = -Infinity;
let lostCaptureFrame = 0;
let inputCatchUpFrame = 0;
let inputCatchUpLastTime = 0;
let dragVisualGhostX = null;
let lastDragInputX = null;
let stageWidth = 1;
let ruDragAnchorX = null;
let enDragAnchorX = null;
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
  const heights = elements.map(([primary, curtain]) => Math.ceil(Math.max(
    primary.getBoundingClientRect().height,
    curtain.getBoundingClientRect().height,
  )));
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
  const width = stageRect.width || document.documentElement.clientWidth || window.innerWidth;
  stageWidth = Math.max(1, width);
  // The curtain should begin where the user grips the inner side of the
  // language control, not one control-width beyond it at the viewport edge.
  const ruRect = ruButton.getBoundingClientRect();
  const enRect = enButton.getBoundingClientRect();
  ruDragAnchorX = clamp(ruRect.right - stageRect.left, 0, stageWidth);
  enDragAnchorX = clamp(enRect.left - stageRect.left, 0, stageWidth);
  return stageWidth;
}

function dragAnchorProgress(targetLang) {
  const anchorX = targetLang === 'en' ? enDragAnchorX : ruDragAnchorX;
  if (!Number.isFinite(anchorX)) return targetLang === 'en' ? 0 : 1;
  return clamp(1 - (anchorX / stageWidth), 0, 1);
}

function progressToDividerX(p) {
  return (1 - p) * stageWidth;
}

function paintGhostAt(clientX) {
  const maxX = Math.max(GHOST_HALF_WIDTH, stageWidth - GHOST_HALF_WIDTH);
  const x = clamp(clientX, GHOST_HALF_WIDTH, maxX);
  ghost.style.transform = `translate3d(${(x - GHOST_HALF_WIDTH).toFixed(3)}px, 0, 0)`;
}

function paintCurtain(p, { ghostX = null, retainPending = false } = {}) {
  const frame = curtainFrame(p, stageWidth, curtainLang);
  progress = frame.progress;
  if (!retainPending) pendingProgress = progress;
  // Keep a visible divider inside the viewport at the fully closed endpoints.
  // The reveal itself still uses the exact edge coordinate above.
  const dividerX = clamp(frame.dividerPosition, .5, Math.max(.5, stageWidth - .5));

  // These are local compositor transforms. Do not update an inherited CSS custom
  // property here: that invalidates both full language trees on every pointer frame.
  curtainReveal.style.transform = `translate3d(${frame.revealX.toFixed(3)}px, 0, 0)`;
  curtainLayer.style.transform = `translate3d(${frame.layerX.toFixed(3)}px, 0, 0)`;
  divider.style.transform = `translate3d(${dividerX.toFixed(3)}px, 0, 0)`;
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
  location.assign(canonicalPath(lang) + localizedHash(lang));
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function cancelMoveFrame({ flush = false } = {}) {
  if (!moveFrame) return;
  cancelAnimationFrame(moveFrame);
  moveFrame = 0;
  if (flush) paintCurtain(pendingProgress, { ghostX: pendingGhostX });
}

function cancelInputCatchUp() {
  if (!inputCatchUpFrame) return;
  cancelAnimationFrame(inputCatchUpFrame);
  inputCatchUpFrame = 0;
  inputCatchUpLastTime = 0;
}

function startInputCatchUp() {
  if (inputCatchUpFrame) return;
  inputCatchUpLastTime = performance.now();

  const tick = now => {
    inputCatchUpFrame = 0;
    const elapsed = clamp(now - inputCatchUpLastTime, 8, 48);
    inputCatchUpLastTime = now;

    const currentDividerX = progressToDividerX(progress);
    const targetDividerX = progressToDividerX(pendingProgress);
    const maxStep = elapsed * INPUT_CATCHUP_SPEED_PX_PER_MS;
    const nextDividerX = currentDividerX + clamp(targetDividerX - currentDividerX, -maxStep, maxStep);
    const nextProgress = clamp(1 - (nextDividerX / stageWidth), 0, 1);

    const currentGhostX = Number.isFinite(dragVisualGhostX) ? dragVisualGhostX : dragOriginX;
    const targetGhostX = Number.isFinite(pendingGhostX) ? pendingGhostX : currentGhostX;
    const nextGhostX = currentGhostX + clamp(targetGhostX - currentGhostX, -maxStep, maxStep);

    paintCurtain(nextProgress, { ghostX: nextGhostX, retainPending: true });
    dragVisualGhostX = nextGhostX;

    const dividerSettled = Math.abs(targetDividerX - nextDividerX) < .5;
    const ghostSettled = Math.abs(targetGhostX - nextGhostX) < .5;
    if (dragging && (!dividerSettled || !ghostSettled)) {
      inputCatchUpFrame = requestAnimationFrame(tick);
      return;
    }

    paintCurtain(pendingProgress, { ghostX: pendingGhostX });
    dragVisualGhostX = pendingGhostX;
  };

  inputCatchUpFrame = requestAnimationFrame(tick);
}

function detachPointerListeners() {
  window.removeEventListener('pointermove', moveDrag);
  window.removeEventListener('pointerup', endPointerSession);
  window.removeEventListener('pointercancel', cancelDrag);
  window.removeEventListener('mousemove', moveMouseFallback);
  window.removeEventListener('mouseup', endMouseSession);
}

function finishPointerSession() {
  detachPointerListeners();
  cancelInputCatchUp();
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
  dragVisualGhostX = null;
  lastDragInputX = null;
  ruButton.classList.remove('is-drag-source');
  enButton.classList.remove('is-drag-source');
  if (source?.hasPointerCapture?.(capturedPointerId)) {
    source.releasePointerCapture(capturedPointerId);
  }
}

function cleanupCurtain() {
  cancelMoveFrame();
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
    dragSamples.push({ x: clamp(sample.clientX, 0, stageWidth), time });
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
  cancelMoveFrame();
  hideCurtain();
  dragging = true;
  dragTarget = targetLang;
  dragOriginX = event.clientX;
  dragOriginY = event.clientY;
  dragStartProgress = dragAnchorProgress(targetLang);
  dragMoved = false;
  dragPreviewed = false;
  dragPointerType = event.pointerType || '';
  lastPointerMoveAt = -Infinity;
  pointerId = event.pointerId;
  pendingProgress = dragStartProgress;
  pendingGhostX = event.clientX;
  dragVisualGhostX = event.clientX;
  lastDragInputX = event.clientX;
  paintGhostAt(pendingGhostX);
  dragSamples = [{ x: clamp(event.clientX, 0, stageWidth), time: performance.now() }];
  dragSource = targetLang === 'en' ? enButton : ruButton;
  dragSource.classList.add('is-drag-source');
  // Promote the transform layers before the first visible pixel moves. This
  // keeps Safari from doing its expensive layer/filter switch on that frame.
  prepareCurtain(targetLang);
  // Start at the grip edge, so the divider is visible immediately under the
  // language control instead of appearing only after it enters the viewport.
  paintCurtain(dragStartProgress, { ghostX: pendingGhostX });
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

function queueDragPosition(event, { immediate = false } = {}) {
  const travel = event.clientX - dragOriginX;
  pendingProgress = clamp(dragStartProgress - (travel / stageWidth), 0, 1);
  pendingGhostX = event.clientX;
  const inputJump = Number.isFinite(lastDragInputX)
    && Math.abs(event.clientX - lastDragInputX) >= INPUT_JUMP_PX;
  lastDragInputX = event.clientX;

  if (inputJump) {
    cancelMoveFrame();
    startInputCatchUp();
    return;
  }
  if (inputCatchUpFrame) return;

  if (immediate) {
    cancelMoveFrame();
    paintCurtain(pendingProgress, { ghostX: pendingGhostX });
    dragVisualGhostX = pendingGhostX;
    return;
  }
  if (moveFrame) return;
  moveFrame = requestAnimationFrame(() => {
    moveFrame = 0;
    paintCurtain(pendingProgress, { ghostX: pendingGhostX });
    dragVisualGhostX = pendingGhostX;
  });
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
      queueDragPosition(event, { immediate: firstPreview });
      queuedPreview = true;
    }

    if (horizontalDistance < DRAG_START_PX && verticalDistance < DRAG_START_PX) return;
    if (verticalDistance > horizontalDistance) {
      cancelMoveFrame();
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
      queueDragPosition(event, { immediate: true });
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
    cancelMoveFrame();
    finishPointerSession();
    paintCurtain(activeLang === 'en' ? 1 : 0);
    hideCurtain();
    dragTarget = null;
    return;
  }

  const wasCatchingUp = Boolean(inputCatchUpFrame);
  recordPointerSamples(event);
  if (!wasCatchingUp) queueDragPosition(event, { immediate: true });
  const velocity = currentVelocity();
  const travelled = Math.abs(event.clientX - dragOriginX);
  const target = snapProgress({
    progress: wasCatchingUp ? pendingProgress : progress,
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
  cancelMoveFrame({ flush: true });
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
    cancelMoveFrame();
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
