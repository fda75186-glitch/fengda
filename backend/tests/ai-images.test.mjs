import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { handleApi } from '../api.mjs';
import { createLocalStorage } from '../local-adapter.mjs';
import { safeGeneratedImageUrl } from '../ai-images.mjs';
import { createAssistantTools } from '../assistant-tools.mjs';

const input = { prompt: '深蓝宇宙里一颗拥有冰环的土星，科普插画', ratio: 'landscape', style: 'illustration' };
const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const imageUrl = 'https://aigc-image.cos.myqcloud.com/generated.png?signature=private';
const provider = async url => String(url).includes('/v3-generation') ? Response.json({ data: [{ url: imageUrl }] }) : new Response(png, { headers: { 'Content-Type': 'image/png' } });
async function fixture(t, imageFetch = provider) {
  const directory = await mkdtemp(join(tmpdir(), 'xingyu-image-test-'));
  const storage = await createLocalStorage(directory);
  const context = { ...storage, allowLoopback: true, TENCENT_API_KEY: 'test-not-a-secret', TENCENT_IMAGE_ENABLED: 'true', imageFetch };
  const call = (path, data, token, id, extra = {}) => handleApi(new Request('http://127.0.0.1:40090' + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(id ? { 'Idempotency-Key': id } : {}) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }), ...extra }), context);
  const register = async username => (await (await call('/api/auth/register', { username, password: 'isolated-test-password' })).json()).token;
  const token = await register('ImageTest');
  t.after(async () => { storage.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('xingyu-image-test-')); await rm(directory, { recursive: true, force: true }); });
  return { context, call, token, register, generate: (id = crypto.randomUUID(), data = input) => call('/api/ai/images', data, token, id) };
}

