import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { watch } from 'vue';

// Pure Node host substitutes; no browser, real accounts, or network requests.
const hooks = registerHooks({ load(url, context, nextLoad) {
  const result = nextLoad(url, context);
  if (url.split('?')[0].endsWith('/src/communityClient.js')) return { ...result, source: result.source.toString().replaceAll('import.meta.env.', '({VITE_COMMUNITY_API_URL:"http://127.0.0.1:63601/",VITE_COMMUNITY_MODE:"preview"}).') };
  if (url.endsWith('/src/assets.js')) return { ...result, source: result.source.toString().replace('import.meta.env.BASE_URL', '"/"') };
  return result;
} });
let sequence = 0;
const tokenKey = 'xingyu-account:http://127.0.0.1:63601';
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
async function fixture(callback) {
  const descriptors = new Map(['window', 'localStorage', 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const listeners = new Map(), saved = new Map([[tokenKey, 'old-session']]);
  let lookup = async () => json({ user: { id: 'old-user', name: 'Old' } });
  Object.assign(globalThis, {
    window: { location: { origin: 'http://127.0.0.1:63602' }, addEventListener: (name, fn) => listeners.set(name, fn) },
    localStorage: { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) },
    fetch: async (url, options) => new URL(url).pathname === '/api/auth/me' ? lookup(options) : json({ posts: [] }),
  });
  try {
    const client = await import(`../src/communityClient.js?session-test=${++sequence}`);
    const store = client.useCommunityStore();
    await store.initialize();
    await callback({ store, client, saved, storage: event => listeners.get('storage')(event), setLookup: fn => { lookup = fn; } });
  } finally {
    for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
}

test('another tab logging out immediately clears identity and notifies active AI watchers', async () => {
  await fixture(async ({ store, client, storage }) => {
    let stopped = false;
    const unwatch = watch(() => store.state.user, user => { if (!user) stopped = true; }, { flush: 'sync' });
    try {
      const update = storage({ key: tokenKey, newValue: null });
      assert.equal(store.state.user, null);
      assert.equal(client.getCommunityToken(), '');
      assert.equal(stopped, true);
      await update;
    } finally { unwatch(); }
  });
});

test('storage clear also invalidates the current community session', async () => {
  await fixture(async ({ store, client, storage }) => {
    await storage({ key: null, newValue: null });
    assert.equal(store.state.user, null);
    assert.equal(client.getCommunityToken(), '');
  });
});

for (const staleStatus of [200, 401]) test(`a stale account lookup (${staleStatus}) cannot restore or clear a newer identity`, async () => {
  await fixture(async ({ store, client, storage, setLookup, saved }) => {
    let finishOld;
    setLookup(() => new Promise(resolve => { finishOld = resolve; }));
    const oldLookup = store.initialize();
    setLookup(async options => {
      assert.equal(options.headers.get('Authorization'), 'Bearer new-session');
      return json({ user: { id: 'new-user', name: 'New' } });
    });
    saved.set(tokenKey, 'new-session');
    await storage({ key: tokenKey, newValue: 'new-session' });
    finishOld(json({ user: { id: 'old-user' } }, staleStatus));
    await oldLookup;
    assert.equal(store.state.user.id, 'new-user');
    assert.equal(client.getCommunityToken(), 'new-session');
    assert.equal(saved.get(tokenKey), 'new-session');
  });
});

process.once('exit', () => hooks.deregister());

test('an account change during media upload prevents any guarded AI publication under the new account', async () => {
  await fixture(async ({ store }) => {
    let writes = 0;
    globalThis.fetch = async (url, options) => {
      if (new URL(url).pathname === '/api/media') { store.state.user = { id: 'different-user' }; return json({ url: '/api/media/11111111-1111-4111-8111-111111111111' }); }
      if (options?.method === 'POST') writes++;
      return json({ posts: [] });
    };
    await assert.rejects(store.publishPost({ type: 'article', title: 'AI发布防护验证', content: '这是测试正文', images: [{ type: 'image/jpeg', size: 12 }] }, { ownerId: 'old-user', sessionToken: 'old-session', idempotencyKey: 'only-an-isolated-test' }), /账号已变化/);
    assert.equal(writes, 0);
  });
});

test('generated attachments reuse an owned media reference without reuploading on a confirmed retry', async () => {
  await fixture(async ({ store }) => {
    let uploads=0, writes=0;
    const media='/api/media/11111111-1111-4111-8111-111111111111';
    globalThis.fetch=async (url,options)=>{
      if(new URL(url).pathname==='/api/media'){uploads++;throw Error('must not upload again');}
      if(new URL(url).pathname==='/api/posts' && options.method==='POST'){
        writes++;assert.deepEqual(JSON.parse(options.body).images,[media]);
        assert.equal(options.headers.get('Idempotency-Key'),'image-post-confirmation');
        return json({id:'post-result'});
      }
      return json({posts:[]});
    };
    const payload={type:'article',title:'AI生成图片配文',content:'科普示意并非真实观测',images:[{ownedMedia:media,ownerId:'old-user'}]};
    await store.publishPost(payload,{ownerId:'old-user',sessionToken:'old-session',idempotencyKey:'image-post-confirmation'});
    assert.equal(uploads,0);assert.equal(writes,1);
    await assert.rejects(store.publishPost({...payload,images:[{ownedMedia:media,ownerId:'someone-else'}]}),/账号/);
    await assert.rejects(store.publishPost({...payload,images:[{ownedMedia:'https://hostile.invalid/image',ownerId:'old-user'}]}),/附件格式/);
    assert.equal(writes,1);
  });
});
