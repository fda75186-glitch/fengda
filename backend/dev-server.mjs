import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { handleApi } from './api.mjs';
import { createLocalStorage, seedLocalExamples } from './local-adapter.mjs';

export async function createApiServer({ port = 0, dataDir, assetsDir, allowedOrigins = [], host = '127.0.0.1' } = {}) {
  if (!dataDir) throw new Error('An explicit isolated dataDir is required');
  if (host !== '127.0.0.1') throw new Error('The preview API binds only to 127.0.0.1');
  const storage = await createLocalStorage(dataDir);
  try { await seedLocalExamples(storage, assetsDir); } catch (error) { storage.close(); throw error; }
  const subscriptions = new Set();
  const context = {
    ...storage, storageName: 'isolated local SQLite + files', allowedOrigins, allowLoopback: true,
    notify() { for (const subscription of subscriptions) subscription(); },
    subscribe(callback) { subscriptions.add(callback); return () => subscriptions.delete(callback); },
  };
  let url;
  const server = createServer(async (incoming, outgoing) => {
    const abort = new AbortController();
    outgoing.on('close', () => abort.abort());
    try {
      const requestHeaders = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined && key.toLowerCase() !== 'cf-connecting-ip') requestHeaders.set(key, Array.isArray(value) ? value.join(', ') : value);
      }
      const method = incoming.method || 'GET';
      const path = incoming.url || '/';
      if (!path.startsWith('/') || path.startsWith('//')) { outgoing.writeHead(400); outgoing.end(); return; }
      const request = new Request(new URL(path, url), {
        method, headers: requestHeaders, signal: abort.signal,
        ...(['GET', 'HEAD'].includes(method) ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }),
      });
      const response = await handleApi(request, { ...context, remoteAddress: incoming.socket.remoteAddress });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      if (!response.body) { outgoing.end(); incoming.resume(); return; }
      const readable = Readable.fromWeb(response.body);
      readable.on('error', () => outgoing.destroy());
      outgoing.on('close', () => readable.destroy());
      readable.pipe(outgoing);
    } catch {
      if (!outgoing.headersSent) outgoing.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      outgoing.end(JSON.stringify({ error: '本地社区服务暂时不可用', code: 'INTERNAL_ERROR' }));
    }
  });
  try {
    await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, host, accept); });
  } catch (error) { storage.close(); throw error; }
  const address = server.address();
  url = `http://${host}:${address.port}`;
  let closed = false;
  return {
    server, url, dataDir: storage.directory,
    async close() {
      if (closed) return;
      closed = true;
      server.closeAllConnections();
      await new Promise(accept => server.close(accept));
      storage.close();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : fallback; };
  const port = Number(option('--port', '0'));
  const dataDir = option('--data-dir');
  const assetsDir = option('--assets-dir');
  if (!dataDir || !Number.isInteger(port) || port < 0 || port > 65535) {
    console.error('Usage: node backend/dev-server.mjs --port 0 --data-dir <isolated-directory> [--assets-dir <public/images>]');
    process.exitCode = 1;
  } else {
    const app = await createApiServer({ port, dataDir, assetsDir });
    console.log(JSON.stringify({ url: app.url, storage: 'isolated local SQLite + files' }));
    const stop = async () => { await app.close(); process.exit(0); };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
}
