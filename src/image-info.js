import { LIMITS } from './recipes.js';

export function inspectImage(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 12 || bytes.length > LIMITS.fileBytes) throw new Error('无法识别图片或文件大小超限。');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset, size) => String.fromCharCode(...bytes.subarray(offset, offset + size));
  let width, height, type;
  if (bytes[0] === 137 && ascii(1, 7) === 'PNG\r\n\u001a\n') {
    type = 'image/png';
    if (bytes.length < 33 || view.getUint32(8) !== 13 || ascii(12, 4) !== 'IHDR') throw new Error('PNG 头损坏。');
    width = view.getUint32(16); height = view.getUint32(20);
    let offset = 8, ended = false;
    while (offset + 12 <= bytes.length) {
      const size = view.getUint32(offset), kind = ascii(offset + 4, 4);
      if (offset + size + 12 > bytes.length) throw new Error('PNG 数据截断。');
      if (kind === 'acTL') throw new Error('首版不支持动画 PNG。');
      offset += size + 12;
      if (kind === 'IEND') { ended = true; break; }
    }
    if (!ended) throw new Error('PNG 数据不完整。');
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    type = 'image/jpeg';
    let offset = 2;
    const frames = new Set([0xc0, 0xc1, 0xc2]);
    while (offset < bytes.length) {
      if (bytes[offset++] !== 255) throw new Error('JPEG 段格式无效。');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > bytes.length) throw new Error('JPEG 数据截断。');
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) throw new Error('JPEG 段长度无效。');
      if (frames.has(marker)) {
        if (size < 8) throw new Error('JPEG 尺寸数据截断。');
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break;
      }
      offset += size;
    }
  } else if (ascii(0,4) === 'RIFF' && ascii(8,4) === 'WEBP') {
    type = 'image/webp';
    if (view.getUint32(4,true) + 8 !== bytes.length) throw new Error('WebP 长度无效。');
    const u24 = offset => bytes[offset] | bytes[offset+1] << 8 | bytes[offset+2] << 16;
    let offset = 12, frameWidth, frameHeight, extended = false;
    while (offset + 8 <= bytes.length) {
      const kind = ascii(offset,4), size = view.getUint32(offset+4,true), start = offset + 8;
      if (start + size > bytes.length) throw new Error('WebP 数据截断。');
      if (kind === 'ANIM' || kind === 'ANMF' || kind === 'VP8X' && (bytes[start] & 2)) throw new Error('首版不支持动画 WebP。');
      if (kind === 'VP8X') {
        if (size !== 10 || extended || offset !== 12) throw new Error('WebP 头无效。');
        extended = true;
        width = u24(start+4) + 1; height = u24(start+7) + 1;
      } else if (kind === 'VP8 ') {
        if (frameWidth !== undefined) throw new Error('WebP 帧重复。');
        if (size < 10 || ascii(start+3,3) !== '\u009d\u0001\u002a') throw new Error('WebP 帧无效。');
        frameWidth = view.getUint16(start+6,true) & 0x3fff; frameHeight = view.getUint16(start+8,true) & 0x3fff;
      } else if (kind === 'VP8L') {
        if (frameWidth !== undefined) throw new Error('WebP 帧重复。');
        if (size < 5 || bytes[start] !== 0x2f) throw new Error('WebP 无损帧无效。');
        const bits = view.getUint32(start+1,true);
        frameWidth = (bits & 0x3fff) + 1; frameHeight = (bits >>> 14 & 0x3fff) + 1;
      }
      offset = start + size + (size % 2);
    }
    if (offset !== bytes.length) throw new Error('WebP 尾部数据无效。');
    if (frameWidth === undefined) throw new Error('WebP 缺少图片帧。');
    if (extended && (width !== frameWidth || height !== frameHeight)) throw new Error('WebP 画布与图片帧尺寸不匹配。');
    width = frameWidth; height = frameHeight;
  } else throw new Error('仅支持 JPEG、PNG、静态 WebP；不支持 SVG/GIF。');
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > LIMITS.pixels) throw new Error('图片尺寸无效或超过 1600 万像素。');
  return { type, width, height };
}
