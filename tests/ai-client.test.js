import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatMessages, createAiClient, createAiRequestScope, createSseParser } from '../src/aiClient.js';

const frame = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
function streamResponse(chunks, options = {}) {
  let canceled = false;
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      if (!options.stayOpen) controller.close();
    },
    cancel() { canceled = true; },
  });
  return { response: new Response(body, { headers: { 'Content-Type': 'text/event-stream' } }), wasCanceled: () => canceled };
}
const encode = value => new TextEncoder().encode(value);

test('SSE handles CRLF split across chunks and multiline JSON data', () => {
  const received = [];
  const parser = createSseParser(event => received.push(event));
  for (const part of ['event: delta\r', '\ndata: {"text":\r\n', 'data: "月亮"}\r\n\r', '\nevent: done\ndata: {"finishReason":"stop"}\n\n']) parser.feed(part);
  parser.finish();
  assert.deepEqual(received, [{ type: 'delta', text: '月亮' }, { type: 'done', finishReason: 'stop' }]);
});

test('real byte stream reconstructs split Chinese UTF-8, forwards metadata, and uses the central session token', async () => {
  const bytes = encode(frame('meta', { providerName: '腾讯混元', model: 'hunyuan', requestId: 'request-1' }) + frame('delta', { text: '月亮🌙' }) + frame('done', { finishReason: 'stop' }));
  const fixture = streamResponse([...bytes].map(value => Uint8Array.of(value)));
  let request;
  const client = createAiClient({ apiBase: 'https://example.test/', getToken: () => 'session-token', fetchImpl: async (url, options) => { request = { url, options }; return fixture.response; } });
  const received = [];
  await client.chat({ messages: [{ role: 'user', content: '月相' }], onEvent: event => received.push(event) });
  assert.equal(request.url, 'https://example.test/api/ai/chat');
  assert.equal(request.options.headers.get('Authorization'), 'Bearer session-token');
  assert.deepEqual(JSON.parse(request.options.body), { messages: [{ role: 'user', content: '月相' }] });
  assert.equal(received.map(event => event.text || '').join(''), '月亮🌙');
  assert.equal(received[0].providerName, '腾讯混元');
});

test('unconfigured status remains explicitly unconfigured', async () => {
  const client = createAiClient({ apiBase: 'https://example.test/', fetchImpl: async () => Response.json({ configured: false, provider: 'tencent', providerName: '腾讯混元', model: '', requiresLogin: true }) });
  const status = await client.status();
  assert.equal(status.configured, false);
  assert.equal(status.requiresLogin, true);
});

test('HTTP JSON error preserves login failure without emitting an answer', async () => {
  const client = createAiClient({ apiBase: 'https://example.test/', fetchImpl: async () => Response.json({ error: '请先登录。', code: 'LOGIN_REQUIRED' }, { status: 401 }) });
  const received = [];
  await assert.rejects(client.chat({ messages: [], onEvent: event => received.push(event) }), error => error.code === 'LOGIN_REQUIRED' && error.status === 401);
  assert.deepEqual(received, []);
});

test('malformed event JSON and invalid delta shape fail instead of becoming answer text', () => {
  for (const invalid of ['event: delta\ndata: {bad}\n\n', frame('delta', { text: { html: '<script>' } })]) {
    const parser = createSseParser(() => assert.fail('invalid event was emitted'));
    assert.throws(() => parser.feed(invalid), error => error.code === 'AI_STREAM_INVALID');
  }
});

test('SSE parser bounds unfinished lines and event data', () => {
  const parser = createSseParser(() => {}, { maxBuffer: 32 });
  assert.throws(() => parser.feed(`data: ${'x'.repeat(33)}`), error => error.code === 'AI_STREAM_INVALID');
});

test('partial answer followed by server error remains partial and fails visibly', async () => {
  const fixture = streamResponse([encode(frame('delta', { text: '已经收到的部分' }) + frame('error', { error: '回答连接中断。', code: 'AI_STREAM_TRUNCATED' }))]);
  const client = createAiClient({ apiBase: 'https://example.test/', fetchImpl: async () => fixture.response });
  const received = [];
  await assert.rejects(client.chat({ messages: [], onEvent: event => received.push(event) }), error => error.code === 'AI_STREAM_TRUNCATED');
  assert.deepEqual(received.map(event => event.type), ['delta']);
  assert.equal(received[0].text, '已经收到的部分');
});

