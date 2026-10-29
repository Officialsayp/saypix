import assert from 'node:assert/strict';
import { curtainFrame, snapProgress, pointerProgress } from '../src/curtain-math.js';

const width = 1000;
const snap = (progress, targetLang, velocity = 0, travelled = 300) => snapProgress({
  progress,
  targetLang,
  velocity,
  travelled,
  flingVelocity: 0.45,
  minimumFlingTravel: 12,
});

assert.deepEqual(curtainFrame(0, width, 'en'), {
  progress: 0,
  dividerPosition: 1000,
  revealX: 1000,
  layerX: -1000,
});
assert.deepEqual(curtainFrame(1, width, 'en'), {
  progress: 1,
  dividerPosition: 0,
  revealX: 0,
  layerX: 0,
});
assert.deepEqual(curtainFrame(1, width, 'ru'), {
  progress: 1,
  dividerPosition: 0,
  revealX: -1000,
  layerX: 1000,
});
assert.deepEqual(curtainFrame(0, width, 'ru'), {
  progress: 0,
  dividerPosition: 1000,
  revealX: 0,
  layerX: 0,
});

for (const coverage of [0.2, 0.4]) {
  assert.equal(snap(coverage, 'en'), 0, `RU → EN must return at ${coverage * 100}%`);
  assert.equal(snap(1 - coverage, 'ru'), 1, `EN → RU must return at ${coverage * 100}%`);
}
for (const coverage of [0.6, 0.8]) {
  assert.equal(snap(coverage, 'en'), 1, `RU → EN must commit at ${coverage * 100}%`);
  assert.equal(snap(1 - coverage, 'ru'), 0, `EN → RU must commit at ${coverage * 100}%`);
}

assert.equal(snap(0.5, 'en'), 1, 'RU → EN must commit at exactly 50%');
assert.equal(snap(0.5, 'ru'), 0, 'EN → RU must commit at exactly 50%');
assert.equal(snap(0.2, 'en', -0.5, 20), 1, 'left fling must commit EN');
assert.equal(snap(0.8, 'ru', 0.5, 20), 0, 'right fling must commit RU');
assert.equal(snap(0.2, 'en', -0.5, 5), 0, 'short movement must not count as a fling');

// Direct tracking: neither drag origin nor selected-language control affects X.
for (const [clientX,left,width,expected] of [
  [0,0,1000,1], [500,0,1000,.5], [1000,0,1000,0],
  [200,100,1000,.9], [600,100,1000,.5], [1300,100,1000,0],
  [-50,0,1000,1], [2050,0,1000,0],
]) {
  assert.ok(Math.abs(pointerProgress(clientX,left,width)-expected)<1e-10,
    `pointer ${clientX} with stage ${left}/${width} should produce ${expected}`);
}
for (const width of [320,375,768,1512,1920]) {
  for (let x=0;x<=width;x+=17) {
    const p=pointerProgress(x,0,width);
    assert.ok(Math.abs((1-p)*width-x)<1e-8,
      `pointer ${x} px must map to the divider itself on ${width} px screens`);
  }
}
console.log('Curtain direction, snap and direct pointer tracking checks passed.');
