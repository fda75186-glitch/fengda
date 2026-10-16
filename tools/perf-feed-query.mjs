import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const fixtureOwner = 'account:fixture-owner';
export const fixtureToken = 'a'.repeat(64);
export const fixturePassword = 'isolated-password-2026';
export const legacyFeedSql = "SELECT p.*, (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS likes, EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.owner=?) AS liked FROM posts p WHERE p.visibility='public' OR p.owner=? ORDER BY p.created_at DESC,p.id DESC LIMIT 200";
export const legacyCommentsSql = "SELECT c.* FROM comments c WHERE c.post_id IN (SELECT id FROM posts WHERE visibility='public' OR owner=? ORDER BY created_at DESC,id DESC LIMIT 200) ORDER BY c.created_at LIMIT 4000";

// Deterministic synthetic records only; never open a file-backed or cloud database.
export async function createFixture({ posts = 500, perPost = 20 } = {}) {
  const database = new DatabaseSync(':memory:');
  for (const name of ['0000_legacy.sql', '0001_accounts_media.sql', '0002_image_generations.sql']) {
    database.exec(await readFile(new URL('../backend/migrations/' + name, import.meta.url), 'utf8'));
  }
  const now = Date.now();
  database.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?)').run('fixture-owner', 'fixture-owner', 'Fixture owner', '00'.repeat(16), pbkdf2Sync(fixturePassword, Buffer.alloc(16), 100000, 32, 'sha256').toString('hex'), now);
  database.prepare('INSERT INTO account_sessions VALUES(?,?,?,?)').run(createHash('sha256').update(fixtureToken).digest('hex'), 'fixture-owner', now + 3600000, now);
  const post = database.prepare('INSERT INTO posts(id,owner,author,title,content,category,target,location,images,created_at,kind,communities,topics,visibility) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const like = database.prepare('INSERT INTO likes VALUES(?,?,?,?)');
  const comment = database.prepare('INSERT INTO comments VALUES(?,?,?,?,?,?)');
  database.exec('BEGIN');
  for (let i = 0; i < posts; i++) {
    const id = 'f0000000-0000-4000-8000-' + String(i).padStart(12, '0');
    post.run(id, i % 10 === 0 ? fixtureOwner : 'account:other', '夹具作者', '夹具标题 ' + i, '测量夹具正文，仅内存临时数据。'.repeat(80), '学习交流', '', '', '[]', 1700000000000 + Math.floor(i / 3), 'article', '[]', '[]', i % 5 === 0 ? 'private' : 'public');
    for (let j = 0; j < perPost; j++) {
      const owner = j === 0 ? fixtureOwner : 'account:liker-' + j;
      like.run(id + ':' + owner, id, owner, i + j);
      comment.run('comment-' + i + '-' + j, id, 'account:commenter', '夹具评论者', '测量评论'.repeat(20), i + j);
    }
  }
  database.exec('COMMIT');
  const calls = [];
  function prepare(sql, values = []) {
    function execute() {
      const statement = database.prepare(sql);
      if (statement.columns().length) return { success: true, results: statement.all(...values) };
      const result = statement.run(...values);
      return { success: true, meta: { changes: result.changes }, results: [] };
    }
    return {
      bind(...bound) { return prepare(sql, bound); },
      async first() { calls.push({ method: 'first', sql, values }); return database.prepare(sql).get(...values) || null; },
      async all() { calls.push({ method: 'all', sql, values }); return { results: database.prepare(sql).all(...values) }; },
      async run() { calls.push({ method: 'run', sql }); return execute(); },
      execute,
      query: { sql, values },
    };
  }
  const DB = {
    prepare,
    async batch(statements) {
      calls.push({ method: 'batch', statements: statements.length, queries: statements.map(statement => statement.query) });
      database.exec('BEGIN');
      try { const result = statements.map(statement => statement.execute()); database.exec('COMMIT'); return result; }
      catch (error) { database.exec('ROLLBACK'); throw error; }
    },
  };
  return { database, calls, context: { DB, BUCKET: {}, allowedOrigins: ['https://fda75186-glitch.github.io'] }, close: () => database.close() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { handleApi } = await import('../backend/api.mjs');
  const fixture = await createFixture({ posts: 5000 });
  try {
    const legacyRows = fixture.database.prepare(legacyFeedSql).all(fixtureOwner, fixtureOwner);
    const legacyComments = fixture.database.prepare(legacyCommentsSql).all(fixtureOwner);
    const request = () => new Request('https://fixture.test/api/posts', { headers: { Authorization: 'Bearer ' + fixtureToken } });
    const current = await (await handleApi(request(), fixture.context)).json();
    const currentBatch = fixture.calls.find(call => call.method === 'batch').queries;
    const currentComments = fixture.calls.at(-1);
    assert.deepEqual(current.posts.map(post => post.id), legacyRows.map(post => post.id));
    assert.equal(current.posts.reduce((sum, post) => sum + post.comments.length, 0), legacyComments.length);
    async function sample(work) {
      for (let i = 0; i < 5; i++) await work();
      const samples = [];
      for (let i = 0; i < 25; i++) { const start = performance.now(); await work(); samples.push(performance.now() - start); }
      samples.sort((a, b) => a - b);
      return { medianMs: +samples[12].toFixed(3), p90Ms: +samples[22].toFixed(3) };
    }
    const legacy = await sample(() => { fixture.database.prepare(legacyFeedSql).all(fixtureOwner, fixtureOwner); fixture.database.prepare(legacyCommentsSql).all(fixtureOwner); });
    const currentQueries = await sample(() => {
      fixture.database.exec('BEGIN');
      try { for (const query of currentBatch) fixture.database.prepare(query.sql).all(...query.values); fixture.database.exec('COMMIT'); }
      catch (error) { fixture.database.exec('ROLLBACK'); throw error; }
      fixture.database.prepare(currentComments.sql).all(...currentComments.values);
    });
    const currentApi = await sample(async () => { await (await handleApi(request(), fixture.context)).text(); });
    console.log(JSON.stringify({ fixture: { posts: 5000, likes: 100000, comments: 100000 }, legacyQueries: legacy, currentQueries, currentApiIncludingSerialization: currentApi, utf8Bytes: Buffer.byteLength(JSON.stringify(current)), revision: current.revision }, null, 2));
  } finally { fixture.close(); }
}
