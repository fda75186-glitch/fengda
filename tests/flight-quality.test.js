import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightQuality } from '../src/universe/flightQuality.js';

function run(controller, frames, duration = 1000 / 60, options) {
  const changes = [];
  for (let index = 0; index < frames; index++) {
    const result = controller.sample(typeof duration === 'function' ? duration(index) : duration, options);
    if (result.changed) changes.push(result);
  }
  return changes;
}

test('持续帧压力才降低像素负载，保证最低清晰度', () => {
  const quality = createFlightQuality({ initialPixelRatio: 1.7 });
  assert.equal(run(quality, 30, 40).length, 0);
  const changes = run(quality, 1500, 40);
  assert.ok(changes.length > 0);
  assert.ok(changes.every((state, index) => !index || state.pixelRatio < changes[index - 1].pixelRatio));
  assert.equal(quality.getState().pixelRatio, .85);
  assert.equal(quality.getState().mode, 'performance');
});

test('瞬时加载及后台延迟不触发分辨率降级', () => {
  const quality = createFlightQuality({ initialPixelRatio: 1.45 });
  run(quality, 180);
  quality.sample(5000);
  quality.sample(100, { loading: true });
  quality.sample(1000, { visible: false });
  quality.sample(1000, { paused: true });
  const changes = run(quality, 800, index => index % 90 === 0 ? 70 : 1000 / 60);
  assert.ok(changes.every(state => state.pixelRatio >= 1.45));
  assert.ok(quality.getState().pixelRatio >= 1.45);
});

test('足够长的流畅区间缓慢恢复画质，恢复不会超过设备上限', () => {
  const quality = createFlightQuality({ initialPixelRatio: 1.6, maxPixelRatio: 1.6 });
  run(quality, 300, 40);
  const reduced = quality.getState().pixelRatio;
  assert.ok(reduced < 1.6);
  assert.equal(run(quality, 240).length, 0);
  const changes = run(quality, 9000);
  assert.ok(changes.length > 0);
  assert.ok(changes.every(state => state.pixelRatio <= 1.6));
  assert.equal(quality.getState().pixelRatio, 1.6);
});

test('目标附近抖动不反复重分配画布尺寸', () => {
  const quality = createFlightQuality({ initialPixelRatio: 1.3 });
  const changes = run(quality, 2500, index => 22 + Math.sin(index * .13) * 3);
  assert.equal(changes.length, 0);
  assert.equal(quality.getState().pixelRatio, 1.3);
});

test('参数与异常采样保持有限且有界', () => {
  const quality = createFlightQuality({ initialPixelRatio: Infinity, maxPixelRatio: NaN, minPixelRatio: 8, targetFrameMs: -1 });
  assert.equal(quality.getState().pixelRatio, 1.7);
  for (const frame of [NaN, Infinity, -5, 0, 1]) assert.equal(quality.sample(frame).changed, false);
  quality.reset();
  assert.equal(quality.getState().pixelRatio, 1.7);
  assert.equal(quality.getState().frameMs, 0);
});
