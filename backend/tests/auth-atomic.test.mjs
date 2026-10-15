import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { handleApi } from '../api.mjs';

const origin = 'https://fda75186-glitch.github.io';
const credentials = { username: 'atomic-fixture', password: 'isolated-password-2026' };

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'xingyu-auth-atomic-'));
  let storage;
  t.after(async () => {
    storage?.close();
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('xingyu-auth-atomic-'));
    await rm(directory, { recursive: true, force: true });
  });
  // Load only the shipped schema in an isolated temporary directory. Load the shipped adapter
  // unchanged beside isolated copies of those migrations, never user data.
  const adapter = join(directory, 'local-adapter.mjs');
  await copyFile(new URL('../local-adapter.mjs', import.meta.url), adapter);
  await mkdir(join(directory, 'migrations'));
  for (const name of ['0000_legacy.sql', '0001_accounts_media.sql', '0002_image_generations.sql']) {
    await copyFile(new URL(`../migrations/${name}`, import.meta.url), join(directory, 'migrations', name));
  }
  const { createLocalStorage } = await import(pathToFileURL(adapter).href);
  storage = await createLocalStorage(join(directory, 'data'));
  const context = { ...storage, allowedOrigins: [origin], allowLoopback: false };
  async function request(action, input, token) {
    const response = await handleApi(new Request(`https://isolated.test/api/auth/${action}`, {
      method: input ? 'POST' : 'GET',
      headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(input ? { body: JSON.stringify(input) } : {}),
    }), context);
    return { status: response.status, body: await response.json() };
  }
  async function counts() {
    return { ...await storage.DB.prepare('SELECT (SELECT COUNT(*) FROM accounts) AS accounts, (SELECT COUNT(*) FROM account_sessions) AS sessions').first() };
  }
  return { ...storage, request, counts };
}

test('registration rolls back the account when its initial session cannot be inserted', async t => {
  const f = await fixture(t);
  await f.DB.prepare("CREATE TRIGGER reject_session_insert BEFORE INSERT ON account_sessions BEGIN SELECT RAISE(ABORT, 'injected session constraint failure'); END").run();

  const failed = await f.request('register', credentials);
  assert.equal(failed.status, 500);
  assert.equal(failed.body.code, 'INTERNAL_ERROR');
  assert.deepEqual(await f.counts(), { accounts: 0, sessions: 0 });

  await f.DB.prepare('DROP TRIGGER reject_session_insert').run();
  const retry = await f.request('register', credentials);
  assert.equal(retry.status, 201);
  assert.equal((await f.request('me', null, retry.body.token)).body.user.id, retry.body.user.id);
  assert.equal((await f.request('login', credentials)).status, 200);
  assert.equal((await f.request('register', credentials)).status, 409);
});

test('a failed login session insert preserves the account and existing valid session', async t => {
  const f = await fixture(t);
  const initial = await f.request('register', credentials);
  assert.equal(initial.status, 201);
  await f.DB.prepare("CREATE TRIGGER reject_session_insert BEFORE INSERT ON account_sessions BEGIN SELECT RAISE(ABORT, 'injected session constraint failure'); END").run();

  const failed = await f.request('login', credentials);
  assert.equal(failed.status, 500);
  assert.deepEqual(await f.counts(), { accounts: 1, sessions: 1 });
  assert.equal((await f.request('me', null, initial.body.token)).status, 200);

  await f.DB.prepare('DROP TRIGGER reject_session_insert').run();
  assert.equal((await f.request('login', credentials)).status, 200);
  assert.equal((await f.request('login', { ...credentials, password: 'wrong-password' })).status, 401);
});

test('concurrent registrations for one username return one account and one valid initial session', async t => {
  const f = await fixture(t);
  const results = await Promise.all([f.request('register', credentials), f.request('register', credentials)]);
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal(results.find(result => result.status === 409).body.code, 'USERNAME_TAKEN');
  const registered = results.find(result => result.status === 201);
  assert.equal((await f.request('me', null, registered.body.token)).status, 200);
  assert.deepEqual(await f.counts(), { accounts: 1, sessions: 1 });
});

test('expired-session cleanup failures do not turn successful registration or login into errors', async t => {
  const f = await fixture(t);
  const initial = await f.request('register', credentials);
  assert.equal(initial.status, 201);
  await f.DB.prepare('INSERT INTO account_sessions(token_hash,account_id,expires_at,created_at) VALUES(?,?,?,?)').bind('e'.repeat(64), initial.body.user.id, 1, 1).run();
  await f.DB.prepare("CREATE TRIGGER reject_session_cleanup BEFORE DELETE ON account_sessions WHEN OLD.expires_at=1 BEGIN SELECT RAISE(ABORT, 'injected cleanup failure'); END").run();

  const registered = await f.request('register', { ...credentials, username: 'atomic-second' });
  assert.equal(registered.status, 201);
  assert.equal((await f.request('me', null, registered.body.token)).body.user.id, registered.body.user.id);
  const loggedIn = await f.request('login', credentials);
  assert.equal(loggedIn.status, 200);
  assert.equal((await f.request('me', null, loggedIn.body.token)).body.user.id, initial.body.user.id);
  assert.equal((await f.request('me', null, initial.body.token)).status, 200);
  assert.deepEqual(await f.counts(), { accounts: 2, sessions: 4 });

  await f.DB.prepare('DROP TRIGGER reject_session_cleanup').run();
  assert.equal((await f.request('login', credentials)).status, 200);
  assert.equal(await f.DB.prepare('SELECT COUNT(*) AS n FROM account_sessions WHERE expires_at=1').first().then(row => row.n), 0);
  assert.deepEqual(await f.counts(), { accounts: 2, sessions: 4 });
});
