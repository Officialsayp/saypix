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

const DRAG_START_PX = 4;
const MIN_FLING_TRAVEL_PX = 64;
const MIN_FLING_TRAVEL_RATIO = .12;
const FLING_VELOCITY = 1.1;
const VELOCITY_WINDOW_MS = 80;
const GHOST_WIDTH = 48;
const GHOST_HALF_WIDTH = GHOST_WIDTH / 2;

let activeLang = root.dataset.initialLang === 'en' ? 'en' : 'ru';
let progress = activeLang === 'en' ? 1 : 0; // 0 = RU, 1 = EN
let dragging = false;
let dragTarget = null;
let pointerId = null;
let dragSource = null;
let dragSamples = [];
let settleFrame = 0;
let geometryFrame = 0;
let dragOriginX = 0;
let dragOriginY = 0;
let dragMoved = false;
let dragGrabOffset = GHOST_HALF_WIDTH;
let stageWidth = 1;
let stageLeft = 0;
let lastViewportWidth = 0;
let suppressNextClick = false;
let suppressClickTimer = 0;

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
  stageLeft = stageRect.left;
  return stageWidth;
}

function progressAtClientX(clientX) {
  const localX = clamp(clientX - stageLeft, 0, stageWidth);
  return clamp(1 - (localX / stageWidth), 0, 1);
}

function progressToDividerX(p) {
  return (1 - p) * stageWidth;
}

function paintGhostAt(clientX) {
  // Preserve the point at which the user grabbed the language pill. This
  // avoids the old visual jump where the pill was re-centred under the cursor.
  const maxLeft = Math.max(0, stageWidth - GHOST_WIDTH);
  const left = clamp(clientX - stageLeft - dragGrabOffset, 0, maxLeft);
  ghost.style.transform = `translate3d(${left.toFixed(3)}px, 0, 0)`;
}

function paintCurtain(p) {
  progress = clamp(p, 0, 1);
  const x = progressToDividerX(progress);
  const xValue = `${x.toFixed(3)}px`;
  const inverseXValue = `${(-x).toFixed(3)}px`;

  // These are local compositor transforms. Do not update an inherited CSS custom
  // property here: that invalidates both full language trees on every pointer frame.
  enReveal.style.transform = `translate3d(${xValue}, 0, 0)`;
  enLayer.style.transform = `translate3d(${inverseXValue}, 0, 0)`;
  divider.style.transform = `translate3d(${xValue}, 0, 0)`;
}

function paintCurtainAt(clientX) {
  paintCurtain(progressAtClientX(clientX));
}

