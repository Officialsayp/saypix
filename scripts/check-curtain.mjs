import assert from 'node:assert/strict';
import { curtainFrame, snapProgress } from '../src/curtain-math.js';

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

console.log('Curtain direction and snap checks passed.');
