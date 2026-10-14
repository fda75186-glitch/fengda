import { CurvePath, LineCurve3, QuadraticBezierCurve3, Triangle, Vector3 } from 'three';

const UP = new Vector3(0, 1, 0);
const EPSILON = 1e-5;
const finiteVector = value => value?.isVector3 && [value.x, value.y, value.z].every(Number.isFinite);

/** Solid body/ring envelope. Earth's atmosphere remains traversable during surface launch. */
export function obstacleRadius(body) {
  const radius = Number(body?.radius);
  if (!Number.isFinite(radius) || radius <= 0 || /^(galaxy|cluster|web|nebula)$/.test(body?.kind || '')) return 0;
  const shape = Array.isArray(body.shape) ? Math.max(1, ...body.shape.filter(Number.isFinite).map(Math.abs)) : 1;
  const key = String(body.texture || body.id || '').toLowerCase();
  const shell = key === 'earth' ? 1 : body.kind === 'star' ? 1.12 : 1.012;
  return radius * Math.max(shape * shell, body.ring || key === 'saturn' ? 2.34 : 0);
}

function spheres(obstacles, clearance = 0) {
  if (!Number.isFinite(clearance) || clearance < 0) throw new RangeError('飞船净空必须是有限的非负数');
  return (obstacles || []).filter(obstacle => finiteVector(obstacle?.center) && Number.isFinite(obstacle.radius) && obstacle.radius > 0)
    .map(obstacle => ({ id: obstacle.id, center: obstacle.center.clone(), radius: obstacle.radius + clearance }));
}

function checkedPoint(point) {
  if (!finiteVector(point)) throw new TypeError('航行坐标必须是有限的 Three.js Vector3');
  return point.clone();
}

function tolerance(radius) { return Math.max(EPSILON, radius * 1e-6); }

function outside(point, obstacles) {
  return obstacles.every(obstacle => point.distanceToSquared(obstacle.center) >= (obstacle.radius - tolerance(obstacle.radius)) ** 2);
}

function projectOutside(point, obstacles, preferredDirection = UP) {
  const origin = point.clone();
  // Project out of the deepest overlap. Ordinary scenes converge in one or two passes.
  for (let iteration = 0; iteration < 48; iteration++) {
    let deepest = null, penetration = 0;
    for (const obstacle of obstacles) {
      const amount = obstacle.radius + tolerance(obstacle.radius) - point.distanceTo(obstacle.center);
      if (amount > penetration) { deepest = obstacle; penetration = amount; }
    }
    if (!deepest) return point;
    const normal = point.clone().sub(deepest.center);
    if (normal.lengthSq() < EPSILON ** 2) normal.copy(preferredDirection).normalize();
    if (normal.lengthSq() < EPSILON ** 2) normal.copy(UP);
    point.copy(deepest.center).addScaledVector(normal.normalize(), deepest.radius + tolerance(deepest.radius) * 2);
  }
  // Fully overlapping shells can have no nearby projection. This bounded escape is outside the whole union.
  const direction = point.clone().sub(origin);
  if (direction.lengthSq() < EPSILON ** 2) direction.copy(preferredDirection);
  direction.normalize();
  let distance = 0;
  for (const obstacle of obstacles) distance = Math.max(distance, origin.distanceTo(obstacle.center) + obstacle.radius);
  return origin.addScaledVector(direction, distance + EPSILON * 4);
}

export function nearestSafePosition(point, obstacles, clearance = 0, preferredDirection = UP) {
  return projectOutside(checkedPoint(point), spheres(obstacles, clearance), preferredDirection);
}

function segmentDistanceSquared(from, to, center) {
  const segment = to.clone().sub(from), length = segment.lengthSq();
  const t = length ? Math.max(0, Math.min(1, center.clone().sub(from).dot(segment) / length)) : 0;
  return from.clone().addScaledVector(segment, t).distanceToSquared(center);
}

function segmentClear(from, to, obstacles) {
  return obstacles.every(obstacle => segmentDistanceSquared(from, to, obstacle.center) >= (obstacle.radius - tolerance(obstacle.radius)) ** 2);
}

function segmentHit(from, to, obstacle) {
  const motion = to.clone().sub(from), relative = from.clone().sub(obstacle.center);
  const a = motion.lengthSq();
  if (a <= EPSILON ** 2) return null;
  const b = relative.dot(motion), c = relative.lengthSq() - obstacle.radius ** 2;
  if (c <= tolerance(obstacle.radius) * obstacle.radius && b >= 0) return null;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const t = (-b - Math.sqrt(Math.max(0, discriminant))) / a;
  return t >= -EPSILON && t <= 1 ? Math.max(0, t) : null;
}

