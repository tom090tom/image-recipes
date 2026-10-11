import { DEFAULT_RECIPE, validateRecipe } from '../src/recipes.js';
import { createZip } from '../src/zip.js';
import { prepareFiles, exportImages } from './processor.js';

const $ = id => document.getElementById(id);
const storageKey = 'image-recipes.recipe.v1';
let prepared = [], outputs = [], sourceUrls = [], outputUrls = [], zipUrl, busy = false;

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function status(message, error = false) { $('status').textContent = message; $('status').classList.toggle('error',error); }
function sizes(bytes) { return bytes >= 1024 ** 2 ? `${(bytes / 1024 ** 2).toFixed(1)} MiB` : `${(bytes / 1024).toFixed(1)} KiB`; }
function showErrors(id, errors) {
  $(id).replaceChildren(...errors.map(error => element('li',`${error.name}：${error.message}`)));
}
function controls() {
  for (const node of document.querySelectorAll('button,input,select')) node.disabled = busy;
  $('generate').disabled = busy || !prepared.length;
  $('download').disabled = busy || !outputs.length;
  $('add-variant').disabled = busy || $('variants').children.length >= 5;
  for (const node of document.querySelectorAll('.remove-variant')) node.disabled = busy || $('variants').children.length <= 1;
  for (const row of $('variants').children) row.querySelector('[data-field="quality"]').disabled = busy || row.querySelector('[data-field="format"]').value === 'png';
}
function setBusy(value) { busy = value; controls(); }
function clearResults() {
  outputs = [];
  outputUrls.forEach(url => URL.revokeObjectURL(url)); outputUrls = [];
  if (zipUrl) URL.revokeObjectURL(zipUrl); zipUrl = undefined;
  $('results').replaceChildren(element('div','你的导出结果会出现在这里。','empty'));
  $('result-summary').textContent = '生成后查看实际尺寸、文件大小和超限提示。';
  $('export-errors').replaceChildren(); $('progress').hidden = true;
  controls();
}
function inputField(row, key, label, value, type = 'text', options = {}) {
  const wrapper = element('label',label,'field');
  const input = element('input'); input.type = type; input.value = value; input.dataset.field = key;
  Object.assign(input,options); wrapper.append(input); row.append(wrapper); return input;
}
function addVariant(value) {
  const row = element('div',undefined,'variant');
  const top = element('div',undefined,'variant-top');
  inputField(top,'label','规格名称',value.label,'text',{maxLength:32});
  const remove = element('button','移除','text-button remove-variant'); remove.type = 'button';
  remove.addEventListener('click',() => { row.remove(); clearResults(); }); top.append(remove);
  const grid = element('div',undefined,'variant-grid');
  inputField(grid,'width','宽度 px',value.width,'number',{min:16,max:4096,step:1});
  inputField(grid,'height','高度 px',value.height,'number',{min:16,max:4096,step:1});
  const formatLabel = element('label','格式','field');
  const format = element('select'); format.dataset.field = 'format';
  for (const name of ['jpeg','png','webp']) { const option = element('option',name.toUpperCase()); option.value = name; format.append(option); }
  format.value = value.format; formatLabel.append(format); grid.append(formatLabel);
  inputField(grid,'quality','质量 %',Math.round(value.quality * 100),'number',{min:10,max:100,step:1});
  inputField(grid,'maxKB','上限 KiB',value.maxKB,'number',{min:0,max:10240,step:1});
  const allow = element('label',undefined,'upscale');
  const checkbox = element('input'); checkbox.type = 'checkbox'; checkbox.dataset.field = 'upscale'; checkbox.checked = value.upscale;
  allow.append(checkbox,document.createTextNode('允许放大小图（可能降低清晰度）'));
  row.append(top,grid,allow); $('variants').append(row); controls();
}
function displayRecipe(recipe) {
  $('recipe-name').value = recipe.name; $('variants').replaceChildren();
  recipe.variants.forEach(addVariant); controls();
}
function readRecipe() {
  return validateRecipe({name:$('recipe-name').value,variants:[...$('variants').children].map(row => {
    const field = key => row.querySelector(`[data-field="${key}"]`);
    return {label:field('label').value,width:Number(field('width').value),height:Number(field('height').value),format:field('format').value,quality:Number(field('quality').value)/100,maxKB:Number(field('maxKB').value),upscale:field('upscale').checked};
  })});
}
function renderSources() {
  sourceUrls.forEach(url => URL.revokeObjectURL(url)); sourceUrls = [];
  $('sources').replaceChildren();
  for (const item of prepared) {
    const card = element('div',undefined,'source-card');
    const img = element('img'); img.alt = item.name; img.src = URL.createObjectURL(item.blob); sourceUrls.push(img.src);
    card.append(img,element('p',item.name),element('small',`${item.info.width} × ${item.info.height} · ${sizes(item.blob.size)}`));
    $('sources').append(card);
  }
  $('source-count').textContent = prepared.length ? `${prepared.length} 张原图 · ${sizes(prepared.reduce((n,item) => n + item.blob.size,0))}` : '尚未选择图片';
}
async function ingest(files) {
  clearResults(); prepared = []; renderSources(); showErrors('input-errors',[]);
  const result = await prepareFiles(files);
  prepared = result.prepared; showErrors('input-errors',result.errors); renderSources();
  status(`已加载 ${prepared.length} 张图片${result.errors.length ? `，${result.errors.length} 张被拒绝，详见原图区` : '，确认规格后即可生成'}。`,result.errors.length > 0);
}
$('files').addEventListener('change',async event => {
  const files = [...event.target.files]; event.target.value = '';
  if (!files.length) return;
  setBusy(true);
  try { await ingest(files); } catch(error) { status(error.message,true); }
  finally { setBusy(false); }
});
$('demo').addEventListener('click',async () => {
  setBusy(true); status('正在加载 3 张合成示例图片…');
  try {
    const files = [];
    for (const name of ['product.png','portrait.jpg','mark.webp']) {
      const response = await fetch(`/examples/${name}`);
      if (!response.ok) throw new Error('示例无法加载，请确认本地服务正常。');
      files.push(new File([await response.blob()],name));
    }
    await ingest(files);
  } catch(error) { status(error.message,true); }
  finally { setBusy(false); }
});
$('clear').addEventListener('click',() => {
  prepared = []; renderSources(); clearResults(); showErrors('input-errors',[]); status('原图已清空，配方保留。');
});
$('add-variant').addEventListener('click',() => {
  addVariant({...DEFAULT_RECIPE.variants[0],label:`size-${$('variants').children.length + 1}`}); clearResults();
});
for (const id of ['variants','recipe-name']) $(id).addEventListener('input',() => {
  clearResults(); $('saved-state').textContent = '配方已修改，点击保存后下次复用。';
});
$('save-recipe').addEventListener('click',() => {
  try { localStorage.setItem(storageKey,JSON.stringify(readRecipe())); $('saved-state').textContent = '配方已保存在本机浏览器。'; status('配方已保存；原图和导出文件不会保存。'); }
  catch(error) { status(`无法保存：${error.message}`,true); }
});
$('reset-recipe').addEventListener('click',() => {
  displayRecipe(structuredClone(DEFAULT_RECIPE)); clearResults();
  try { localStorage.removeItem(storageKey); $('saved-state').textContent = '已清除保存的配方。'; status('已恢复默认示例配方。'); }
  catch { status('已恢复默认，但浏览器拒绝清除保存的配方。',true); }
});
$('generate').addEventListener('click',async () => {
  let recipe;
  try { recipe = readRecipe(); } catch(error) { status(error.message,true); return; }
  clearResults(); setBusy(true); $('progress').hidden = false; $('progress').value = 0;
  status('正在本机生成，请保持页面打开…');
  try {
    const result = await exportImages(prepared,recipe,(count,total) => { $('progress').max = total; $('progress').value = count; $('result-summary').textContent = `正在生成 ${count} / ${total}`; });
    outputs = result.outputs; showErrors('export-errors',result.errors); $('results').replaceChildren();
    for (const item of outputs) {
      const card = element('article',undefined,'result-card');
      const url = URL.createObjectURL(item.blob); outputUrls.push(url);
      const img = element('img'); img.src = url; img.alt = item.name;
      const body = element('div',undefined,'result-body');
      const meta = element('div',undefined,'result-meta');
      meta.append(element('span',`${item.width} × ${item.height}`),element('span',sizes(item.blob.size)),element('span',item.exceeds ? '大小超限' : '已生成',`chip${item.exceeds ? ' warn' : ''}`));
      const link = element('a','单张下载','download-link'); link.href = url; link.download = item.name;
      body.append(element('p',item.name),meta,link); card.append(img,body); $('results').append(card);
    }
    if (!outputs.length) $('results').append(element('div','没有生成可下载文件，请查看错误提示。','empty'));
    const exceeds = outputs.filter(item => item.exceeds).length;
    $('result-summary').textContent = `${prepared.length} 张原图 × ${recipe.variants.length} 条规格 · 已生成 ${outputs.length} 个文件 · ${sizes(outputs.reduce((n,item) => n + item.data.length,0))}${exceeds ? ` · ${exceeds} 个大小超限` : ''}${result.errors.length ? ` · ${result.errors.length} 个错误` : ''}`;
    status(exceeds || result.errors.length ? '生成结束，有超限或失败项，请检查后再使用；ZIP 仅包含成功文件。' : '全部版本已生成，原图保持完整。可以下载 ZIP 了。',exceeds > 0 || result.errors.length > 0);
  } catch(error) { status(`生成失败：${error.message}`,true); }
  finally { $('progress').hidden = true; setBusy(false); }
});
$('download').addEventListener('click',() => {
  try {
    if (!zipUrl) zipUrl = URL.createObjectURL(new Blob([createZip(outputs)],{type:'application/zip'}));
    const link = element('a'); link.href = zipUrl; link.download = 'image-recipes-export.zip';
    document.body.append(link); link.click(); link.remove();
    status('ZIP 已准备下载，包含成功生成的全部图片；请留意超限提示。');
  } catch(error) { status(`打包失败：${error.message}`,true); }
});

displayRecipe(structuredClone(DEFAULT_RECIPE));
try {
  const saved = localStorage.getItem(storageKey);
  if (saved) {
    if (saved.length > 20000) throw new Error('保存内容超出限制');
    displayRecipe(validateRecipe(JSON.parse(saved))); $('saved-state').textContent = '已加载上次保存的配方。';
  }
} catch { status('保存的配方不可用，已加载默认示例。可点击恢复默认清除旧设置。',true); }
// Replacement/clear releases URLs. The browser releases them on document unload;
// keeping them on pagehide also lets back-forward cache restore working previews.
