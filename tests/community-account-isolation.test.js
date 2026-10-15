import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Run the production client in a deterministic host, without a browser/network.
const hooks = registerHooks({ load(url, context, nextLoad) {
  const result = nextLoad(url, context);
  if (url.split('?')[0].endsWith('/src/communityClient.js')) return { ...result, source: result.source.toString().replaceAll('import.meta.env.', '({VITE_COMMUNITY_API_URL:"https://community.example.test/",VITE_COMMUNITY_MODE:"shared"}).') };
  if (url.endsWith('/src/assets.js')) return { ...result, source: result.source.toString().replace('import.meta.env.BASE_URL', '"/"') };
  return result;
} });
const tokenKey = 'xingyu-account:https://community.example.test';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const publicPost = { id: 'public-post', title: 'Public', content: 'Public content', visibility: 'public', images: [] };
const privatePost = (owner, images = []) => ({ id: `private-${owner}`, author: owner, title: `Private ${owner}`, content: `Private content of ${owner}`, visibility: 'private', images });
const flush = () => new Promise(resolve => setImmediate(resolve));
let sequence = 0;

async function fixture(t, initialize = true) {
  const descriptors = new Map(['window', 'localStorage', 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const saved = new Map([[tokenKey, 'token-A']]);
  const listeners = new Map(), tasks = [], gates = [], created = [], revoked = [];
  const owner = options => new Headers(options.headers).get('Authorization')?.replace('Bearer token-', '') || '';
  const defaultFetch = async (url, options) => {
    const path = new URL(url).pathname, id = owner(options);
    if (path === '/api/auth/me') return json({ user: { id, name: id } });
    if (path === '/api/auth/logout') return json({ ok: true });
    return json({ posts: id ? [publicPost, privatePost(id)] : [publicPost] });
  };
  Object.assign(globalThis, {
    window: { location: { origin: 'https://site.example.test' }, addEventListener: (name, handler) => listeners.set(name, handler) },
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    fetch: defaultFetch,
  });
  URL.createObjectURL = blob => { const url = `blob:fixture-${created.length}`; created.push({ url, blob }); return url; };
  URL.revokeObjectURL = url => revoked.push(url);
  t.after(async () => {
    for (const gate of gates) gate.resolve(gate.fallback);
    await Promise.allSettled(tasks);
    for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
    Object.defineProperty(URL, 'createObjectURL', createDescriptor);
    Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
  });
  const client = await import(`../src/communityClient.js?account-isolation=${++sequence}`);
  const store = client.useCommunityStore();
  const track = promise => { tasks.push(promise); promise.catch(() => {}); return promise; };
  const defer = (fallback = json({ posts: [] })) => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const gate = { promise, resolve, reject, fallback }; gates.push(gate); return gate;
  };
  const switchAccount = id => {
    saved.set(tokenKey, `token-${id}`);
    return track(listeners.get('storage')({ key: tokenKey, newValue: `token-${id}` }));
  };
  if (initialize) await store.initialize();
  return { store, client, saved, owner, defaultFetch, track, defer, switchAccount, created, revoked };
}

test('an account switch removes private content immediately and loads B independently of an older A load', async t => {
  const f = await fixture(t), a = f.defer(), b = f.defer();
  let bLoads = 0;
  globalThis.fetch = (url, options) => {
    if (new URL(url).pathname !== '/api/posts') return f.defaultFetch(url, options);
    if (f.owner(options) === 'B') { bLoads++; return b.promise; }
    return a.promise;
  };
  const oldLoad = f.track(f.store.loadPosts());
  const switching = f.switchAccount('B');
  assert.deepEqual(f.store.state.posts.map(post => post.id), ['public-post']);
  await flush();
  assert.equal(bLoads, 1);
  a.resolve(json({ posts: [privatePost('A')] }));
  await oldLoad;
  assert.equal(f.store.state.loading, true);
  assert.equal(f.store.state.error, '');
  assert.equal(f.store.state.posts.some(post => post.id === 'private-A'), false);
  b.resolve(json({ posts: [publicPost, privatePost('B')] }));
  await switching;
  assert.equal(f.store.state.user.id, 'B');
  assert.deepEqual(f.store.state.posts.map(post => post.id), ['public-post', 'private-B']);
  assert.equal(f.store.state.loading, false);
});

test('a late A failure cannot replace the error from B or clear its loading state', async t => {
  const f = await fixture(t), a = f.defer();
  globalThis.fetch = (url, options) => {
    if (new URL(url).pathname !== '/api/posts') return f.defaultFetch(url, options);
    return f.owner(options) === 'A' ? a.promise : Promise.resolve(json({ error: 'B current load failed' }, 503));
  };
  const oldLoad = f.track(f.store.loadPosts());
  const switching = f.switchAccount('B');
  await flush();
  const currentError = f.store.state.error;
  a.reject(new TypeError('A stale network failure'));
  await Promise.all([oldLoad, switching]);
  assert.equal(currentError, 'B current load failed');
  assert.equal(f.store.state.error, 'B current load failed');
  assert.equal(f.store.state.loading, false);
});

test('logout immediately removes private posts and ignores the pending authenticated response', async t => {
  const f = await fixture(t), a = f.defer(), guest = f.defer();
  globalThis.fetch = (url, options) => {
    if (new URL(url).pathname !== '/api/posts') return f.defaultFetch(url, options);
    return f.owner(options) ? a.promise : guest.promise;
  };
  const oldLoad = f.track(f.store.loadPosts());
  const logout = f.track(f.store.logout());
  assert.equal(f.client.getCommunityToken(), '');
  assert.equal(f.store.state.user, null);
  assert.deepEqual(f.store.state.posts.map(post => post.id), ['public-post']);
  await flush();
  a.resolve(json({ posts: [privatePost('A')] }));
  await oldLoad;
  assert.equal(f.store.state.loading, true);
  guest.resolve(json({ posts: [publicPost] }));
  await logout;
  assert.deepEqual(f.store.state.posts.map(post => post.id), ['public-post']);
});

test('an explicit current-session 401 also removes private posts while preserving public posts', async t => {
  const f = await fixture(t);
  globalThis.fetch = async () => json({ error: 'Expired', code: 'SESSION_EXPIRED' }, 401);
  await assert.rejects(f.store.login({ username: 'fixture', password: 'fixture-only-password' }));
  assert.equal(f.client.getCommunityToken(), '');
  assert.equal(f.store.state.user, null);
  assert.deepEqual(f.store.state.posts.map(post => post.id), ['public-post']);
});

for (const phase of ['headers', 'body']) test(`a private media ${phase} response arriving after a switch is never cached or displayed`, async t => {
  const f = await fixture(t), gate = f.defer(phase === 'body' ? new Blob(['fixture']) : new Response('fixture'));
  let mediaStarted = false, mediaToken;
  globalThis.fetch = (url, options) => {
    const path = new URL(url).pathname;
    if (path === '/api/media/fixture-A') {
      mediaStarted = true; mediaToken = new Headers(options.headers).get('Authorization');
      return phase === 'headers' ? gate.promise : Promise.resolve({ ok: true, blob: () => gate.promise });
    }
    if (path === '/api/posts' && f.owner(options) === 'A') return Promise.resolve(json({ posts: [privatePost('A', ['/api/media/fixture-A'])] }));
    return f.defaultFetch(url, options);
  };
  const oldLoad = f.track(f.store.loadPosts());
  await flush();
  assert.equal(mediaStarted, true);
  assert.equal(mediaToken, 'Bearer token-A');
  const switching = f.switchAccount('B');
  await flush();
  gate.resolve(phase === 'headers' ? new Response('fixture') : new Blob(['fixture']));
  await Promise.all([oldLoad, switching]);
  assert.equal(f.created.length, 0);
  assert.equal(f.store.state.user.id, 'B');
  assert.deepEqual(f.store.state.posts.map(post => post.id), ['public-post', 'private-B']);
});

test('current private media is displayed and reused only until the session changes', async t => {
  const f = await fixture(t);
  let mediaLoads = 0;
  globalThis.fetch = (url, options) => {
    if (new URL(url).pathname === '/api/media/fixture-A') { mediaLoads++; return Promise.resolve(new Response('fixture')); }
    if (new URL(url).pathname === '/api/posts' && f.owner(options) === 'A') return Promise.resolve(json({ posts: [publicPost, privatePost('A', ['/api/media/fixture-A'])] }));
    return f.defaultFetch(url, options);
  };
  await f.store.loadPosts();
  const imageUrl = f.store.state.posts.find(post => post.id === 'private-A').images[0].url;
  assert.match(imageUrl, /^blob:/);
  await f.store.loadPosts();
  assert.equal(mediaLoads, 1);
  const switching = f.switchAccount('B');
  assert.deepEqual(f.revoked, [imageUrl]);
  assert.deepEqual(f.store.state.posts.map(post => post.id), ['public-post']);
  await switching;
  assert.equal(f.store.state.user.id, 'B');
});

test('an initial account lookup failure remains visible when public posts load successfully', async t => {
  const f = await fixture(t, false);
  globalThis.fetch = async url => new URL(url).pathname === '/api/auth/me' ? json({ error: 'Account lookup temporarily unavailable' }, 503) : json({ posts: [publicPost] });
  await f.store.initialize();
  assert.equal(f.client.getCommunityToken(), 'token-A');
  assert.equal(f.saved.get(tokenKey), 'token-A');
  assert.equal(f.store.state.user, null);
  assert.equal(f.store.state.ready, true);
  assert.equal(f.store.state.error, 'Account lookup temporarily unavailable');
  globalThis.fetch = f.defaultFetch;
  await f.store.initialize();
  assert.equal(f.store.state.user.id, 'A');
  assert.equal(f.store.state.error, '');
});

test('a private publication response for A cannot enter B after the account switches', async t => {
  const f = await fixture(t), publication = f.defer(json({ id: 'published-by-A' }));
  let posted = false;
  globalThis.fetch = (url, options) => {
    if (new URL(url).pathname === '/api/posts' && options.method === 'POST') { posted = true; return publication.promise; }
    return f.defaultFetch(url, options);
  };
  const pending = f.track(f.store.publishPost({ title: 'A private draft', content: 'A private body', visibility: 'private', type: 'article', category: '学习交流' }));
  await flush();
  assert.equal(posted, true);
  await f.switchAccount('B');
  publication.resolve(json({ id: 'published-by-A' }));
  await assert.rejects(pending, /账号已变化/);
  assert.equal(f.store.state.user.id, 'B');
  assert.deepEqual(f.store.state.posts.map(post => post.id), ['public-post', 'private-B']);
});

test('manual diagnostics probe the JSON registration route with only an empty invalid object', async t => {
  const f = await fixture(t), requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return new URL(url).pathname === '/api/auth/register' ? json({ code: 'VALIDATION', error: 'must-not-be-reported' }, 400) : json({ private: 'must-not-be-reported' });
  };
  const result = await f.client.checkCommunityConnection();
  assert.equal(requests.length, 4);
  const registration = requests.find(request => new URL(request.url).pathname === '/api/auth/register').options;
  assert.equal(registration.method, 'POST');
  assert.equal(registration.credentials, 'omit');
  assert.equal(registration.mode, 'cors');
  assert.equal(registration.body, '{}');
  assert.deepEqual(registration.headers, { 'Content-Type': 'application/json' });
  assert.deepEqual(result.checks.at(-1), { label: '注册接口校验', status: 'ok', httpStatus: 400, expected: true });
  assert.doesNotMatch(JSON.stringify(result), /must-not-be-reported|token-A|Private content/);
  globalThis.fetch = async url => new URL(url).pathname === '/api/auth/register' ? json({ code: 'OTHER' }, 400) : json({});
  assert.deepEqual((await f.client.checkCommunityConnection()).checks.at(-1), { label: '注册接口校验', status: 'http', httpStatus: 400, expected: false });
});

process.once('exit', () => hooks.deregister());
