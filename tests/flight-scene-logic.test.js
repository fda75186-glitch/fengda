import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import * as RealThree from 'three';
import { journeyStops } from '../src/universe/catalog.js';
import { branchStops,explorationFor } from '../src/universe/exploration.js';

// Only renderer/texture IO and host APIs are substituted. Navigation, scene
// geometry, camera matrices, launch collision and lifecycle remain production code.
// Nothing creates a browser, a GL context, a screenshot or a pixel comparison.
let host;
const descriptors = new Map();
const noOp = () => {};
function eventTarget() {
  const listeners = new Map();
  return {
    style: {}, width: 0, height: 0,
    addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    dispatch(type, event = {}) { for (const callback of listeners.get(type) || []) callback({ preventDefault: noOp, ...event }); },
    focus: noOp, setPointerCapture: noOp, setAttribute: noOp,
    remove() { this.removed = true; },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    getContext: () => null, // Canvas textures are optional; no 2D drawing is done.
  };
}
class LogicRenderer {
  constructor(options) { this.options = options; this.domElement = eventTarget(); this.capabilities = { getMaxAnisotropy: () => 8 }; this.ratio = 1; host.renderer = this; }
  setPixelRatio(value) { this.ratio = value; }
  getPixelRatio() { return this.ratio; }
  setSize = noOp;
  setClearColor = noOp;
  clear = noOp;
  clearDepth = noOp;
  render(scene, camera) { if (camera.far > 1000) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); host.world = { scene, camera }; } }
  compileAsync(scene, camera) {
    if (host.rejectCompile) { const failure = host.rejectCompile; host.rejectCompile = null; return Promise.reject(failure); }
    if (!host.deferCompile) return Promise.resolve(scene);
    return new Promise((resolve, reject) => { host.pendingCompiles.push({ resolve, reject, scene, camera }); });
  }
  dispose() { this.disposed = true; }
  forceContextLoss = noOp;
}
class LogicTextureLoader {
  loadAsync() { return Promise.resolve(new RealThree.Texture()); }
}
const overrideKey = Symbol.for('starwhisper.flight.logic.three');
globalThis[overrideKey] = { LogicRenderer, LogicTextureLoader };
const threeUrl = import.meta.resolve('three');
const shim = 'data:text/javascript,' + encodeURIComponent(`
  export * from ${JSON.stringify(threeUrl)};
  export const WebGLRenderer = globalThis[Symbol.for('starwhisper.flight.logic.three')].LogicRenderer;
  export const TextureLoader = globalThis[Symbol.for('starwhisper.flight.logic.three')].LogicTextureLoader;
`);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'three' && context.parentURL?.split('?')[0].endsWith('/universe/flightScene.js')) return { url: shim, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const result = nextLoad(url, context);
    // Emulate Vite's public-base substitution; this suite does not test asset IO.
    if (url.endsWith('/src/assets.js')) return { ...result, source: result.source.toString().replace('import.meta.env.BASE_URL', JSON.stringify('/')) };
    return result;
  },
});
const { createFlightScene } = await import('../src/universe/flightScene.js?node-state-regression');

