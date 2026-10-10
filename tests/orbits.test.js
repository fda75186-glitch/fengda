import test from 'node:test';
import assert from 'node:assert/strict';
import { ORBIT_SCENE, orbitLayouts, orbitPosition, advanceOrbitTime } from '../src/orbits.js';

test('八条轨道共享太阳中心，四个象限围绕太阳而非画布角落', () => {
  assert.equal(orbitLayouts.length, 8);
  for (const orbit of orbitLayouts) {
    const right = orbitPosition(orbit, -orbit.phase * orbit.period / (2 * Math.PI));
    const left = orbitPosition(orbit, -orbit.phase * orbit.period / (2 * Math.PI) + orbit.period / 2);
    assert.ok(Math.abs((right.x + left.x) / 2 - ORBIT_SCENE.cx) < 1e-7);
    assert.ok(Math.abs((right.y + left.y) / 2 - ORBIT_SCENE.cy) < 1e-7);
    assert.ok(right.x > ORBIT_SCENE.cx && left.x < ORBIT_SCENE.cx);
  }
});

test('整圈中所有行星与标签都留在响应式 SVG 画布内', () => {
  for (const orbit of orbitLayouts) {
    for (let step = 0; step <= 360; step++) {
      const point = orbitPosition(orbit, orbit.period * step / 360);
      assert.ok(point.x >= 34 && point.x <= ORBIT_SCENE.width - 34);
      assert.ok(point.y >= 34 && point.y <= ORBIT_SCENE.height - 48);
      const ellipse = ((point.x - ORBIT_SCENE.cx) / orbit.rx) ** 2 + ((point.y - ORBIT_SCENE.cy) / orbit.ry) ** 2;
      assert.ok(Math.abs(ellipse - 1) < 1e-7);
    }
  }
});

test('每颗行星走完完整一圈回到起点，四分之一圈位置发生变化', () => {
  for (const orbit of orbitLayouts) {
    const start = orbitPosition(orbit, 0);
    const quarter = orbitPosition(orbit, orbit.period / 4);
    const end = orbitPosition(orbit, orbit.period);
    assert.ok(Math.hypot(start.x - end.x, start.y - end.y) < 1e-7);
    assert.ok(Math.hypot(start.x - quarter.x, start.y - quarter.y) > orbit.ry);
  }
});

test('暂停时动画时钟停止，恢复不累计后台时间', () => {
  assert.equal(advanceOrbitTime(8, 16, false), 8.016);
  assert.equal(advanceOrbitTime(8, 60000, true), 8);
  assert.equal(advanceOrbitTime(8, 60000, false), 8.1);
  assert.equal(advanceOrbitTime(8, -16, false), 8);
});
