import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { CurvePath, Matrix4, Quaternion, Vector3 } from 'three';
import { createLaunchSite } from '../src/universe/flightVisuals.js';
import { createSurveyCraft } from '../src/universe/shipModel.js';
import { nearestSafePosition, obstacleRadius, planSafeFlight, safeMotion } from '../src/universe/flightNavigation.js';

const earthCenter = new Vector3(0, -5.6, -9), earthRadius = 7.5;
const surfaceNormal = new Vector3(.65, .55, .52).normalize(), localUp = new Vector3(0, 1, 0);
const rotation = new Quaternion().setFromUnitVectors(localUp, surfaceNormal);
const origin = earthCenter.clone().addScaledVector(surfaceNormal, earthRadius + .003);
const site = createLaunchSite({ radius: earthRadius }), craft = createSurveyCraft(), shipScale = .015;
site.group.position.copy(origin); site.group.quaternion.copy(rotation); site.group.updateMatrixWorld(true);
const worldPoint = point => site.group.localToWorld(point.clone());
const earth = { id: 'earth', center: earthCenter, radius: obstacleRadius({ id: 'earth', texture: 'earth', kind: 'planet', radius: earthRadius }) };
const facilities = site.obstacles.map(obstacle => ({ id: obstacle.id, radius: obstacle.radius, center: worldPoint(obstacle.center) }));
const obstacles = [earth, ...facilities], shipClearance = craft.radius * shipScale;
const worldCamera = worldPoint(site.localCameraPosition), worldTarget = worldPoint(site.localCameraTarget);
const waypoints = site.launchWaypoints.map(worldPoint);

after(() => { site.dispose(); craft.dispose(); });

function assertOutside(point, bodies, clearance, message = '') {
  assert.ok([point.x, point.y, point.z].every(Number.isFinite));
  for (const body of bodies) assert.ok(point.distanceTo(body.center) >= body.radius + clearance - 3e-5,
    `${message} enters ${body.id}: ${point.distanceTo(body.center)} < ${body.radius + clearance}`);
}

function assertSafeCurve(curve, bodies, clearance, samples = 320) {
  for (let index = 0; index <= samples; index++) assertOutside(curve.getPoint(index / samples), bodies, clearance, `curve sample ${index}/${samples}`);
}

test('Wenchang launch origin and camera use the true Earth-surface world transform', () => {
  assert.equal(earth.radius, earthRadius, 'the translucent atmosphere must not displace the departure camera');
  assert.ok(site.group.localToWorld(new Vector3()).distanceTo(origin) < 1e-10);
  assert.ok(site.surfaceUp.clone().transformDirection(site.group.matrixWorld).distanceTo(surfaceNormal) < 1e-10);
  const independentlyTransformed = site.localCameraPosition.clone().applyQuaternion(rotation).add(origin);
  assert.ok(worldCamera.distanceTo(independentlyTransformed) < 1e-10);
  const altitude = worldCamera.distanceTo(earthCenter) - earthRadius;
  const padTop = Math.max(...site.padBoxes.filter(box => site.localCameraPosition.x >= box.min.x && site.localCameraPosition.x <= box.max.x && site.localCameraPosition.z >= box.min.z && site.localCameraPosition.z <= box.max.z).map(box => box.max.y));
  assert.ok(site.localCameraPosition.y - padTop > shipClearance * 1.04, 'parked ship must clear the solid launch pad with its full hull margin');
  assert.ok(altitude > shipClearance && altitude < .2, `camera must start at the pad rather than in orbit, altitude ${altitude}`);
  assertOutside(worldCamera, obstacles, shipClearance, 'default ground cockpit');
  assert.ok(nearestSafePosition(worldCamera, obstacles, shipClearance).distanceTo(worldCamera) < 1e-8,
    'a safe departure must not be projected to orbit before the user launches');
  const heading = worldTarget.clone().sub(worldCamera).normalize();
  assert.ok(heading.dot(surfaceNormal) > 0 && heading.dot(surfaceNormal) < .1,
    'ground cockpit should look across the launch site and horizon');
});

test('all local launch facilities preserve coordinates and collision envelopes in world space', () => {
  assert.ok(facilities.length >= 12);
  assert.equal(new Set(facilities.map(item => item.id)).size, facilities.length);
  for (let index = 0; index < facilities.length; index++) {
    const local = site.obstacles[index], world = facilities[index];
    assert.ok(world.center.distanceTo(local.center.clone().applyQuaternion(rotation).add(origin)) < 1e-10);
    assert.equal(world.radius, local.radius, 'unit quaternion rotation must preserve spherical collision radius');
    for (const point of waypoints) assertOutside(point, [world], shipClearance, world.id);
  }
  assert.ok(facilities[0].center.distanceTo(worldCamera) > facilities[0].radius + shipClearance,
    'the service gantry must not intersect the initial parked ship');
});

