import test from 'node:test';
import assert from 'node:assert/strict';
import { observatories, observatoryBounds, createObservatoryMapStyle } from '../src/observatories.js';

test('FAST 标记定位反射面，而非附近旅游景区或论文中的粗略纬度', () => {
  const fast = observatories.find(place => place.id === 'fast');
  assert.ok(Math.abs(fast.longitude - 106.85656699) < 0.00001);
  assert.ok(Math.abs(fast.latitude - 25.65292108) < 0.00001);
  assert.ok(fast.sourceUrl.endsWith('/way/384699313'));
});
test('全部地标边界包含四个WGS84坐标，没有交换经纬度', () => {
  const bounds = observatoryBounds();
  for (const place of observatories) {
    assert.ok(place.longitude >= bounds[0][0] && place.longitude <= bounds[1][0]);
    assert.ok(place.latitude >= bounds[0][1] && place.latitude <= bounds[1][1]);
    assert.ok(place.longitude > 100 && place.longitude < 125);
    assert.ok(place.latitude > 20 && place.latitude < 45);
  }
});
test('DEM使用服务公布的Terrarium编码及归属信息', () => {
  const style = createObservatoryMapStyle();
  assert.equal(style.sources.terrain.encoding, 'terrarium');
  assert.equal(style.sources.terrain.tileSize, 512);
  assert.equal(style.terrain.exaggeration, 1);
  assert.match(style.sources.osm.attribution, /openstreetmap.org\/copyright/);
  assert.match(style.sources.terrain.attribution, /mapterhorn.com\/attribution/);
  assert.notEqual(style.sources.terrain, style.sources.hillshade);
});
