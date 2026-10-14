import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { journeyStops, exoplanetStop } from '../src/universe/catalog.js';
import { nearestSafePosition, obstacleRadius, planSafeFlight, safeMotion } from '../src/universe/flightNavigation.js';

const v = (x = 0, y = 0, z = 0) => new Vector3(x, y, z);
const obstacle = (id, radius, center = v()) => ({ id, center, radius });
function assertOutside(point, obstacles, clearance, message = '') {
  assert.ok([point.x, point.y, point.z].every(Number.isFinite), `finite coordinates ${message}`);
  for (const item of obstacles) assert.ok(point.distanceTo(item.center) >= item.radius + clearance - 3e-5,
    `${message} enters ${item.id}: ${point.distanceTo(item.center)} < ${item.radius + clearance}`);
}
function assertRoute(from, to, obstacles, clearance = .08, samples = 160) {
  const planned = planSafeFlight(from, to, obstacles, clearance);
  assert.ok(Number.isFinite(planned.length) && planned.length >= 0);
  assert.ok(planned.points.length <= 600, 'route planning must be bounded');
  assert.ok(planned.curve.getPoint(0).distanceTo(nearestSafePosition(from, obstacles, clearance)) < 1e-5);
  assert.ok(planned.curve.getPoint(1).distanceTo(nearestSafePosition(to, obstacles, clearance)) < 1e-5);
  for (let index = 0; index <= samples; index++) assertOutside(planned.curve.getPoint(index / samples), obstacles, clearance, `sample ${index}/${samples}`);
  return planned;
}

test('solar opposite-side transfer goes around the Sun rather than through a curved chord', () => {
  const sun = obstacle('sun', 4.25);
  const planned = assertRoute(v(-11, 0, 0), v(11, 0, 0), [sun], .12);
  assert.ok(planned.length > 22 && planned.length < 32, 'detour must remain a local, readable flight');
  assert.ok(planned.points.some(point => Math.hypot(point.y, point.z) > 4), 'route must wrap around the blocking Sun');
  const midpoint = planned.curve.getPoint(.5);
  assert.ok(midpoint.distanceTo(sun.center) >= sun.radius + .12);
});

test('Earth launch lifts radially before heading toward the Moon', () => {
  const earth = obstacle('earth', 3.48), moon = obstacle('moon', .91, v(11, .7, -4));
  const start = v(0, earth.radius + .04, 0), target = moon.center.clone().add(v(0, 0, 2.9));
  const planned = assertRoute(start, target, [earth, moon], .03);
  const departure = planned.points[1].clone().sub(planned.points[0]);
  assert.ok(departure.y > .5 && Math.abs(departure.x) < 1e-5 && Math.abs(departure.z) < 1e-5,
    'surface launch must climb first, not immediately point through the Earth');
});

test('a close moon and a ring shell are both avoided during arrival', () => {
  const saturn = obstacle('saturn-and-rings', obstacleRadius({ id: 'saturn', radius: 1.75, ring: true }));
  const closeMoon = obstacle('enceladus', .22, v(5.6, .08, 0));
  const planned = assertRoute(v(-10, .1, 0), v(8, .1, 0), [saturn, closeMoon], .06, 240);
  assert.ok(planned.length < 40, 'small clearance must not require an arbitrary system-wide escape');
});

test('swept manual flight stops before a planet even if one key/wheel step crosses its full diameter', () => {
  const planet = obstacle('planet', 2);
  const stopped = safeMotion(v(-12, 0, 0), v(12, 0, 0), [planet], .2);
  assertOutside(stopped, [planet], .2);
  assert.ok(stopped.x <= -2.2 + 1e-5, 'collision must be detected before the far-side endpoint');
  const outward = safeMotion(stopped, stopped.clone().add(v(-1, 0, 0)), [planet], .2);
  assert.ok(outward.x < stopped.x - .99, 'after contact the user can still leave the surface');
});

test('manual glancing contact slides safely and repeated moves never enter the surface', () => {
  const planets = [obstacle('first', 2), obstacle('second', 1, v(3, 0, 1))];
  let position = v(-5, 0, -1.8);
  for (let step = 0; step < 28; step++) {
    const next = safeMotion(position, position.clone().add(v(.5, .08, .08)), planets, .1);
    assertOutside(next, planets, .1);
    position = next;
  }
  assert.ok(position.y > 1, 'tangential motion should move rather than remain stuck');
});

test('outer radii include stretched bodies and rings while allowing surface launch through translucent Earth atmosphere', () => {
  assert.equal(obstacleRadius({ id: 'earth', radius: 7.5 }), 7.5);
  assert.ok(obstacleRadius({ kind: 'star', radius: 1 }) > 1.08);
  assert.ok(obstacleRadius({ id: 'haumea', radius: .3, shape: [1.65, .72, .85] }) >= .3 * 1.65);
  assert.ok(obstacleRadius({ id: 'saturn', radius: 1.75 }) > 1.75 * 2.28);
  assert.equal(obstacleRadius({ kind: 'galaxy', radius: 12 }), 0);
  assert.equal(obstacleRadius({ kind: 'cluster', radius: 5 }), 0);
});

test('overlapping obstacles and starts inside an expanded shell resolve to finite safe positions', () => {
  const obstacles = [obstacle('a', 2), obstacle('b', 2, v(2, 0, 0)), obstacle('c', .7, v(0, 2.2, 0))];
  assertOutside(nearestSafePosition(v(.2, 0, 0), obstacles, .04), obstacles, .04);
  assertRoute(v(-5, 0, 0), v(7, 0, 0), obstacles, .04, 240);
  assertRoute(v(0, 0, 0), v(7, 0, 0), obstacles, .04, 240);
});

test('every destination pair in the seven real journey stages has a safe route at normal ship clearance', () => {
  let count = 0;
  for (const stop of journeyStops) {
    const obstacles = stop.bodies.map(body => obstacle(body.id, obstacleRadius(body), new Vector3(...body.position))).filter(item => item.radius > 0);
    const destinations = stop.bodies.map(body => new Vector3(...body.position).add(v(body.radius * .6, body.radius * .8, Math.max(.4, body.radius * 3.1))));
    for (let from = 0; from < destinations.length; from++) for (let to = 0; to < destinations.length; to++) {
      if (from === to) continue;
      assertRoute(destinations[from], destinations[to], obstacles, .055, 64);
      count++;
    }
  }
  assert.ok(count > 800, `expected full real solar route coverage, saw ${count}`);
});

test('compact multiple-star exoplanet system is navigable without crossing its host or companions', () => {
  const stop = exoplanetStop({ id: 'compact', name: 'Compact', stars: 3, distanceLy: 20,
    planets: Array.from({ length: 7 }, (_, index) => ({ id: 'p' + index, name: 'Planet ' + index, radiusEarth: index + 1, semiMajorAxisAU: .01 + index * .015 })) });
  const obstacles = stop.bodies.map(body => obstacle(body.id, obstacleRadius(body), new Vector3(...body.position))).filter(item => item.radius > 0);
  for (const target of stop.bodies.slice(1)) assertRoute(v(0, 2, 12), new Vector3(...target.position).add(v(0, 0, target.radius * 3)), obstacles, .07, 120);
});
