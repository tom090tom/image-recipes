import { LIMITS } from './recipes.js';

const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let i = 0; i < 8; i++) value = value & 1 ? 0xedb88320 ^ value >>> 1 : value >>> 1;
  return value >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
  return (crc ^ 0xffffffff) >>> 0;
}

export function createZip(entries) {
  if (!Array.isArray(entries) || entries.length < 1 || entries.length > 100) throw new Error('ZIP 需包含 1–100 个文件。');
  const names = new Set();
  let payload = 0;
  const records = entries.map(({ name, data }) => {
    if (typeof name !== 'string' || !name || name.startsWith('.') || /[<>:"/\\|?*\x00-\x1f\x7f]|[. ]$/u.test(name)
      || /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/iu.test(name)) throw new Error('ZIP 文件名不安全。');
    const key = name.normalize('NFC').toLocaleLowerCase('en-US');
    if (names.has(key)) throw new Error('ZIP 文件名重复。');
    names.add(key);
    if (!(data instanceof Uint8Array)) throw new Error('ZIP 只接受字节数据。');
    payload += data.byteLength;
    if (payload > LIMITS.outputBytes) throw new Error('导出总大小超过 100 MiB。');
    const encoded = encoder.encode(name);
    if (encoded.length > 240) throw new Error('ZIP 文件名过长。');
    return { data, name: encoded, crc: crc32(data), offset: 0 };
  });
  const localSize = records.reduce((size, r) => size + 30 + r.name.length + r.data.length, 0);
  const centralSize = records.reduce((size, r) => size + 46 + r.name.length, 0);
  const bytes = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(bytes.buffer);
  const u16 = (offset,value) => view.setUint16(offset,value,true);
  const u32 = (offset,value) => view.setUint32(offset,value,true);
  let offset = 0;
  for (const r of records) {
    r.offset = offset;
    u32(offset,0x04034b50); u16(offset+4,20); u16(offset+6,0x800);
    u16(offset+12,0x2821); // Stable 2000-01-01 date, not source metadata.
    u32(offset+14,r.crc); u32(offset+18,r.data.length); u32(offset+22,r.data.length); u16(offset+26,r.name.length);
    bytes.set(r.name,offset+30); bytes.set(r.data,offset+30+r.name.length);
    offset += 30 + r.name.length + r.data.length;
  }
  for (const r of records) {
    u32(offset,0x02014b50); u16(offset+4,20); u16(offset+6,20); u16(offset+8,0x800); u16(offset+14,0x2821);
    u32(offset+16,r.crc); u32(offset+20,r.data.length); u32(offset+24,r.data.length); u16(offset+28,r.name.length); u32(offset+42,r.offset);
    bytes.set(r.name,offset+46); offset += 46 + r.name.length;
  }
  u32(offset,0x06054b50); u16(offset+8,records.length); u16(offset+10,records.length); u32(offset+12,centralSize); u32(offset+16,localSize);
  return bytes;
}
