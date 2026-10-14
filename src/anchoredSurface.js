// Keep one opaque surface moving between the actual clicked label/card and the
// final reading panel. Layout snapshots scale uniformly instead of stretching text.
export function captureAnchoredSurface(element, fallback = null) {
  if (!element?.isConnected) return null;
  const bounds = element.getBoundingClientRect();
  if (bounds.width < 1 || bounds.height < 1) return null;
  const rect = { left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height };
  const computed = getComputedStyle(element);
  const clone = element.cloneNode(true);
  clone.removeAttribute('id'); clone.removeAttribute('autofocus');
  clone.classList.remove('tap-feedback', 'scroll-reveal');
  clone.setAttribute('aria-hidden', 'true'); clone.inert = true;
  clone.querySelectorAll('[id],[autofocus]').forEach(node => { node.removeAttribute('id'); node.removeAttribute('autofocus'); });
  // cloneNode copies a canvas element but loses its pixels. Ask a WebGL model to
  // render synchronously, then freeze that frame for the expanding card.
  const liveCanvases = [...element.querySelectorAll('canvas')];
  const clonedCanvases = [...clone.querySelectorAll('canvas')];
  liveCanvases.forEach((canvas, index) => {
    try {
      canvas.dispatchEvent(new Event('anchored-snapshot'));
      clonedCanvases[index]?.getContext('2d')?.drawImage(canvas, 0, 0);
    } catch { /* A lost context must not prevent the card from opening. */ }
  });
  // The reading panel mounts its own model asynchronously. Keep the clicked
  // model visible in the motion snapshot until the live panel is ready.
  if (fallback) for (const model of clone.querySelectorAll('[data-anchored-model]')) {
    if (model.dataset.anchoredReady === 'true') continue;
    const original = [...fallback.clone.querySelectorAll('[data-anchored-model]')]
      .find(candidate => candidate.dataset.anchoredModel === model.dataset.anchoredModel && candidate.dataset.anchoredReady === 'true');
    const canvas = original?.querySelector('canvas');
    const viewport = model.querySelector('.explore-model-viewport');
    if (!canvas || !viewport) continue;
    try {
      const still = document.createElement('canvas');
      still.width = canvas.width; still.height = canvas.height;
      still.getContext('2d').drawImage(canvas, 0, 0);
      Object.assign(still.style, { width: '100%', height: '100%', objectFit: 'contain' });
      viewport.replaceChildren(still); model.querySelector('.model-state')?.remove();
    } catch { /* Keep the normal loading state if the browser cannot copy it. */ }
  }
  for (const property of ['color','backgroundColor','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textAlign','padding','border','borderRadius','display','gap','alignItems','justifyContent','flexDirection','scrollbarGutter']) clone.style[property] = computed[property];
  Object.assign(clone.style, {
    width: `${rect.width}px`, height: `${rect.height}px`, minWidth: '0', minHeight: '0', maxWidth: 'none', maxHeight: 'none',
    position: 'relative', inset: 'auto', margin: '0', boxSizing: 'border-box',
    visibility: 'visible', opacity: '1', transform: 'none', animation: 'none', transition: 'none',
    overflow: element.scrollHeight > element.clientHeight ? 'auto' : 'hidden',
  });
  return { rect, clone, scrollTop: element.scrollTop, radius: computed.borderRadius, background: computed.backgroundColor };
}

export function moveAnchoredSurface(host, backdrop, from, to, opening, onComplete) {
  const frame = document.createElement('div');
  frame.className = 'anchored-motion-surface'; frame.inert = true; frame.setAttribute('aria-hidden','true');
  Object.assign(frame.style, { position: 'absolute', left: '0', top: '0', overflow: 'hidden', background: '#fff', transformOrigin: '0 0', pointerEvents: 'none' });
  function layer(snapshot) {
    const node = document.createElement('div');
    Object.assign(node.style, { position: 'absolute', inset: '0 auto auto 0', width: `${snapshot.rect.width}px`, height: `${snapshot.rect.height}px`, transformOrigin: '0 0', overflow: 'hidden' });
    node.append(snapshot.clone); frame.append(node);
    return node;
  }
  const first = layer(from), second = layer(to);
  host.replaceChildren(frame);
  from.clone.scrollTop = from.scrollTop; to.clone.scrollTop = to.scrollTop;
  const duration = opening ? 510 : 470;
  const timing = { duration, easing: 'cubic-bezier(.22,.8,.24,1)', fill: 'both' };
  const shadow = '0 24px 90px #13273544';
  const effects = [
    frame.animate([
      { transform: `translate3d(${from.rect.left}px,${from.rect.top}px,0)`, width: `${from.rect.width}px`, height: `${from.rect.height}px`, borderRadius: from.radius, boxShadow: opening ? '0 0 0 #13273500' : shadow },
      { transform: `translate3d(${to.rect.left}px,${to.rect.top}px,0)`, width: `${to.rect.width}px`, height: `${to.rect.height}px`, borderRadius: to.radius, boxShadow: opening ? shadow : '0 0 0 #13273500' },
    ], timing),
    first.animate([{ transform: 'scale(1)' },{ transform: `scale(${to.rect.width/from.rect.width})` }], timing),
    second.animate([{ transform: `scale(${from.rect.width/to.rect.width})`, opacity: 0 },{ transform: 'scale(1)', opacity: 1 }], timing),
    backdrop.animate([{ opacity: opening ? 0 : 1 },{ opacity: opening ? 1 : 0 }], timing),
  ];
  let disposed = false, complete = onComplete, timer;
  const settle = () => { if (disposed) return; clearTimeout(timer); complete(); };
  effects[0].finished.then(settle).catch(() => {});
  timer = setTimeout(settle, duration+150);
  return {
    reverse(callback) {
      complete = callback; clearTimeout(timer);
      const time = Math.max(0, Number(effects[0].currentTime) || 0);
      effects.forEach(effect => { effect.currentTime = time; effect.reverse(); });
      timer = setTimeout(settle, time+150);
    },
    dispose() { disposed = true; clearTimeout(timer); effects.forEach(effect => effect.cancel()); host.replaceChildren(); },
  };
}
