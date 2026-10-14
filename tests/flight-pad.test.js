import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { safePadMotion } from '../src/universe/flightPadCollision.js';

const v = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
function box(size, center) {
  const half = new Vector3(...size).multiplyScalar(.5), position = new Vector3(...center);
  return { min: position.clone().sub(half), max: position.clone().add(half) };
}
const pad = [box([.42, .015, .59], [0, .014, .11]), box([.2, .025, .22], [0, .031, .1]), box([.11, .006, .125], [0, .046, .1])];
function assertOutside(point, boxes = pad, clearance = 0) {
  assert.ok([point.x, point.y, point.z].every(Number.isFinite));
  for (const item of boxes) assert.ok(['x', 'y', 'z'].some(axis => point[axis] <= item.min[axis] - clearance || point[axis] >= item.max[axis] + clearance), 'position must remain outside every expanded pad slab');
}

test('parked ship at revised .115 height and vertical lift have full spacecraft clearance', () => {
  const clearance = .0506, start = v(0, .115, .1), destination = v(0, .6, .1);
  assertOutside(start, pad, clearance);
  assert.ok(safePadMotion(start, destination, pad, clearance).distanceTo(destination) < 1e-10);
});

test('descending ship stops above the highest launch platform instead of entering it', () => {
  const clearance = .0506, start = v(0, .3, .1), destination = v(0, -.15, .1);
  const stopped = safePadMotion(start, destination, pad, clearance);
  assertOutside(stopped, pad, clearance);
  assert.ok(stopped.y >= .049 + clearance && stopped.y < .049 + clearance + 1e-5);
  assert.ok(stopped.x === 0 && stopped.z === .1);
});

test('a single large lateral movement cannot enter and emerge from the opposite pad edge', () => {
  const clearance = .012, start = v(-4, .014, .1), destination = v(4, .014, .1);
  const stopped = safePadMotion(start, destination, pad, clearance);
  assertOutside(stopped, pad, clearance);
  assert.ok(stopped.x <= -.21 - clearance && stopped.x > -.21 - clearance - 1e-5);
});

test('chase camera with small clearance is swept independently from the hull', () => {
  const clearance = .007, stopped = safePadMotion(v(0, .12, .1), v(0, -.2, .1), pad, clearance);
  assertOutside(stopped, pad, clearance);
  assert.ok(stopped.y >= .056 && stopped.y < .057);
});

test('an inside starting point is projected outside the nearest face, with ties preferring upward', () => {
  const cube = [{ min: v(-1, -1, -1), max: v(1, 1, 1) }];
  const original = v(), projected = safePadMotion(original, original, cube, 0);
  assertOutside(projected, cube);
  assert.ok(projected.y >= 1 && projected.x === 0 && projected.z === 0, 'center-face tie should escape +Y');
  assert.ok(original.lengthSq() === 0, 'inputs must not be mutated');
  const overlapping = safePadMotion(v(0, .04, .1), v(0, .04, .1), pad, .01);
  assertOutside(overlapping, pad, .01);
  assert.ok(overlapping.y >= .059 && overlapping.y < .06, 'nested pad slabs must be escaped together');
});

test('legal motion above/beside a platform remains unchanged and returns a fresh vector', () => {
  const destination = v(.45, .3, -.25), actual = safePadMotion(v(-.3, .2, -.25), destination, pad, .02);
  assert.ok(actual.distanceTo(destination) < 1e-10);
  assert.notEqual(actual, destination);
  const tangent = safePadMotion(v(-.3, .049, .1), v(.3, .049, .1), [pad[2]], 0);
  assert.ok(tangent.distanceTo(v(.3, .049, .1)) < 1e-10, 'face-tangent travel must not be spuriously blocked');
  assert.ok(safePadMotion(v(), v(1, 2, 3), [], .02).distanceTo(v(1, 2, 3)) < 1e-10);
  assert.ok(safePadMotion(v(1, 1, 1), v(1 + 1e-8, 1, 1), pad, .02).x === 1 + 1e-8, 'tiny legal movements should remain unchanged');
});

test('invalid coordinates, inverted bounds, and negative/nonfinite clearance are rejected', () => {
  assert.throws(() => safePadMotion(v(NaN), v(), pad, .01), TypeError);
  assert.throws(() => safePadMotion(v(), v(), [{ min: v(1), max: v(-1) }], 0), RangeError);
  assert.throws(() => safePadMotion(v(), v(), [{ min: v(), max: v(Infinity) }], 0), TypeError);
  assert.throws(() => safePadMotion(v(), v(), {}, 0), TypeError);
  for (const clearance of [-1, NaN, Infinity]) assert.throws(() => safePadMotion(v(), v(), pad, clearance), RangeError);
  assert.throws(() => safePadMotion(v(), v(), [{ min: v(-1e308), max: v(1e308) }], 1e308), RangeError);
});