test('actual image contract stores protected owned bytes; retries reuse one provider call and published media becomes public', async t => {
  let generated = 0;
  const app = await fixture(t, async (url, options) => {
    if (String(url).includes('/v3-generation')) {
      generated++;
      const data = JSON.parse(options.body);
      assert.equal(data.model, 'hy-image-v3'); assert.equal(data.size, '1024x768'); assert.equal(data.footnote, '星语AI生成'); assert.equal(options.redirect, 'manual');
    } else { assert.equal(options.headers.Authorization, undefined); assert.equal(options.redirect, 'manual'); }
    return provider(url);
  });
  const id = crypto.randomUUID();
  const result = await (await app.generate(id)).json(); assert.equal(result.status, 'complete'); assert.ok(!JSON.stringify(result).includes('signature'));
  assert.equal((await (await app.generate(id)).json()).media, result.media); assert.equal(generated, 1);
  assert.equal((await app.call(result.media)).status, 404);
  const ownerImage = await app.call(result.media, undefined, app.token); assert.equal(ownerImage.status, 200); assert.deepEqual(new Uint8Array(await ownerImage.arrayBuffer()), png);
  assert.equal((await app.generate(id, { ...input, ratio: 'portrait' })).status, 409);
  const other = await app.register('OtherImageUser');
  assert.equal((await app.call(`/api/ai/images/${id}`, undefined, other)).status, 404);
  assert.equal((await app.call('/api/ai/images', input, other, id)).status, 409);
  const post = { type: 'image', kind: 'image', title: 'AI科普示意分享', content: 'AI生成的土星插画，并非真实观测照片。', category: '学习交流', images: [result.media], visibility: 'public' };
  assert.equal((await app.call('/api/posts', post, other)).status, 403);
  assert.equal((await app.call('/api/posts', post, app.token)).status, 201);
  assert.equal((await app.call(result.media)).status, 200);
});
test('auth, configuration, prompt, ratio and model are validated before calling provider', async t => {
  let calls = 0; const app = await fixture(t, async () => { calls++; return provider(''); });
  assert.equal((await app.call('/api/ai/images', input, null, crypto.randomUUID())).status, 401);
  for (const data of [{ ...input, prompt: 'x' }, { ...input, ratio: '4096x4096' }, { ...input, model: 'other' }, { ...input, images: ['http://127.0.0.1'] }]) assert.equal((await app.generate(undefined, data)).status, 400);
  app.context.TENCENT_IMAGE_ENABLED = 'false';
  assert.equal((await app.generate()).status, 503); assert.equal(calls, 0);
  assert.equal((await (await app.call('/api/ai/status')).json()).images.configured, false);
});
test('duplicate in-flight requests do not spend twice or create another media object', async t => {
  let release, entered, calls = 0;
  const ready = new Promise(r => { entered = r; }), gate = new Promise(r => { release = r; });
  const app = await fixture(t, async url => { if (String(url).includes('/v3-generation')) { calls++; entered(); await gate; } return provider(url); });
  const id = crypto.randomUUID(), first = app.generate(id); await ready;
  assert.equal((await (await app.generate(id)).json()).status, 'pending'); release();
  assert.equal((await (await first).json()).status, 'complete'); assert.equal(calls, 1);
  assert.equal((await app.context.DB.prepare('SELECT COUNT(*) AS n FROM media').first()).n, 1);
});
test('provider access errors are safe, persisted, and never automatically retried', async t => {
  let calls = 0;
  const app = await fixture(t, async () => { calls++; return Response.json({ error: { code: '401006', message: 'sensitive provider diagnostic' } }, { status: 400 }); });
  const id = crypto.randomUUID(), result = await (await app.generate(id)).json();
  assert.equal(result.code, 'IMAGE_ACCESS'); assert.equal(result.status, 'failed'); assert.ok(!JSON.stringify(result).includes('sensitive'));
  await app.generate(id); assert.equal(calls, 1);
});
test('unsafe URLs, redirects, HTML and oversized files are refused without persisting media', async t => {
  for (const url of ['http://aigc-image.cos.myqcloud.com/a', 'https://127.0.0.1/a', 'https://aigc-image.cos.myqcloud.com.evil.invalid/a', 'https://name:pass@aigc-image.cos.myqcloud.com/a', 'https://aigc-image.cos.myqcloud.com:444/a']) assert.throws(() => safeGeneratedImageUrl(url));
  const cases = [
    () => Response.json({ data: [{ url: 'https://127.0.0.1/private' }] }),
    url => String(url).includes('/v3-generation') ? provider(url) : new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }),
    url => String(url).includes('/v3-generation') ? provider(url) : new Response('<html>invalid</html>', { headers: { 'content-type': 'image/png' } }),
    url => String(url).includes('/v3-generation') ? provider(url) : new Response(png, { headers: { 'content-type': 'image/png', 'content-length': 9 * 1024 * 1024 } }),
  ];
  for (const fetch of cases) {
    const app = await fixture(t, fetch), result = await (await app.generate()).json(); assert.equal(result.status, 'failed');
    assert.equal((await app.context.DB.prepare('SELECT COUNT(*) AS n FROM media').first()).n, 0);
  }
});
test('minute quota blocks a new image attempt and canceled requests leave a recoverable failure', async t => {
  const app = await fixture(t);
  await app.generate(); const second = await (await app.generate()).json(); assert.equal(second.code, 'IMAGE_LIMIT');
  const other = await app.register('CancelledImage'); const cancel = new AbortController(); cancel.abort();
  const id = crypto.randomUUID();
  const response = await app.call('/api/ai/images', input, other, id, { signal: cancel.signal });
  assert.equal(response.status,408); assert.equal((await response.json()).code,'IMAGE_CANCELLED');
  assert.equal((await app.call(`/api/ai/images/${id}`,undefined,other)).status,404);
});
test('input deadline closes a hanging body before any paid request or pending task is created', async t => {
  let canceled=false,calls=0;
  const app=await fixture(t,async()=>{calls++;return provider('');});app.context.imageInputTimeoutMs=15;
  const body=new ReadableStream({start(){},cancel(){canceled=true;}});
  const response=await handleApi(new Request('http://127.0.0.1:40090/api/ai/images',{method:'POST',headers:{Authorization:`Bearer ${app.token}`,'Idempotency-Key':crypto.randomUUID()},body,duplex:'half'}),app.context);
  assert.equal(response.status,408);assert.equal(calls,0);assert.equal(canceled,true);
  assert.equal((await app.context.DB.prepare('SELECT COUNT(*) AS n FROM image_generations').first()).n,0);
});
test('image tool prepares only a validated request; model cannot trigger generation or publication', async () => {
  const execute = createAssistantTools({});
  const prepared = await execute('prepare_image', input);
  assert.equal(prepared.action.type, 'image_request'); assert.equal(prepared.result.requiresUserClick, true);
  assert.equal(prepared.result.status, 'prepared_not_executed');
  await assert.rejects(execute('prepare_image', { ...input, imageUrl: 'https://hostile.invalid' }));
});
