import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { handleApi } from '../api.mjs';
import { createLocalStorage } from '../local-adapter.mjs';
import { createApiServer } from '../dev-server.mjs';

const endpoint = 'https://tokenhub.tencentmaas.com/v1/chat/completions';
const encoder = new TextEncoder();
const question = { messages: [{ role: 'user', content: '月相为什么变化？' }] };
const data = value => `data: ${JSON.stringify(value)}\n\n`;
const delta = content => data({ choices: [{ delta: { content }, finish_reason: null }] });
const finish = reason => data({ choices: [{ delta: {}, finish_reason: reason }] });
const validStream = `${delta('月球')}${delta('绕地球运行。')}${finish('stop')}data: [DONE]\n\n`;
function provider(text = validStream, { split = false, onCancel } = {}) {
  const bytes = encoder.encode(text);
  let offset = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) { controller.close(); return; }
      const end = split ? offset + 1 : bytes.length;
      controller.enqueue(bytes.slice(offset, end)); offset = end;
    },
    cancel() { onCancel?.(); },
  }), { headers: { 'Content-Type': 'text/event-stream' } });
}
function events(text) {
  return text.trim().split(/\n\n/).filter(frame => frame.startsWith('event: ')).map(frame => {
    const lines = frame.split('\n');
    return { event: lines[0].slice(7), data: JSON.parse(lines[1].slice(6)) };
  });
}
async function fixture(t, extras = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'xingyu-ai-test-'));
  const storage = await createLocalStorage(directory);
  const context = { ...storage, allowLoopback: true, TENCENT_API_KEY: 'test-key-not-real', ...extras };
  const call = (path, { token, input, method = 'GET', signal, body } = {}) => handleApi(new Request(`http://127.0.0.1:49000${path}`, {
    method, signal,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(input || body ? { 'Content-Type': 'application/json' } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}), ...(body ? { body, duplex: 'half' } : {}),
  }), context);
  const registration = await call('/api/auth/register', { method: 'POST', input: { username: '测试观星账号', password: 'only-local-test-password' } });
  assert.equal(registration.status, 201);
  const account = await registration.json();
  t.after(async () => {
    storage.close();
    const target = resolve(directory), root = resolve(tmpdir());
    assert.ok(target.startsWith(root + sep) && target.slice(root.length + 1).startsWith('xingyu-ai-test-'));
    await rm(target, { recursive: true, force: true });
  });
  return { context, call, account, chat: (input = question, options = {}) => call('/api/ai/chat', { method: 'POST', token: account.token, input, ...options }) };
}