test('ship radius includes every real hull vertex and the scaled spacecraft clears the Earth at launch', () => {
  craft.ship.updateMatrixWorld(true);
  const vertex = new Vector3();
  let largest = 0, count = 0;
  craft.ship.traverse(mesh => {
    const attribute = mesh.geometry?.getAttribute('position');
    if (!attribute) return;
    for (let index = 0; index < attribute.count; index++) {
      vertex.fromBufferAttribute(attribute, index).applyMatrix4(mesh.matrixWorld);
      largest = Math.max(largest, vertex.length()); count++;
    }
  });
  assert.ok(count > 50000, 'exercise the detailed, merged craft meshes, not a placeholder sphere');
  assert.ok(largest <= craft.radius + 1e-6, `craft.radius ${craft.radius} must enclose every vertex, largest ${largest}`);
  assert.ok(shipClearance >= .048 && shipClearance < .06, 'use the actual craft radius rather than a fixed point-camera clearance');
  const attitude = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(worldCamera, worldTarget, surfaceNormal));
  const transform = new Matrix4().compose(worldCamera, attitude, new Vector3(shipScale, shipScale, shipScale));
  craft.ship.traverse(mesh => {
    const attribute = mesh.geometry?.getAttribute('position');
    if (!attribute) return;
    const model = transform.clone().multiply(mesh.matrixWorld);
    for (let index = 0; index < attribute.count; index += 31) {
      vertex.fromBufferAttribute(attribute, index).applyMatrix4(model);
      assertOutside(vertex, obstacles, 0, 'world-space parked hull');
    }
  });
});

test('all six transformed launch waypoints and their planned/merged curves have full hull clearance', () => {
  assert.equal(waypoints.length, 6);
  assert.ok(waypoints[0].distanceTo(worldCamera) < 1e-10);
  const firstLift = waypoints[1].clone().sub(waypoints[0]);
  assert.ok(firstLift.dot(surfaceNormal) > 0 && firstLift.clone().cross(surfaceNormal).length() < 1e-10,
    'the first movement must be vertical above the launch pad');
  let lastAltitude = -Infinity;
  const combined = new CurvePath();
  for (let index = 0; index < waypoints.length; index++) {
    assertOutside(waypoints[index], obstacles, shipClearance, `launch waypoint ${index}`);
    const altitude = waypoints[index].distanceTo(earthCenter) - earthRadius;
    assert.ok(altitude > lastAltitude, 'surface departure must climb monotonically'); lastAltitude = altitude;
    if (!index) continue;
    const planned = planSafeFlight(waypoints[index - 1], waypoints[index], obstacles, shipClearance, { up: surfaceNormal });
    assertSafeCurve(planned.curve, obstacles, shipClearance);
    assert.ok(planned.curve.getPoint(0).distanceTo(waypoints[index - 1]) < 1e-8);
    assert.ok(planned.curve.getPoint(1).distanceTo(waypoints[index]) < 1e-8);
    combined.add(planned.curve);
  }
  assertSafeCurve(combined, obstacles, shipClearance, 1200);
  assert.ok(combined.getPoint(1).distanceTo(waypoints.at(-1)) < 1e-8);
});

test('chase camera sweep remains outside the surface and launch facilities when its requested offset clips ground', () => {
  const cameraClearance = .01;
  const forward = worldTarget.clone().sub(worldCamera).normalize();
  const normalBehind = worldCamera.clone().addScaledVector(forward, -.3).addScaledVector(surfaceNormal, .075);
  const ordinary = safeMotion(worldCamera, normalBehind, obstacles, cameraClearance);
  assertOutside(ordinary, obstacles, cameraClearance);
  assert.ok(ordinary.distanceTo(normalBehind) < 1e-8, 'a clear chase-camera offset should remain unchanged');
  const underground = worldCamera.clone().addScaledVector(surfaceNormal, -.5).addScaledVector(forward, -.08);
  assert.ok(underground.distanceTo(earthCenter) < earthRadius, 'regression target must actually enter Earth');
  const swept = safeMotion(worldCamera, underground, obstacles, cameraClearance);
  assertOutside(swept, obstacles, cameraClearance);
  const corrected = nearestSafePosition(underground, obstacles, cameraClearance, surfaceNormal);
  assertOutside(corrected, obstacles, cameraClearance);
  const gantryCenter = facilities[0].center;
  assertOutside(safeMotion(worldCamera, gantryCenter, obstacles, cameraClearance), obstacles, cameraClearance);
});

test('solar and ring-system chase offsets cannot sweep through the Sun or a tilted ring envelope', () => {
  for (const body of [{ id: 'sun', kind: 'star', radius: 3.8 }, { id: 'saturn', kind: 'planet', radius: 1.75, ring: true }]) {
    const center = new Vector3(13, 2, -8), radius = obstacleRadius(body), shell = [{ id: body.id, center, radius }];
    const rig = center.clone().add(new Vector3(radius + .18, .03, 0));
    const requested = center.clone().add(new Vector3(-radius - .5, .03, 0));
    const swept = safeMotion(rig, requested, shell, .02);
    assertOutside(swept, shell, .02);
    assert.ok(swept.x > center.x, 'camera must stop on the near side instead of popping through a whole planet');
    assertOutside(nearestSafePosition(center.clone().add(new Vector3(.04, .03, 0)), shell, .02), shell, .02);
  }
});
