// A moving, opaque surface with two proportionally scaled content snapshots.
// Each endpoint is captured at its real layout, so returning to the feed has no swap jump.
export function capturePostSurface(element, viewport = element, isCard = false) {
  const bounds = viewport.getBoundingClientRect();
  const rect = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
  const style = getComputedStyle(element);
  const clone = element.cloneNode(true);
  clone.removeAttribute('id');
  clone.removeAttribute('data-reveal');
  clone.classList.remove('ch-detail-body');
  clone.setAttribute('aria-hidden', 'true');
  clone.inert = true;
  clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  clone.querySelectorAll('img').forEach(node => { node.loading = 'eager'; });
  // Keep a video on its current frame; a cloned video would restart or show a black rectangle.
  const originals = [...element.querySelectorAll('video')];
  clone.querySelectorAll('video').forEach((video, index) => {
    const original = originals[index];
    const still = document.createElement('canvas');
    still.className = video.className;
    still.width = Math.max(1, original.clientWidth);
    still.height = Math.max(1, original.clientHeight);
    const context = still.getContext('2d');
    context.fillStyle = '#08131f';
    context.fillRect(0, 0, still.width, still.height);
    if (original.readyState >= 2) {
      const ratio = Math.min(still.width / original.videoWidth, still.height / original.videoHeight);
      const width = original.videoWidth * ratio, height = original.videoHeight * ratio;
      try { context.drawImage(original, (still.width - width) / 2, (still.height - height) / 2, width, height); } catch {}
    }
    video.replaceWith(still);
  });
  Object.assign(clone.style, {
    width: `${isCard ? rect.width : viewport.clientWidth}px`, maxWidth: 'none',
    margin: '0', boxSizing: 'border-box', visibility: 'visible', opacity: '1',
    transform: 'none', animation: 'none', transition: 'none',
    padding: style.padding, borderRadius: style.borderRadius,
  });
  return { rect, clone, scrollTop: isCard ? 0 : viewport.scrollTop, radius: getComputedStyle(viewport).borderRadius };
}

export function morphPostSurface(host, from, to, opening, onComplete) {
  const backdrop = document.createElement('div');
  backdrop.className = 'ch-morph-backdrop';
  const frame = document.createElement('div');
  frame.className = 'ch-morph-surface';
  frame.setAttribute('aria-hidden', 'true');
  frame.inert = true;
  function layer(snapshot) {
    const node = document.createElement('div');
    node.className = 'ch-morph-layer';
    Object.assign(node.style, { width: `${snapshot.rect.width}px`, height: `${snapshot.rect.height}px` });
    node.append(snapshot.clone);
    frame.append(node);
    return node;
  }
  const first = layer(from), second = layer(to);
  host.replaceChildren(backdrop, frame);
  first.scrollTop = from.scrollTop;
  second.scrollTop = to.scrollTop;
  const duration = opening ? 520 : 480;
  const options = { duration, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'both' };
  const shadow = '0 24px 90px #13273544';
  const effects = [
    frame.animate([
      { transform: `translate3d(${from.rect.left}px,${from.rect.top}px,0)`, width: `${from.rect.width}px`, height: `${from.rect.height}px`, borderRadius: from.radius, boxShadow: opening ? '0 0 0 #13273500' : shadow },
      { transform: `translate3d(${to.rect.left}px,${to.rect.top}px,0)`, width: `${to.rect.width}px`, height: `${to.rect.height}px`, borderRadius: to.radius, boxShadow: opening ? shadow : '0 0 0 #13273500' },
    ], options),
    first.animate([{ transform: 'scale(1)' }, { transform: `scale(${to.rect.width / from.rect.width})` }], options),
    second.animate([{ transform: `scale(${from.rect.width / to.rect.width})` }, { transform: 'scale(1)' }], options),
    // Only the internal layouts blend. The white card itself remains fully opaque.
    second.animate([{ opacity: 0 }, { opacity: 0, offset: .12 }, { opacity: 1, offset: .78 }, { opacity: 1 }], options),
    backdrop.animate([{ opacity: opening ? 0 : 1 }, { opacity: opening ? 1 : 0 }], options),
  ];
  let complete = onComplete, disposed = false, timer;
  const settle = () => {
    if (disposed) return;
    clearTimeout(timer);
    complete();
  };
  effects[0].finished.then(settle).catch(() => {});
  timer = setTimeout(settle, duration + 150);
  return {
    reverse(callback) {
      complete = callback;
      clearTimeout(timer);
      const time = Math.max(0, Number(effects[0].currentTime) || 0);
      for (const effect of effects) { effect.currentTime = time; effect.reverse(); }
      timer = setTimeout(settle, time + 150);
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      effects.forEach(effect => effect.cancel());
      host.replaceChildren();
    },
  };
}