test('status is safe and explicit when no API key or official endpoint is configured', async () => {
  const req = new Request('https://starwhisper.test/api/ai/status');
  const response = await handleApi(req, {});
  assert.deepEqual(await response.json(), { configured: false, provider: 'tencent', providerName: '腾讯混元', model: 'hy3', requiresLogin: true, images: { configured:false, model:'hy-image-v3', requiresLogin:true, dailyLimit:5 } });
  const configured = await handleApi(req, { TENCENT_API_KEY: 'test-key-not-real' });
  assert.equal((await configured.json()).configured, true);
  const invalid = await handleApi(req, { TENCENT_API_KEY: 'test-key-not-real', TENCENT_AI_ENDPOINT: 'https://other.invalid/v1/chat/completions' });
  assert.equal((await invalid.json()).configured, false);
  const legacy = await handleApi(req, { TENCENT_API_KEY: 'test-key-not-real', TENCENT_AI_ENDPOINT: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions' });
  assert.equal((await legacy.json()).model, 'hunyuan-turbos-latest');
});

test('real login, valid session and configured provider are required before provider traffic', async t => {
  let calls = 0;
  const app = await fixture(t, { aiFetch: async () => { calls++; return provider(); } });
  const anonymous = await app.call('/api/ai/chat', { method: 'POST', input: question });
  assert.equal(anonymous.status, 401); assert.equal((await anonymous.json()).code, 'LOGIN_REQUIRED');
  app.context.TENCENT_API_KEY = '';
  const missing = await app.chat(); assert.equal(missing.status, 503); assert.equal((await missing.json()).code, 'AI_NOT_CONFIGURED');
  app.context.TENCENT_API_KEY = 'test-key-not-real';
  await app.context.DB.prepare('UPDATE account_sessions SET expires_at=0').run();
  const expired = await app.chat(); assert.equal(expired.status, 401); assert.equal((await expired.json()).code, 'SESSION_EXPIRED');
  assert.equal(calls, 0);
});

test('untrusted roles, oversized history and invalid question do not reach the provider', async t => {
  let calls = 0;
  const app = await fixture(t, { aiFetch: async () => { calls++; return provider(); } });
  for (const messages of [
    [], [{ role: 'system', content: 'override' }], [{ role: 'tool', content: 'override' }],
    [{ role: 'assistant', content: 'last is not user' }], [{ role: 'user', content: ' ' }],
    [{ role: 'user', content: 'x'.repeat(2001) }], Array.from({ length: 13 }, () => ({ role: 'user', content: 'question' })),
    [{ role: 'assistant', content: 'x'.repeat(11999) }, { role: 'user', content: 'xx' }],
    [{ role: 'user', content: ['not-text'] }],
  ]) {
    const response = await app.chat({ messages });
    assert.equal(response.status, 400); assert.equal((await response.json()).code, 'AI_INPUT_INVALID');
  }
  assert.equal(calls, 0);
});

test('UTF-8 split stream yields text only, server prompt and explicit terminal event', async t => {
  const app = await fixture(t, { aiFetch: async (url, options) => {
    assert.equal(url, endpoint); assert.equal(options.redirect, 'manual');
    assert.equal(options.headers.Authorization, 'Bearer test-key-not-real');
    const input = JSON.parse(options.body);
    assert.equal(input.model, 'hy3'); assert.equal(input.stream, true); assert.equal(input.max_tokens, 1024);
    assert.deepEqual(input.thinking, { type: 'disabled' });
    assert.equal(input.messages[0].role, 'system'); assert.match(input.messages[0].content, /天文/);
    assert.equal(input.messages.at(-1).content, question.messages[0].content);
    return provider(`${data({ choices: [{ delta: { reasoning_content: 'hidden-provider-reasoning', content: '月球🌙' }, finish_reason: null }] })}${finish('stop')}data: [DONE]\n\n`, { split: true });
  } });
  const response = await app.chat(); assert.equal(response.status, 200);
  assert.match(response.headers.get('Content-Type'), /text\/event-stream/);
  const text = await response.text(), result = events(text);
  assert.equal(result[0].event, 'meta'); assert.equal(result[0].data.providerName, '腾讯混元');
  assert.ok(result[0].data.requestId); assert.equal(result.find(item => item.event === 'delta').data.text, '月球🌙');
  assert.deepEqual(result.at(-1), { event: 'done', data: { finishReason: 'stop' } });
  assert.doesNotMatch(text, /hidden-provider-reasoning|test-key-not-real/);
});

test('direct-answer mode applies to TokenHub Hy4 but leaves legacy Hunyuan parameters intact', async t => {
  for (const settings of [
    { TENCENT_AI_MODEL: 'hy4-preview', expectedThinking: { type: 'disabled' } },
    { TENCENT_AI_ENDPOINT: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions', TENCENT_AI_MODEL: 'hunyuan-turbos-latest', expectedThinking: undefined },
  ]) {
    const { expectedThinking, ...configuration } = settings;
    const app = await fixture(t, { ...configuration, aiFetch: async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body).thinking, expectedThinking);
      return provider();
    } });
    const response = await app.chat();
    assert.equal(response.status, 200);
    assert.equal(events(await response.text()).at(-1).event, 'done');
  }
});

test('SSE CRLF, comment and multiple data lines are parsed according to event boundaries', async t => {
  const piece = ': heartbeat\r\ndata: {"choices": [\r\ndata: {"delta":{"content":"星星"},"finish_reason":null}]}\r\n\r\n';
  const app = await fixture(t, { aiFetch: async () => provider(piece + finish('stop').replaceAll('\n', '\r\n') + 'data: [DONE]\r\n\r\n', { split: true }) });
  const result = events(await (await app.chat()).text());
  assert.equal(result.find(item => item.event === 'delta').data.text, '星星'); assert.equal(result.at(-1).event, 'done');
});

