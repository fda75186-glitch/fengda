import assert from 'node:assert/strict';
import test from 'node:test';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { handleApi } from '../api.mjs';
import { createFixture, fixtureOwner, fixtureToken, fixturePassword, legacyFeedSql, legacyCommentsSql } from '../../tools/perf-feed-query.mjs';

async function feed(fixture, token = '') {
  const response = await handleApi(new Request('https://fixture.test/api/posts', { headers: token ? { Authorization: 'Bearer ' + token } : {} }), fixture.context);
  assert.equal(response.status, 200);
  return response.json();
}

for (const authenticated of [false, true]) {
  test(`feed preserves visible posts, stable ties, likes, and all bounded comments (${authenticated ? 'owner' : 'anonymous'})`, async t => {
    const fixture = await createFixture(); t.after(fixture.close);
    const owner = authenticated ? fixtureOwner : '';
    const expected = fixture.database.prepare(legacyFeedSql).all(owner, owner);
    const comments = fixture.database.prepare(legacyCommentsSql).all(owner);
    const result = await feed(fixture, authenticated ? fixtureToken : '');
    assert.equal(result.revision, 0);
    assert.equal(result.posts.length, 200);
    assert.deepEqual(result.posts.map(post => post.id), expected.map(post => post.id));
    for (let i = 0; i < expected.length; i++) {
      const post = result.posts[i], row = expected[i];
      assert.equal(post.content, row.content);
      assert.equal(post.likes, row.likes);
      assert.equal(post.liked, Boolean(row.liked));
      assert.equal(post.owned, row.owner === owner);
      assert.ok(post.visibility === 'public' || post.authorId === 'fixture-owner');
      assert.deepEqual(post.comments, comments.filter(comment => comment.post_id === row.id).map(comment => ({ id: comment.id, author: comment.author, content: comment.content, createdAt: comment.created_at })));
    }
    assert.equal(fixture.calls.length, authenticated ? 3 : 2);
    assert.equal(fixture.calls.at(-1).method, 'all');
    assert.ok(fixture.calls.at(-1).sql.includes('json_each(?)'));
  });
}

test('feed revision cannot acknowledge a change committed after its feed snapshot', async t => {
  const fixture = await createFixture({ posts: 0 }); t.after(fixture.close);
  fixture.database.prepare('INSERT INTO events(owner,created_at) VALUES(?,?)').run(fixtureOwner, 1);
  const batch = fixture.context.DB.batch;
  fixture.context.DB.batch = async statements => {
    const result = await batch(statements);
    fixture.database.prepare('INSERT INTO events(owner,created_at) VALUES(?,?)').run(fixtureOwner, 2);
    fixture.context.DB.batch = batch;
    return result;
  };
  assert.equal((await feed(fixture)).revision, 1);
  assert.equal((await feed(fixture)).revision, 2);
});

test('successful login performs five DB calls while retaining password and username rate limits', async t => {
  t.mock.method(Date, 'now', () => Date.UTC(2026, 9, 16));
  const fixture = await createFixture({ posts: 0 }); t.after(fixture.close);
  const request = password => handleApi(new Request('https://fixture.test/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'fixture-owner', password }) }), fixture.context);
  const result = await request(fixturePassword);
  assert.equal(result.status, 200);
  assert.equal(fixture.calls.length, 5);
  assert.equal((await request('wrong-password')).status, 401);
  const attempts = await Promise.all(Array.from({ length: 15 }, () => request('wrong-password')));
  assert.equal(attempts.filter(response => response.status === 401).length, 13);
  assert.equal(attempts.filter(response => response.status === 429).length, 2);
  assert.equal(fixture.database.prepare('SELECT COUNT(*) AS n FROM accounts').get().n, 1);
});

test('concurrent auth calls preserve the shared IP bucket limit without rejecting earlier allowed calls', async t => {
  t.mock.method(Date, 'now', () => Date.UTC(2026, 9, 16));
  const fixture = await createFixture({ posts: 0 }); t.after(fixture.close);
  const attempts = await Promise.all(Array.from({ length: 31 }, (_, i) => handleApi(new Request('https://fixture.test/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'unknown-fixture-' + i, password: fixturePassword }),
  }), fixture.context)));
  assert.equal(attempts.filter(response => response.status === 401).length, 30);
  assert.equal(attempts.filter(response => response.status === 429).length, 1);
});

test('shipped SQLite adapter returns batch read rows and keeps failed batches atomic', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'xingyu-feed-contract-'));
  let storage;
  t.after(async () => {
    storage?.close();
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('xingyu-feed-contract-'));
    await rm(directory, { recursive: true, force: true });
  });
  const adapter = join(directory, 'local-adapter.mjs');
  await copyFile(new URL('../local-adapter.mjs', import.meta.url), adapter);
  await mkdir(join(directory, 'migrations'));
  for (const name of ['0000_legacy.sql', '0001_accounts_media.sql', '0002_image_generations.sql']) {
    await copyFile(new URL('../migrations/' + name, import.meta.url), join(directory, 'migrations', name));
  }
  const { createLocalStorage } = await import(pathToFileURL(adapter).href);
  storage = await createLocalStorage(join(directory, 'data'));
  const [first, second] = await storage.DB.batch([storage.DB.prepare('SELECT 1 AS n'), storage.DB.prepare('SELECT 2 AS n')]);
  assert.equal(first.results[0].n, 1);
  assert.equal(second.results[0].n, 2);
  await storage.DB.prepare('CREATE TABLE fixture_atomic(id INTEGER PRIMARY KEY)').run();
  await assert.rejects(storage.DB.batch([storage.DB.prepare('INSERT INTO fixture_atomic VALUES(1)'), storage.DB.prepare('INSERT INTO fixture_atomic VALUES(1)')]));
  assert.equal((await storage.DB.prepare('SELECT COUNT(*) AS n FROM fixture_atomic').first()).n, 0);
  const result = await feed({ context: storage });
  assert.deepEqual(result, { revision: 0, posts: [] });
});
