import * as THREE from 'three';
import { muxVideoWebM } from './webm-muxer.mjs';

const DURATION = 10;
const APPROACH_DURATION = 2.5;
const ORBIT_DURATION = 7.5;
const FPS = 30;
const WIDTH = 1920;
const HEIGHT = 1080;
const base = import.meta.env.BASE_URL;
const byId = id => document.getElementById(id);
const canvas = byId('film');
const status = byId('status');
const play = byId('play');
const record = byId('record');
const offline = byId('offline');
const reset = byId('reset');
const seek = byId('seek');
const timeOutput = byId('time');
const progress = byId('progress');
const download = byId('download');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(WIDTH, HEIGHT, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000002, 1);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, WIDTH / HEIGHT, 0.002, 12000);
const light = new THREE.DirectionalLight(0xfff8ec, 5.4);
light.position.set(4, 9, 6);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
Object.assign(light.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: 0.5, far: 20 });
light.shadow.bias = -0.000015;
light.shadow.normalBias = 0.0004;
scene.add(light, new THREE.AmbientLight(0x9fb8d0, 0.025));

const loader = new THREE.TextureLoader();
async function texture(name, color = false) {
  const tex = await loader.loadAsync(`${base}textures/${name}`);
  tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

// Stars have fixed 3D positions. Camera rotation reveals different sky regions.
function starField() {
  let seed = 23169;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const count = 2100;
  const position = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const phi = random() * Math.PI * 2;
    const y = random() * 2 - 1;
    const r = Math.sqrt(1 - y * y);
    const distance = 3500 + random() * 2500;
    position.set([Math.cos(phi) * r * distance, y * distance, Math.sin(phi) * r * distance], i * 3);
    const brightness = 0.22 + Math.pow(random(), 7) * 0.7;
    const warm = random() < 0.15;
    colors.set(warm ? [brightness, brightness * 0.85, brightness * 0.70] : [brightness * 0.84, brightness * 0.92, brightness], i * 3);
    sizes[i] = 0.7 + Math.pow(random(), 9) * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('pointSize', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    vertexShader: `attribute float pointSize; varying vec3 vStarColor; void main(){ vStarColor=color; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_PointSize=pointSize; }`,
    fragmentShader: `varying vec3 vStarColor; void main(){ float r=length(gl_PointCoord-0.5); if(r>0.5)discard; gl_FragColor=vec4(vStarColor,1.0-smoothstep(0.1,0.5,r)); #include <colorspace_fragment> }`,
  });
  // A separate point shader avoids luminance changes as Moon fills the frame.
  material.fragmentShader = material.fragmentShader.replace(' #include <colorspace_fragment>', '\n#include <colorspace_fragment>\n');
  scene.add(new THREE.Points(geometry, material));
}

function terrainGeometry(data, width, height, radiusM) {
  const geometry = new THREE.SphereGeometry(1, 384, 192);
  const positions = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const sample = (u, v) => {
    const xf = ((u % 1 + 1) % 1) * width;
    const yf = THREE.MathUtils.clamp((1 - v) * (height - 1), 0, height - 1);
    const x0 = Math.floor(xf) % width;
    const x1 = (x0 + 1) % width;
    const y0 = Math.floor(yf);
    const y1 = Math.min(y0 + 1, height - 1);
    const tx = xf - Math.floor(xf);
    const ty = yf - y0;
    const a = THREE.MathUtils.lerp(data[y0 * width + x0], data[y0 * width + x1], tx);
    const b = THREE.MathUtils.lerp(data[y1 * width + x0], data[y1 * width + x1], tx);
    return (THREE.MathUtils.lerp(a, b, ty) * 0.5 - 10000) / radiusM;
  };
  const vertex = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i).normalize();
    vertex.multiplyScalar(1 + sample(uv.getX(i), uv.getY(i)));
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

let ready = false;
let running = false;
let recording = false;
let frameHandle;
let currentTime = 0;
let recorder;
let exportUrl;
let recordedFrames = 0;
const trajectory = [];