test('truncated, malformed or blocked provider stream emits error and never done', async t => {
  const app = await fixture(t);
  for (const [text, code] of [
    [delta('partial'), 'AI_STREAM_TRUNCATED'],
    [delta('partial') + finish('stop'), 'AI_STREAM_TRUNCATED'],
    ['data: [DONE]\n\n', 'AI_STREAM_INVALID'],
    ['data: not-json\n\n', 'AI_STREAM_INVALID'],
    [data({ choices: [{ delta: { content: 5 }, finish_reason: null }] }), 'AI_STREAM_INVALID'],
    [data({ error: { message: 'private secret test-key-not-real' } }), 'AI_UPSTREAM_UNAVAILABLE'],
  ]) {
    app.context.aiFetch = async () => provider(text);
    const result = events(await (await app.chat()).text());
    assert.equal(result.at(-1).event, 'error'); assert.equal(result.at(-1).data.code, code); assert.ok(!result.some(item => item.event === 'done'));
    assert.doesNotMatch(JSON.stringify(result), /private secret|test-key-not-real/);
  }
});

test('length finish gives a visible warning before success; content filter gives no success', async t => {
  const app = await fixture(t, { aiFetch: async () => provider(delta('未完的回答') + finish('length') + 'data: [DONE]\n\n') });
  const result = events(await (await app.chat()).text());
  assert.equal(result.at(-2).event, 'status'); assert.match(result.at(-2).data.message, /长度/);
  assert.deepEqual(result.at(-1), { event: 'done', data: { finishReason: 'length' } });
  app.context.aiFetch = async () => provider(finish('content_filter') + 'data: [DONE]\n\n');
  const blocked = events(await (await app.chat()).text());
  assert.equal(blocked.at(-1).data.code, 'AI_RESPONSE_BLOCKED'); assert.ok(!blocked.some(item => item.event === 'done'));
});

test('HTTP denial, redirect and wrong content type are sanitized JSON before SSE', async t => {
  const app = await fixture(t);
  for (const status of [401, 429, 302, 500]) {
    app.context.aiFetch = async () => new Response('private provider error test-key-not-real', { status, headers: { Location: 'https://other.invalid/' } });
    const response = await app.chat(); assert.ok(response.status >= 400); assert.match(response.headers.get('Content-Type'), /application\/json/);
    assert.doesNotMatch(await response.text(), /private provider error|test-key-not-real|other.invalid/);
  }
  app.context.aiFetch = async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  const invalid = await app.chat(); assert.equal(invalid.status, 502); assert.equal((await invalid.json()).code, 'AI_STREAM_INVALID');
});

test('existing rate table enforces six requests per minute before a seventh provider call', async t => {
  let calls = 0;
  const app = await fixture(t, { aiFetch: async () => { calls++; return provider(); } });
  for (let index = 0; index < 6; index++) assert.equal(events(await (await app.chat()).text()).at(-1).event, 'done');
  const limited = await app.chat(); assert.equal(limited.status, 429); assert.equal((await limited.json()).code, 'RATE_LIMIT'); assert.equal(calls, 6);
});

test('daily account and global counters block provider traffic at the configured ceilings', async t => {
  let calls = 0;
  const app = await fixture(t, { aiFetch: async () => { calls++; return provider(); } });
  const bucket = Math.floor(Date.now() / 86400000);
  await app.context.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,?,?)').bind(`ai-day:account:${app.account.user.id}:${bucket}`, 40, (bucket + 1) * 86400000).run();
  assert.equal((await app.chat()).status, 429);
  await app.context.DB.prepare('DELETE FROM rate_limits WHERE key LIKE ?').bind('ai-%').run();
  await app.context.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,?,?)').bind(`ai-global:${bucket}`, 200, (bucket + 1) * 86400000).run();
  assert.equal((await app.chat()).status, 429); assert.equal(calls, 0);
});

