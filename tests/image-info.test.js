import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inspectImage } from '../src/image-info.js';

const sample = name => readFile(new URL(`../examples/${name}`, import.meta.url));
test('recognizes real PNG, JPEG and WebP by content, not extensions', async () => {
  for (const [name, type, width, height] of [['product.png', 'image/png', 1200, 800], ['portrait.jpg', 'image/jpeg', 720, 1200], ['mark.webp', 'image/webp', 512, 512]]) {
    assert.deepEqual(inspectImage(await sample(name)), { type, width, height });
  }
});
test('rejects SVG, GIF and truncated or unknown content', () => {
  for (const value of ['<svg/>', 'GIF89a', '', 'RIFF']) assert.throws(() => inspectImage(new TextEncoder().encode(value)));
});
test('rejects huge dimensions from a PNG header before decoding', async () => {
  const bytes = new Uint8Array(await sample('product.png'));
  new DataView(bytes.buffer).setUint32(16, 20001);
  assert.throws(() => inspectImage(bytes), /像素|尺寸/);
});
test('rejects APNG animation chunks', async () => {
  const bytes = await sample('product.png');
  const animation = Buffer.from([0,0,0,8,97,99,84,76,0,0,0,2,0,0,0,0,0,0,0,0]);
  assert.throws(() => inspectImage(Buffer.concat([bytes.subarray(0,33), animation, bytes.subarray(33)])), /动画/);
});
test('rejects animated extended WebP and truncated chunk lengths', () => {
  const bytes = Buffer.alloc(30);
  bytes.write('RIFF'); bytes.writeUInt32LE(22,4); bytes.write('WEBP',8); bytes.write('VP8X',12);
  bytes.writeUInt32LE(10,16); bytes[20] = 2;
  assert.throws(() => inspectImage(bytes), /动画/);
  bytes[20] = 0; bytes.writeUInt32LE(1000,16);
  assert.throws(() => inspectImage(bytes));
});
test('extended WebP must contain a real frame with matching dimensions', async () => {
  const source = await sample('mark.webp');
  const extended = Buffer.alloc(18);
  extended.write('VP8X'); extended.writeUInt32LE(10,4);
  const combined = Buffer.concat([source.subarray(0,12),extended,source.subarray(12)]);
  combined.writeUInt32LE(combined.length-8,4);
  assert.throws(() => inspectImage(combined), /尺寸|匹配/);
  const headerOnly = combined.subarray(0,30);
  headerOnly.writeUInt32LE(22,4);
  assert.throws(() => inspectImage(headerOnly), /帧/);
});
