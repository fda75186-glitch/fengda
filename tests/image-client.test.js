import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageClient } from '../src/imageClient.js';
import { validateImageRequest } from '../shared/image-generation.mjs';
import { validateAssistantAction } from '../shared/assistant-tools.mjs';
import { buildChatMessages, createSseParser } from '../src/aiClient.js';

const request = { prompt: '宇宙星空中的土星科普插画', ratio: 'square', style: 'illustration' };
const id = '12000000-0000-4000-8000-000000000001';
const image = { id, status: 'complete', media: '/api/media/12000000-0000-4000-8000-000000000002', mime: 'image/png', ...request };
test('image contract allows only bounded prompt and fixed supported ratios/styles', () => {
  assert.deepEqual(validateImageRequest(request), request);
  for (const value of [{ ...request, ratio: '4K' }, { ...request, prompt: 'x' }, { ...request, prompt: 'x'.repeat(1601) }, { ...request, url: 'http://localhost' }]) assert.throws(() => validateImageRequest(value));
  assert.equal(validateAssistantAction({ id, type: 'image_request', request }).request.prompt, request.prompt);
});
test('image client uses authenticated server endpoint, immutable request ID and owned media only', async () => {
  let calls = 0;
  const client = createImageClient({ apiBase: 'http://127.0.0.1:63601', getSession: () => ({ userId: 'owner', token: 'session' }), fetchImpl: async (url, options) => {
    calls++; assert.equal(options.headers.get('Authorization'), 'Bearer session');
    if (url.pathname === '/api/ai/images') { assert.equal(options.headers.get('Idempotency-Key'), id); assert.deepEqual(JSON.parse(options.body), request); return Response.json(image); }
    assert.equal(url.pathname, image.media); return new Response(new Uint8Array([1,2,3]), { headers: { 'Content-Type': 'image/png' } });
  } });
  const value = await client.generate(id, request, 'owner'); assert.equal(value.media, image.media);
  assert.equal((await client.read(value, 'owner')).type, 'image/png');
  await assert.rejects(client.read({ ...image, media: 'https://hostile.invalid' }, 'owner'));
  await assert.rejects(client.generate(id, request, 'other')); assert.equal(calls, 2);
});
test('changing login during generation discards stale image data instead of exposing it to another account', async () => {
  let session = { userId: 'owner', token: 'old' }, finish;
  const client = createImageClient({ apiBase: 'http://127.0.0.1', getSession: () => session, fetchImpl: () => new Promise(resolve => { finish = resolve; }) });
  const work = client.generate(id, request, 'owner'); session = { userId: 'other', token: 'new' }; finish(Response.json(image));
  await assert.rejects(work, /账号/);
});
test('canceling image wait is explicit and never reissues a paid generation request', async () => {
  let calls = 0;
  const client = createImageClient({ apiBase: 'http://127.0.0.1', getSession: () => ({ userId: 'owner', token: 'session' }), fetchImpl: (_url, options) => { calls++; return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('stop', 'AbortError')))); } });
  const abort = new AbortController(), work = client.generate(id, request, 'owner', abort.signal); abort.abort();
  await assert.rejects(work, { name: 'AbortError' }); assert.equal(calls, 1);
});
test('prepared image SSE cards preserve prompt context without injecting media links or pretending completion', () => {
  let action;
  const parser = createSseParser(e => { if(e.type === 'action') action = e.action; });
  parser.feed(`event: action\ndata: ${JSON.stringify({ id, type: 'image_request', request })}\n\nevent: done\ndata: {"finishReason":"stop"}\n\n`); parser.finish();
  const history = buildChatMessages([{ role: 'user', text: '帮我画土星' }, { role: 'assistant', text: '描述已准备好', status: 'complete', actions: [action] }], '再写一段配文');
  assert.match(history[1].content, /prepared_not_generated/); assert.match(history[1].content, /土星科普插画/); assert.ok(!history[1].content.includes('/api/media'));
});