function prepareCurtain(targetLang) {
  const label = targetLang.toUpperCase();
  if (ghost.textContent !== label) ghost.textContent = label;
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
  body.classList.remove('is-curtain-moving');
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

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function latestPointerSample(event) {
  const samples = event.getCoalescedEvents?.();
  return samples?.at(-1) ?? event;
}

function recordPointerSamples(event) {
  const samples = event.getCoalescedEvents?.() || [event];
  for (const sample of samples) {
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

function finishPointerSession() {
  const source = dragSource;
  const capturedPointerId = pointerId;
  dragging = false;
  pointerId = null;
  dragSource = null;
  dragSamples = [];
  dragGrabOffset = GHOST_HALF_WIDTH;
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

function animateTo(target, { duration } = {}) {
  cancelAnimationFrame(settleFrame);
  settleFrame = 0;
  const start = progress;
  const distance = Math.abs(target - start);
  const targetLang = target >= .5 ? 'en' : 'ru';
  showCurtain(dragTarget ?? targetLang, { showGhost: false });

  if (reducedMotion.matches || distance < 0.002) {
    paintCurtain(target);
    commitLanguage(targetLang);
    cleanupCurtain();
    return;
  }

  const startTime = performance.now();
  const ms = duration ?? clamp(120 + distance * 180, 140, 300);
  const tick = now => {
    const t = clamp((now - startTime) / ms, 0, 1);
    paintCurtain(start + (target - start) * easeOutCubic(t));
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

function isActiveDragEvent(event) {
  return dragging && event.pointerId === pointerId;
}

function startDrag(event, targetLang) {
  if (targetLang === activeLang) return;
  if (event.isPrimary === false) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  const source = event.currentTarget;
  if (!source) return;

  cancelAnimationFrame(settleFrame);
  settleFrame = 0;
  hideCurtain();
  updateStageWidth();

  dragging = true;
  dragTarget = targetLang;
  pointerId = event.pointerId;
  dragSource = source;
  dragOriginX = event.clientX;
  dragOriginY = event.clientY;
  dragMoved = false;
  const sourceRect = source.getBoundingClientRect();
  dragGrabOffset = clamp(event.clientX - sourceRect.left, 0, sourceRect.width);
  dragSamples = [];
  recordPointerSamples(event);
  source.classList.add('is-drag-source');

  // A direct-manipulation slider must be under the pointer immediately. There
  // is intentionally no rAF queue, speed cap, or "catch up from the edge".
  showCurtain(targetLang, { showGhost: true });
  paintCurtainAt(event.clientX);
  paintGhostAt(event.clientX);
  source.setPointerCapture?.(pointerId);
}

function moveDrag(event) {
  if (!isActiveDragEvent(event)) return;
  const point = latestPointerSample(event);
  const horizontalDistance = Math.abs(point.clientX - dragOriginX);
  const verticalDistance = Math.abs(point.clientY - dragOriginY);

  if (!dragMoved && verticalDistance > horizontalDistance && verticalDistance >= DRAG_START_PX) {
    cancelDrag(event);
    return;
  }

  // Render synchronously inside the input task. Only transform writes occur
  // here, with no layout reads and no interpolation between pointer samples.
  recordPointerSamples(event);
  paintCurtainAt(point.clientX);
  paintGhostAt(point.clientX);
  if (horizontalDistance >= DRAG_START_PX && horizontalDistance >= verticalDistance) {
    dragMoved = true;
    if (event.cancelable) event.preventDefault();
  }
}

function endPointerSession(event) {
  if (!isActiveDragEvent(event)) return;
  const point = latestPointerSample(event);
  const horizontalDistance = Math.abs(point.clientX - dragOriginX);
  const verticalDistance = Math.abs(point.clientY - dragOriginY);
  if (!dragMoved && horizontalDistance >= DRAG_START_PX && horizontalDistance >= verticalDistance) {
    dragMoved = true;
  }

  const targetLang = dragTarget;
  if (!dragMoved) {
    ghost.classList.remove('is-visible');
    finishPointerSession();
    suppressOneClick();
    animateTo(targetLang === 'en' ? 1 : 0);
    return;
  }

  recordPointerSamples(event);
  paintCurtainAt(point.clientX);
  paintGhostAt(point.clientX);
  const velocity = currentVelocity();
  const travelled = Math.abs(point.clientX - dragOriginX);
  const minFlingTravel = Math.max(MIN_FLING_TRAVEL_PX, stageWidth * MIN_FLING_TRAVEL_RATIO);
  const target = Math.abs(velocity) >= FLING_VELOCITY && travelled >= minFlingTravel
    ? (velocity < 0 ? 1 : 0)
    : (progress >= .5 ? 1 : 0);

  ghost.classList.remove('is-visible');
  finishPointerSession();
  suppressOneClick();
  animateTo(target);
}

function cancelDrag(event) {
  if (!isActiveDragEvent(event)) return;
  ghost.classList.remove('is-visible');
  finishPointerSession();
  dragTarget = null;
  suppressOneClick();
  animateTo(activeLang === 'en' ? 1 : 0);
}

function handleLostPointerCapture(event) {
  if (isActiveDragEvent(event)) cancelDrag(event);
}

function suppressOneClick() {
  suppressNextClick = true;
  window.clearTimeout(suppressClickTimer);
  suppressClickTimer = window.setTimeout(() => {
    suppressNextClick = false;
    suppressClickTimer = 0;
  }, 700);
}

function switchByClick(targetLang) {
  if (targetLang === activeLang || dragging) return;
  dragTarget = targetLang;
  animateTo(targetLang === 'en' ? 1 : 0);
}

for (const button of [ruButton, enButton]) {
  const targetLang = button.dataset.langTarget;
  button.addEventListener('pointerdown', event => startDrag(event, targetLang));
  button.addEventListener('pointermove', moveDrag, { passive: false });
  button.addEventListener('pointerup', endPointerSession);
  button.addEventListener('pointercancel', cancelDrag);
  button.addEventListener('lostpointercapture', handleLostPointerCapture);
  button.addEventListener('click', event => {
    if (suppressNextClick) {
      suppressNextClick = false;
      window.clearTimeout(suppressClickTimer);
      suppressClickTimer = 0;
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
    cancelAnimationFrame(settleFrame);
    settleFrame = 0;
    finishPointerSession();
    paintCurtain(activeLang === 'en' ? 1 : 0);
    cleanupCurtain();
  }
  scheduleGeometry();
});
window.addEventListener('popstate', () => {
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
