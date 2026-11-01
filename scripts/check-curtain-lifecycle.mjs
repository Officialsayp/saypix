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
  await assertHint(page, true, label);
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

async function beginTouch(page, lang) {
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
  return pointer;
}

async function cancelTouch(page, lang, preview) {
  // Playwright has no cross-browser native pointercancel API. Use one
  // synthetic touch session throughout: mixing cancel with native mouseup
  // would invent a click that a real browser-cancelled pointer never emits.
  const pointer = await beginTouch(page, lang);
  if (preview !== 'none') {
    pointer.clientX = preview === 'micro'
      ? pointer.clientX + (lang === 'ru' ? -3 : 3)
      : page.viewportSize().width * (lang === 'ru' ? .2 : .8);
    await page.locator('body').dispatchEvent('pointermove', pointer);
  }
  await page.locator('body').dispatchEvent('pointercancel', { ...pointer, buttons: 0 });
  await assertIdle(page, lang, `pointercancel ${preview}`);
}

async function flingTouch(page, lang) {
  const pointer = await beginTouch(page, lang);
  // Model a 32ms touch fling. Separate mouse RPCs can take >96ms on CI,
  // which correctly turns the intended fling into a paused snap-back instead.
  await page.evaluate(({ pointer, lang, width }) => {
    const start = performance.now();
    for (const [type, coverage, elapsed] of [
      ['pointermove', .15, 0], ['pointermove', .25, 16], ['pointerup', .25, 32],
    ]) {
      const event = new PointerEvent(type, {
        ...pointer, clientX: width * (lang === 'ru' ? 1 - coverage : coverage),
        buttons: type === 'pointerup' ? 0 : 1,
      });
      Object.defineProperty(event, 'timeStamp', { value: start + elapsed });
      document.body.dispatchEvent(event);
    }
  }, { pointer, lang, width: page.viewportSize().width });
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
      await assertHint(page, true, 'new language document');
      // Sampling the release must still preserve an intentional fast fling.
      await flingTouch(page, other);
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
        await assertHint(page, true, `${mode} initial`);
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
        await assertHint(page, true, `${mode} destination`);
        assert.deepEqual(errors, [], `${engine} ${mode} ${width} ${lang}`);
        await page.close();
        console.log('LANGUAGE_CONTROL_OK', JSON.stringify({ engine, mode, width, lang }));
      }
    }
  }
  // Regression: the most recent click wins while the language animation is
  // pending. Clicking the visible language cancels the opposite transition.
  for (const width of [375, 1512]) {
    for (const lang of ['ru', 'en']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const other = lang === 'ru' ? 'en' : 'ru';
      const errors = [];
      page.on('pageerror', error => errors.push(String(error)));
      try {
        await page.goto(`${origin}/${lang}/`);
        await cancelTouch(page, lang, 'none'); // warm lazy curtain
        await assertIdle(page, lang, 'rapid-toggle warm idle');
        // Clear the intentional same-gesture click suppression introduced by
        // pointercancel. The next click is a new user interaction.
        await page.locator(`[data-lang-target="${lang}"]`).click();
        await assertIdle(page, lang, 'rapid-toggle active click idle');

        // Two clicks in the same task eliminate CI scheduling variation.
        await page.evaluate(({ lang, other }) => {
          const click = target => document.querySelector(`[data-lang-target="${target}"]`)
            .dispatchEvent(new MouseEvent('click', {
              bubbles: true, cancelable: true, button: 0, detail: 1
            }));
          click(other);
          if (!document.body.classList.contains('is-curtain-moving')) {
            throw new Error('First click must begin the opposite-language transition');
          }
          click(lang);
        }, { lang, other });
        await page.waitForTimeout(460);
        await assertIdle(page, lang, 'opposite click canceled before navigation');

        // The previous pointer could lose its terminal event. Starting another
        // gesture must remove the previous drag-source class, never leave it dim.
        await page.evaluate(({ lang, other }) => {
          const at = target => {
            const control = document.querySelector(`[data-lang-target="${target}"]`);
            const box = control.getBoundingClientRect();
            return { control, x: box.x + box.width / 2, y: box.y + box.height / 2 };
          };
          const first = at(other);
          const second = at(lang);
          first.control.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, pointerId: 101, pointerType: 'touch',
            isPrimary: true, button: 0, buttons: 1, clientX: first.x, clientY: first.y
          }));
          second.control.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true, pointerId: 102, pointerType: 'touch',
            isPrimary: true, button: 0, buttons: 1, clientX: second.x, clientY: second.y
          }));
        }, { lang, other });
        await assertIdle(page, lang, 'interrupted pointer capture cleared');

        await page.locator(`[data-lang-target="${other}"]`).click();
        await page.waitForURL(`**/${other}/`);
        await assertLanguageControls(page, other);
        await assertHint(page, true, 'rapid-toggle destination hint');
        assert.equal(await page.locator('.is-drag-source').count(), 0,
          'No language control may remain dim after navigation');
        assert.deepEqual(errors, [], `${engine}: rapid-toggle ${width} ${lang}`);
        console.log('RAPID_LANGUAGE_TOGGLE_OK', JSON.stringify({ engine, width, lang }));
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
