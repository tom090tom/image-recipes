import { LIMITS, fitImage, outputName, validateRecipe, validateBatch } from '../src/recipes.js';
import { inspectImage } from '../src/image-info.js';

export async function prepareFiles(files) {
  validateBatch(files);
  const prepared = [];
  const errors = [];
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const info = inspectImage(bytes);
      // Trust inspected content, never an extension or a user-controlled MIME hint.
      prepared.push({ name: file.name, info, blob: new Blob([bytes],{type:info.type}) });
    } catch(error) { errors.push({name:file.name,message:error.message}); }
  }
  return { prepared, errors };
}

export async function exportImages(prepared, recipe, onProgress = () => {}) {
  recipe = validateRecipe(recipe);
  validateBatch(prepared.map(item => ({size:item.blob.size})));
  const outputs = [], errors = [];
  let totalBytes = 0, completed = 0;
  for (const [index,item] of prepared.entries()) {
    let bitmap;
    try {
      bitmap = await createImageBitmap(item.blob,{imageOrientation:'from-image'});
      if (bitmap.width * bitmap.height > LIMITS.pixels) throw new Error('解码图片超过 1600 万像素。');
      for (const variant of recipe.variants) {
        const canvas = document.createElement('canvas');
        try {
          canvas.width = variant.width; canvas.height = variant.height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('浏览器无法创建图片画布。');
          if (variant.format === 'jpeg') { context.fillStyle = '#ffffff'; context.fillRect(0,0,canvas.width,canvas.height); }
          context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
          const fit = fitImage(bitmap.width,bitmap.height,variant);
          context.drawImage(bitmap,fit.x,fit.y,fit.width,fit.height);
          const type = `image/${variant.format}`;
          const blob = await new Promise(resolve => canvas.toBlob(resolve,type,variant.quality));
          if (!blob || blob.type !== type) throw new Error(`浏览器不支持 ${variant.format.toUpperCase()} 编码，请更换格式。`);
          if (totalBytes + blob.size > LIMITS.outputBytes) throw new Error('导出总大小超过 100 MiB；请减少图片或规格。');
          const data = new Uint8Array(await blob.arrayBuffer());
          totalBytes += data.length;
          outputs.push({name:outputName(item.name,variant.label,index+1,variant.format), data, blob, width:canvas.width, height:canvas.height, exceeds:variant.maxKB > 0 && blob.size > variant.maxKB * 1024});
        } catch(error) { errors.push({name:`${item.name} / ${variant.label}`,message:error.message}); }
        finally { canvas.width = 1; canvas.height = 1; }
        completed++;
        onProgress(completed,prepared.length * recipe.variants.length);
        // Yield for progress rendering and keep only one source bitmap alive.
        await new Promise(resolve => setTimeout(resolve,0));
      }
    } catch(error) {
      errors.push({name:item.name,message:`无法解码：${error.message}`});
      completed += recipe.variants.length;
      onProgress(completed,prepared.length * recipe.variants.length);
    } finally { bitmap?.close(); }
  }
  return { outputs, errors };
}
