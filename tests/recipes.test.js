import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRecipe, fitImage, outputName, validateBatch } from '../src/recipes.js';

const variant = { label: '商品图', width: 800, height: 800, format: 'jpeg', quality: 0.85, maxKB: 300, upscale: false };
test('recipe validates and normalizes only explicit supported settings', () => {
  const value = validateRecipe({ name: ' 商品配方 ', variants: [variant], ignored: 'secret' });
  assert.equal(value.name, '商品配方');
  assert.equal(value.ignored, undefined);
  assert.equal(value.variants[0].width, 800);
});
for (const [name, change] of [
  ['small width', { width: 0 }], ['fractional size', { width: 80.5 }],
  ['large width', { width: 4097 }], ['large pixel count', { width: 4096, height: 4096 }],
  ['unknown format', { format: 'svg' }], ['quality zero', { quality: 0 }],
  ['quality above one', { quality: 2 }], ['invalid size limit', { maxKB: -1 }],
  ['nonboolean upscale', { upscale: 'false' }], ['blank label', { label: '' }]
]) test(`recipe rejects ${name}`, () => assert.throws(() => validateRecipe({ name: 'a', variants: [{ ...variant, ...change }] })));
test('recipe rejects empty and excessive variants and duplicate normalized labels', () => {
  for (const variants of [[], Array(6).fill(variant), [variant, { ...variant, label: ' 商品图 ' }]]) {
    assert.throws(() => validateRecipe({ name: 'a', variants }));
  }
});
test('landscape picture stays centered with exact target canvas and no distortion', () => {
  assert.deepEqual(fitImage(1200, 800, variant), { width: 800, height: 533, x: 0, y: 133 });
});
test('small picture is not enlarged unless explicitly requested', () => {
  assert.deepEqual(fitImage(200, 100, variant), { width: 200, height: 100, x: 300, y: 350 });
  assert.deepEqual(fitImage(200, 100, { ...variant, upscale: true }), { width: 800, height: 400, x: 0, y: 200 });
});
test('invalid source dimensions fail instead of allocating a canvas', () => {
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => fitImage(value, 100, variant));
});
test('filenames preserve Unicode and leading zeros with deterministic collision-free indices', () => {
  assert.equal(outputName('001 商品.png', '商品图', 1, 'webp'), '001_001 商品_商品图.webp');
  assert.notEqual(outputName('a.png', 'x', 1, 'jpeg'), outputName('a.jpg', 'x', 2, 'jpeg'));
});
test('source index is the first filename component so source and label text cannot collide', () => {
  const left = outputName('a.png', 'x_002_y', 1, 'jpeg');
  const right = outputName('a_001_x.png', 'y', 2, 'jpeg');
  assert.notEqual(left, right);
  assert.match(left, /^001_/u);
  assert.match(right, /^002_/u);
});
test('filenames neutralize paths, control characters and Windows device names', () => {
  const name = outputName('../CON.jpg', '..\\NUL\u0000', 1, 'jpeg');
  assert.doesNotMatch(name, /[<>:"/\\|?*\x00-\x1f\x7f]/u);
  assert.ok(!name.startsWith('.'));
  assert.match(outputName('CON.jpg', 'x', 1, 'jpeg'), /^001__CON/);
  assert.throws(() => outputName('a', 'b', 1, 'svg'));
});
test('batch bounds protect input memory before reading any files', () => {
  validateBatch([{ size: 10 }]);
  for (const files of [[], Array(21).fill({ size: 1 }), [{ size: 10 * 1024 ** 2 + 1 }], Array(6).fill({ size: 10 * 1024 ** 2 })]) {
    assert.throws(() => validateBatch(files));
  }
});
test('long Unicode input names remain portable ZIP filenames', () => {
  const name = outputName('图'.repeat(80) + '.png', '图'.repeat(32), 1, 'webp');
  assert.ok(new TextEncoder().encode(name).length <= 240);
});
