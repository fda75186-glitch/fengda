// Label offsets are screen-space only; the pins keep their exact geographic positions.
export function isObservatoryAnchorVisible(point, viewportWidth, viewportHeight = Infinity) {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
    && point.x >= 0 && point.x <= viewportWidth && point.y >= 0 && point.y <= viewportHeight;
}
export function observatoryLabelOffsets(labels, viewportWidth, gap = 8, viewportHeight = Infinity) {
  // Cull by the real pin before moving labels to avoid overlapping. An off-screen
  // station must never be clamped back onto the map's left or right edge.
  const laidOut = labels.filter(label => isObservatoryAnchorVisible({ x: label.anchorX ?? label.x, y: label.anchorY ?? label.y }, viewportWidth, viewportHeight))
    .map(label => ({ ...label, center: label.x }))
    .sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
  const clamp = label => {
    const margin = label.width / 2 + gap;
    return Math.max(margin, Math.min(viewportWidth - margin, label.center));
  };
  laidOut.forEach(label => { label.center = clamp(label); });
  for (let pass = 0; pass < laidOut.length * 3; pass++) {
    let changed = false;
    for (let i = 0; i < laidOut.length; i++) {
      for (let j = i + 1; j < laidOut.length; j++) {
        const left = laidOut[i], right = laidOut[j];
        if (Math.abs(left.y - right.y) >= (left.height + right.height) / 2 + gap) continue;
        const overlap = (left.width + right.width) / 2 + gap - (right.center - left.center);
        if (overlap <= .5) continue;
        const oldLeft = left.center, oldRight = right.center;
        left.center = clamp({ ...left, center: left.center - overlap / 2 });
        right.center = clamp({ ...right, center: right.center + overlap / 2 });
        const remaining = (left.width + right.width) / 2 + gap - (right.center - left.center);
        if (remaining > 0 && left.center === oldLeft) right.center = clamp({ ...right, center: right.center + remaining });
        else if (remaining > 0 && right.center === oldRight) left.center = clamp({ ...left, center: left.center - remaining });
        changed ||= left.center !== oldLeft || right.center !== oldRight;
      }
    }
    if (!changed) break;
  }
  return new Map(laidOut.map(label => [label.id, Math.round((label.center - label.x) * 10) / 10]));
}
