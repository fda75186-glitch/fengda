import * as THREE from 'three';

// Fit the projected major bodies, rather than a diagonal enclosing every
// distant dwarf planet. Minor destinations remain available in the navigator.
export function systemOverview(entries, fov, aspect) {
  const major = entries.filter(entry => !/moon|dwarf/.test(entry.body.kind || ''));
  const subjects = major.length ? major : entries;
  const bounds = new THREE.Box3();
  for (const entry of subjects) bounds.expandByPoint(entry.position);
  const target = bounds.getCenter(new THREE.Vector3());
  const direction = new THREE.Vector3(.18, .92, 1).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right);
  const tanY = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * .82;
  const tanX = tanY * Math.max(.2, aspect);
  let distance = 1;
  for (const entry of subjects) {
    const offset = entry.position.clone().sub(target), depth = offset.dot(direction);
    const radius = entry.radius * 1.08;
    distance = Math.max(distance, depth + radius + (Math.abs(offset.dot(right)) + radius) / tanX, depth + radius + (Math.abs(offset.dot(up)) + radius) / tanY);
  }
  return { position: target.clone().addScaledVector(direction, distance), target };
}

export const rectanglesOverlap = (a, b) => a.left < b.right + 6 && a.right > b.left - 6 && a.top < b.bottom + 6 && a.bottom > b.top - 6;

// Deterministic placement with bounded leader lengths. Hide lower-priority
// labels when no room remains; never pile all satellite names onto a planet.
export function arrangeFlightLabels(candidates, width, height, obstacles = []) {
  const occupied = [...obstacles], result = candidates.map(item => ({ ...item, visible: false }));
  const ordered = result.filter(item => candidates.find(source => source.id === item.id)?.visible && Number.isFinite(item.x + item.y))
    .sort((a, b) => Number(b.selected) - Number(a.selected) || (b.priority || 0) - (a.priority || 0) || a.id.localeCompare(b.id));
  for (const item of ordered) {
    const textWidth = [...item.name].reduce((sum, char) => sum + (char.charCodeAt(0) > 255 ? 10 : 6.2), 0);
    const w = Math.min(210, textWidth + 36), h = 30;
    const anchorX = item.x, anchorY = item.y;
    const offsets = [[0,-22],[0,22],[-w/2-14,0],[w/2+14,0],[0,-60],[0,60],[-w/2-14,-38],[w/2+14,-38],[-w/2-14,38],[w/2+14,38]];
    for (const [dx, dy] of offsets) {
      const x = anchorX + dx, y = anchorY + dy;
      const rect = { left:x-w/2, right:x+w/2, top:y-h/2, bottom:y+h/2 };
      if (rect.left < 12 || rect.right > width-12 || rect.top < 16 || rect.bottom > height-22 || occupied.some(other => rectanglesOverlap(rect, other))) continue;
      Object.assign(item, { x, y, anchorX, anchorY, width:w, visible:true, rect }); occupied.push(rect); break;
    }
  }
  return result;
}
