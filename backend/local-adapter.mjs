import { DatabaseSync } from 'node:sqlite';
import { mkdir, readdir, readFile, writeFile, unlink, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function createLocalStorage(dataDir) {
  const directory = resolve(dataDir);
  await mkdir(join(directory, 'media'), { recursive: true });
  const database = new DatabaseSync(join(directory, 'community.sqlite'));
  database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS _local_migrations(name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);');
  const migrationDir = fileURLToPath(new URL('./migrations/', import.meta.url));
  for (const name of (await readdir(migrationDir)).filter(name => name.endsWith('.sql')).sort()) {
    if (database.prepare('SELECT name FROM _local_migrations WHERE name=?').get(name)) continue;
    const sql = await readFile(join(migrationDir, name), 'utf8');
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec(sql);
      database.prepare('INSERT INTO _local_migrations(name,applied_at) VALUES(?,?)').run(name, Date.now());
      database.exec('COMMIT');
    } catch (error) { database.exec('ROLLBACK'); database.close(); throw error; }
  }
  function statement(sql, values = []) {
    return {
      bind(...bound) { return statement(sql, bound); },
      async first() { return database.prepare(sql).get(...values) || null; },
      async all() { return { results: database.prepare(sql).all(...values) }; },
      async run() { return this.runSync(); },
      runSync() {
        const prepared = database.prepare(sql);
        if (prepared.columns().length) return { success: true, results: prepared.all(...values), meta: { changes: 0 } };
        const result = prepared.run(...values);
        return { success: true, meta: { changes: result.changes } };
      },
    };
  }
  const DB = {
    prepare: statement,
    async batch(statements) {
      database.exec('BEGIN IMMEDIATE');
      try {
        // No await inside this transaction: another request cannot interleave on the SQLite connection.
        const result = statements.map(statement => statement.runSync());
        database.exec('COMMIT');
        return result;
      } catch (error) { database.exec('ROLLBACK'); throw error; }
    },
  };
  function mediaPath(key) {
    if (!/^(media|images)\/[a-f0-9-]{36}$/.test(key)) throw new Error('Invalid storage key');
    return join(directory, 'media', key.replace('/', '-'));
  }
  const BUCKET = {
    async put(key, bytes) { await writeFile(mediaPath(key), new Uint8Array(bytes), { flag: 'wx' }); },
    async delete(key) { try { await unlink(mediaPath(key)); } catch (error) { if (error.code !== 'ENOENT') throw error; } },
    async get(key, options = {}) {
      const path = mediaPath(key);
      let info;
      try { info = await stat(path); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
      const range = options.range;
      const start = range?.offset || 0;
      const end = range ? start + range.length - 1 : info.size - 1;
      return { body: Readable.toWeb(createReadStream(path, { start, end })), size: info.size };
    },
  };
  return { DB, BUCKET, close: () => database.close(), directory };
}

export async function seedLocalExamples(storage, assetsDir) {
  if (!assetsDir) return;
  const count = await storage.DB.prepare('SELECT COUNT(*) AS n FROM posts').first();
  if (count.n) return;
  const seeds = [
    ['moon', '观星日记', '今晚的月亮，和昨天有什么不一样？', '试着连续几天在相近的时间看看月亮，记录它的形状和位置。你会发现，月亮每天都在变化。也欢迎分享你观察到的月相与拍摄时间。'],
    ['saturn', '天文问答', '土星的光环，真的是一整块吗？', '远看像一片完整光环，近看却是无数冰粒与岩石碎片。它们各自绕着土星运行。还有哪些天文问题让你好奇？'],
    ['andromeda', '摄影分享', '第一次拍星空，先学会记录一次夜晚', '找一处视野开阔、安全且远离强光的地方，用固定支架拍摄并记录设备、时间和环境。保护自己与同行者，再慢慢积累观察经验。'],
    ['earth', '学习交流', '把一颗蓝色星球，讲给身边的人听', '试着用自己的话解释地球为什么看起来是蓝色，再制作一张知识卡。比背住术语更重要的，是让别人也能听懂。'],
  ];
  for (const [index, [name, category, title, content]] of seeds.entries()) {
    const id = `01300000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
    const imageId = `01300000-0000-4000-8001-${String(index + 1).padStart(12, '0')}`;
    let bytes;
    try { bytes = await readFile(join(assetsDir, `${name}.jpg`)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    await storage.BUCKET.put(`media/${imageId}`, bytes);
    const image = `/api/media/${imageId}`;
    await storage.DB.batch([
      storage.DB.prepare('INSERT INTO media(id,owner,mime,bytes,filename,created_at) VALUES(?,?,?,?,?,?)').bind(imageId, 'system:editor', 'image/jpeg', bytes.length, `${name}.jpg`, Date.now()),
      storage.DB.prepare('INSERT INTO posts(id,owner,author,title,content,category,target,location,images,created_at,kind,topics,communities) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, 'system:editor', '星语编辑', title, content, category, '', '', JSON.stringify([image]), Date.now() - index, index === 3 ? 'article' : 'image', JSON.stringify(['一起观星']), JSON.stringify([category])),
    ]);
  }
}
