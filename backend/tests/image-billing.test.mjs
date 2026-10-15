import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { generateImage } from '../ai-images.mjs';

for (const [status, code, expected] of [
  [402, '401007', 'IMAGE_BILLING'],
  [402, '401008', 'IMAGE_BILLING'],
  [403, '403004', 'IMAGE_BILLING'],
  [403, '401006', 'IMAGE_ACCESS'],
]) test(`provider ${status}/${code} stays distinct and a retry reuses the failed result`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'xingyu-billing-'));
  let storage;
  t.after(async () => {
    storage?.close();
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith('xingyu-billing-'));
    await rm(directory, { recursive: true, force: true });
  });
  const adapter = join(directory, 'local-adapter.mjs');
  await copyFile(new URL('../local-adapter.mjs', import.meta.url), adapter);
  await mkdir(join(directory, 'migrations'));
  const migrations = new URL('../migrations/', import.meta.url);
  for (const name of (await readdir(migrations)).filter(name => name.endsWith('.sql'))) {
    await copyFile(new URL(name, migrations), join(directory, 'migrations', name));
  }
  storage = await (await import(pathToFileURL(adapter).href)).createLocalStorage(join(directory, 'data'));
  let calls = 0;
  const context = {
    ...storage, TENCENT_API_KEY: 'isolated-fixture', TENCENT_IMAGE_ENABLED: 'true',
    imageFetch: async () => { calls++; return Response.json({ error: { code, message: 'private provider detail' } }, { status }); },
  };
  const id = crypto.randomUUID();
  const input = { prompt: '土星和冰环的天文科普插画', ratio: 'landscape', style: 'illustration' };
  const run = () => generateImage(new Request('https://isolated.test/api/ai/images', {
    method: 'POST', headers: { 'Idempotency-Key': id }, body: JSON.stringify(input),
  }), context, { owner: 'account:isolated-fixture' }, async () => {});
  const result = await run();
  assert.equal(result.status, 'failed');
  assert.equal(result.code, expected);
  if (expected === 'IMAGE_BILLING') assert.match(result.error, /后付费/);
  assert.ok(!JSON.stringify(result).includes('private provider detail'));
  assert.deepEqual(await run(), result);
  assert.equal(calls, 1);
});
