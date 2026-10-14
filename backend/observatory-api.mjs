import { observatories, observatoryRevision } from './observatory-catalog.mjs';

const tileCache = new Map();
const MAX_BYTES = 2 * 1024 * 1024;
const WEEK = 7 * 24 * 60 * 60;
const catalogue = () => ({ revision: observatoryRevision, places: observatories });

export function parseMapTile(path) {
  const match = path.match(/^\/api\/map\/(base|terrain)\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})\.(png|webp)$/);
  if (!match) return null;
  const [, kind, zText, xText, yText, extension] = match;
  const z = Number(zText), x = Number(xText), y = Number(yText), size = 2 ** z;
  if (z < (kind === 'terrain' ? 0 : 3) || z > (kind === 'terrain' ? 12 : 19) || x >= size || y >= size || extension !== (kind === 'base' ? 'png' : 'webp')) return null;
  // Only the map's supported East Asia viewport can request upstream tiles.
  const lon = n => n / size * 360 - 180;
  const lat = n => Math.atan(Math.sinh(Math.PI * (1 - 2 * n / size))) * 180 / Math.PI;
  if (lon(x + 1) < 70 || lon(x) > 140 || lat(y) < 10 || lat(y + 1) > 60) return null;
  return { kind, z, x, y, extension };
}

async function tileResponse(request, headers, tile, context) {
  const key = `${tile.kind}/${tile.z}/${tile.x}/${tile.y}`;
  const cacheRequest = new Request(`https://starwhisper-map-cache.invalid/${key}`);
  // Some hosted Worker dispatch environments do not provide a usable Cache
  // API. Cache reads/writes must never make a valid upstream tile fail.
  let platformCache;
  try { platformCache = context.MAP_CACHE || globalThis.caches?.default; } catch {}
  const now = Date.now();
  let saved = tileCache.get(key);
  if (saved?.expires <= now) { tileCache.delete(key); saved = null; }
  let cached = null;
  try { cached = platformCache ? await platformCache.match(cacheRequest) : null; } catch {}
  if (cached) saved = { bytes: await cached.arrayBuffer(), type: cached.headers.get('Content-Type'), ttl: Number(cached.headers.get('X-Map-Ttl')) || WEEK };
  if (!saved) {
    const url = tile.kind === 'base'
      ? `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`
      : `https://tiles.mapterhorn.com/${tile.z}/${tile.x}/${tile.y}.webp`;
    let upstream;
    try {
      upstream = await (context.mapFetch || fetch)(url, {
        headers: { 'User-Agent': 'StarWhisper/0.1.5 (+https://fda75186-glitch.github.io/fengda/)', 'Referer': 'https://fda75186-glitch.github.io/fengda/' },
        signal: AbortSignal.timeout(10000), redirect: 'error',
      });
      const type = upstream.headers.get('Content-Type')?.split(';')[0];
      if (!upstream.ok || !['image/png', 'image/webp'].includes(type) || Number(upstream.headers.get('Content-Length')) > MAX_BYTES) throw new Error('Invalid tile response');
      const reader = upstream.body.getReader();
      const chunks = []; let total = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          total += value.byteLength;
          if (total > MAX_BYTES) { await reader.cancel(); throw new Error('Tile exceeds maximum'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(total); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const ttl = Number(upstream.headers.get('Cache-Control')?.match(/(?:^|,)\s*max-age=(\d+)/)?.[1] || WEEK);
      saved = { bytes, type, ttl, expires: now + ttl * 1000 };
      if (ttl > 0 && !/no-store|private/.test(upstream.headers.get('Cache-Control') || '')) {
        tileCache.set(key, saved);
        if (tileCache.size > 128) tileCache.delete(tileCache.keys().next().value);
        if (platformCache) {
          try { await platformCache.put(cacheRequest, new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': `public, max-age=${ttl}`, 'X-Map-Ttl': String(ttl) } })); } catch {}
        }
      }
    } catch {
      headers.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(JSON.stringify({ code: 'MAP_UPSTREAM_UNAVAILABLE', error: '地图数据暂不可用，请使用备用地理图或重试。' }), { status: 502, headers });
    }
  }
  headers.set('Cache-Control', `public, max-age=${saved.ttl}`);
  headers.set('Content-Type', saved.type);
  return new Response(request.method === 'HEAD' ? null : saved.bytes, { headers });
}

function catalogueStream(request, headers, context) {
  headers.set('Content-Type', 'text/event-stream');
  headers.set('Cache-Control', 'no-cache, no-transform');
  const encoder = new TextEncoder();
  let timer, stop, unsubscribe;
  return new Response(new ReadableStream({
    start(controller) {
      let closed = false, lastRevision = '';
      stop = () => {
        if (closed) return; closed = true;
        clearInterval(timer); unsubscribe?.(); request.signal.removeEventListener('abort', stop);
        try { controller.close(); } catch {}
      };
      const send = () => {
        if (closed || lastRevision === observatoryRevision) return;
        lastRevision = observatoryRevision;
        controller.enqueue(encoder.encode(`event: catalogue\ndata: ${JSON.stringify(catalogue())}\n\n`));
      };
      send(); unsubscribe = context.subscribe?.(send);
      timer = setInterval(() => { if (!closed) controller.enqueue(encoder.encode(': keepalive\n\n')); }, 25000);
      request.signal.addEventListener('abort', stop, { once: true });
      if (request.signal.aborted) stop();
    },
    cancel() { stop?.(); },
  }), { headers });
}

export async function handleObservatoryApi(request, context, headers) {
  const path = new URL(request.url).pathname;
  if (path === '/api/observatories' && request.method === 'GET') {
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify(catalogue()), { headers });
  }
  if (path === '/api/observatories/events' && request.method === 'GET') return catalogueStream(request, headers, context);
  if (!path.startsWith('/api/map/')) return null;
  const tile = parseMapTile(path);
  if (!tile || !['GET', 'HEAD'].includes(request.method)) {
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(JSON.stringify({ code: 'INVALID_MAP_TILE', error: '地图请求无效' }), { status: 400, headers });
  }
  return tileResponse(request, headers, tile, context);
}