/** Continuous sweep, so a large wheel/key step cannot enter one side and exit the other. */
export function safeMotion(from, to, obstacles, clearance = 0) {
  const prepared = spheres(obstacles, clearance);
  const position = projectOutside(checkedPoint(from), prepared);
  let remaining = checkedPoint(to).sub(position);
  for (let iteration = 0; iteration < 5 && remaining.lengthSq() > EPSILON ** 2; iteration++) {
    const end = position.clone().add(remaining);
    let hit = null, first = Infinity;
    for (const obstacle of prepared) {
      const t = segmentHit(position, end, obstacle);
      if (t !== null && t < first) { first = t; hit = obstacle; }
    }
    if (!hit) { position.copy(end); break; }
    const length = remaining.length();
    const t = Math.max(0, first - tolerance(hit.radius) * 2 / length);
    position.addScaledVector(remaining, t);
    remaining.multiplyScalar(1 - first);
    const normal = position.clone().sub(hit.center).normalize();
    const inward = remaining.dot(normal);
    if (inward < 0) remaining.addScaledVector(normal, -inward);
  }
  return projectOutside(position, prepared);
}

function stableNormal(direction, preferredUp = UP) {
  const normal = direction.clone().cross(preferredUp);
  if (normal.lengthSq() < 1e-8) normal.copy(direction).cross(new Vector3(1, 0, 0));
  return normal.normalize();
}

function pathLength(points) {
  let result = 0;
  for (let index = 1; index < points.length; index++) result += points[index - 1].distanceTo(points[index]);
  return result;
}

function detour(from, to, obstacle, obstacles, preferredUp) {
  const origin = obstacle.center, radius = obstacle.radius;
  const start = from.clone().sub(origin), finish = to.clone().sub(origin);
  const a = start.length(), b = finish.length(), u = start.normalize(), v = finish.normalize();
  let normal = u.clone().cross(v);
  if (normal.lengthSq() < 1e-8) normal = stableNormal(u, preferredUp);
  else normal.normalize();
  const angle = Math.acos(Math.max(-1, Math.min(1, u.dot(v))));
  const routeRadius = radius * 1.026 + tolerance(radius) * 4;
  const startRadius = Math.max(a, routeRadius), finishRadius = Math.max(b, routeRadius);
  const alpha = Math.acos(Math.min(1, routeRadius / startRadius));
  const beta = Math.acos(Math.min(1, routeRadius / finishRadius));
  const candidates = [];
  for (const sign of [1, -1]) {
    const oriented = sign > 0 ? angle : Math.PI * 2 - angle;
    const arc = Math.max(0, oriented - alpha - beta);
    const result = [from.clone()];
    if (a < routeRadius) result.push(origin.clone().addScaledVector(u, routeRadius));
    const count = Math.max(1, Math.ceil(arc / (Math.PI / 16)));
    for (let index = 0; index <= count; index++) {
      const direction = u.clone().applyAxisAngle(normal, sign * (alpha + arc * index / count));
      result.push(origin.clone().addScaledVector(direction, routeRadius));
    }
    if (b < routeRadius) result.push(origin.clone().addScaledVector(v, routeRadius));
    result.push(to.clone());
    const collisions = result.slice(1).reduce((sum, point, index) => sum + obstacles.filter(item => !segmentClear(result[index], point, [item])).length, 0);
    candidates.push({ points: result, score: pathLength(result) + collisions * radius * 8 });
  }
  candidates.sort((left, right) => left.score - right.score);
  return candidates[0].points;
}

function firstBlocked(points, obstacles) {
  for (let index = 0; index < points.length - 1; index++) {
    let closest = null, distance = Infinity;
    for (const obstacle of obstacles) {
      if (segmentClear(points[index], points[index + 1], [obstacle])) continue;
      const candidate = points[index].distanceTo(obstacle.center);
      if (candidate < distance) { closest = obstacle; distance = candidate; }
    }
    if (closest) return { index, obstacle: closest };
  }
  return null;
}

function simplify(points, obstacles) {
  const result = [points[0]];
  let index = 0;
  while (index < points.length - 1) {
    let next = points.length - 1;
    while (next > index + 1 && !segmentClear(points[index], points[next], obstacles)) next--;
    result.push(points[next]); index = next;
  }
  return result;
}

