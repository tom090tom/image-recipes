import test from 'node:test';
import assert from 'node:assert/strict';
import { createZip } from '../src/zip.js';

test('writes UTF-8 STORE archive with real file content and standard CRC32', () => {
  const bytes = createZip([{ name: '商品_001.txt', data: new TextEncoder().encode('123456789') }]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0,true), 0x04034b50);
  assert.equal(view.getUint16(6,true), 0x800);
  assert.equal(view.getUint16(8,true), 0);
  assert.equal(view.getUint32(14,true), 0xcbf43926);
  assert.equal(view.getUint32(bytes.length-22,true), 0x06054b50);
  const length = view.getUint16(26,true);
  assert.equal(new TextDecoder().decode(bytes.slice(30,30+length)), '商品_001.txt');
  assert.equal(new TextDecoder().decode(bytes.slice(30+length,30+length+9)), '123456789');
});
test('archive refuses traversal, ambiguous paths, device names and duplicate filenames', () => {
  for (const name of ['../x', '/x', 'a\\b', '..', 'a/b', 'x\u0000y', 'CON', 'NUL.txt', 'x.', 'x ']) {
    assert.throws(() => createZip([{ name, data: new Uint8Array(1) }]));
  }
  assert.throws(() => createZip(['a.png','A.png'].map(name => ({ name, data: new Uint8Array(1) }))));
});
test('archive refuses empty batches, oversized entries and nonbyte data', () => {
  assert.throws(() => createZip([]));
  assert.throws(() => createZip([{ name: 'x', data: 'not bytes' }]));
  assert.throws(() => createZip([{ name: 'x', data: new Uint8Array(100 * 1024 ** 2 + 1) }]));
});
