export const LIMITS = Object.freeze({ files: 20, fileBytes: 10 * 1024 ** 2, batchBytes: 50 * 1024 ** 2, pixels: 16_000_000, outputBytes: 100 * 1024 ** 2 });
const formats = new Set(['jpeg', 'png', 'webp']);
const reserved = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(?:\.|$)/iu;
export const DEFAULT_RECIPE = {
  name: '商品与社媒示例',
  variants: [
    { label: 'square', width: 1200, height: 1200, format: 'jpeg', quality: 0.85, maxKB: 300, upscale: false },
    { label: 'compact', width: 800, height: 800, format: 'webp', quality: 0.8, maxKB: 200, upscale: false },
    { label: 'cover', width: 1600, height: 900, format: 'jpeg', quality: 0.85, maxKB: 500, upscale: false }
  ]
};

function text(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${label}需为 1–${max} 个字符。`);
  return value.trim();
}

export function validateRecipe(recipe) {
  if (!recipe || !Array.isArray(recipe.variants) || recipe.variants.length < 1 || recipe.variants.length > 5) throw new Error('配方需包含 1–5 条规格。');
  const name = text(recipe.name, '配方名称', 60);
  const labels = new Set();
  const variants = recipe.variants.map(item => {
    if (!item || typeof item !== 'object') throw new Error('规格格式无效。');
    const label = text(item.label, '规格名称', 32);
    const key = safePart(label).toLocaleLowerCase('en-US');
    if (labels.has(key)) throw new Error('规格名称重复或转换后的文件名冲突。');
    labels.add(key);
    const { width, height, format, quality, maxKB, upscale } = item;
    if (![width, height].every(n => Number.isInteger(n) && n >= 16 && n <= 4096) || width * height > LIMITS.pixels) throw new Error('输出尺寸需为 16–4096 的整数，最多 1600 万像素。');
    if (!formats.has(format)) throw new Error('仅支持 JPEG、PNG、WebP。');
    if (!Number.isFinite(quality) || quality < 0.1 || quality > 1) throw new Error('质量需为 0.1–1。');
    if (!Number.isInteger(maxKB) || maxKB < 0 || maxKB > 10240) throw new Error('大小上限需为 0–10240 KiB，0 表示不检查。');
    if (typeof upscale !== 'boolean') throw new Error('放大选项需为布尔值。');
    return { label, width, height, format, quality, maxKB, upscale };
  });
  return { name, variants };
}

export function fitImage(width, height, variant) {
  if (![width, height].every(n => Number.isInteger(n) && n > 0) || width * height > LIMITS.pixels) throw new Error('源图片尺寸或像素数量超出限制。');
  const target = validateRecipe({ name: 'fit', variants: [variant] }).variants[0];
  const scale = Math.min(target.width / width, target.height / height, target.upscale ? Infinity : 1);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  return { width: w, height: h, x: Math.floor((target.width - w) / 2), y: Math.floor((target.height - h) / 2) };
}

function safePart(value) {
  let safe = String(value).normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/gu, '_').replace(/^\.+/u, '').replace(/[. ]+$/u, '').trim();
  safe = [...safe].slice(0, 60).join('').replace(/[. ]+$/u, '') || 'image';
  while (new TextEncoder().encode(safe).length > 80) safe = [...safe].slice(0, -1).join('');
  safe = safe.replace(/[. ]+$/u, '') || 'image';
  return reserved.test(safe) ? `_${safe}` : safe;
}

export function outputName(name, label, index, format) {
  if (!formats.has(format) || !Number.isInteger(index) || index < 1 || index > LIMITS.files) throw new Error('导出名称参数无效。');
  const base = safePart(String(name).replace(/\.[^.]*$/u, ''));
  return `${base}_${String(index).padStart(3, '0')}_${safePart(label)}.${format === 'jpeg' ? 'jpg' : format}`;
}

export function validateBatch(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > LIMITS.files) throw new Error('每次请选择 1–20 张图片。');
  if (files.some(file => !Number.isSafeInteger(file.size) || file.size < 1 || file.size > LIMITS.fileBytes)) throw new Error('单张图片需为 1 字节–10 MiB。');
  if (files.reduce((total, file) => total + file.size, 0) > LIMITS.batchBytes) throw new Error('原图总大小不能超过 50 MiB。');
}
