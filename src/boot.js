const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const languageLinks = [...document.querySelectorAll('[data-lang-target]')];

let curtainApi = null;
let curtainLoad = null;
let pendingSession = null;

function updatePageTopState() {
  root.classList.toggle('is-page-top', window.scrollY <= 24);
}

updatePageTopState();
requestAnimationFrame(updatePageTopState);
window.addEventListener('scroll', updatePageTopState, { passive: true });
window.addEventListener('pageshow', updatePageTopState);

function pointerSnapshot(event) {
  return {
    pointerId: event.pointerId,
    pointerType: event.pointerType || '',
    clientX: event.clientX,
    clientY: event.clientY,
    timeStamp: Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now(),
  };
}

function loadCurtain() {
  if (curtainApi) return Promise.resolve(curtainApi);
  if (curtainLoad) return curtainLoad;

  const fragmentUrl = root.dataset.curtainFragment;
  if (!fragmentUrl) return Promise.resolve(null);

  curtainLoad = Promise.all([
    import('./curtain.js'),
    fetch(fragmentUrl, { credentials: 'same-origin' }).then(response => {
      if (!response.ok) throw new Error(`Curtain fragment returned ${response.status}`);
      return response.text();
    }),
  ])
    .then(([module, fragmentHtml]) => {
      curtainApi = module.installCurtain(fragmentHtml);
      return curtainApi;
    })
    .catch(error => {
      console.warn('Language curtain unavailable; using normal links.', error);
      curtainLoad = null;
      return null;
    });

  return curtainLoad;
}

function stopPendingSession(session) {
  window.removeEventListener('pointermove', session.onMove);
  window.removeEventListener('pointerup', session.onEnd);
  window.removeEventListener('pointercancel', session.onEnd);
  if (pendingSession === session) pendingSession = null;
}

function queueFirstPointer(event, targetLang) {
  if (curtainApi || pendingSession || reducedMotion.matches) return;
  if (targetLang === root.dataset.initialLang || event.isPrimary === false) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;

  const session = {
    targetLang,
    pointerId: event.pointerId,
    down: pointerSnapshot(event),
    current: pointerSnapshot(event),
    ended: false,
  };
  session.onMove = moveEvent => {
    if (moveEvent.pointerId === session.pointerId) session.current = pointerSnapshot(moveEvent);
  };
  session.onEnd = endEvent => {
    if (endEvent.pointerId !== session.pointerId) return;
    session.current = pointerSnapshot(endEvent);
    session.ended = true;
    if (session.started && curtainApi) {
      curtainApi.endQueuedDrag(session, endEvent.type === 'pointercancel');
    }
    stopPendingSession(session);
  };
  pendingSession = session;

  window.addEventListener('pointermove', session.onMove, { passive: true });
  window.addEventListener('pointerup', session.onEnd);
  window.addEventListener('pointercancel', session.onEnd);

  loadCurtain().then(api => {
    if (!api || session.ended || pendingSession !== session) return;
    session.started = true;
    api.startQueuedDrag(session);
  });
}

for (const link of languageLinks) {
  link.addEventListener('dragstart', event => event.preventDefault());

  const targetLang = link.dataset.langTarget;
  const warm = () => {
    if (targetLang !== root.dataset.initialLang && !reducedMotion.matches) loadCurtain();
  };

  link.addEventListener('pointerenter', warm, { once: true });
  link.addEventListener('focus', warm, { once: true });
  link.addEventListener('pointerdown', event => queueFirstPointer(event, targetLang));
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-copy-code]');
  if (!button) return;
  const text = button.nextElementSibling.innerText.replace(/\xa0/g, ' ');
  navigator.clipboard.writeText(text).then(() => {
    button.classList.add('is-copied');
    setTimeout(() => button.classList.remove('is-copied'), 1000);
  }).catch(() => {});
});
