import { Vector3 } from 'three';

const EPSILON = 1e-6;
const AXES = ['x', 'y', 'z'];
const finiteVector = point => point?.isVector3 && AXES.every(axis => Number.isFinite(point[axis]));

function prepare(boxes, clearance) {
  if (!Array.isArray(boxes)) throw new TypeError('发射台碰撞盒必须是数组');
  if (!Number.isFinite(clearance) || clearance < 0) throw new RangeError('发射台净空必须是有限的非负数');
  return boxes.map(box => {
    if (!finiteVector(box?.min) || !finiteVector(box?.max)) throw new TypeError('发射台边界必须是有限 Vector3');
    if (AXES.some(axis => box.min[axis] > box.max[axis])) throw new RangeError('发射台最小边界不能大于最大边界');
    const expanded = { min: box.min.clone().addScalar(-clearance), max: box.max.clone().addScalar(clearance) };
    if (!finiteVector(expanded.min) || !finiteVector(expanded.max)) throw new RangeError('扩大后的发射台边界必须保持有限');
    return expanded;
  });
}

function inside(point, box) {
  return AXES.every(axis => point[axis] > box.min[axis] && point[axis] < box.max[axis]);
}

function escapePoint(point, boxes) {
  if (!boxes.some(box => inside(point, box))) return point;
  const candidates = [];
  // Enumerating all faces also handles nested/overlapping pad slabs without repeated projections.
  const faces = [['y', 'max'], ['x', 'max'], ['x', 'min'], ['z', 'max'], ['z', 'min'], ['y', 'min']];
  for (const box of boxes) for (const [axis, face] of faces) {
    const candidate = point.clone(); candidate[axis] = box[face][axis] + (face === 'max' ? EPSILON : -EPSILON);
    if (boxes.some(item => inside(candidate, item))) continue;
    candidates.push({ point: candidate, distance: candidate.distanceToSquared(point), priority: faces.findIndex(item => item[0] === axis && item[1] === face) });
  }
  candidates.sort((a, b) => Math.abs(a.distance - b.distance) <= EPSILON ** 2 * 4 ? a.priority - b.priority : a.distance - b.distance);
  // For finite AABBs, at least one outer face on each axis is outside the whole union.
  return candidates[0]?.point || point;
}

function firstEntry(from, motion, box) {
  let enter = 0, exit = 1;
  for (const axis of AXES) {
    const velocity = motion[axis];
    if (Math.abs(velocity) < 1e-12) {
      // Staying exactly along a face does not enter its volume.
      if (from[axis] <= box.min[axis] || from[axis] >= box.max[axis]) return null;
      continue;
    }
    const first = (box.min[axis] - from[axis]) / velocity, second = (box.max[axis] - from[axis]) / velocity;
    enter = Math.max(enter, Math.min(first, second)); exit = Math.min(exit, Math.max(first, second));
    if (enter > exit) return null;
  }
  if (exit <= 0 || enter > 1 || enter >= exit) return null;
  return Math.max(0, enter);
}

/** Local-space pad sweep. The root renderer applies site/world transforms around this operation. */
export function safePadMotion(fromLocal, toLocal, boxes = [], clearance = 0) {
  if (!finiteVector(fromLocal) || !finiteVector(toLocal)) throw new TypeError('发射台移动坐标必须是有限 Vector3');
  const prepared = prepare(boxes, clearance), from = escapePoint(fromLocal.clone(), prepared);
  const motion = toLocal.clone().sub(from), length = motion.length();
  if (!length) return from;
  let first = Infinity;
  for (const box of prepared) {
    const entry = firstEntry(from, motion, box);
    if (entry !== null) first = Math.min(first, entry);
  }
  if (!Number.isFinite(first)) return toLocal.clone();
  return from.addScaledVector(motion, Math.max(0, first - EPSILON * 2 / length));
}
