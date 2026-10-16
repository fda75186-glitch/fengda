import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const hooks = registerHooks({ load(url, context, nextLoad) {
  const result = nextLoad(url, context);
  if (url.split('?')[0].endsWith('/src/communityClient.js')) return { ...result, source: result.source.toString().replaceAll('import.meta.env.', '({VITE_COMMUNITY_API_URL:"https://community.example.test/",VITE_COMMUNITY_MODE:"shared"}).') };
  if (url.endsWith('/src/assets.js')) return { ...result, source: result.source.toString().replace('import.meta.env.BASE_URL', '"/"') };
  return result;
} });
const tokenKey = 'xingyu-account:https://community.example.test';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const post = { id: 'loaded-post', title: 'Fixture', content: 'Fixture content', visibility: 'public', images: [], comments: [] };
const flush = () => new Promise(resolve => setImmediate(resolve));
let sequence = 0;

async function fixture(t, signedIn = false) {
  const descriptors = new Map(['window', 'localStorage', 'fetch', 'EventSource', 'setTimeout', 'clearTimeout'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const savedNow = Date.now, saved = new Map(signedIn ? [[tokenKey, 'token-A']] : []);
  const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const sources = [], calls = [], gates = [], tasks = [], listeners = new Map();
  let clock = 1000;
  class Source {
    constructor() { this.handlers = new Map(); sources.push(this); }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    emit(revision) { return this.handlers.get('change')?.({ data: String(revision) }); }
    close() {}
  }
  const defaultFetch = async (url, options) => {
    const path = new URL(url).pathname;
    if (path === '/api/auth/me') { const id = new Headers(options.headers).get('Authorization')?.endsWith('token-B') ? 'B' : 'A'; return json({ user: { id, name: id } }); }
    if (path === '/api/auth/login') return json({ user: { id: 'A', name: 'A' }, token: 'token-A' });
    if (path === '/api/posts') return json({ posts: [post], revision: 7 });
    return json({ ok: true });
  };
  let respond = defaultFetch;
  Object.assign(globalThis, {
    window: { location: { origin: 'https://site.example.test' }, EventSource: Source, addEventListener: (name, handler) => listeners.set(name, handler) },
    EventSource: Source,
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    fetch: (url, options) => { calls.push({ path: new URL(url).pathname, ...options }); return respond(url, options); },
  });
  Date.now = () => clock;
  let blobs = 0;
  URL.createObjectURL = () => `blob:performance-fixture-${++blobs}`;
  URL.revokeObjectURL = () => {};
  const client = await import(`../src/communityClient.js?feed-performance=${++sequence}`), store = client.useCommunityStore();
  const track = promise => { tasks.push(promise); promise.catch(() => {}); return promise; };
  t.after(async () => {
    for (const gate of gates) gate.resolve(gate.fallback);
    await Promise.allSettled(tasks);
    await flush();
    for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
    Date.now = savedNow;
    Object.defineProperty(URL, 'createObjectURL', createDescriptor);
    Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
  });
  return {
    client, store, calls, sources, track, defaultFetch,
    respond: handler => { respond = handler; },
    advance: ms => { clock += ms; },
    postReads: () => calls.filter(call => call.path === '/api/posts' && (call.method || 'GET') === 'GET').length,
    switchAccount: id => { saved.set(tokenKey, `token-${id}`); return track(listeners.get('storage')({ key: tokenKey, newValue: `token-${id}` })); },
    defer(fallback = json({ posts: [], revision: 7 })) { let resolve; const promise = new Promise(yes => { resolve = yes; }); const gate = { promise, resolve, fallback }; gates.push(gate); return gate; },
  };
}

test('successful login resolves while its session-guarded feed refresh is still pending', async t => {
  const f = await fixture(t), feed = f.defer();
  f.respond((url, options) => new URL(url).pathname === '/api/posts' ? feed.promise : f.defaultFetch(url, options));
  let resolved = false;
  const login = f.track(f.store.login({ username: 'fixture', password: 'fixture-only-password' }));
  login.then(() => { resolved = true; });
  await flush();
  assert.equal(f.store.state.user.id, 'A');
  assert.equal(resolved, true);
  assert.equal(f.store.state.loading, true);
  feed.resolve(json({ posts: [post], revision: 7 }));
  await login;
  await flush();
  assert.equal(f.store.state.posts[0].id, post.id);
});

test('a background login refresh failure is reported by the feed without undoing successful login', async t => {
  const f = await fixture(t), feed = f.defer(json({ error: 'Feed unavailable' }, 503));
  f.respond((url, options) => new URL(url).pathname === '/api/posts' ? feed.promise : f.defaultFetch(url, options));
  const login = f.track(f.store.login({ username: 'fixture', password: 'fixture-only-password' }));
  await flush();
  feed.resolve(json({ error: 'Feed unavailable' }, 503));
  assert.equal((await login).id, 'A');
  await flush();
  assert.equal(f.store.state.user.id, 'A');
  assert.equal(f.client.getCommunityToken(), 'token-A');
  assert.equal(f.store.state.error, 'Feed unavailable');
});

test('a late background login refresh cannot clear or overwrite a newer account', async t => {
  const f = await fixture(t), older = f.defer();
  f.respond((url, options) => new URL(url).pathname === '/api/posts' && new Headers(options.headers).get('Authorization') === 'Bearer token-A' ? older.promise : f.defaultFetch(url, options));
  await f.store.login({ username: 'fixture', password: 'fixture-only-password' });
  await f.switchAccount('B');
  older.resolve(json({ error: 'A stale expired session' }, 401));
  await flush();
  assert.equal(f.store.state.user.id, 'B');
  assert.equal(f.client.getCommunityToken(), 'token-B');
  assert.equal(f.store.state.error, '');
  assert.equal(f.sources.length, 1);
});

test('passive reads reuse a fresh session snapshot; explicit load and expired freshness still fetch', async t => {
  const f = await fixture(t);
  await f.store.initialize();
  assert.equal(f.postReads(), 1);
  await f.store.ensurePosts();
  await f.store.ensurePosts();
  assert.equal((await f.store.getPost(post.id)).id, post.id);
  assert.equal(f.postReads(), 1);
  await f.store.loadPosts();
  assert.equal(f.postReads(), 2);
  f.advance(5001);
  await f.store.ensurePosts();
  assert.equal(f.postReads(), 3);
});

test('freshness never reuses a previous account feed after a storage switch', async t => {
  const f = await fixture(t, true);
  await f.store.initialize();
  await f.switchAccount('B');
  assert.equal(f.store.state.user.id, 'B');
  assert.equal(f.postReads(), 2);
  await f.store.ensurePosts();
  assert.equal(f.postReads(), 2);
});

test('SSE skips known revisions, refreshes newer revisions, and keeps legacy responses safe', async t => {
  const f = await fixture(t);
  await f.store.initialize();
  f.sources[0].emit(7);
  await flush();
  assert.equal(f.postReads(), 1);
  f.respond((url, options) => new URL(url).pathname === '/api/posts' ? Promise.resolve(json({ posts: [post], revision: 8 })) : f.defaultFetch(url, options));
  f.sources[0].emit(8);
  await flush();
  assert.equal(f.postReads(), 2);
  f.sources[0].emit(8);
  await flush();
  assert.equal(f.postReads(), 2);
  f.respond((url, options) => new URL(url).pathname === '/api/posts' ? Promise.resolve(json({ posts: [post] })) : f.defaultFetch(url, options));
  await f.store.loadPosts();
  f.sources[0].emit(8);
  await flush();
  assert.equal(f.postReads(), 4);
});

test('a mutation event during a feed read gets a follow-up read if that snapshot predates the event', async t => {
  const f = await fixture(t), older = f.defer();
  await f.store.initialize();
  let reads = 0;
  f.respond((url, options) => {
    if (new URL(url).pathname !== '/api/posts') return f.defaultFetch(url, options);
    return ++reads === 1 ? older.promise : Promise.resolve(json({ posts: [{ ...post, content: 'Newer content' }], revision: 8 }));
  });
  const pending = f.track(f.store.loadPosts());
  f.sources[0].emit(8);
  older.resolve(json({ posts: [post], revision: 7 }));
  await pending;
  await flush();
  assert.equal(reads, 2);
  assert.equal(f.store.state.posts[0].content, 'Newer content');
});

test('a committed feed with an attachment failure still follows a newer SSE revision', async t => {
  const f = await fixture(t, true), older = f.defer();
  await f.store.initialize();
  let reads = 0;
  f.respond((url, options) => {
    const path = new URL(url).pathname;
    if (path === '/api/media/missing') return Promise.resolve(json({}, 404));
    if (path !== '/api/posts') return f.defaultFetch(url, options);
    return ++reads === 1 ? older.promise : Promise.resolve(json({ posts: [{ ...post, content: 'Revision 9 content' }], revision: 9 }));
  });
  const pending = f.track(f.store.loadPosts());
  f.sources[0].emit(9);
  older.resolve(json({ posts: [{ ...post, visibility: 'private', images: ['/api/media/missing'] }], revision: 8 }));
  await pending;
  await flush();
  assert.equal(reads, 2);
  assert.equal(f.store.state.posts[0].content, 'Revision 9 content');
  assert.equal(f.store.state.error, '');
});

test('a failed feed read does not automatically retry an outstanding SSE revision', async t => {
  const f = await fixture(t), failed = f.defer(json({ error: 'Feed unavailable' }, 503));
  await f.store.initialize();
  let reads = 0;
  f.respond((url, options) => {
    if (new URL(url).pathname !== '/api/posts') return f.defaultFetch(url, options);
    reads++; return failed.promise;
  });
  f.sources[0].emit(8);
  failed.resolve(json({ error: 'Feed unavailable' }, 503));
  await flush();
  assert.equal(reads, 1);
  assert.equal(f.store.state.error, 'Feed unavailable');
});

test('own writes refresh even a fresh feed and the matching SSE event adds no duplicate read', async t => {
  const f = await fixture(t, true);
  await f.store.initialize();
  f.respond((url, options) => new URL(url).pathname === '/api/posts' ? Promise.resolve(json({ posts: [post], revision: 8 })) : f.defaultFetch(url, options));
  await f.store.likePost(post.id);
  assert.equal(f.postReads(), 2);
  f.sources[0].emit(8);
  await flush();
  assert.equal(f.postReads(), 2);
});

test('concurrent references to one private attachment share one bounded download', async t => {
  const f = await fixture(t, true), media = f.defer(new Response('fixture-media'));
  await f.store.initialize();
  let downloads = 0;
  f.respond((url, options) => {
    const path = new URL(url).pathname;
    if (path === '/api/media/reused') { downloads++; return media.promise; }
    if (path === '/api/posts') return Promise.resolve(json({ posts: Array.from({ length: 12 }, (_, index) => ({ ...post, id: `private-${index}`, visibility: 'private', images: ['/api/media/reused'] })), revision: 7 }));
    return f.defaultFetch(url, options);
  });
  const pending = f.track(f.store.loadPosts());
  await flush();
  assert.equal(downloads, 1);
  media.resolve(new Response('fixture-media'));
  await pending;
  assert.equal(new Set(f.store.state.posts.map(item => item.images[0].url)).size, 1);
});

test('a stalled private attachment aborts at its own deadline and leaves the feed retryable', async t => {
  const f = await fixture(t, true);
  await f.store.initialize();
  const originalSetTimeout = globalThis.setTimeout;
  let deadlines = 0;
  globalThis.setTimeout = (callback, delay, ...args) => {
    if (delay === 15000) { deadlines++; queueMicrotask(callback); return 0; }
    return originalSetTimeout(callback, delay, ...args);
  };
  f.respond((url, options) => {
    const path = new URL(url).pathname;
    if (path === '/api/media/stalled') return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
    if (path === '/api/posts') return Promise.resolve(json({ posts: [{ ...post, visibility: 'private', images: ['/api/media/stalled'] }], revision: 7 }));
    return f.defaultFetch(url, options);
  });
  await f.store.loadPosts();
  assert.equal(deadlines, 1);
  assert.equal(f.store.state.loading, false);
  assert.match(f.store.state.error, /附件.*超时/);
  f.respond(f.defaultFetch);
  await f.store.loadPosts();
  assert.equal(f.store.state.error, '');
});

test('private videos retain a 180 second transfer window instead of the shorter image deadline', async t => {
  const f = await fixture(t, true);
  await f.store.initialize();
  const originalSetTimeout = globalThis.setTimeout, deadlines = [];
  globalThis.setTimeout = (callback, delay, ...args) => { deadlines.push(delay); return originalSetTimeout(callback, delay, ...args); };
  f.respond((url, options) => {
    const path = new URL(url).pathname;
    if (path === '/api/media/video') return Promise.resolve(new Response('fixture-video'));
    if (path === '/api/posts') return Promise.resolve(json({ posts: [{ ...post, type: 'video', visibility: 'private', videoUrl: '/api/media/video' }], revision: 7 }));
    return f.defaultFetch(url, options);
  });
  await f.store.loadPosts();
  assert.equal(deadlines.includes(180000), true);
  assert.equal(deadlines.includes(15000), false);
  assert.match(f.store.state.posts[0].video.url, /^blob:/);
});

process.once('exit', () => hooks.deregister());