test('stream EOF without done and incomplete UTF-8 fail instead of claiming completion', async () => {
  for (const chunks of [[encode(frame('delta', { text: '部分答案' }))], [Uint8Array.of(0xe6, 0x9c)]]) {
    const fixture = streamResponse(chunks);
    const client = createAiClient({ apiBase: 'https://example.test/', fetchImpl: async () => fixture.response });
    await assert.rejects(client.chat({ messages: [], onEvent: () => {} }), error => ['AI_STREAM_TRUNCATED', 'AI_STREAM_INVALID'].includes(error.code));
  }
});

test('abort cancels the reader and suppresses subsequent events in the same chunk', async () => {
  const controller = new AbortController();
  const fixture = streamResponse([encode(frame('delta', { text: '第一段' }) + frame('delta', { text: '过期段' }) + frame('done', { finishReason: 'stop' }))], { stayOpen: true });
  const client = createAiClient({ apiBase: 'https://example.test/', fetchImpl: async () => fixture.response });
  const received = [];
  await assert.rejects(client.chat({ messages: [], signal: controller.signal, onEvent: event => { received.push(event); controller.abort(); } }), error => error.name === 'AbortError');
  assert.equal(fixture.wasCanceled(), true);
  assert.deepEqual(received.map(event => event.text), ['第一段']);
});

test('done with length exposes the provider truncation warning', async () => {
  const fixture = streamResponse([encode(frame('status', { message: '回答已达到长度上限。' }) + frame('done', { finishReason: 'length' }))]);
  const client = createAiClient({ apiBase: 'https://example.test/', fetchImpl: async () => fixture.response });
  const received = [];
  await client.chat({ messages: [], onEvent: event => received.push(event) });
  assert.equal(received[0].message, '回答已达到长度上限。');
  assert.equal(received[1].finishReason, 'length');
});

test('status timeout reports connection failure instead of leaving loading indefinitely', async () => {
  const client = createAiClient({ apiBase: 'https://example.test/', statusTimeoutMs: 5, fetchImpl: (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true })) });
  await assert.rejects(client.status(), error => error.code === 'AI_TIMEOUT');
});

test('chat timeout cancels an idle stream and preserves the distinction from user stop', async () => {
  const fixture = streamResponse([], { stayOpen: true });
  const client = createAiClient({ apiBase: 'https://example.test/', chatTimeoutMs: 5, fetchImpl: async () => fixture.response });
  await assert.rejects(client.chat({ messages: [] }), error => error.code === 'AI_TIMEOUT');
  assert.equal(fixture.wasCanceled(), true);
});

test('request scope invalidates old work on replacement, cancel, and finish', () => {
  const scope = createAiRequestScope();
  const oldRequest = scope.begin();
  const nextRequest = scope.begin();
  assert.equal(oldRequest.signal.aborted, true);
  assert.equal(oldRequest.current(), false);
  assert.equal(nextRequest.current(), true);
  scope.cancel();
  assert.equal(nextRequest.current(), false);
  const lastRequest = scope.begin();
  scope.finish(lastRequest);
  assert.equal(lastRequest.current(), false);
});

test('conversation context excludes failed or stopped answers and stays within server budgets', () => {
  const conversation = [];
  for (let i = 0; i < 10; i++) conversation.push({ role: 'user', text: `问题${i}${'问'.repeat(1000)}` }, { role: 'assistant', text: `回答${i}${'答'.repeat(1500)}`, status: 'complete' });
  conversation.push({ role: 'user', text: '失败的问题' }, { role: 'assistant', text: '失败的部分回答', status: 'error' });
  const payload = buildChatMessages(conversation, '现在的问题');
  assert.ok(payload.length <= 12);
  assert.ok(payload.reduce((sum, item) => sum + item.content.length, 0) <= 12000);
  assert.equal(payload.at(-1).content, '现在的问题');
  assert.equal(payload.at(-1).role, 'user');
  assert.equal(payload.some(item => item.content.includes('失败')), false);
  assert.throws(() => buildChatMessages([], '问'.repeat(2001)), error => error.code === 'AI_INPUT_INVALID');
});
