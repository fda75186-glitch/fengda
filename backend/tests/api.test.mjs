import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleApi } from '../api.mjs';
import { createLocalStorage } from '../local-adapter.mjs';

test('real accounts, ownership, privacy, media validation and video byte ranges', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'xingyu-api-013-'));
  const storage = await createLocalStorage(directory);
  const context = { ...storage, allowLoopback: true, allowedOrigins: [] };
  async function request(path, { method = 'GET', token, input, bytes, mime, headers = {} } = {}) {
    const auth = token ? { Authorization: `Bearer ${token}` } : {};
    return handleApi(new Request(`http://127.0.0.1:40000${path}`, { method, headers: { ...auth, ...(input ? { 'Content-Type': 'application/json' } : {}), ...(mime ? { 'Content-Type': mime } : {}), ...headers }, ...(input ? { body: JSON.stringify(input) } : {}), ...(bytes ? { body: bytes } : {}) }), context);
  }
  async function data(response, status = 200) { assert.equal(response.status, status); return response.json(); }
  try {
    const alice = await data(await request('/api/auth/register', { method: 'POST', input: { username: '观星者Ａ', password: 'an-example-password-013' } }), 201);
    assert.equal(alice.user.name, '观星者A');
    assert.equal(alice.user.avatar, null);
    assert.ok(alice.expiresAt > Date.now());
    assert.equal((await request('/api/auth/register', { method: 'POST', input: { username: '观星者A', password: 'an-example-password-013' } })).status, 409);
    assert.equal((await request('/api/auth/login', { method: 'POST', input: { username: '观星者A', password: 'wrong-password' } })).status, 401);
    const relogin = await data(await request('/api/auth/login', { method: 'POST', input: { username: '观星者A', password: 'an-example-password-013' } }));
    assert.equal(relogin.user.id, alice.user.id);
    const bob = await data(await request('/api/auth/register', { method: 'POST', input: { username: '另一个观星者', password: 'another-example-password-013' } }), 201);
    const me = await data(await request('/api/auth/me', { token: alice.token }));
    assert.equal(me.user.id, alice.user.id);
    assert.equal('token' in me, false);
    const draft = { title: '今天看到的月亮', content: '月相会随着月球绕地球运行而变化。', category: '观星日记', kind: 'image', images: [], topics: ['月球'] };
    assert.equal((await request('/api/posts', { method: 'POST', input: draft })).status, 401);
    assert.equal((await request('/api/media', { method: 'POST', token: alice.token, bytes: new Uint8Array(30), mime: 'image/png' })).status, 415);
    assert.equal((await request('/api/media', { method: 'POST', token: alice.token, bytes: new Uint8Array(30), mime: 'text/html' })).status, 415);
    assert.equal((await request('/api/media', { method: 'POST', token: alice.token, bytes: new Uint8Array(30), mime: 'video/mp4', headers: { 'Content-Length': String(51 * 1024 * 1024) } })).status, 413);
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    const uploaded = await data(await request('/api/media', { method: 'POST', token: alice.token, bytes: png, mime: 'image/png' }), 201);
    assert.equal((await request('/api/posts', { method: 'POST', token: bob.token, input: { ...draft, images: [uploaded.url] } })).status, 403);
    assert.equal((await request('/api/posts', { method: 'POST', token: alice.token, input: { ...draft, images: ['javascript:alert(1)'] } })).status, 400);
    const posted = await data(await request('/api/posts', { method: 'POST', token: alice.token, input: { ...draft, author: '伪造作者', images: [uploaded.url] } }), 201);
    const anonymous = await data(await request('/api/posts'));
    assert.equal(anonymous.posts[0].author, alice.user.name);
    assert.equal(anonymous.posts[0].owned, false);
    assert.equal((await request(uploaded.url)).status, 200);
    assert.equal((await request(`/api/posts/${posted.id}/delete`, { method: 'POST', token: bob.token, input: {} })).status, 403);
    await data(await request(`/api/posts/${posted.id}/like`, { method: 'POST', token: bob.token, input: {} }));
    await data(await request(`/api/posts/${posted.id}/comments`, { method: 'POST', token: bob.token, input: { author: '假作者', content: '谢谢分享观察记录。' } }), 201);
    const publicAfter = (await data(await request('/api/posts', { token: bob.token }))).posts[0];
    assert.equal(publicAfter.likes, 1);
    assert.equal(publicAfter.liked, true);
    assert.equal(publicAfter.comments[0].author, bob.user.name);
    const privateMedia = await data(await request('/api/media', { method: 'POST', token: alice.token, bytes: png, mime: 'image/png' }), 201);
    const privatePost = await data(await request('/api/posts', { method: 'POST', token: alice.token, input: { ...draft, images: [privateMedia.url], visibility: 'private' } }), 201);
    assert.equal((await data(await request('/api/posts'))).posts.length, 1);
    assert.equal((await data(await request('/api/posts', { token: bob.token }))).posts.length, 1);
    assert.equal((await data(await request('/api/posts', { token: relogin.token }))).posts.length, 2);
    assert.equal((await request(privateMedia.url)).status, 404);
    assert.equal((await request(privateMedia.url, { token: bob.token })).status, 404);
    assert.equal((await request(privateMedia.url, { token: relogin.token })).status, 200);
    assert.equal((await request(`/api/posts/${privatePost.id}/comments`, { method: 'POST', token: bob.token, input: { content: '不能访问私密帖子' } })).status, 404);
    const mp4 = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 105, 115, 111, 109, 0, 0, 0, 0, 105, 115, 111, 109, 109, 112, 52, 50]);
    const video = await data(await request('/api/media', { method: 'POST', token: alice.token, bytes: mp4, mime: 'video/mp4' }), 201);
    await data(await request('/api/posts', { method: 'POST', token: alice.token, input: { ...draft, kind: 'video', video: video.url } }), 201);
    const ranged = await request(video.url, { headers: { Range: 'bytes=4-7' } });
    assert.equal(ranged.status, 206);
    assert.equal(ranged.headers.get('Content-Type'), 'video/mp4');
    assert.equal(ranged.headers.get('Content-Range'), 'bytes 4-7/24');
    assert.equal(new TextDecoder().decode(await ranged.arrayBuffer()), 'ftyp');
    assert.equal((await request(video.url, { headers: { Range: 'bytes=900-1000' } })).status, 416);
    await data(await request('/api/auth/logout', { method: 'POST', token: alice.token }));
    assert.equal((await request('/api/auth/me', { token: alice.token })).status, 401);
    assert.equal((await request('/api/auth/me', { token: relogin.token })).status, 200);
    const stored = await storage.DB.prepare('SELECT password_hash,salt FROM accounts WHERE id=?').bind(alice.user.id).first();
    assert.notEqual(stored.password_hash, 'an-example-password-013');
    assert.equal(stored.salt.length, 32);
    assert.equal((await request('/api/health', { headers: { Origin: 'https://evil.example' } })).status, 403);
  } finally {
    storage.close();
    await rm(directory, { recursive: true, force: true });
  }
});
