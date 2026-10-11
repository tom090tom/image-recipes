import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { createAppServer } from '../bin/server.js';

async function withServer(fn) {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await fn(server, `http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
function raw(server, headers, port = server.address().port) {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, headers }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject); req.end();
  });
}
test('serves the demo and documentation while keeping private files inaccessible', () => withServer(async (_, base) => {
  assert.equal((await fetch(base)).status,200);
  for (const path of ['/examples/product.png','/examples/portrait.jpg','/examples/mark.webp','/src/recipes.js','/processor.js','/SECURITY.md','/DISCLAIMER.md']) {
    assert.equal((await fetch(base + path)).status,200,path);
  }
  for (const path of ['/.git/config','/package.json','/AGENTS.md','/../个人资料/账号定位.md','/..%2f.env']) assert.equal((await fetch(base+path)).status,404,path);
  assert.equal((await fetch(base,{ method:'POST',body:'private image' })).status,405);
  assert.equal((await fetch(base,{ method:'HEAD' })).status,200);
}));
for (const [name, headers] of [
  ['foreign Host',{Host:'attacker.example'}],['wrong port',{Host:'localhost:1'}],
  ['foreign Origin',{Origin:'https://attacker.example'}],['opaque Origin',{Origin:'null'}],
  ['cross-site browser',{ 'Sec-Fetch-Site':'cross-site' }]
]) test(`rejects ${name}`, () => withServer(async server => assert.equal(await raw(server,headers),403)));
test('accepts matching local Origin and sets privacy and script policies', () => withServer(async (_,base) => {
  const response = await fetch(base,{headers:{Origin:base}});
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cross-origin-resource-policy'),'same-origin');
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.match(response.headers.get('content-security-policy'),/object-src 'none'/);
}));
test('default port accepts portless localhost without allowing wrong protocols', () => withServer(async server => {
  const port = server.address().port, original = server.address;
  server.address = () => ({port:80});
  try {
    assert.equal(await raw(server,{Host:'localhost',Origin:'http://localhost'},port),200);
    assert.equal(await raw(server,{Host:'localhost',Origin:'https://localhost'},port),403);
  } finally { server.address = original; }
}));
