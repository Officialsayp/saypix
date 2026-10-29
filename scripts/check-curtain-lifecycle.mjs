// Browser regression for cancelled drags, hints and the current-language control.
import assert from 'node:assert/strict';

const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const browser = await pw[engine].launch({
  headless: true,
  ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
});
const origin = process.env.BASE_URL || 'http://127.0.0.1:4173';

async function assertLanguageControls(page, lang) {
  const controls = await page.locator('.language-edge').evaluateAll(links => links.map(link => ({
    lang: link.dataset.langTarget,
    current: link.getAttribute('aria-current'),
    background: getComputedStyle(link).backgroundColor,
    cursor: getComputedStyle(link).cursor,
    pressed: link.matches(':active'),
  })));
  const current = controls.find(control => control.lang === lang);
  const other = controls.find(control => control.lang !== lang);
  assert.equal(current.current, 'page');
  assert.equal(other.current, null);
  assert.notEqual(current.background, other.background, 'Current language needs a distinct fill before lazy setup');
  assert.equal(current.cursor, 'default');
  assert.equal(other.cursor, other.pressed ? 'grabbing' : 'grab');
}

async function assertHint(page, visible, label) {
  await page.waitForFunction(expected => {
    const style = getComputedStyle(document.querySelector('.drag-hint'));
    return expected
      ? style.display !== 'none' && Number(style.opacity) >= .79
      : style.display === 'none' || Number(style.opacity) <= .01;
  }, visible, { timeout: 4000 }).catch(async () => {
    const state = await page.locator('.drag-hint').evaluate(hint => ({
      display: getComputedStyle(hint).display,
      opacity: getComputedStyle(hint).opacity,
      body: document.body.className,
    }));
    assert.fail(`${engine}: ${label}: hint visible=${visible}: ${JSON.stringify(state)}`);
  });
}

async function assertIdle(page, lang, label) {
  await page.waitForFunction(() =>
    !document.querySelector('.curtain-divider.is-visible, .language-ghost.is-visible, .is-drag-source')
    && !document.body.matches('.is-curtain-moving, .is-curtain-prepared'));
  assert.equal(new URL(page.url()).pathname, `/${lang}/`, label);
  assert.equal(await page.locator('html').getAttribute('lang'), lang, label);
  assert.equal(await page.evaluate(() => localStorage.getItem('preferred-language')), null, label);
  await assertLanguageControls(page, lang);
  await assertHint(page, page.viewportSize().width > 1450, label);
}

async function beginDrag(page, targetLang) {
  const control = page.locator(`[data-lang-target="${targetLang}"]`);
  const box = await control.boundingBox();
  const grip = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.waitForFunction(() => document.querySelector('.is-drag-source')
    && document.querySelector('[data-layer="curtain"] .page'));
  return grip;
}

async function moveToCoverage(page, lang, coverage, y) {
  const x = page.viewportSize().width * (lang === 'ru' ? 1 - coverage : coverage);
  await page.mouse.move(x, y, { steps: 1 });
}

// Release the driver's mouse outside a link after capture loss or resizing.
async function releaseCancelledMouse(page) {
  await page.mouse.move(page.viewportSize().width / 2, 300);
  await page.mouse.up();
}

async function cancelTouch(page, lang, preview) {
  // Playwright has no cross-browser native pointercancel API. Use one
  // synthetic touch session throughout: mixing cancel with native mouseup
  // would invent a click that a real browser-cancelled pointer never emits.
  const other = lang === 'ru' ? 'en' : 'ru';
  const control = page.locator(`[data-lang-target="${other}"]`);
  const box = await control.boundingBox();
  const pointer = {
    pointerId: 100, pointerType: 'touch', isPrimary: true,
    button: 0, buttons: 1, bubbles: true,
    clientX: box.x + box.width / 2, clientY: box.y + box.height / 2,
  };
  await control.dispatchEvent('pointerdown', pointer);
  await page.waitForFunction(() => document.querySelector('.is-drag-source'));
  if (preview !== 'none') {
    pointer.clientX = preview === 'micro'
      ? pointer.clientX + (lang === 'ru' ? -3 : 3)
      : page.viewportSize().width * (lang === 'ru' ? .2 : .8);
    await page.locator('body').dispatchEvent('pointermove', pointer);
  }
  await page.locator('body').dispatchEvent('pointercancel', { ...pointer, buttons: 0 });
  await assertIdle(page, lang, `pointercancel ${preview}`);
}

