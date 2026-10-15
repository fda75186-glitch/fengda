import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Exercise the real client with an in-memory browser host; no UI or real network.
const hooks = registerHooks({ load(url, context, nextLoad) {
  const result = nextLoad(url, context);
  if (url.split('?')[0].endsWith('/src/communityClient.js')) return { ...result, source: result.source.toString().replaceAll('import.meta.env.', '({VITE_COMMUNITY_API_URL:"https://community.example.test/",VITE_COMMUNITY_MODE:"shared"}).') };
  if (url.endsWith('/src/assets.js')) return { ...result, source: result.source.toString().replace('import.meta.env.BASE_URL', '"/"') };
  return result;
} });
const tokenKey = 'xingyu-account:https://community.example.test';
const user = { id: 'existing-user', name: 'Observer' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
let sequence = 0;

async function fixture(callback) {
  const descriptors = new Map(['window', 'localStorage', 'fetch', 'setTimeout', 'clearTimeout'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const saved = new Map([[tokenKey, 'existing-session']]);
  Object.assign(globalThis, {
    window: { location: { origin: 'https://site.example.test' }, addEventListener() {} },
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    fetch: async url => new URL(url).pathname === '/api/auth/me' ? json({ user }) : json({ posts: [] }),
  });
  try {
    const client = await import(`../src/communityClient.js?connection-test=${++sequence}`);
    const store = client.useCommunityStore();
    await store.initialize();
    await callback({ store, client, saved });
  } finally {
    for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
}

test('temporary account lookup failure preserves the saved session and current identity', async () => {
  await fixture(async ({ store, client, saved }) => {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await store.initialize();
    assert.equal(client.getCommunityToken(), 'existing-session');
    assert.equal(saved.get(tokenKey), 'existing-session');
    assert.equal(store.state.user.id, user.id);
    assert.match(store.state.error, /当前网络.*共享社区/);
    assert.doesNotMatch(store.state.error, /预览|本地/);
  });
});

test('failed registration does not retry the POST, create a local account, or clear a session', async () => {
  await fixture(async ({ store, client, saved }) => {
    let requests = 0;
    globalThis.fetch = async (url, options) => {
      requests++;
      assert.equal(new URL(url).pathname, '/api/auth/register');
      assert.equal(options.method, 'POST');
      throw new TypeError('Failed to fetch');
    };
    await assert.rejects(store.register({ username: 'new-observer', password: 'isolated-test-only' }), error => {
      assert.equal(error.code, 'COMMUNITY_NETWORK');
      assert.match(error.message, /切换网络/);
      return true;
    });
    assert.equal(requests, 1);
    assert.equal(client.getCommunityToken(), 'existing-session');
    assert.equal(saved.get(tokenKey), 'existing-session');
    assert.equal(store.state.user.id, user.id);
  });
});

test('a timed out account lookup preserves the session and reports a timeout', async () => {
  await fixture(async ({ store, client, saved }) => {
    globalThis.setTimeout = callback => { queueMicrotask(callback); return 1; };
    globalThis.clearTimeout = () => {};
    globalThis.fetch = async (url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    await store.initialize();
    assert.match(store.state.error, /连接共享社区超时/);
    assert.equal(client.getCommunityToken(), 'existing-session');
    assert.equal(saved.get(tokenKey), 'existing-session');
    assert.equal(store.state.user.id, user.id);
  });
});

test('an explicit invalid-session response still clears the expired identity', async () => {
  await fixture(async ({ store, client, saved }) => {
    globalThis.fetch = async url => new URL(url).pathname === '/api/auth/me' ? json({ error: '登录已过期，请重新登录。', code: 'AUTH_REQUIRED' }, 401) : json({ posts: [] });
    await store.initialize();
    assert.equal(client.getCommunityToken(), '');
    assert.equal(saved.has(tokenKey), false);
    assert.equal(store.state.user, null);
  });
});

for (const status of [400, 401]) test(`server account errors (${status}) keep their real message and code`, async () => {
  await fixture(async ({ store }) => {
    const code = status === 401 ? 'BAD_CREDENTIALS' : 'VALIDATION';
    const message = status === 401 ? '用户名或密码不正确。' : '用户名长度应为 2 到 24 个字符。';
    globalThis.fetch = async () => json({ error: message, code }, status);
    await assert.rejects(store.login({ username: 'observer', password: 'isolated-test-only' }), error => {
      assert.equal(error.message, message);
      assert.equal(error.status, status);
      assert.equal(error.code, code);
      assert.doesNotMatch(error.code, /^COMMUNITY_/);
      return true;
    });
  });
});

test('a temporary server failure preserves the saved session', async () => {
  await fixture(async ({ store, client, saved }) => {
    globalThis.fetch = async () => json({ error: '服务繁忙，请稍后重试。' }, 503);
    await store.initialize();
    assert.equal(client.getCommunityToken(), 'existing-session');
    assert.equal(saved.get(tokenKey), 'existing-session');
    assert.equal(store.state.user.id, user.id);
    assert.equal(store.state.error, '服务繁忙，请稍后重试。');
  });
});

test('an unavailable endpoint has a public-service message and a safe unauthenticated health URL', async () => {
  await fixture(async ({ store, client }) => {
    globalThis.fetch = async () => json({}, 404);
    await assert.rejects(store.login({ username: 'observer', password: 'isolated-test-only' }), error => {
      assert.equal(error.code, 'COMMUNITY_ENDPOINT');
      assert.doesNotMatch(error.message, /预览|本地/);
      return true;
    });
    assert.equal(client.communityHealthUrl, 'https://community.example.test/api/health');
    assert.equal(new URL(client.communityHealthUrl).search, '');
  });
});

test('manual diagnostics use only fixed safe probes and never include the saved account credential or response data', async () => {
  await fixture(async ({ client }) => {
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, ...options });
      if (new URL(url).pathname === '/api/auth/register') return json({ code: 'VALIDATION', token: 'must-not-be-read' }, 400);
      return json({ token: 'must-not-be-read', posts: [{ title: 'must-not-be-read' }] }, new URL(url).pathname === '/api/posts' ? 503 : 200);
    };
    assert.equal(requests.length, 0);
    const result = await client.checkCommunityConnection();
    assert.deepEqual(requests.map(request => request.url), [
      'https://community.example.test/api/health',
      'https://community.example.test/api/posts',
      'https://community.example.test/api/health',
      'https://community.example.test/api/auth/register',
    ]);
    for (const [index, request] of requests.entries()) {
      assert.equal(request.method, index === 3 ? 'POST' : 'GET');
      assert.equal(request.credentials, 'omit');
      assert.equal(request.mode, 'cors');
      assert.equal(request.cache, 'no-store');
      assert.equal(request.body, index === 3 ? '{}' : undefined);
      assert.doesNotMatch(JSON.stringify(request), /existing-session/);
    }
    assert.deepEqual(requests.map(request => request.headers), [{}, {}, { Authorization: 'Bearer connection-check' }, { 'Content-Type': 'application/json' }]);
    assert.deepEqual(result, { origin: 'https://site.example.test', service: 'https://community.example.test', checks: [
      { label: '服务连接', status: 'ok', httpStatus: 200 },
      { label: '社区读取', status: 'http', httpStatus: 503 },
      { label: '跨域预检', status: 'ok', httpStatus: 200 },
      { label: '注册接口校验', status: 'ok', httpStatus: 400, expected: true },
    ] });
    assert.doesNotMatch(JSON.stringify(result), /must-not-be-read|existing-session/);
  });
});

test('manual diagnostics distinguish network failures from bounded timeouts without retrying', async () => {
  await fixture(async ({ client }) => {
    let requests = 0;
    globalThis.setTimeout = (callback, delay) => { assert.equal(delay, 8000); queueMicrotask(callback); return 1; };
    globalThis.clearTimeout = () => {};
    globalThis.fetch = async (url, { signal, headers }) => {
      requests++;
      if (new URL(url).pathname === '/api/auth/register') return json({ code: 'VALIDATION' }, 400);
      if (new URL(url).pathname === '/api/posts') throw new TypeError('private network detail');
      if (!headers.Authorization) return json({ status: 'ready' });
      return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    };
    const result = await client.checkCommunityConnection();
    assert.deepEqual(result.checks.map(check => check.status), ['ok', 'network', 'timeout', 'ok']);
    assert.equal(requests, 4);
    assert.doesNotMatch(JSON.stringify(result), /private network detail/);
  });
});

for (const [status, code] of [[200, 'VALIDATION'], [400, 'UNEXPECTED']]) test(`manual registration validation does not report unexpected response ${status}/${code} as healthy`, async () => {
  await fixture(async ({ client }) => {
    globalThis.fetch = async url => new URL(url).pathname === '/api/auth/register' ? json({ code }, status) : json({ status: 'ready' });
    const result = await client.checkCommunityConnection();
    assert.deepEqual(result.checks.at(-1), { label: '注册接口校验', status: 'http', httpStatus: status, expected: false });
  });
});

process.once('exit', () => hooks.deregister());
