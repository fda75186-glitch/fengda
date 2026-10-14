import * as THREE from 'three';
import { assetUrl } from '../assets.js';
import { createSurveyCraft } from './shipModel.js';
import { createStarfield, createLaunchSite } from './flightVisuals.js';
import { obstacleRadius, planSafeFlight, safeMotion, nearestSafePosition } from './flightNavigation.js';
import { createFlightQuality } from './flightQuality.js';
import { safePadMotion } from './flightPadCollision.js';
import { useFlightDepth } from './flightDepth.js';
import { systemOverview, arrangeFlightLabels } from './flightPresentation.js';
import { createGalaxyModel } from './galaxyModel.js';
import { createLargeScaleModel } from './largeScaleModel.js';
import { createWormhole, shouldUseWormhole, wormholeState } from './wormhole.js';

const TEXTURES = { earth: '2k_earth_daymap.jpg', moon: '2k_moon.jpg', sun: '2k_sun.jpg', mercury: '2k_mercury.jpg', venus: '2k_venus_atmosphere.jpg', mars: '2k_mars.jpg', jupiter: '2k_jupiter.jpg', saturn: '2k_saturn.jpg', uranus: '2k_uranus.jpg', neptune: '2k_neptune.jpg' };
const UP = new THREE.Vector3(0, 1, 0);
const smooth = value => value * value * (3 - 2 * value);
const ease = value => value < .5 ? 4 * value ** 3 : 1 - ((-2 * value + 2) ** 3) / 2;
function seedRandom(seed) {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return () => { hash += 0x6d2b79f5; let value = Math.imul(hash ^ hash >>> 15, 1 | hash); value ^= value + Math.imul(value ^ value >>> 7, 61 | value); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
}
const gaussian = random => Math.sqrt(-2 * Math.log(Math.max(.00001, random()))) * Math.cos(2 * Math.PI * random());

export function createFlightScene(holder, callbacks = {}) {
  let renderer, scene, camera, overlayScene, overlayCamera, observer, wormhole, animation = 0;
  let disposed = false, paused = false, cameraOverlay = false, view = 'cockpit', speed = 1;
  let current = null, transition = null, activeBody = null, request = 0, elapsed = 0, previousTime = 0, lastReport = 0, readyReported = false;
  let yaw = 0, pitch = 0, desiredYaw = 0, desiredPitch = 0, travelDistance = 0, measuredSpeed = 0;
  let pointer = null, pinchDistance = 0, keys = new Set();
  const pointers = new Map(), layers = new Set(), geometries = new Set(), materials = new Set(), textureCache = new Map();
  const rig = { position: new THREE.Vector3(0, 0, 16), target: new THREE.Vector3(), up: UP.clone() };
  const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(), forward = new THREE.Vector3(), temp = new THREE.Vector3();
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const sphereLevels = [new THREE.SphereGeometry(1, 36, 24), new THREE.SphereGeometry(1, 80, 48), new THREE.SphereGeometry(1, 160, 96)];
  const sphere = sphereLevels[1], sharedSpheres = new Set(sphereLevels); sphereLevels.forEach(geometry => geometries.add(geometry));
  const craft = createSurveyCraft();
  const quality = createFlightQuality({ initialPixelRatio: Math.min(window.devicePixelRatio || 1, 1.7), maxPixelRatio: Math.min(window.devicePixelRatio || 1, 1.7) });
  let loadingCount = 0, launchState = 'surface', pendingDestination = null, lastLOD = 0, cameraInitialized = false;
  const lookMatrix = new THREE.Matrix4(), baseQuaternion = new THREE.Quaternion(), lookQuaternion = new THREE.Quaternion(), turnEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const cameraQuaternion = new THREE.Quaternion(), shipQuaternion = new THREE.Quaternion(), oldCamera = new THREE.Vector3(), candidate = new THREE.Vector3(), lookTarget = new THREE.Vector3(), lookUp = new THREE.Vector3(), side = new THREE.Vector3(), projected = new THREE.Vector3();
  const padFrom = new THREE.Vector3(), padTo = new THREE.Vector3(), padResult = new THREE.Vector3();
  const registerGeometry = geometry => { geometries.add(geometry); return geometry; };
  const registerMaterial = material => { materials.add(material); return useFlightDepth(material); };
  const reportError = error => callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  function loadTexture(key) {
    const file = key === 'clouds' ? '2k_earth_clouds.jpg' : key === 'rings' ? '2k_saturn_ring_alpha.png' : TEXTURES[key];
    if (!file) return Promise.resolve(null);
    if (!textureCache.has(key)) {
      const promise = new THREE.TextureLoader().loadAsync(assetUrl(`/textures/${file}`)).then(texture => {
        if (disposed) { texture.dispose(); return null; }
        texture.colorSpace = key === 'clouds' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() || 2); return texture;
      }).catch(() => null);
      textureCache.set(key, promise);
    }
    return textureCache.get(key);
  }
  function atmosphere(color, radius, strength = .7) {
    const object = new THREE.Mesh(sphere, registerMaterial(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      uniforms: { tint: { value: new THREE.Color(color) }, strength: { value: strength }, fade: { value: 1 } },
      vertexShader: 'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
      fragmentShader: 'uniform vec3 tint; uniform float strength; uniform float fade; varying vec3 n; varying vec3 v; void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),2.6); gl_FragColor=vec4(tint,rim*strength*fade);}',
    })));
    object.scale.setScalar(radius); return object;
  }
  // World-space, soft star particles: these remain actual 3D objects during flight.
  function pointCloud(positions, colors, sizes, opacity = 1) {
    const geometry = registerGeometry(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    const material = registerMaterial(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, vertexColors: true, blending: THREE.AdditiveBlending,
      uniforms: { fade: { value: opacity }, pointScale: { value: Math.max(1, holder.clientHeight) * (renderer?.getPixelRatio() || 1) * .88 } },
      vertexShader: 'attribute float size; uniform float pointScale; varying vec3 tint; void main(){tint=color; vec4 p=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*p; gl_PointSize=clamp(size*pointScale/max(1.,-p.z),.65,44.);}',
      fragmentShader: 'uniform float fade; varying vec3 tint; void main(){float r=length(gl_PointCoord-.5)*2.; if(r>1.)discard; float glow=exp(-r*r*6.)*.65+exp(-r*r*32.)*.55; gl_FragColor=vec4(tint,glow*fade);}',
    }));
    const object = new THREE.Points(geometry, material); object.frustumCulled = false; return object;
  }
  function makeGalaxy(body, compact) {
    return createGalaxyModel(body, { compact, pointCloud, geometry: registerGeometry, material: registerMaterial });
  }
  function makeWeb(body) {
    return createLargeScaleModel(body,{geometry:registerGeometry,material:registerMaterial,pointScale:Math.max(1,holder.clientHeight)*(renderer?.getPixelRatio()||1)*.88,pixelRatio:renderer?.getPixelRatio()||1});
  }
  function makeBlackHole(body) {
    const group = new THREE.Group(), radius = body.radius || 3;
    const shadow = new THREE.Mesh(sphere, registerMaterial(new THREE.MeshBasicMaterial({ color: '#000207' }))); shadow.scale.setScalar(radius * .35); group.add(shadow);
    const ring = new THREE.Mesh(registerGeometry(new THREE.RingGeometry(radius * .38, radius, 128, 8)), registerMaterial(new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { fade: { value: 1 }, radius: { value: radius } },
      vertexShader: 'varying vec3 p; void main(){p=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform float radius; uniform float fade; varying vec3 p; void main(){float r=length(p.xy)/radius; float bands=.55+.35*sin(r*210.)+.1*sin(r*530.); vec3 tint=mix(vec3(1.,.54,.19),vec3(.78,.89,1.),smoothstep(.45,.9,r)); float light=pow(1.-r,.6)*bands; gl_FragColor=vec4(tint,light*fade);}',
    })));
    ring.rotation.x = -Math.PI / 2 + .13; group.add(ring);
    const photon = new THREE.Mesh(registerGeometry(new THREE.TorusGeometry(radius * .36, radius * .012, 8, 100)), registerMaterial(new THREE.MeshBasicMaterial({ color: '#e6eeff', toneMapped: false }))); group.add(photon);
    return group;
  }
  function applySchematicSurface(material, body) {
    const gas = body.catalogue?.radiusEarth > 4 || /jupiter|saturn|uranus|neptune/.test(body.id);
    material.onBeforeCompile = shader => {
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 schematicPosition;').replace('#include <begin_vertex>', '#include <begin_vertex>\nschematicPosition=position;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 schematicPosition;
        float schematicHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float schematicNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(schematicHash(i),schematicHash(i+vec3(1,0,0)),f.x),mix(schematicHash(i+vec3(0,1,0)),schematicHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(schematicHash(i+vec3(0,0,1)),schematicHash(i+vec3(1,0,1)),f.x),mix(schematicHash(i+vec3(0,1,1)),schematicHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      `).replace('#include <color_fragment>', `#include <color_fragment>
        float grain=schematicNoise(schematicPosition*11.)*.55+schematicNoise(schematicPosition*31.)*.3+schematicNoise(schematicPosition*73.)*.15;
        ${gas ? 'float band=.5+.5*sin(schematicPosition.y*36.+grain*3.); diffuseColor.rgb*=.63+band*.48+grain*.15;' : 'diffuseColor.rgb*=.56+grain*.79;'}
      `);
    };
    material.customProgramCacheKey = () => gas ? 'starwhisper-schematic-gas-v1' : 'starwhisper-schematic-rock-v1';
  }
  async function createLayer(stop) {
    const group = new THREE.Group(), entries = [], textureKeys = new Set();
    for (const body of stop.bodies || []) { const key = body.texture || body.id; if (TEXTURES[key]) textureKeys.add(key); if (key === 'earth') textureKeys.add('clouds'); if (key === 'saturn' || body.ring) textureKeys.add('rings'); }
    const textures = new Map(await Promise.all([...textureKeys].map(async key => [key, await loadTexture(key)])));
    if (disposed) return null;
    const bounds = new THREE.Box3();
    for (const body of stop.bodies || []) {
      const root = new THREE.Group(), radius = Math.max(.08, Number(body.radius) || 1), key = body.texture || body.id;
      let object;
      if (body.kind === 'galaxy') object = makeGalaxy(body, (stop.bodies || []).filter(item => /galaxy|nebula/i.test(item.kind || "")).length > 2);
      else if (/web|cluster|supercluster|nebula/i.test(body.kind || '')) object = makeWeb(body);
      else if (/black.?hole/i.test(body.kind || '') || /black.?hole|sagittarius-a/i.test(body.id)) object = makeBlackHole(body);
      else {
        const isStar = key === 'sun' || /star|stellar/i.test(body.kind || '');
        const material = registerMaterial(isStar ? new THREE.MeshBasicMaterial({ map: textures.get(key) || null, color: body.color || '#ffdc9e', toneMapped: false }) : new THREE.MeshStandardMaterial({ map: textures.get(key) || null, color: textures.get(key) ? '#ffffff' : body.color || '#94a8bc', roughness: .95, metalness: 0 }));
        if (!textures.get(key)) applySchematicSurface(material, body);
        object = new THREE.Mesh(sphere, material); object.scale.setScalar(radius);
        if (Array.isArray(body.shape)) object.scale.multiply(new THREE.Vector3(...body.shape));
        if (key === 'earth') {
          const clouds = new THREE.Mesh(sphere, registerMaterial(new THREE.MeshStandardMaterial({ color: '#ffffff', alphaMap: textures.get('clouds') || null, transparent: true, opacity: textures.get('clouds') ? .72 : .07, depthWrite: false, roughness: 1 })));
          clouds.scale.setScalar(radius * 1.008); root.add(clouds);
          const glow = atmosphere('#59aef2', radius * 1.034, .74); root.add(glow);
        } else if (isStar) {
          root.add(atmosphere(body.color || '#ffc871', radius * 1.08, .56));
          if (entries.filter(entry => entry.body.kind === 'star').length < 2) {
            const glow = new THREE.PointLight(body.color || '#ffedcb', 2.4, radius * 32, .8); root.add(glow);
          }
        } else if (/neptune|uranus|venus/i.test(key)) root.add(atmosphere('#78bcdf', radius * 1.025, .33));
        if (key === 'saturn' || body.ring) {
          const geometry = registerGeometry(new THREE.RingGeometry(radius * 1.22, radius * 2.28, 112, 2));
          const positions = geometry.attributes.position, uv = geometry.attributes.uv;
          for (let index = 0; index < positions.count; index++) uv.setXY(index, (Math.hypot(positions.getX(index), positions.getY(index)) / radius - 1.22) / 1.06, .5);
          const ring = new THREE.Mesh(geometry, registerMaterial(new THREE.MeshStandardMaterial({ map: textures.get('rings') || null, color: '#d9c8a5', side: THREE.DoubleSide, transparent: true, alphaTest: .03, opacity: .92, roughness: 1 })));
          ring.rotation.x = -Math.PI / 2; ring.rotation.y = .22; root.add(ring); root.rotation.z = -.32;
        }
      }
      root.add(object); root.position.fromArray(body.position || [0, 0, 0]);
      root.userData.body = body; root.userData.object = object; object.userData.body = body;
      root.rotation.y = key === 'earth' ? 2.6 : .5;
      group.add(root); entries.push({ body, root, object, radius: body.ring || key === 'saturn' ? radius * 2.3 : radius, position: root.position.clone() });
      const effectiveRadius = radius * (/galaxy|cluster|web/i.test(body.kind || '') ? 1.4 : body.ring ? 2.3 : 1.1);
      bounds.expandByPoint(root.position.clone().addScalar(effectiveRadius)); bounds.expandByPoint(root.position.clone().addScalar(-effectiveRadius));
    }
    if (bounds.isEmpty()) { bounds.min.set(-8, -8, -8); bounds.max.set(8, 8, 8); }
    const center = bounds.getCenter(new THREE.Vector3()), extent = Math.max(4, bounds.getSize(new THREE.Vector3()).length() / 2);
    // Orbits clarify planetary systems without becoming a flat 2D map.
    if (/solar|nearby/.test(stop.id) || /planetary|stellar|system/.test(stop.kind || '')) {
      const stars = entries.filter(entry => /star|stellar/.test(entry.body.kind || '') || entry.body.id === 'sun');
      for (const entry of entries.filter(entry => !stars.includes(entry) && !/galaxy|cluster|web/i.test(entry.body.kind || ''))) {
        const orbitCenter = entries.find(parent => parent.body.id === entry.body.parentBodyId)?.position || stars[0]?.position || center;
        const distance = entry.position.distanceTo(orbitCenter); if (distance < entry.radius * 2) continue;
        const points = Array.from({ length: 129 }, (_, index) => new THREE.Vector3(Math.cos(index / 128 * Math.PI * 2) * distance, 0, Math.sin(index / 128 * Math.PI * 2) * distance).add(orbitCenter));
        const geometry = registerGeometry(new THREE.BufferGeometry().setFromPoints(points));
        group.add(new THREE.Line(geometry, registerMaterial(new THREE.LineBasicMaterial({ color: '#7b9fbd', transparent: true, opacity: .15 }))));
      }
    }
    const obstacles = entries.map(entry => ({ id: entry.body.id, center: entry.position, radius: obstacleRadius(entry.body) })).filter(item => item.radius > 0);
    const smallest = Math.min(...obstacles.map(item => item.radius), 1);
    const shipScale = stop.kind === 'launch' ? .015 : Math.min(.015, smallest * .12 / craft.radius);
    const layer = { stop, group, entries, center, extent, obstacles, shipScale, clearance: craft.radius * shipScale * 1.04, fadeMaterials: [], lights: [] }; layers.add(layer);
    if (stop.kind === 'launch') {
      const earth = entries.find(entry => (entry.body.texture || entry.body.id) === 'earth');
      if (earth) {
        earth.root.traverse(object => { if (object.isMesh && sharedSpheres.has(object.geometry)) object.geometry = sphereLevels[2]; }); earth.lod = 2;
        const site = createLaunchSite({ radius: earth.body.radius });
        // Visual Wenchang-style site; not a geodetically surveyed launch installation.
        const normal = new THREE.Vector3(.65, .55, .52).normalize();
        site.group.quaternion.setFromUnitVectors(UP, normal);
        site.group.position.copy(earth.position).addScaledVector(normal, earth.body.radius + .003);
        group.add(site.group); group.updateMatrixWorld(true);
        layer.site = site; layer.launchEarth = earth; layer.surfaceNormal = normal;
        layer.padCeiling = Math.max(...site.padBoxes.map(box => box.max.y));
        layer.launchForward = new THREE.Vector3(0, 0, -1).applyQuaternion(site.group.quaternion);
        layer.launchPose = { position: site.group.localToWorld(site.localCameraPosition.clone()), target: site.group.localToWorld(site.localCameraTarget.clone()) };
        layer.launchWaypoints = site.launchWaypoints.map(point => site.group.localToWorld(point.clone()));
        for (const item of site.obstacles) obstacles.push({ id: item.id, center: site.group.localToWorld(item.center.clone()), radius: item.radius });
      }
    }
    group.traverse(object => {
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material && !layer.fadeMaterials.includes(material)) {
        useFlightDepth(material); material.userData.baseOpacity = material.opacity; material.userData.baseTransparent = material.transparent; layer.fadeMaterials.push(material);
      }
      if (object.isLight) layer.lights.push({ object, intensity: object.intensity });
    });
    return layer;
  }
  function setLayerFade(layer, opacity) {
    if (!layer) return;
    for (const material of layer.fadeMaterials) {
        if (material.uniforms?.layerFade) material.uniforms.layerFade.value = opacity;
        else if (material.uniforms?.fade) material.uniforms.fade.value = opacity;
        else { material.transparent = opacity < .999 || material.userData.baseTransparent; material.opacity = (material.userData.baseOpacity ?? 1) * opacity; }
    }
    for (const light of layer.lights) light.object.intensity = opacity * light.intensity;
  }
  function releaseLayer(layer) {
    if (!layer) return;
    scene?.remove(layer.group); layers.delete(layer);
    if (layer.site) { layer.group.remove(layer.site.group); layer.site.dispose(); }
    const uniqueMaterials = new Set(), uniqueGeometry = new Set();
    layer.group.traverse(object => {
      if (object.geometry && !sharedSpheres.has(object.geometry)) uniqueGeometry.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material) uniqueMaterials.add(material);
    });
    uniqueMaterials.forEach(material => { material.dispose(); materials.delete(material); });
    uniqueGeometry.forEach(geometry => { geometry.dispose(); geometries.delete(geometry); });
  }
  function safePose(pose, layer = current) {
    return { position: nearestSafePosition(pose.position, layer.obstacles, layer.clearance, layer.surfaceNormal || UP), target: pose.target };
  }
  function overviewPose(layer) {
    if (layer.site && launchState === 'surface') return safePose(layer.launchPose, layer);
    if(layer.stop.entryPose)return safePose({position:new THREE.Vector3(...layer.stop.entryPose.position),target:new THREE.Vector3(...layer.stop.entryPose.target)},layer);
    return safePose(systemOverview(layer.entries, camera.fov, camera.aspect), layer);
  }
  function targetPose(entry) {
    const toward = rig.position.clone().sub(entry.position).normalize();
    if (toward.lengthSq() < .1) toward.set(.2, .25, 1).normalize();
    const distance = Math.max(entry.radius * (/galaxy|web|cluster/i.test(entry.body.kind || '') ? 2.6 : 2.8), obstacleRadius(entry.body) + current.clearance * 8);
    return safePose({ position: entry.position.clone().addScaledVector(toward, distance), target: entry.position.clone() });
  }
  function cancelTransition() {
    if (!transition) return;
    if (transition.previous && transition.previous !== current) releaseLayer(transition.previous);
    if (transition.launch) { launchState = 'climb-paused'; pendingDestination = null; }
    transition = null; setLayerFade(current, 1);
    callbacks.onTravel?.({ active: false, progress: 0, target: current?.stop, phase: '手动接管' });
  }
  function beginTravel(pose, target, { animate = true, previous = null, duration = 5.4, quick = false, allowWormhole = true, curve = null, launch = false, complete = null, phase = '天体间转移' } = {}) {
    const plan = curve ? { curve, length: curve.getLength() } : planSafeFlight(rig.position, pose.position, current.obstacles, current.clearance, { departureNormal: current.surfaceNormal, up: rig.up });
    const warp = allowWormhole && shouldUseWormhole({distance:plan.length,extent:current.extent,clearance:current.clearance,crossRegion:!!previous&&previous.stop.id!==current.stop.id,launch,animate});
    if(warp){duration=4.8;phase=wormholeState(0).phase;}else if(quick&&!launch)duration=2.4;
    desiredYaw = 0; desiredPitch = 0;
    transition = { curve: plan.curve, fromTarget: rig.target.clone(), targetPose: pose.target.clone(), duration: animate ? reducedMotion ? Math.min(3, duration) : duration : .001, time: 0, target, previous, distance: plan.length, launch, complete, phase, wormhole:warp };
    callbacks.onTravel?.({ active: true, progress: 0, target, phase, wormhole:warp });
    if (!animate) finishTransition();
  }
  function finishTransition() {
    if (!transition) return;
    const completed = transition; rig.position.copy(completed.curve.getPoint(1)); rig.target.copy(completed.targetPose);
    transition = null; setLayerFade(current, 1);
    if (completed.previous && completed.previous !== current) releaseLayer(completed.previous);
    if (completed.launch) {
      launchState = 'departed';
      completed.complete?.();
      return; // A climb is not an arrival at the Moon; don't advance the tour yet.
    }
    activeBody = current.entries.find(entry => entry.body.id === completed.target.id) || null;
    callbacks.onTravel?.({ active: false, progress: 1, target: completed.target, phase: '已抵达' }); callbacks.onArrival?.(completed.target);
  }
  function launchTo(stop, bodyId = null, {quick=false} = {}) {
    if (!current?.site || launchState === 'departed') return setStop(stop, { arrivalBody: bodyId, quick });
    pendingDestination = { stop, bodyId, quick };
    if (transition?.launch) { transition.target = stop; return; }
    cancelTransition(); pendingDestination = { stop, bodyId, quick };
    const earthCenter = current.launchEarth.position;
    const height = rig.position.distanceTo(earthCenter);
    const futurePoints = current.launchWaypoints.slice(1).filter(point => point.distanceTo(earthCenter) > height + .003);
    if (!futurePoints.length) { launchState = 'departed'; pendingDestination = null; return setStop(stop, { arrivalBody: bodyId, quick }); }
    const path = new THREE.CurvePath(), points = [rig.position.clone(), ...futurePoints];
    for (let index = 1; index < points.length; index++) {
      const segment = planSafeFlight(points[index - 1], points[index], current.obstacles, current.clearance, { departureNormal: current.surfaceNormal, up: current.surfaceNormal });
      for (const curve of segment.curve.curves) path.add(curve);
    }
    const end = path.getPoint(1), tangent = path.getTangent(.999).normalize();
    launchState = 'climb'; activeBody = null;
    beginTravel({ position: end, target: end.clone().addScaledVector(tangent, 2) }, stop, {
      curve: path, duration: 18, launch: true, phase: '地面点火',
      complete: () => { const destination = pendingDestination; pendingDestination = null; if (destination) void setStop(destination.stop, { arrivalBody: destination.bodyId, quick:destination.quick }).catch(reportError); },
    });
  }
  async function setStop(stop, { animate = true, arrivalBody = null, quick = false } = {}) {
    if (disposed || !renderer || !stop) return;
    if (current?.site && stop.id !== current.stop.id && launchState !== 'departed') { launchTo(stop, arrivalBody, {quick}); return; }
    if (transition?.launch) cancelTransition();
    const ticket = ++request;
    loadingCount++;
    callbacks.onTravel?.({ active: true, progress: 0, target: stop, phase: '准备目的地' });
    let layer, previous = null, saved = null;
    try {
      layer = await createLayer(stop);
      if (!layer) return;
      if (disposed || ticket !== request) { releaseLayer(layer); return; }
      setLayerFade(layer, current && animate ? 0 : 1); scene.add(layer.group);
      // Pre-warm programs without moving the currently displayed camera.
      if (renderer.compileAsync) { await renderer.compileAsync(scene, camera); if (!disposed) { await renderer.compileAsync(overlayScene, overlayCamera); if(!disposed) await renderer.compileAsync(wormhole.scene, wormhole.camera); } }
      if (disposed || ticket !== request) { releaseLayer(layer); return; }
      cancelTransition(); previous = current;
      saved = { position: rig.position.clone(), target: rig.target.clone(), up: rig.up.clone(), launchState, near: camera.near, far: camera.far };
      current = layer; activeBody = null;
      if (layer.site) { launchState = 'surface'; rig.up.copy(layer.surfaceNormal); }
      else rig.up.copy(UP);
      const oldEarth = previous?.entries.find(entry => (entry.body.texture || entry.body.id) === 'earth');
      const nextEarth = layer.entries.find(entry => (entry.body.texture || entry.body.id) === 'earth');
      const oldSun = previous?.entries.find(entry => (entry.body.texture || entry.body.id) === 'sun');
      const nextSun = layer.entries.find(entry => (entry.body.texture || entry.body.id) === 'sun');
      const oldAnchor = oldEarth && nextEarth ? oldEarth : oldSun && nextSun ? oldSun : null;
      const nextAnchor = oldEarth && nextEarth ? nextEarth : oldSun && nextSun ? nextSun : null;
      if (oldAnchor && nextAnchor && !layer.site) {
        const ratio = nextAnchor.radius / oldAnchor.radius;
        rig.position.sub(oldAnchor.position).multiplyScalar(ratio).add(nextAnchor.position);
        rig.target.sub(oldAnchor.position).multiplyScalar(ratio).add(nextAnchor.position);
        previous.group.visible = false; setLayerFade(layer, 1);
      }
      const corrected = nearestSafePosition(rig.position, layer.obstacles, layer.clearance, rig.up);
      rig.target.add(candidate.copy(corrected).sub(rig.position)); rig.position.copy(corrected);
      camera.far = Math.max(20000, layer.extent * 20); camera.near = Math.max(.0002, layer.clearance * .12); camera.updateProjectionMatrix();
      callbacks.onStopChanged?.(stop);
      if (!previous) {
        const pose = overviewPose(layer); rig.position.copy(pose.position); rig.target.copy(pose.target);
        setLayerFade(layer, 1); callbacks.onTravel?.({ active: false, progress: 1, target: stop, phase: layer.site ? '文昌发射场 · 地面待发' : '已抵达' }); callbacks.onArrival?.(stop);
        updateCamera(0); return;
      }
      const entry = arrivalBody && layer.entries.find(item => item.body.id === arrivalBody);
      beginTravel(entry ? targetPose(entry) : overviewPose(layer), entry?.body || stop, { animate, quick, previous, duration: oldAnchor ? 8 : 7, phase: oldAnchor ? '逐步扩大探索尺度' : '星际尺度转移' });
    } catch (error) {
      if (layer && layer === current && saved) {
        current = previous; transition = null;
        rig.position.copy(saved.position); rig.target.copy(saved.target); rig.up.copy(saved.up); launchState = saved.launchState;
        camera.near = saved.near; camera.far = saved.far; camera.updateProjectionMatrix();
        if (previous) { previous.group.visible = true; setLayerFade(previous, 1); callbacks.onStopChanged?.(previous.stop); updateCamera(0); }
      }
      if (layer && layer !== current) releaseLayer(layer);
      if (!disposed && ticket === request) { callbacks.onTravel?.({ active: false, progress: 0, target: stop, phase: '目的地加载失败' }); throw error; }
    } finally { loadingCount = Math.max(0, loadingCount - 1); }
  }
  function travelTo(bodyId, {quick=false} = {}) {
    if (!current || disposed) return;
    const entry = current.entries.find(item => item.body.id === bodyId); if (!entry) return;
    if (current.site && launchState !== 'departed') {
      // Lift off before approaching a celestial body in the launch layer.
      launchTo(callbacks.launchDestination || current.stop, bodyId, {quick}); return;
    }
    cancelTransition(); activeBody = null; beginTravel(targetPose(entry), entry.body, {quick});
  }
  function intersectsMotion(from, to, clearance) {
    const delta = candidate.copy(to).sub(from), lengthSq = delta.lengthSq();
    for (const obstacle of current.obstacles) {
      const t = lengthSq ? THREE.MathUtils.clamp(temp.copy(obstacle.center).sub(from).dot(delta) / lengthSq, 0, 1) : 0;
      temp.copy(from).addScaledVector(delta, t);
      if (temp.distanceToSquared(obstacle.center) < (obstacle.radius + clearance) ** 2) return true;
    }
    return false;
  }
  function guardedMotion(from, to, clearance) {
    const next = intersectsMotion(from, to, clearance) ? safeMotion(from, to, current.obstacles, clearance) : to;
    if (!current.site) return next;
    const site = current.site;
    site.group.worldToLocal(padFrom.copy(from)); site.group.worldToLocal(padTo.copy(next));
    if (padFrom.y > current.padCeiling + clearance && padTo.y > current.padCeiling + clearance) return next;
    padResult.copy(safePadMotion(padFrom, padTo, site.padBoxes, clearance)); site.group.localToWorld(padResult);
    return intersectsMotion(from, padResult, clearance) ? safeMotion(from, padResult, current.obstacles, clearance) : padResult;
  }
  function move(direction, amount = 1) {
    if (!current || disposed || paused) return;
    if (loadingCount) request++; // A manual command cancels a pending asynchronous scene change.
    if (transition) cancelTransition();
    const heading = forward.lengthSq() ? forward : temp.copy(rig.target).sub(rig.position).normalize();
    side.crossVectors(heading, rig.up).normalize();
    let gap = Infinity;
    for (const item of current.obstacles) gap = Math.min(gap, Math.max(0, rig.position.distanceTo(item.center) - item.radius));
    const step = Math.max(current.clearance * .65, Math.min(current.extent * .006, gap * .3 + current.clearance * .2));
    const vector = direction === 'forward' ? heading : direction === 'back' || direction === 'backward' ? heading : direction === 'left' || direction === 'right' ? side : direction === 'up' || direction === 'down' ? rig.up : null;
    if (!vector) return;
    const sign = ['back', 'backward', 'left', 'down'].includes(direction) ? -1 : 1;
    const desired = rig.position.clone().addScaledVector(vector, step * speed * amount * sign);
    const next = guardedMotion(rig.position, desired, current.clearance);
    const lookDistance = Math.max(1, rig.target.distanceTo(rig.position));
    const movement = next.clone().sub(rig.position); rig.position.copy(next); rig.target.add(movement);
    if (direction === 'forward' || direction === 'backward' || direction === 'back') {
      rig.target.copy(rig.position).addScaledVector(heading, lookDistance); desiredYaw = yaw = 0; desiredPitch = pitch = 0;
    }
    travelDistance += movement.length(); measuredSpeed = movement.length() * 20; activeBody = null;
    if (current.site && rig.position.distanceTo(current.launchEarth.position) > current.launchEarth.body.radius * 1.3) launchState = 'departed';
  }
  function updateCamera(delta) {
    oldCamera.copy(camera.position); lookUp.copy(rig.up);
    temp.copy(rig.target).sub(rig.position).normalize();
    // A vertical climb needs a perpendicular roll reference, not a collinear up vector.
    const alignment = temp.dot(lookUp);
    if (Math.abs(alignment) > .8) {
      lookUp.set(0, 1, 0).applyQuaternion(shipQuaternion).addScaledVector(temp, -lookUp.dot(temp));
      if (lookUp.lengthSq() < .001) { if (current?.launchForward) lookUp.copy(current.launchForward).multiplyScalar(alignment > 0 ? -1 : 1); else lookUp.set(1, 0, 0); }
      lookUp.normalize().lerp(rig.up, smooth(THREE.MathUtils.clamp((.96 - Math.abs(alignment)) / .16, 0, 1))).normalize();
    }
    lookMatrix.lookAt(rig.position, rig.target, lookUp); baseQuaternion.setFromRotationMatrix(lookMatrix);
    const damping = delta ? 1 - Math.exp(-delta * 9) : 1;
    yaw += (desiredYaw - yaw) * damping; pitch += (desiredPitch - pitch) * damping;
    if (!cameraInitialized || !delta) shipQuaternion.copy(baseQuaternion); else shipQuaternion.slerp(baseQuaternion, damping);
    turnEuler.set(pitch, yaw, 0); lookQuaternion.setFromEuler(turnEuler); baseQuaternion.multiply(lookQuaternion);
    if (!cameraInitialized || !delta) { cameraQuaternion.copy(baseQuaternion); cameraInitialized = true; }
    else cameraQuaternion.slerp(baseQuaternion, damping);
    forward.set(0, 0, -1).applyQuaternion(cameraQuaternion);
    if (view === 'cockpit') { camera.position.copy(rig.position); camera.quaternion.copy(cameraQuaternion); }
    else {
      const unit = current.clearance;
      const desired = lookTarget.copy(rig.position).addScaledVector(forward, -unit * 6).addScaledVector(rig.up, unit * 2.1);
      const safe = guardedMotion(rig.position, desired, unit * .18);
      // The camera is connected to the ship by a clear segment, including at the surface.
      camera.position.copy(safe); lookTarget.copy(rig.position).addScaledVector(forward, unit * 12); camera.up.copy(lookUp); camera.lookAt(lookTarget);
    }
    craft.ship.position.copy(rig.position); craft.ship.quaternion.copy(shipQuaternion); craft.ship.scale.setScalar(current.shipScale);
    if (delta && transition) { const distance = oldCamera.distanceTo(camera.position); measuredSpeed = distance / delta; travelDistance += distance; }
    craft.ship.visible = view === 'chase'; craft.cockpit.visible = view === 'cockpit' && !cameraOverlay;
  }
  function updateLOD(time) {
    if (time - lastLOD < 250) return; lastLOD = time;
    const projection = holder.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    for (const entry of current.entries) {
      if (!entry.object.isMesh || !sharedSpheres.has(entry.object.geometry)) continue;
      const pixels = entry.radius / Math.max(.001, entry.position.distanceTo(camera.position)) * projection;
      const previous = entry.lod ?? 1;
      // Keep the ground sphere stable during launch; use hysteresis elsewhere.
      const level = current.site && entry.body.id === 'earth' ? 2 : previous === 2 ? (pixels < 145 ? 1 : 2) : previous === 0 ? (pixels > 48 ? 1 : 0) : pixels > 205 ? 2 : pixels < 30 ? 0 : 1;
      entry.lod = level;
      const geometry = sphereLevels[level];
      entry.root.traverse(object => { if (object.isMesh && sharedSpheres.has(object.geometry)) object.geometry = geometry; });
    }
  }
  function launchPhase(progress) {
    return progress < .14 ? '地面点火 · 垂直升空' : progress < .38 ? '垂直爬升' : progress < .66 ? '穿越云层与大气' : '转入近地空间';
  }
  function report(time) {
    if (time - lastReport < 150 || !current) return; lastReport = time;
    if (transition) { const progress = Math.min(1, transition.time / transition.duration); callbacks.onTravel?.({ active: true, progress, target: transition.target, phase: transition.launch ? launchPhase(progress) : transition.wormhole ? wormholeState(progress).phase : transition.phase, wormhole:transition.wormhole }); }
    const state = quality.getState();
    callbacks.onTelemetry?.({ speed: Math.round(measuredSpeed * 10) / 10, distance: Math.round(travelDistance), heading: Math.round((THREE.MathUtils.radToDeg(Math.atan2(forward.x, -forward.z)) + 360) % 360), fps: state.frameMs ? Math.round(1000 / state.frameMs) : null, quality: state.mode, pixelRatio: state.pixelRatio });
    const width = holder.clientWidth, height = holder.clientHeight;
    const labels = current.entries.map(entry => {
      const above = temp.copy(entry.position);
      const smallBody = /moon|dwarf/.test(entry.body.kind || '');
      const pixels = entry.radius / Math.max(.001, entry.position.distanceTo(camera.position)) * height;
      const facing = candidate.copy(above).sub(camera.position).dot(forward) > 0; projected.copy(above).project(camera);
      return { id: entry.body.id, name: entry.body.name, x: (projected.x * .5 + .5) * width, y: (-projected.y * .5 + .5) * height, priority: smallBody ? 1 : /star/.test(entry.body.kind || '') ? 4 : 3, visible: !entry.body.nonInteractive && (!smallBody || pixels > 12 || entry === activeBody) && facing && projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < .94 && Math.abs(projected.y) < .9, selected: entry === activeBody };
    });
    callbacks.onLabels?.(arrangeFlightLabels(labels, width, height, callbacks.getLabelObstacles?.() || []));
  }
  function animate(time) {
    if (disposed) return;
    animation = requestAnimationFrame(animate);
    if (document.hidden || !current || !holder.clientWidth || !holder.clientHeight) { previousTime = 0; quality.reset(); return; }
    const frameMs = previousTime ? time - previousTime : 0, delta = Math.min(frameMs / 1000, .065); previousTime = time;
    const resolution = quality.sample(frameMs, { paused, loading: loadingCount > 0 });
    if (resolution.changed) { renderer.setPixelRatio(resolution.pixelRatio); resize(); }
    if (!paused) {
      elapsed += delta;
      if (transition) {
        transition.time += delta * (transition.wormhole ? Math.min(speed,1.4) : speed);
        const progress = Math.min(1, transition.time / transition.duration), eased = ease(progress);
        const planned = transition.curve.getPoint(eased);
        rig.position.copy(guardedMotion(rig.position, planned, current.clearance));
        // Look ahead along the planned safe route, then gently face the destination.
        const ahead = transition.curve.getPoint(Math.min(1, eased + .012));
        temp.copy(ahead).sub(rig.position);
        if (temp.lengthSq() < 1e-8) temp.copy(transition.targetPose).sub(rig.position);
        temp.normalize(); lookTarget.copy(rig.position).addScaledVector(temp, Math.max(current.clearance * 20, 1));
        const landing = smooth(THREE.MathUtils.clamp((progress - .76) / .24, 0, 1));
        rig.target.copy(lookTarget).lerp(transition.targetPose, landing);
        if (transition.launch && progress < .14) rig.target.lerp(transition.fromTarget, 1 - smooth(progress / .14));
        if (transition.previous?.group.visible) { setLayerFade(current, smooth(Math.min(1, progress * 2.3))); setLayerFade(transition.previous, 1 - smooth(Math.min(1, progress * 2.4))); }
        if (progress === 1) finishTransition();
      } else {
        measuredSpeed *= Math.exp(-delta * 4);
        if (keys.has('w') || keys.has('arrowup')) move('forward', delta * 10);
        if (keys.has('s') || keys.has('arrowdown')) move('back', delta * 10);
        if (keys.has('a') || keys.has('arrowleft')) move('left', delta * 10);
        if (keys.has('d') || keys.has('arrowright')) move('right', delta * 10);
        if (keys.has('q')) move('down', delta * 10); if (keys.has('e')) move('up', delta * 10);
      }
      for (const entry of current.entries) {
        if (current.site && entry === current.launchEarth) continue;
        if (!/galaxy|web|cluster|nebula|black.?hole/i.test(entry.body.kind || '')) entry.root.rotation.y += delta * .025;
      }
    }
    updateCamera(delta); updateLOD(time); craft.update(elapsed, transition ? .95 : measuredSpeed / Math.max(1, current.extent));
    let spaceBlend = 1;
    if (current.site) {
      const altitude = rig.position.distanceTo(current.launchEarth.position) - current.launchEarth.body.radius;
      current.site.update(altitude); spaceBlend = THREE.MathUtils.smoothstep(altitude / current.launchEarth.body.radius, .014, .17);
    }
    starfield.update(camera, elapsed, spaceBlend);
    renderer.clear(); renderer.render(scene, camera);
    if(transition?.wormhole){wormhole.update(transition.time/transition.duration,transition.time,camera.aspect,reducedMotion);renderer.clearDepth();renderer.render(wormhole.scene,wormhole.camera);}
    if (craft.cockpit.visible) { renderer.clearDepth(); renderer.render(overlayScene, overlayCamera); }
    if (!readyReported) { readyReported = true; callbacks.onReady?.(); }
    report(time);
  }
  function resize() {
    if (disposed || !renderer) return;
    const width = Math.max(1, holder.clientWidth), height = Math.max(1, holder.clientHeight);
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (overlayCamera) { overlayCamera.aspect = camera.aspect; overlayCamera.fov = 62; overlayCamera.updateProjectionMatrix(); }
    starfield?.setPixelRatio(renderer.getPixelRatio());
    for (const material of materials) if (material.uniforms?.pointScale) {
      material.uniforms.pointScale.value = height * renderer.getPixelRatio() * .88;
      if (material.uniforms.pixelRatio) material.uniforms.pixelRatio.value = renderer.getPixelRatio();
    }
  }
  function onPointerDown(event) {
    if (event.button !== 0) return;
    renderer.domElement.focus({ preventScroll: true });
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, moved: false };
    renderer.domElement.setPointerCapture(event.pointerId);
    if (pointers.size === 2) { const values = [...pointers.values()]; pinchDistance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y); pointer.moved = true; }
  }
  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const values = [...pointers.values()], distance = Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
      if (pinchDistance) move(distance > pinchDistance ? 'forward' : 'back', Math.abs(distance - pinchDistance) * .055);
      pinchDistance = distance; if (pointer) pointer.moved = true; return;
    }
    if (!pointer || pointer.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointer.originX, event.clientY - pointer.originY) > 6) pointer.moved = true;
    desiredYaw -= (event.clientX - pointer.x) * .0035;
    desiredPitch = THREE.MathUtils.clamp(desiredPitch - (event.clientY - pointer.y) * .003, -1.1, 1.1);
    pointer.x = event.clientX; pointer.y = event.clientY;
  }
  function pickedBody(event){
    const rect=renderer.domElement.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(mouse,camera);
    const matches=raycaster.intersectObjects(current?.entries.filter(entry=>!entry.body.nonInteractive).map(entry=>entry.root)||[],true);
    for(const match of matches){let object=match.object;while(object&&!object.userData.body)object=object.parent;if(object?.userData.body&&!object.userData.body.nonInteractive)return object.userData.body;}
    return null;
  }
  function onDoubleClick(event){const body=pickedBody(event);if(body)callbacks.onExplore?.(body);}
  function onPointerUp(event) {
    if(pointer?.id===event.pointerId&&!pointer.moved&&event.type!=='pointercancel'){const picked=pickedBody(event);if(picked)travelTo(picked.id);}
    pointers.delete(event.pointerId); pointer = null; pinchDistance = 0;
  }
  function onWheel(event) { event.preventDefault(); if (!paused) move(event.deltaY < 0 ? 'forward' : 'back', Math.min(3, Math.abs(event.deltaY) / 65)); }
  function onKeyDown(event) {
    if (['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright',' '].includes(event.key.toLowerCase())) event.preventDefault();
    if (event.key === ' ' && !event.repeat) setPaused(!paused);
    else if (event.key.toLowerCase() === 'r') resetView();
    else {
      const key = event.key.toLowerCase();
      if (['w','a','s','d','q','e','arrowup','arrowdown','arrowleft','arrowright'].includes(key)) { cancelTransition(); if (loadingCount) request++; }
      keys.add(key);
    }
  }
  function onKeyUp(event) { keys.delete(event.key.toLowerCase()); }
  function clearKeys() { keys.clear(); pointers.clear(); pointer = null; pinchDistance = 0; }
  function setPaused(value) { paused = Boolean(value); clearKeys(); }
  function setView(value) { view = value === 'chase' ? 'chase' : 'cockpit'; if (camera && current) updateCamera(0); }
  function setSpeed(value) { speed = THREE.MathUtils.clamp(Number(value) || 1, .25, 3); }
  function resetView() {
    if (!current) return; cancelTransition(); desiredYaw = 0; desiredPitch = 0; activeBody = null;
    beginTravel(overviewPose(current), current.stop, { duration: 2.1, allowWormhole:false });
  }
  function setCameraOverlay(value) { cameraOverlay = Boolean(value); renderer?.setClearColor('#020712', cameraOverlay ? .25 : 1); }
  function contextLost(event) { event.preventDefault(); if (!disposed) { reportError(new Error('3D 图形连接已中断，请重新进入宇宙云图。')); dispose(); } }
  function dispose() {
    if (disposed) return; disposed = true; request++; cancelAnimationFrame(animation); observer?.disconnect(); clearKeys();
    document.removeEventListener('visibilitychange', clearKeys); window.removeEventListener('blur', clearKeys);
    const canvas = renderer?.domElement;
    if (canvas) {
      canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('dblclick', onDoubleClick);
      canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('keydown', onKeyDown); canvas.removeEventListener('keyup', onKeyUp); canvas.removeEventListener('blur', clearKeys); canvas.removeEventListener('webglcontextlost', contextLost);
    }
    for (const layer of [...layers]) releaseLayer(layer);
    geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose()); craft.dispose(); starfield?.dispose(); wormhole?.dispose();
    geometries.clear(); materials.clear(); scene?.clear(); overlayScene?.clear();
    textureCache.forEach(promise => promise.then(texture => texture?.dispose())); textureCache.clear();
    renderer?.dispose(); renderer?.forceContextLoss(); canvas?.remove();
    current = null; transition = null; scene = null; camera = null; overlayScene = null; overlayCamera = null; renderer = null; starfield = null;
  }
  let starfield;
  try {
    renderer = new THREE.WebGLRenderer({ logarithmicDepthBuffer: true, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(quality.getState().pixelRatio); renderer.setClearColor('#020712', 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08; renderer.autoClear = false;
    wormhole = createWormhole();
    scene = new THREE.Scene(); camera = new THREE.PerspectiveCamera(55, 1, .02, 20000);
    scene.add(new THREE.HemisphereLight('#8fafd4', '#131b2c', 1.2));
    const sun = new THREE.DirectionalLight('#fff0d5', 3.3); sun.position.set(-24, 18, 35); scene.add(sun);
    starfield = createStarfield({ quality: (navigator.hardwareConcurrency || 8) <= 4 ? 'low' : 'high' }); starfield.group.traverse(object => { if (object.material) useFlightDepth(object.material); }); scene.add(starfield.group, craft.ship);
    overlayScene = new THREE.Scene(); overlayCamera = new THREE.PerspectiveCamera(55, 1, .01, 10); overlayScene.add(craft.cockpit);
    overlayScene.add(new THREE.HemisphereLight('#cbdfea', '#0b1724', 1.7)); const cabinLight = new THREE.DirectionalLight('#f4e8ca', 2); cabinLight.position.set(1, 2, 1); overlayScene.add(cabinLight);
    const canvas = renderer.domElement; canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;'; canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', '可交互的三维宇宙飞船视野，拖动转头，滚轮或 W S 前后飞行，方向键平移。');
    holder.appendChild(canvas); resize(); observer = new ResizeObserver(resize); observer.observe(holder);
    canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('dblclick', onDoubleClick);
    canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('keydown', onKeyDown); canvas.addEventListener('keyup', onKeyUp); canvas.addEventListener('blur', clearKeys); canvas.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', clearKeys); window.addEventListener('blur', clearKeys);
    animation = requestAnimationFrame(animate);
  } catch (error) { reportError(error); dispose(); }
  return { setStop, launchTo, travelTo, setPaused, setView, setSpeed, resetView, move, setCameraOverlay, dispose };
}