try {
  for (const width of [1512, 1920, 375]) {
    for (const lang of ['ru', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      await page.addInitScript(() => {
        window.addEventListener('pointerdown', event => {
          window.testPointerId = event.pointerId;
        }, true);
      });
      await page.goto(`${origin}/${lang}/`);
      const other = lang === 'ru' ? 'en' : 'ru';
      await assertIdle(page, lang, 'initial page');

      // Same document, cold first gesture, then repeated warm gestures. Crossing
      // the midpoint is only a preview: returning before release must not commit.
      for (let attempt = 0; attempt < 2; attempt++) {
        const grip = await beginDrag(page, other);
        await moveToCoverage(page, lang, .8, grip.y);
        await assertHint(page, false, 'drag preview');
        await page.mouse.move(grip.x, grip.y, { steps: 1 });
        await page.mouse.up();
        await assertIdle(page, lang, `return to origin ${attempt}`);
      }

      let grip = await beginDrag(page, other);
      await moveToCoverage(page, lang, .25, grip.y);
      // Exceed the 96ms velocity window to test snap, not a successful fling.
      await page.waitForTimeout(140);
      await page.mouse.up();
      await assertIdle(page, lang, 'below switching threshold');

      for (const preview of ['none', 'micro', 'past-threshold']) {
        await cancelTouch(page, lang, preview);
      }

      grip = await beginDrag(page, other);
      await moveToCoverage(page, lang, .8, grip.y);
      await page.locator(`[data-lang-target="${other}"]`).evaluate(control => {
        if (!control.hasPointerCapture(window.testPointerId)) throw new Error('No pointer capture');
        control.releasePointerCapture(window.testPointerId);
      });
      // The next native move makes the browser deliver lostpointercapture.
      await page.mouse.move(page.viewportSize().width / 2, grip.y);
      await page.waitForFunction(() => !document.querySelector('.is-drag-source'));
      await assertIdle(page, lang, 'lostpointercapture before release');
      await releaseCancelledMouse(page);
      await assertIdle(page, lang, 'lostpointercapture');

      grip = await beginDrag(page, other);
      const microX = grip.x + (lang === 'ru' ? -3 : 3);
      await page.mouse.move(microX, grip.y);
      await page.mouse.move(microX, grip.y + 40);
      await page.mouse.up();
      await assertIdle(page, lang, 'vertical abandonment after horizontal preview');

      grip = await beginDrag(page, other);
      await moveToCoverage(page, lang, .3, grip.y);
      await page.setViewportSize({ width: width === 375 ? 1512 : width + 40, height: 900 });
      // WebKit delivers resize asynchronously after the viewport command.
      await page.waitForFunction(() => !document.querySelector('.is-drag-source'));
      await releaseCancelledMouse(page);
      await assertIdle(page, lang, 'resize during drag');
      await page.setViewportSize({ width, height: 900 });

      // A fresh successful drag after every cancellation must still navigate.
      grip = await beginDrag(page, other);
      await moveToCoverage(page, lang, .8, grip.y);
      await assertHint(page, false, 'successful drag preview');
      await page.mouse.up();
      await page.waitForURL(`**/${other}/`);
      assert.equal(await page.locator('html').getAttribute('lang'), other);
      assert.equal(await page.evaluate(() => localStorage.getItem('preferred-language')), other);
      await assertLanguageControls(page, other);
      await assertHint(page, width > 1450, 'new language document');
      // Sampling the release must still preserve an intentional fast fling.
      grip = await beginDrag(page, lang);
      await moveToCoverage(page, other, .15, grip.y);
      await moveToCoverage(page, other, .25, grip.y);
      await page.mouse.up();
      await page.waitForURL(`**/${lang}/`);
      await assertLanguageControls(page, lang);
      assert.equal(await page.evaluate(() => localStorage.getItem('preferred-language')), lang);
      assert.deepEqual(errors, [], `${engine} ${width} ${lang}`);
      await page.close();
      console.log('LIFECYCLE_OK', JSON.stringify({ engine, width, lang, cancellations: 9 }));
    }
  }

  // The same indication must work without loading the curtain, and an ordinary
  // click or keyboard activation must transfer it to the newly loaded document.
  for (const mode of ['click', 'keyboard', 'reduced-motion', 'no-js']) {
    for (const width of [375, 1512]) {
      for (const lang of ['ru', 'en']) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
          javaScriptEnabled: mode !== 'no-js',
          reducedMotion: mode === 'reduced-motion' ? 'reduce' : 'no-preference',
        });
        const errors = [];
        page.on('pageerror', error => errors.push(String(error)));
        await page.goto(`${origin}/${lang}/`);
        const other = lang === 'ru' ? 'en' : 'ru';
        await assertLanguageControls(page, lang);
        await assertHint(page, width > 1450, `${mode} initial`);
        if (mode === 'click' || mode === 'keyboard') {
          await cancelTouch(page, lang, 'past-threshold');
        }
        if (mode === 'keyboard') {
          const control = page.locator(`[data-lang-target="${other}"]`);
          // macOS WebKit's default keyboard policy reaches links with Option+Tab.
          const tabKey = engine === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
          for (let tab = 0; tab < 3; tab++) {
            await page.keyboard.press(tabKey);
            if (await control.evaluate(link => link === document.activeElement)) break;
          }
          assert.ok(await control.evaluate(link => link.matches(':focus-visible')
            && getComputedStyle(link).outlineStyle !== 'none'));
          await page.keyboard.press('Enter');
        } else {
          await page.locator(`[data-lang-target="${other}"]`).click();
        }
        await page.waitForURL(`**/${other}/`);
        await assertLanguageControls(page, other);
        await assertHint(page, width > 1450, `${mode} destination`);
        assert.deepEqual(errors, [], `${engine} ${mode} ${width} ${lang}`);
        await page.close();
        console.log('LANGUAGE_CONTROL_OK', JSON.stringify({ engine, mode, width, lang }));
      }
    }
  }
} finally {
  await browser.close();
}