const smooth = x => x * x * (3 - 2 * x);

// One continuous Moon shot: approach for 2.5 s, then a complete orbit in 7.5 s.
// The model, lights, and world-positioned stars remain unchanged and stationary.
function cameraPose(t) {
  const approachT = smooth(THREE.MathUtils.clamp(t / APPROACH_DURATION, 0, 1));
  const orbitT = smooth(THREE.MathUtils.clamp((t - APPROACH_DURATION) / ORBIT_DURATION, 0, 1));
  const theta = 2 * Math.PI * orbitT;
  const flyby = Math.sin(Math.PI * orbitT);
  const radius = THREE.MathUtils.lerp(9.2, 2.68, approachT) - 0.87 * Math.pow(flyby, 1.6);
  const latitude = 0.21 + 0.11 * Math.sin(theta);
  camera.position.set(Math.sin(theta) * radius * Math.cos(latitude), Math.sin(latitude) * radius, Math.cos(theta) * radius * Math.cos(latitude));
  // A forward look of a few degrees, a changing vertical framing, and bank provide
  // diagonal foreground motion rather than an unchanged center-locked turntable.
  const leading = 0.11 * Math.sin(Math.PI * orbitT);
  const target = new THREE.Vector3(
    Math.cos(theta) * leading,
    0.07 + 0.05 * Math.sin(theta * 2),
    -Math.sin(theta) * leading,
  );
  const bank = Math.sin(theta) * 0.105 + Math.sin(theta * 2) * 0.032;
  camera.up.set(Math.sin(bank), Math.cos(bank), 0);
  camera.lookAt(target);
  return { time: t, angleDegrees: orbitT * 360, radius, latitudeDegrees: latitude * 180 / Math.PI, bankDegrees: bank * 180 / Math.PI, position: camera.position.toArray(), target: target.toArray() };
}

function draw(t) {
  currentTime = THREE.MathUtils.clamp(t, 0, DURATION);
  cameraPose(currentTime);
  renderer.render(scene, camera);
  seek.value = String(currentTime);
  progress.value = currentTime;
  timeOutput.value = `${currentTime.toFixed(2)} / ${DURATION.toFixed(2)} 秒`;
}

function stopPlayback() {
  running = false;
  cancelAnimationFrame(frameHandle);
  play.textContent = '播放轨迹';
}

function animateFrom(t, callback) {
  const startedAt = performance.now() - t * 1000;
  running = true;
  function tick(now) {
    if (!running) return;
    const elapsed = Math.min((now - startedAt) / 1000, DURATION);
    draw(elapsed);
    if (recording) recordedFrames++;
    if (elapsed >= DURATION) {
      stopPlayback();
      callback?.();
      return;
    }
    frameHandle = requestAnimationFrame(tick);
  }
  frameHandle = requestAnimationFrame(tick);
}

play.addEventListener('click', () => {
  if (!ready || recording) return;
  if (running) { stopPlayback(); return; }
  play.textContent = '暂停轨迹';
  animateFrom(currentTime >= DURATION ? 0 : currentTime);
});

reset.addEventListener('click', () => { if (!recording) { stopPlayback(); draw(0); } });
seek.addEventListener('input', () => { if (!recording) { stopPlayback(); draw(Number(seek.value)); } });