function global(name, value) {
  if (!descriptors.has(name)) descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
async function settle() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
function fixture(extraCallbacks = {}) {
  host = { raf: new Map(), rafId: 0, time: 0, pendingCompiles: [], deferCompile: false, arrivals: [], stops: [], travels: [], errors: [] };
  const document = { ...eventTarget(), hidden: false, createElement: eventTarget };
  const window = { ...eventTarget(), devicePixelRatio: 1, matchMedia: () => ({ matches: false }) };
  global('document', document); global('window', window); global('navigator', { hardwareConcurrency: 8 });
  global('requestAnimationFrame', callback => { const id = ++host.rafId; host.raf.set(id, callback); return id; });
  global('cancelAnimationFrame', id => host.raf.delete(id));
  global('ResizeObserver', class { observe() {} disconnect() {} });
  const holder = { clientWidth: 1280, clientHeight: 720, appendChild: noOp };
  const flight = createFlightScene(holder, {
    launchDestination: journeyStops[1],
    onArrival: item => host.arrivals.push(item),
    onStopChanged: item => host.stops.push(item),
    onTravel: state => host.travels.push(state),
    onError: error => host.errors.push(error),
    ...extraCallbacks,
  });
  host.flight = flight;
  async function advance(frames, deltaMs = 50) {
    for (let index = 0; index < frames; index++) {
      host.time += deltaMs;
      const callbacks = [...host.raf.values()]; host.raf.clear();
      for (const callback of callbacks) callback(host.time);
      await settle();
    }
  }
  const position = () => host.world.camera.position.clone();
  return { flight, advance, position };
}
afterEach(() => { host?.flight?.dispose(); host = null; });
after(() => {
  hooks.deregister(); delete globalThis[overrideKey];
  for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
});

test('初始位置在文昌风格地表，而非外太空，地球只有一个实体', async () => {
  const { flight, advance, position } = fixture();
  await flight.setStop(journeyStops[0], { animate: false });
  await advance(2);
  const earth = journeyStops[0].bodies.find(body => body.id === 'earth');
  const altitude = position().distanceTo(new RealThree.Vector3(...earth.position)) - earth.radius;
  assert.ok(altitude > .03 && altitude < .25, `surface altitude ${altitude}`);
  const bodies = [];
  host.world.scene.traverse(object => { if (object.userData.body?.id === 'earth' && object.userData.object) bodies.push(object); });
  assert.equal(bodies.length, 1);
  assert.equal(host.arrivals.at(-1).id, 'earth-launch');
  assert.deepEqual(host.errors, []);
});

test('地面初始球面精度稳定，所有世界自定义材质使用一致的深度方案', async () => {
  const { flight, advance } = fixture();
  await flight.setStop(journeyStops[0], { animate: false }); await advance(2);
  assert.equal(host.renderer.options.logarithmicDepthBuffer, true);
  let earth;
  host.world.scene.traverse(object => {
    if(object.userData.body?.id==='earth'&&object.userData.object)earth=object.userData.object;
    if(object.material?.isShaderMaterial)assert.equal(object.material.userData.flightDepth,true);
  });
  const geometry=earth.geometry;assert.equal(geometry.parameters.widthSegments,160);
  await advance(40); assert.equal(earth.geometry,geometry,'ground LOD must not alternate while parked');
});

test('银河层接入细节模型，离开时释放恒星与尘埃几何', async () => {
  const { flight, advance } = fixture();
  const galaxyStop=journeyStops.find(stop=>stop.bodies.some(body=>body.id==='milky-way-disc'));
  await flight.setStop(galaxyStop,{animate:false});await advance(4);
  const stars=host.world.scene.getObjectByName('galaxy-volume-stars'), disc=host.world.scene.getObjectByName('galaxy-dust-and-stellar-disc');
  assert.equal(stars.geometry.attributes.position.count,64000); assert.ok(disc);
  assert.equal(disc.material.userData.flightDepth,true);
  const freed=[];stars.geometry.addEventListener('dispose',()=>freed.push('stars'));disc.geometry.addEventListener('dispose',()=>freed.push('disc'));
  await flight.setStop(journeyStops[2],{animate:false});await advance(4);
  assert.deepEqual(freed.sort(),['disc','stars']);assert.deepEqual(host.errors,[]);
});

test('点击月球先沿地面航道升空，随后进入规范地月层并抵达月球', async () => {
  const { flight, advance } = fixture();
  await flight.setStop(journeyStops[0], { animate: false });
  await advance(2);
  flight.travelTo('moon');
  assert.equal(host.travels.at(-1).active, true);
  await advance(160);
  assert.equal(host.stops.at(-1).id, 'earth-launch');
  assert.ok(!host.arrivals.some(item => item.id === 'moon'));
  await advance(440);
  assert.equal(host.stops.at(-1), journeyStops[1]);
  assert.equal(host.arrivals.at(-1).id, 'moon');
  assert.deepEqual(host.errors, []);
});

test('爬升期间重选目的地最终采用最新目的地，不重新落回地面', async () => {
  const { flight, advance, position } = fixture();
  await flight.setStop(journeyStops[0], { animate: false });
  await advance(2);
  flight.launchTo(journeyStops[1]);
  await advance(220);
  const before = position();
  flight.launchTo(journeyStops[2]);
  await advance(1);
  const earthCenter = new RealThree.Vector3(...journeyStops[0].bodies[0].position);
  assert.ok(position().distanceTo(earthCenter) >= before.distanceTo(earthCenter) - .002);
  await advance(420);
  assert.equal(host.stops.at(-1), journeyStops[2]);
  assert.equal(host.arrivals.at(-1).id, 'solar');
  assert.ok(!host.stops.some(stop => stop.id === 'earth-moon'));
});

test('键盘接管中断爬升，恢复起飞从当前高度继续，不向地面折返', async () => {
  const { flight, advance, position } = fixture();
  await flight.setStop(journeyStops[0], { animate: false });
  await advance(2); flight.launchTo(journeyStops[1]); await advance(190);
  host.renderer.domElement.dispatch('keydown', { key: 'w' });
  assert.equal(host.travels.at(-1).active, false);
  assert.equal(host.travels.at(-1).phase, '手动接管');
  await advance(6); host.renderer.domElement.dispatch('keyup', { key: 'w' });
  const earthCenter = new RealThree.Vector3(...journeyStops[0].bodies[0].position), height = position().distanceTo(earthCenter);
  flight.launchTo(journeyStops[1]); await advance(25);
  assert.ok(position().distanceTo(earthCenter) >= height - .003);
  await advance(550);
  assert.equal(host.arrivals.at(-1).id, 'earth-moon');
});

test('手动命令取消仍在编译的异步层切换，旧层继续航行', async () => {
  const { flight, advance } = fixture();
  await flight.setStop(journeyStops[1], { animate: false }); await advance(2);
  host.deferCompile = true;
  const pending = flight.setStop(journeyStops[2]); await settle();
  assert.equal(host.pendingCompiles.length, 1);
  flight.move('left');
  host.deferCompile = false; host.pendingCompiles.shift().resolve(); await pending; await advance(2);
  assert.equal(host.stops.at(-1), journeyStops[1]);
  const solar = []; host.world.scene.traverse(object => { if (object.userData.body?.id === 'sun') solar.push(object); });
  assert.equal(solar.length, 0);
  assert.deepEqual(host.errors, []);
});

test('新层加载失败保留旧层与旧相机，随后仍可手动航行', async () => {
  const { flight, advance, position } = fixture();
  await flight.setStop(journeyStops[1], { animate: false }); await advance(2);
  const before = position(); host.rejectCompile = new Error('intentional shader warmup failure');
  await assert.rejects(flight.setStop(journeyStops[2]), /intentional shader/);
  await advance(1); assert.ok(position().distanceTo(before) < 1e-8);
  assert.equal(host.stops.at(-1), journeyStops[1]);
  flight.move('left'); await advance(1); assert.ok(position().distanceTo(before) > 0);
  assert.equal(host.travels.findLast(state => state.phase === '目的地加载失败').active, false);
});

test('已经换入新层后的异常也恢复旧层与坐标', async () => {
  let rejectSolar = true;
  const { flight, advance, position } = fixture({ onStopChanged: item => {
    host.stops.push(item);
    if (item.id === 'solar' && rejectSolar) { rejectSolar = false; throw new Error('intentional observer failure'); }
  } });
  await flight.setStop(journeyStops[1], { animate: false }); await advance(2);
  const before = position();
  await assert.rejects(flight.setStop(journeyStops[2]), /intentional observer/);
  await advance(1);
  assert.equal(host.stops.at(-1), journeyStops[1]);
  assert.ok(position().distanceTo(before) < 1e-8);
  flight.move('right'); await advance(1); assert.ok(position().distanceTo(before) > 0);
});

test('dispose 取消 RAF 且晚到编译不会触发抵达或目的地回调', async () => {
  const { flight, advance } = fixture();
  await flight.setStop(journeyStops[1], { animate: false }); await advance(2);
  host.deferCompile = true;
  const pending = flight.setStop(journeyStops[2]); await settle();
  const arrivalCount = host.arrivals.length, stopCount = host.stops.length, travelCount = host.travels.length;
  flight.dispose();
  host.deferCompile = false; host.pendingCompiles.shift().resolve(); await pending; await advance(2);
  assert.equal(host.raf.size, 0);
  assert.equal(host.arrivals.length, arrivalCount);
  assert.equal(host.stops.length, stopCount);
  assert.equal(host.travels.length, travelCount);
  assert.equal(host.renderer.disposed, true);
  assert.equal(host.renderer.domElement.removed, true);
  assert.deepEqual(host.errors, []);
});


test('快速穿越跨区域天体使用虫洞并保留最终行星，抵达后关闭效果状态',async()=>{
  const {flight,advance}=fixture();await flight.setStop(journeyStops[1],{animate:false});await advance(2);
  await flight.setStop(journeyStops[2],{quick:true,arrivalBody:'neptune'});await advance(12);
  assert.ok(host.travels.some(item=>item.wormhole&&item.active));
  await advance(140);assert.equal(host.arrivals.at(-1).id,'neptune');
  assert.equal(host.travels.at(-1).active,false);assert.ok(!host.travels.at(-1).wormhole);
  assert.deepEqual(host.errors,[]);
});
test('虫洞穿越暂停保持位置，手动接管取消穿越且不会错误抵达',async()=>{
  const {flight,advance,position}=fixture();await flight.setStop(journeyStops[2],{animate:false});await advance(2);
  flight.travelTo('neptune',{quick:true});await advance(14);assert.ok(host.travels.at(-1).wormhole);
  flight.setPaused(true);const before=position();await advance(25);assert.ok(position().distanceTo(before)<.03);
  flight.setPaused(false);flight.move('left');const arrivals=host.arrivals.length;await advance(140);
  assert.equal(host.arrivals.length,arrivals);assert.equal(host.travels.at(-1).active,false);assert.deepEqual(host.errors,[]);
});


test('从星系团进入星系内部时镜头真正位于结构内部，背景不产生标签且资源可释放',async()=>{
  let labels=[];const {flight,advance,position}=fixture({onLabels:value=>{labels=value;}});
  const virgo=branchStops.find(stop=>stop.id==='virgo');await flight.setStop(virgo,{animate:false});await advance(4);
  const inside=explorationFor(virgo.bodies[0],null,virgo);await flight.setStop(inside,{animate:false});await advance(8);
  assert.equal(host.stops.at(-1).id,inside.id);
  const background=inside.bodies.find(body=>body.nonInteractive);assert.ok(position().distanceTo(new RealThree.Vector3(...background.position))<background.radius);
  assert.ok(!labels.some(label=>label.id===background.id&&label.visible));
  const sample=explorationFor(inside.bodies.find(body=>body.demonstrationSystem),null,inside);
  await flight.setStop(sample,{animate:false});await advance(4);assert.equal(host.arrivals.at(-1).id,sample.id);assert.deepEqual(host.errors,[]);
});
