import { siteContent, contactLinks } from './content.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;
const body = document.body;
const shell = document.querySelector('#site-shell');
const skipLink = document.querySelector('.skip-link');
const ruLayer = document.querySelector('[data-layer="ru"]');
const enLayer = document.querySelector('[data-layer="en"]');
const enReveal = document.querySelector('[data-reveal="en"]');
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

function linkOrDisabled(label, href, className = 'button button--ghost contact-link') {
  if (!href) {
    return `<span class="${className}" aria-disabled="true">${label}</span>`;
  }
  const external = href.startsWith('http');
  return `<a class="${className}" href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${label}</a>`;
}

function renderPage(lang) {
  const c = siteContent[lang];
  const projects = c.projects.cards.map(card => `
    <article class="project-card">
      <div class="project-card__num">${card.number}</div>
      <div>
        <h3>${card.name}</h3>
        <p>${card.description}</p>
        <div class="project-card__tags">${card.tags.map(tag => `<span class="project-card__tag">#${tag.replaceAll(' ', '-')}</span>`).join('')}</div>
      </div>
      <div class="project-card__status">${card.linkLabel}</div>
    </article>`).join('');

  return `
    <div class="page" lang="${lang}">
      <header class="header">
        <div class="container header__inner">
          <a class="brand" href="#top-${lang}" aria-label="Max Zolotoy — home">MZ.</a>
          <nav class="nav" aria-label="${lang === 'ru' ? 'Основная навигация' : 'Main navigation'}">
            ${c.nav.map(([label, id]) => `<a href="#${id}-${lang}">${label}</a>`).join('')}
          </nav>
        </div>
      </header>

      <main id="main-${lang}">
        <section class="hero" id="top-${lang}">
          <div class="container hero__grid">
            <div>
              <div class="eyebrow">${c.hero.eyebrow}</div>
              <h1>${c.hero.title}</h1>
              <p class="hero__lead">${c.hero.lead}</p>
              <div class="hero__actions">
                <a class="button button--primary" href="#projects-${lang}">${c.hero.primary}</a>
                <a class="button button--ghost" href="#contacts-${lang}">${c.hero.secondary}</a>
              </div>
            </div>
            <div class="hero__visual" aria-hidden="true">
              <div class="hero__visual-code"><strong>package</strong> portfolio<br><br><strong>func</strong> main() {<br>&nbsp;&nbsp;focus := "Go backend"<br>&nbsp;&nbsp;build(focus)<br>}</div>
            </div>
          </div>
        </section>

        <section class="section" id="about-${lang}">
          <div class="container">
            <div class="section__head"><div class="kicker">${c.about.kicker}</div><h2>${c.about.title}</h2></div>
            <p class="section__body">${c.about.body}</p>
          </div>
        </section>

        <section class="section" id="stack-${lang}">
          <div class="container">
            <div class="section__head"><div class="kicker">${c.stack.kicker}</div><h2>${c.stack.title}</h2></div>
            <div class="chips">${c.stack.items.map(item => `<span class="chip">${item}</span>`).join('')}</div>
          </div>
        </section>

        <section class="section" id="projects-${lang}">
          <div class="container">
            <div class="section__head"><div class="kicker">${c.projects.kicker}</div><h2>${c.projects.title}</h2></div>
            <div class="project-list">${projects}</div>
          </div>
        </section>

        <section class="section" id="contacts-${lang}">
          <div class="container">
            <div class="section__head"><div class="kicker">${c.contacts.kicker}</div><h2>${c.contacts.title}</h2></div>
            <div class="contacts__links">
              ${linkOrDisabled(c.contacts.email, contactLinks.email ? `mailto:${contactLinks.email}` : '')}
              ${linkOrDisabled(c.contacts.github, contactLinks.github)}
              ${linkOrDisabled(c.contacts.cv, contactLinks.cv)}
            </div>
            <p class="contact-note">${c.contacts.note}</p>
          </div>
        </section>
      </main>

      <footer class="footer"><div class="container">${c.footer}</div></footer>
    </div>`;
}

function syncGeometry() {
  const pairs = [
    ['.header', '.header'],
    ['.hero', '.hero'],
    ['#about-ru', '#about-en'],
    ['#stack-ru', '#stack-en'],
    ['#projects-ru', '#projects-en'],
    ['#contacts-ru', '#contacts-en'],
    ['.footer', '.footer']
  ];

  const elements = pairs
    .map(([ruSelector, enSelector]) => [ruLayer.querySelector(ruSelector), enLayer.querySelector(enSelector)])
    .filter(([ru, en]) => ru && en);

  // Batch writes, reads, and final writes. Interleaving those operations forces
  // repeated layout passes in Safari, especially after its browser chrome resizes.
  elements.flat().forEach(element => { element.style.minHeight = ''; });
  const heights = elements.map(([ru, en]) => Math.ceil(Math.max(
    ru.getBoundingClientRect().height,
    en.getBoundingClientRect().height,
  )));
  elements.forEach(([ru, en], index) => {
    const height = `${heights[index]}px`;
    ru.style.minHeight = height;
    en.style.minHeight = height;
  });

  updateStageWidth();
  paintCurtain(progress);
}

function scheduleGeometry() {
  if (geometryFrame || dragging) return;
  geometryFrame = requestAnimationFrame(() => {
    geometryFrame = 0;
    syncGeometry();
  });
}

function render() {
  ruLayer.innerHTML = renderPage('ru');
  enLayer.innerHTML = renderPage('en');
  scheduleGeometry();
}

function updateMeta(lang) {
  const meta = siteContent[lang].meta;
  document.title = meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
  root.lang = lang;
}

function updateA11y() {
  const ruActive = activeLang === 'ru';
  ruLayer.toggleAttribute('inert', !ruActive);
  enLayer.toggleAttribute('inert', ruActive);
  ruLayer.setAttribute('aria-hidden', String(!ruActive));
  enLayer.setAttribute('aria-hidden', String(ruActive));
  ruButton.classList.toggle('is-active', ruActive);
  enButton.classList.toggle('is-active', !ruActive);
  ruButton.setAttribute('aria-pressed', String(ruActive));
  enButton.setAttribute('aria-pressed', String(!ruActive));
  enReveal.classList.toggle('is-interactive', !ruActive);
  body.dataset.lang = activeLang;
  skipLink.setAttribute('href', `#main-${activeLang}`);
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
  progress = clamp(p, 0, 1);
  if (!retainPending) pendingProgress = progress;
  const x = progressToDividerX(progress);
  const xValue = `${x.toFixed(3)}px`;
  const inverseXValue = `${(-x).toFixed(3)}px`;
  // Keep a visible divider inside the viewport at the fully closed endpoints.
  // The reveal itself still uses the exact edge coordinate above.
  const dividerX = clamp(x, .5, Math.max(.5, stageWidth - .5));

  // These are local compositor transforms. Do not update an inherited CSS custom
  // property here: that invalidates both full language trees on every pointer frame.
  enReveal.style.transform = `translate3d(${xValue}, 0, 0)`;
  enLayer.style.transform = `translate3d(${inverseXValue}, 0, 0)`;
  divider.style.transform = `translate3d(${dividerX.toFixed(3)}px, 0, 0)`;
  if (Number.isFinite(ghostX)) paintGhostAt(ghostX);
}

function prepareCurtain(targetLang) {
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

function readStoredLanguage() {
  try {
    const value = localStorage.getItem('preferred-language');
    return value === 'ru' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}

function storeLanguage(lang) {
  try {
    localStorage.setItem('preferred-language', lang);
  } catch {
    // Safari private/blocked storage must not interrupt a completed transition.
  }
}

function commitLanguage(lang, { replace = true } = {}) {
  activeLang = lang;
  paintCurtain(lang === 'en' ? 1 : 0);
  updateMeta(lang);
  updateA11y();
  storeLanguage(lang);
  const path = canonicalPath(lang);
  if (location.pathname !== path) {
    history[replace ? 'replaceState' : 'pushState']({ lang }, '', path + location.hash);
  }
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
    commitLanguage(targetLang);
    cleanupCurtain();
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
    commitLanguage(targetLang);
    cleanupCurtain();
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
  dragSource.setPointerCapture?.(pointerId);
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
  const target = Math.abs(velocity) >= FLING_VELOCITY && travelled >= MIN_FLING_TRAVEL_PX
    ? (velocity < 0 ? 1 : 0)
    : ((wasCatchingUp ? pendingProgress : progress) >= .5 ? 1 : 0);

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
  dragTarget = null;
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
  button.addEventListener('pointerdown', event => startDrag(event, targetLang));
  button.addEventListener('lostpointercapture', handleLostPointerCapture);
  button.addEventListener('click', event => {
    if (suppressNextClick) {
      event.preventDefault();
      return;
    }
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
window.addEventListener('popstate', () => {
  cancelMoveFrame();
  cancelAnimationFrame(settleFrame);
  settleFrame = 0;
  cleanupCurtain();
  const lang = location.pathname.startsWith('/en') ? 'en' : 'ru';
  activeLang = lang;
  paintCurtain(lang === 'en' ? 1 : 0);
  updateMeta(lang);
  updateA11y();
});

const routeLang = location.pathname.startsWith('/en') ? 'en' : location.pathname.startsWith('/ru') ? 'ru' : null;
const saved = readStoredLanguage();
activeLang = routeLang ?? saved ?? activeLang;
progress = activeLang === 'en' ? 1 : 0;
pendingProgress = progress;
lastViewportWidth = document.documentElement.clientWidth || window.innerWidth;

render();
updateStageWidth();
paintCurtain(progress);
updateMeta(activeLang);
updateA11y();
if (!routeLang && location.pathname === '/') {
  history.replaceState({ lang: activeLang }, '', canonicalPath(activeLang) + location.hash);
}
if (document.fonts?.ready) {
  document.fonts.ready.then(scheduleGeometry).catch(() => {});
}
