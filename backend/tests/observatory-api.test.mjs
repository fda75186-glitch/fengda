import test from 'node:test';
import assert from 'node:assert/strict';
import { handleApi } from '../api.mjs';
import { parseMapTile } from '../observatory-api.mjs';

const origin = 'https://fda75186-glitch.github.io';
const context = { allowedOrigins: [origin] };
const request = path => new Request('https://shared.starwhisper.test'+path, { headers: { Origin: origin } });
function tileFor(lon, lat, z) {
  const x = Math.floor((lon+180)/360*2**z);
  const rad = lat*Math.PI/180;
  const y = Math.floor((1-Math.asinh(Math.tan(rad))/Math.PI)/2*2**z);
  return [z,x,y].join('/');
}

test('public catalogue is identical for separate visitors and contains no account data', async () => {
  const first = await handleApi(request('/api/observatories'), context);
  const second = await handleApi(request('/api/observatories'), context);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('Access-Control-Allow-Origin'), origin);
  const a = await first.json(), b = await second.json();
  assert.deepEqual(a,b); assert.equal(a.places.length,4);
  for (const place of a.places) { assert.ok(place.history.length); assert.ok(place.sources.length); }
  assert.doesNotMatch(JSON.stringify(a), /password|token|account|session/);
});

test('shared catalogue stream sends a snapshot and releases on abort', async () => {
  const controller = new AbortController();
  const req = new Request('https://shared.starwhisper.test/api/observatories/events', { signal: controller.signal, headers: { Origin: origin } });
  const response = await handleApi(req, context);
  const reader = response.body.getReader();
  const chunk = new TextDecoder().decode((await reader.read()).value);
  assert.match(chunk, /event: catalogue/); assert.match(chunk, /2026-10-11-guide-2/);
  controller.abort(); assert.equal((await reader.read()).done, true);
});

test('tile routes reject arbitrary hosts, out of range tiles and wrong extensions', () => {
  for (const path of ['/api/map/base/19/999999/0.png','/api/map/terrain/19/1/1.webp','/api/map/base/4/1/1.png','/api/map/base/4/13/6.webp','/api/map/https://example.com']) assert.equal(parseMapTile(path),null,path);
  assert.ok(parseMapTile('/api/map/base/'+tileFor(117.57584,40.39569,13)+'.png'));
  assert.ok(parseMapTile('/api/map/terrain/0/0/0.webp'), 'DEM needs overview levels even when the camera zoom is higher');
});

test('tile relay caches across visitors, keeps CORS, and never forwards credentials', async () => {
  let calls = 0;
  const req = request('/api/map/base/'+tileFor(117.57584,40.39569,13)+'.png');
  const mapFetch = async (url, options) => {
    calls++;
    assert.match(url,/^https:\/\/tile.openstreetmap.org\//);
    assert.match(options.headers['User-Agent'],/StarWhisper/);
    assert.equal(options.headers.Authorization,undefined);
    return new Response(new Uint8Array([137,80,78,71]), { headers: { 'Content-Type':'image/png', 'Cache-Control':'public, max-age=604800' } });
  };
  for (let index=0;index<2;index++) {
    const response = await handleApi(req,{...context,mapFetch});
    assert.equal(response.status,200); assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
    assert.match(response.headers.get('Cache-Control'),/max-age=604800/);
    assert.equal((await response.arrayBuffer()).byteLength,4);
  }
  assert.equal(calls,1);
});

test('upstream failure returns a recoverable map error without pretending to be a tile', async () => {
  const response = await handleApi(request('/api/map/terrain/'+tileFor(106.85657,25.65292,10)+'.webp'),{...context,mapFetch:async()=>new Response('denied',{status:403})});
  assert.equal(response.status,502); assert.equal((await response.json()).code,'MAP_UPSTREAM_UNAVAILABLE');
});
