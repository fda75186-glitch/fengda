export function clampPosition(position, viewport, size, margin=12) {
  return {
    x: Math.max(margin, Math.min(position.x, Math.max(margin,viewport.width-size.width-margin))),
    y: Math.max(margin, Math.min(position.y, Math.max(margin,viewport.height-size.height-margin))),
  };
}
export function restorePosition(saved, viewport, size) {
  const fallback={x:viewport.width-size.width-24,y:viewport.height-size.height-24};
  const valid=saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y);
  return clampPosition(valid?saved:fallback,viewport,size);
}
export function isDragGesture(start,current) {
  return Math.hypot(current.x-start.x,current.y-start.y)>6;
}