// A rare fallback for touching/overlapping shells; graph size and search are bounded.
function visibilityPath(from, to, obstacles, candidates) {
  const nodes = [from, to, ...candidates.filter(point => outside(point, obstacles))];
  for (const obstacle of obstacles) {
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
      if (!(x || y || z)) continue;
      const point = obstacle.center.clone().addScaledVector(new Vector3(x, y, z).normalize(), obstacle.radius * 1.28 + EPSILON);
      if (outside(point, obstacles)) nodes.push(point);
    }
  }
  if (nodes.length > 1200) throw new RangeError('航线障碍过于密集，请先爬升到较大的尺度');
  const costs = new Float64Array(nodes.length).fill(Infinity), previous = new Int32Array(nodes.length).fill(-1), visited = new Uint8Array(nodes.length);
  costs[0] = 0;
  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let current = -1, cheapest = Infinity;
    for (let index = 0; index < nodes.length; index++) if (!visited[index] && costs[index] < cheapest) { current = index; cheapest = costs[index]; }
    if (current < 0) break;
    if (current === 1) {
      const result = [];
      for (let index = 1; index !== -1; index = previous[index]) result.push(nodes[index]);
      return result.reverse();
    }
    visited[current] = 1;
    for (let index = 0; index < nodes.length; index++) {
      if (visited[index]) continue;
      const cost = cheapest + nodes[current].distanceTo(nodes[index]);
      if (cost >= costs[index] || !segmentClear(nodes[current], nodes[index], obstacles)) continue;
      costs[index] = cost; previous[index] = current;
    }
  }
  throw new RangeError('当前位置无法规划安全航线，请先离开重叠的天体区域');
}

function smoothCurve(points, obstacles) {
  const curve = new CurvePath(), triangle = new Triangle(), closest = new Vector3();
  let previous = points[0];
  for (let index = 1; index < points.length - 1; index++) {
    const corner = points[index], before = points[index - 1], after = points[index + 1];
    const cut = Math.min(corner.distanceTo(before), corner.distanceTo(after)) * .24;
    let factor = 1, entry, exit;
    for (let attempt = 0; attempt < 10; attempt++) {
      entry = corner.clone().addScaledVector(before.clone().sub(corner).normalize(), cut * factor);
      exit = corner.clone().addScaledVector(after.clone().sub(corner).normalize(), cut * factor);
      triangle.set(entry, corner, exit);
      const safe = obstacles.every(obstacle => triangle.closestPointToPoint(obstacle.center, closest).distanceToSquared(obstacle.center) >= (obstacle.radius - tolerance(obstacle.radius)) ** 2);
      if (safe) break;
      factor *= .5;
    }
    // Convex-hull validation proves the entire quadratic is safe, not just a few samples.
    triangle.set(entry, corner, exit);
    const safe = obstacles.every(obstacle => triangle.closestPointToPoint(obstacle.center, closest).distanceToSquared(obstacle.center) >= (obstacle.radius - tolerance(obstacle.radius)) ** 2);
    if (!safe || cut < EPSILON) { curve.add(new LineCurve3(previous, corner)); previous = corner; continue; }
    if (previous.distanceToSquared(entry) > EPSILON ** 2) curve.add(new LineCurve3(previous, entry));
    curve.add(new QuadraticBezierCurve3(entry, corner, exit)); previous = exit;
  }
  const final = points[points.length - 1];
  curve.add(new LineCurve3(previous, final));
  return curve;
}

/** Plan outside expanded shells, lift away from a nearby body before turning, then round safe corners. */
export function planSafeFlight(from, to, obstacles, clearance = 0, options = {}) {
  const prepared = spheres(obstacles, clearance), preferredUp = finiteVector(options.up) ? options.up : UP;
  const start = projectOutside(checkedPoint(from), prepared, preferredUp), end = projectOutside(checkedPoint(to), prepared, preferredUp);
  const points = [start];
  const nearby = prepared.filter(obstacle => start.distanceTo(obstacle.center) < obstacle.radius * 1.45)
    .sort((a, b) => start.distanceTo(a.center) - a.radius - (start.distanceTo(b.center) - b.radius))[0];
  if (nearby && start.distanceTo(end) > nearby.radius * .45) {
    const normal = finiteVector(options.departureNormal) ? options.departureNormal.clone().normalize() : start.clone().sub(nearby.center).normalize();
    const lift = Math.min(nearby.radius * .5, start.distanceTo(end) * .2);
    points.push(projectOutside(start.clone().addScaledVector(normal, lift), prepared, normal));
  }
  points.push(end);
  let blocked;
  // Each insertion wraps the actual first intersected shell. No polynomial crosses unchecked space.
  for (let iteration = 0; iteration < 96; iteration++) {
    blocked = firstBlocked(points, prepared);
    if (!blocked) break;
    const replacement = detour(points[blocked.index], points[blocked.index + 1], blocked.obstacle, prepared, preferredUp);
    points.splice(blocked.index, 2, ...replacement);
    if (points.length > 600) break;
  }
  let route = firstBlocked(points, prepared) ? visibilityPath(start, end, prepared, points.slice(1, -1).slice(0, 160)) : points;
  // Keep the explicit departure leg; simplification must not turn surface launch into a chord.
  if (nearby && route.length > 2 && segmentClear(route[0], route[1], prepared)) route = [route[0], ...simplify(route.slice(1), prepared)];
  else route = simplify(route, prepared);
  const curve = smoothCurve(route, prepared);
  return { curve, points: route.map(point => point.clone()), length: curve.getLength() };
}