record.addEventListener('click', async () => {
  if (!ready || recording) return;
  stopPlayback();
  draw(0);
  recording = true;
  recordedFrames = 0;
  for (const control of [play, record, offline, reset, seek]) control.disabled = true;
  download.hidden = true;
  status.textContent = '正在录制 1080p 绕月轨迹，请保持此标签页可见…';
  const stream = canvas.captureStream(FPS);
  const preferred = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = preferred.find(type => MediaRecorder.isTypeSupported(type));
  const chunks = [];
  try {
    recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 15_000_000 });
    recorder.addEventListener('dataavailable', event => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener('stop', () => {
      stream.getTracks().forEach(track => track.stop());
      const blob = new Blob(chunks, { type: mimeType });
      if (exportUrl) URL.revokeObjectURL(exportUrl);
      exportUrl = URL.createObjectURL(blob);
      download.href = exportUrl;
      download.hidden = false;
      recording = false;
      for (const control of [play, record, offline, reset, seek]) control.disabled = false;
      status.textContent = `录制完成，${(blob.size / 1024 / 1024).toFixed(1)} MB。请点击下载绕月影片。`;
    }, { once: true });
    recorder.start(1000);
    animateFrom(0, () => { setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 80); });
  } catch (error) {
    recording = false;
    stream.getTracks().forEach(track => track.stop());
    for (const control of [play, record, offline, reset, seek]) control.disabled = false;
    status.textContent = `此浏览器录制失败：${error.message}`;
  }
});

offline.addEventListener('click', async () => {
  if (!ready || recording) return;
  if (!globalThis.VideoEncoder || !globalThis.VideoFrame) {
    status.textContent = '此浏览器不支持 WebCodecs，请使用“开始录制”备用模式并保持前台。';
    return;
  }
  stopPlayback();
  recording = true;
  download.hidden = true;
  for (const control of [play, record, offline, reset, seek]) control.disabled = true;
  const frameCount = Math.round(DURATION * FPS);
  const encodedFrames = [];
  let encoder;
  let fatalError;
  let pendingDequeue;
  try {
    const candidates = [
      { codec: 'vp09.00.40.08', containerCodec: 'V_VP9' },
      { codec: 'vp8', containerCodec: 'V_VP8' },
    ];
    let chosen;
    for (const candidate of candidates) {
      const config = { codec: candidate.codec, width: WIDTH, height: HEIGHT, framerate: FPS, bitrate: 15_000_000, latencyMode: 'quality' };
      try {
        const result = await VideoEncoder.isConfigSupported(config);
        if (result.supported) { chosen = { ...candidate, config: result.config }; break; }
      } catch { /* Try the next locally provided browser codec. */ }
    }
    if (!chosen) throw new Error('本机未提供 VP9 / VP8 视频编码器');
    encoder = new VideoEncoder({
      output(chunk) {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        encodedFrames.push({ timestamp: chunk.timestamp, duration: chunk.duration, type: chunk.type, data });
      },
      error(error) { fatalError = error; pendingDequeue?.(); },
    });
    encoder.configure(chosen.config);
    // Encoding follows explicit frame timestamps, never requestAnimationFrame.
    // The dequeue event applies backpressure even if the page is throttled.
    for (let i = 0; i < frameCount; i++) {
      if (fatalError) throw fatalError;
      while (encoder.encodeQueueSize >= 3) {
        await new Promise(resolve => {
          const resume = () => { encoder.removeEventListener('dequeue', resume); pendingDequeue = null; resolve(); };
          pendingDequeue = resume;
          encoder.addEventListener('dequeue', resume, { once: true });
        });
        if (fatalError) throw fatalError;
      }
      draw(i / FPS);
      const timestamp = Math.round(i * 1_000_000 / FPS);
      const nextTimestamp = Math.round((i + 1) * 1_000_000 / FPS);
      const frame = new VideoFrame(canvas, { timestamp, duration: nextTimestamp - timestamp });
      encoder.encode(frame, { keyFrame: i % (2 * FPS) === 0 });
      frame.close();
      status.textContent = `逐帧导出 ${i + 1} / ${frameCount} 帧 · ${chosen.containerCodec.slice(2)} · 编码队列 ${encoder.encodeQueueSize}`;
      // This yields occasionally for visible progress. Timer throttling may slow
      // export, but it cannot change the encoded timeline or drop frames.
      if (i % FPS === FPS - 1) await new Promise(resolve => setTimeout(resolve, 0));
    }
    status.textContent = `完成 ${frameCount} 帧渲染，正在等待编码并封装 WebM…`;
    await encoder.flush();
    if (fatalError) throw fatalError;
    if (encodedFrames.length !== frameCount) throw new Error(`编码器只返回 ${encodedFrames.length} / ${frameCount} 帧，未输出不完整影片`);
    const blob = muxVideoWebM({ frames: encodedFrames, width: WIDTH, height: HEIGHT, fps: FPS, durationSeconds: DURATION, codec: chosen.containerCodec });
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    exportUrl = URL.createObjectURL(blob);
    download.href = exportUrl;
    download.download = `moon-camera-orbit-${frameCount}frames.webm`;
    download.hidden = false;
    draw(DURATION);
    status.textContent = `逐帧导出完成：${frameCount} 帧 / ${DURATION.toFixed(3)} 秒 / 30 fps，${(blob.size / 1024 / 1024).toFixed(1)} MB。请点击下载绕月影片。`;
  } catch (error) {
    status.textContent = `逐帧导出失败：${error.message}。可用前台实时录制备用模式。`;
    console.error(error);
  } finally {
    if (encoder && encoder.state !== 'closed') encoder.close();
    recording = false;
    for (const control of [play, record, offline, reset, seek]) control.disabled = false;
  }
});

