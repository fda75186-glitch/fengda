import http from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, openSync, closeSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createApiServer } from './backend/dev-server.mjs';

const folder = dirname(fileURLToPath(import.meta.url));
const root = resolve(folder, 'dist');
const runtime = resolve(folder, 'runtime');
const stateFile = resolve(runtime, 'preview.json');
const identity = createHash('sha256').update(folder).digest('hex');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.mp4':'video/mp4', '.webm':'video/webm', '.woff2':'font/woff2', '.ico':'image/x-icon' };

async function serve() {
  mkdirSync(runtime, { recursive:true });
  const communityApi = await createApiServer({ port:0, dataDir:resolve(runtime,'community-data'), assetsDir:resolve(folder,'public/images'), aiConfigFile:resolve(folder,'.env.ai.local.json') });
  const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
    catch { response.writeHead(400); response.end(); return; }
    if (pathname.startsWith('/api/')) {
      const upstream = http.request(new URL(request.url, communityApi.url), { method:request.method, headers:{...request.headers,host:new URL(communityApi.url).host} }, reply => {
        response.writeHead(reply.statusCode || 502, reply.headers);
        reply.on('error',()=>response.destroy());
        reply.pipe(response);
      });
      upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502,{'Content-Type':'application/json'});response.end(JSON.stringify({error:'社区服务暂时不可用，请重新打开这一版。'}));});
      request.on('aborted',()=>upstream.destroy());
      response.on('close',()=>upstream.destroy());
      request.pipe(upstream);return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
    if (pathname === '/__xingyu_preview') { response.writeHead(200, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }); response.end(JSON.stringify({ identity })); return; }
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    const within = relative(root, file);
    if (within === '..' || within.startsWith('..' + sep) || !existsSync(file) || !statSync(file).isFile()) { response.writeHead(404); response.end('File not found'); return; }
    const size = statSync(file).size;
    const headers = { 'Content-Type':types[extname(file)] || 'application/octet-stream', 'Accept-Ranges':'bytes', 'Cache-Control':'no-cache' };
    let start = 0, end = size - 1, status = 200;
    if (request.headers.range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
      if (!match || (!match[1] && !match[2])) { response.writeHead(416, { 'Content-Range':`bytes */${size}` }); response.end(); return; }
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
      if (start > end || start >= size) { response.writeHead(416, { 'Content-Range':`bytes */${size}` }); response.end(); return; }
      status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    headers['Content-Length'] = Math.max(0, end - start + 1);
    response.writeHead(status, headers);
    if (request.method === 'HEAD' || size === 0) { response.end(); return; }
    const stream = createReadStream(file, { start, end });
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
  });
  // Let Windows choose an unused loopback port for this particular version.
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    writeFileSync(stateFile, JSON.stringify({ port, identity }));
    process.send?.({ url:`http://127.0.0.1:${port}/#home` });
    if (process.connected) process.disconnect();
  });
  server.on('error', error => { console.error(error.message); process.exit(1); });
}

async function launch() {
  if (!existsSync(resolve(root, 'index.html'))) throw new Error('Missing dist/index.html. Please use the complete version folder.');
  mkdirSync(runtime, { recursive:true });
  let url;
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    if (state.identity === identity && Number.isInteger(state.port) && state.port > 0 && state.port < 65536) {
      const response = await fetch(`http://127.0.0.1:${state.port}/__xingyu_preview`, { signal:AbortSignal.timeout(1200) });
      if (response.ok && (await response.json()).identity === identity) url = `http://127.0.0.1:${state.port}/#home`;
    }
  } catch { /* A stale port after a restart simply needs a new server. */ }
  if (!url) {
    const log = openSync(resolve(runtime, 'preview.log'), 'a');
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--serve'], { cwd:folder, detached:true, windowsHide:true, stdio:['ignore', log, log, 'ipc'] });
    closeSync(log);
    url = await new Promise((done, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview startup timed out. See runtime/preview.log.')), 15000);
      child.once('message', message => { clearTimeout(timer); done(message.url); });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Preview stopped during startup (${code}). See runtime/preview.log.`)); });
    });
    child.unref();
  }
  console.log(`StarWhisper community preview: ${url}`);
  if (!process.argv.includes('--no-browser')) {
    const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', url], { detached:true, windowsHide:true, stdio:'ignore' });
    browser.on('error', () => console.log(`Open this address in your browser: ${url}`));
    browser.unref();
  }
}

if (process.argv.includes('--serve')) serve().catch(error=>{console.error(error.message);process.exitCode=1;});
else launch().catch(error => { console.error(error.message); process.exitCode = 1; });
