import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

const root = new URL('../', import.meta.url);
const assets = new Map([
  ['/', ['web/index.html','text/html']], ['/app.js',['web/app.js','text/javascript']],
  ['/processor.js',['web/processor.js','text/javascript']], ['/styles.css',['web/styles.css','text/css']],
  ['/src/recipes.js',['src/recipes.js','text/javascript']], ['/src/image-info.js',['src/image-info.js','text/javascript']],
  ['/src/zip.js',['src/zip.js','text/javascript']],
  ['/examples/product.png',['examples/product.png','image/png']],
  ['/examples/portrait.jpg',['examples/portrait.jpg','image/jpeg']],
  ['/examples/mark.webp',['examples/mark.webp','image/webp']],
  ['/SECURITY.md',['SECURITY.md','text/plain']], ['/DISCLAIMER.md',['DISCLAIMER.md','text/plain']]
]);

export function createAppServer() {
  const server = createServer(async (req,res) => {
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('Cache-Control','no-store');
    res.setHeader('Referrer-Policy','no-referrer'); res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    const port = server.address()?.port;
    const hosts = new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
    if (port === 80) { hosts.add('127.0.0.1'); hosts.add('localhost'); }
    if (!hosts.has(req.headers.host?.toLowerCase())
      || req.headers.origin !== undefined && ![...hosts].some(host => req.headers.origin === `http://${host}`)
      || req.headers['sec-fetch-site'] === 'cross-site') {
      res.writeHead(403); res.end('Only local same-origin requests are allowed'); return;
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405,{Allow:'GET, HEAD'}); res.end('Method not allowed'); return; }
    let asset;
    try { asset = assets.get(new URL(req.url,'http://localhost').pathname); }
    catch { res.writeHead(400); res.end('Bad request'); return; }
    if (!asset) { res.writeHead(404); res.end('Not found'); return; }
    try {
      const data = await readFile(new URL(asset[0],root));
      res.writeHead(200,{'Content-Type':`${asset[1]}${asset[1].startsWith('image/') ? '' : '; charset=utf-8'}`});
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(500); res.end('Unable to load application asset'); }
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const { values } = parseArgs({options:{port:{type:'string',default:'4174'}}});
    const port = Number(values.port);
    if (!/^\d+$/u.test(values.port) || port < 1 || port > 65535 || !Number.isInteger(port)) throw new Error('端口需为 1–65535 的整数。');
    const server = createAppServer();
    server.on('error',error => { console.error(`启动失败：${error.message}`); process.exitCode = 1; });
    server.listen(port,'127.0.0.1',() => console.log(`Image Recipes: http://127.0.0.1:${port}\n图片仅在本机浏览器处理。按 Ctrl+C 停止。`));
  } catch(error) { console.error(error.message); process.exitCode = 1; }
}