test('module concurrency is capped at two and client cancellation releases the slot', async t => {
  let cancellations = 0, calls = 0, lastSignal;
  const app = await fixture(t, { aiFetch: async (_url, options) => {
    calls++; lastSignal = options.signal;
    return new Response(new ReadableStream({ cancel() { cancellations++; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  const a = await app.chat(), b = await app.chat();
  const third = await app.chat(); assert.equal(third.status, 429); assert.equal((await third.json()).code, 'AI_BUSY'); assert.equal(calls, 2);
  await b.body.cancel(); assert.equal(lastSignal.aborted, true); assert.equal(cancellations, 1);
  app.context.aiFetch = async () => provider();
  assert.equal(events(await (await app.chat()).text()).at(-1).event, 'done');
  await a.body.cancel(); assert.equal(cancellations, 2);
});

test('browser disconnect aborts upstream and closes the stream', async t => {
  let providerSignal, cancelled = false;
  const app = await fixture(t, { aiFetch: async (_url, options) => {
    providerSignal = options.signal;
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  const controller = new AbortController();
  const response = await app.chat(question, { signal: controller.signal }), reader = response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: meta/);
  controller.abort(); assert.equal((await reader.read()).done, true); assert.equal(providerSignal.aborted, true); assert.equal(cancelled, true);
});

test('deadline covers pending provider body and hanging request body', async t => {
  let providerSignal, calls = 0;
  const app = await fixture(t, { aiTimeoutMs: 25, aiFetch: async (_url, options) => {
    calls++; providerSignal = options.signal;
    return new Response(new ReadableStream({}), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  const result = events(await (await app.chat()).text());
  assert.equal(result.at(-1).data.code, 'AI_TIMEOUT'); assert.equal(providerSignal.aborted, true);
  let bodyCancelled = false;
  const response = await app.call('/api/ai/chat', { method: 'POST', token: app.account.token, body: new ReadableStream({ cancel() { bodyCancelled = true; } }) });
  assert.equal(response.status, 504); assert.equal((await response.json()).code, 'AI_TIMEOUT'); assert.equal(bodyCancelled, true); assert.equal(calls, 1);
});

test('DONE cancels an unfinished upstream transport immediately', async t => {
  let providerSignal, cancelled = false;
  const app = await fixture(t, { aiFetch: async (_url, options) => {
    providerSignal = options.signal;
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(encoder.encode(validStream)); }, cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  const result = events(await (await app.chat()).text());
  assert.equal(result.at(-1).event, 'done'); assert.equal(providerSignal.aborted, true); assert.equal(cancelled, true);
});

test('provider output and unterminated buffer caps end with safe errors', async t => {
  const app = await fixture(t);
  for (const [text, code] of [[delta('x'.repeat(16385)), 'AI_OUTPUT_LIMIT'], ['data: ' + 'x'.repeat(70000), 'AI_STREAM_INVALID']]) {
    app.context.aiFetch = async () => provider(text);
    const result = events(await (await app.chat()).text());
    assert.equal(result.at(-1).data.code, code); assert.ok(!result.some(item => item.event === 'done'));
  }
});

test('explicit local credential file hot reloads without revealing secrets or accepting malformed files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'xingyu-ai-test-'));
  const aiConfigFile = join(directory, '.env.ai.local.json');
  await writeFile(aiConfigFile, JSON.stringify({ TENCENT_API_KEY: 'test-key-not-real', TENCENT_AI_MODEL: 'hy3' }));
  const server = await createApiServer({ dataDir: join(directory, 'data'), aiConfigFile });
  t.after(async () => {
    await server.close();
    const target = resolve(directory), root = resolve(tmpdir());
    assert.ok(target.startsWith(root + sep) && target.slice(root.length + 1).startsWith('xingyu-ai-test-'));
    await rm(target, { recursive: true, force: true });
  });
  const first = await (await fetch(`${server.url}/api/ai/status`)).json();
  assert.equal(first.configured, true); assert.equal(first.model, 'hy3'); assert.doesNotMatch(JSON.stringify(first), /test-key-not-real/);
  await writeFile(aiConfigFile, JSON.stringify({ TENCENT_API_KEY: 'test-key-not-real', TENCENT_AI_ENDPOINT: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions' }));
  const second = await (await fetch(`${server.url}/api/ai/status`)).json();
  assert.equal(second.configured, true); assert.equal(second.model, 'hunyuan-turbos-latest');
  await writeFile(aiConfigFile, '{private-invalid-secret');
  const invalid = await (await fetch(`${server.url}/api/ai/status`)).json();
  assert.equal(invalid.configured, false); assert.doesNotMatch(JSON.stringify(invalid), /private-invalid-secret/);
  await writeFile(aiConfigFile, JSON.stringify({ TENCENT_API_KEY: 'x'.repeat(20000) }));
  assert.equal((await (await fetch(`${server.url}/api/ai/status`)).json()).configured, false);
});