async function init() {
  const [albedo, normals, earthMap, cloudMap, demMeta, demBuffer] = await Promise.all([
    texture('moon-albedo.jpg', true), texture('moon-normal.png'),
    texture('2k_earth_daymap.jpg', true), texture('2k_earth_clouds.jpg'),
    fetch(`${base}textures/moon-elevation.json`).then(response => { if (!response.ok) throw new Error('高程参数无法加载'); return response.json(); }),
    fetch(`${base}textures/moon-elevation.u16`).then(response => { if (!response.ok) throw new Error('月球高程数据无法加载'); return response.arrayBuffer(); }),
  ]);
  status.textContent = '重建月球陨石坑地形、预热渲染器…';
  const geometry = terrainGeometry(new Uint16Array(demBuffer), demMeta.width, demMeta.height, demMeta.moonRadiusM);
  const moon = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map: albedo, normalMap: normals, normalScale: new THREE.Vector2(1.35, 1.35), roughness: 1, metalness: 0, color: 0xffffff }));
  moon.rotation.y = -Math.PI / 2;
  moon.castShadow = true;
  moon.receiveShadow = true;
  scene.add(moon);
  const earthGroup = new THREE.Group();
  // Nearly real Moon-to-Earth distance, but direction composed for an Earthrise.
  earthGroup.position.set(-55, -58, -190);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(3.667, 96, 48), new THREE.MeshStandardMaterial({ map: earthMap, roughness: 0.95, metalness: 0 }));
  earth.rotation.set(0, 0.8, 0.41);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(3.68, 96, 48), new THREE.MeshStandardMaterial({ alphaMap: cloudMap, transparent: true, opacity: 0.9, color: 0xffffff, roughness: 1, depthWrite: false }));
  clouds.rotation.copy(earth.rotation);
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(3.71, 64, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vNormal; varying vec3 vView; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
    fragmentShader: `varying vec3 vNormal; varying vec3 vView; void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),3.0);gl_FragColor=vec4(0.13,0.35,0.66,rim*0.28);}`,
  }));
  earthGroup.add(earth, clouds, atmosphere);
  scene.add(earthGroup);
  starField();
  cameraPose(0);
  await renderer.compileAsync(scene, camera);
  for (let t = 0; t <= DURATION; t += 1 / FPS) trajectory.push(cameraPose(t));
  draw(0);
  ready = true;
  for (const control of [play, record, offline, reset, seek]) control.disabled = false;
  status.textContent = '已准备就绪 · 静止月球 + 360° 摄影机轨道';
}

init().catch(error => { status.textContent = `加载失败：${error.message}`; console.error(error); });
