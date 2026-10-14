import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Nose toward -Z. Texture detail and material batches keep the craft inexpensive.
export function createSurveyCraft() {
  const ship = new THREE.Group(), cockpit = new THREE.Group();
  const geometries = new Set(), materials = new Set(), textures = new Set();
  const ownGeometry = value => { geometries.add(value); return value; };
  const ownMaterial = value => { materials.add(value); return value; };
  const texture = (width, height, paint) => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d'); if (!context) return null;
    paint(context, width, height);
    const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 2; textures.add(result); return result;
  };
  const panelMap = texture(1024, 512, (ctx, width, height) => {
    ctx.fillStyle = '#e6e9e5'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#a0abb0'; ctx.lineWidth = 2;
    for (let y = 48; y < height; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      for (let x = (y / 80 % 2) * 82; x < width; x += 164) {
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 80); ctx.stroke();
        ctx.fillStyle = '#7d898d'; ctx.fillRect(x + 8, y + 7, 3, 3); ctx.fillRect(x + 151, y + 7, 3, 3);
        ctx.fillStyle = '#f5f5ef'; ctx.fillRect(x + 4, y + 3, 148, 2);
      }
    }
    ctx.fillStyle = '#78848c'; ctx.font = 'bold 18px sans-serif'; ctx.fillText('STARWHISPER / SURVEY 01', 90, 281);
    ctx.fillStyle = '#b18b47'; ctx.fillRect(90, 295, 285, 5);
    for (let x = 650; x < 875; x += 12) { ctx.fillStyle = x % 24 ? '#9b7f47' : '#49555c'; ctx.fillRect(x, 400, 8, 28); }
  });
  const instrumentMap = texture(1024, 384, (ctx, width, height) => {
    ctx.fillStyle = '#031922'; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = '#103f4d'; ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
    ctx.strokeStyle = '#57cfe4'; ctx.lineWidth = 3;
    for (const radius of [55, 102, 150]) { ctx.beginPath(); ctx.arc(220, 196, radius, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(220, 38); ctx.lineTo(220, 350); ctx.moveTo(62, 196); ctx.lineTo(378, 196); ctx.stroke();
    ctx.fillStyle = '#d6f8f8'; ctx.font = '22px monospace'; ctx.fillText('ORBITAL NAVIGATION', 440, 60);
    ctx.fillStyle = '#73dfef'; ctx.font = '48px monospace'; ctx.fillText('SURVEY / 01', 440, 130);
    ctx.font = '20px monospace'; ctx.fillText('ATTITUDE +000.00', 440, 190); ctx.fillText('SYSTEM NOMINAL', 440, 230);
    ctx.fillStyle = '#e5bc73'; ctx.fillText('EARTH / FLIGHT CONTROL', 440, 315);
    for (let i = 0; i < 11; i++) { ctx.fillStyle = i > 8 ? '#cb8d53' : '#6fd8de'; ctx.fillRect(442 + i * 39, 253, 25, 10); }
  });
  const metal = ownMaterial(new THREE.MeshStandardMaterial({ color: '#afbec6', roughness: .32, metalness: .8 }));
  const pale = ownMaterial(new THREE.MeshStandardMaterial({ color: '#f1f2ed', map: panelMap, roughness: .5, metalness: .38 }));
  const dark = ownMaterial(new THREE.MeshStandardMaterial({ color: '#14212b', roughness: .34, metalness: .65 }));
  const rubber = ownMaterial(new THREE.MeshStandardMaterial({ color: '#090f15', roughness: .82, metalness: .18 }));
  const gold = ownMaterial(new THREE.MeshStandardMaterial({ color: '#c5a05f', roughness: .26, metalness: .82 }));
  const glass = ownMaterial(new THREE.MeshPhysicalMaterial({ color: '#091520', roughness: .11, metalness: .6, clearcoat: 1, clearcoatRoughness: .08 }));
  const teal = ownMaterial(new THREE.MeshBasicMaterial({ color: '#9df0ff', toneMapped: false }));
  const amber = ownMaterial(new THREE.MeshBasicMaterial({ color: '#edc88a', toneMapped: false }));
  const red = ownMaterial(new THREE.MeshBasicMaterial({ color: '#ff6062', toneMapped: false }));
  const screen = ownMaterial(new THREE.MeshBasicMaterial({ color: '#a4edee', map: instrumentMap, toneMapped: false }));
  const exhaust = ownMaterial(new THREE.MeshBasicMaterial({ color: '#9de0ff', transparent: true, opacity: .7, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  const unitBox = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
  const unitSphere = ownGeometry(new THREE.SphereGeometry(1, 40, 24));
  const detailSphere = ownGeometry(new THREE.SphereGeometry(1, 8, 6));
  const unitBar = ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 10));
  const staticParts = new Map();
  const part = (geometry, material, parent = ship, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    const object = new THREE.Mesh(geometry, material); object.position.set(...position); object.scale.set(...scale); object.rotation.set(...rotation); object.updateMatrix();
    let buckets = staticParts.get(parent); if (!buckets) { buckets = new Map(); staticParts.set(parent, buckets); }
    let bucket = buckets.get(material); if (!bucket) { bucket = []; buckets.set(material, bucket); }
    const transformed = geometry.clone().applyMatrix4(object.matrix);
    const nonIndexed = transformed.index ? transformed.toNonIndexed() : transformed;
    if (nonIndexed !== transformed) transformed.dispose();
    bucket.push(nonIndexed); return object;
  };
  const box = (dimensions, position, material, parent = ship, rotation = [0, 0, 0]) => part(unitBox, material, parent, position, dimensions, rotation);
  const bar = (a, b, width, material, parent = ship) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), delta = to.clone().sub(from);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    return part(unitBar, material, parent, from.add(to).multiplyScalar(.5).toArray(), [width, delta.length(), width], new THREE.Euler().setFromQuaternion(q).toArray().slice(0, 3));
  };
  const torus = (radius, tube, position, material, scale = [1, 1, 1], rotation = [0, 0, 0]) => part(ownGeometry(new THREE.TorusGeometry(radius, tube, 10, 64)), material, ship, position, scale, rotation);

  part(unitSphere, pale, ship, [0, 0, .04], [1.1, .76, 1.67]);
  part(unitSphere, dark, ship, [0, -.31, .08], [1.045, .52, 1.55]);
  part(unitSphere, glass, ship, [0, .2, -.93], [.88, .56, 1.04]);
  torus(.88, .052, [0, .19, -1.64], gold, [1, .68, 1]);
  torus(.93, .024, [0, .18, -1.58], rubber, [1, .68, 1]);
  part(ownGeometry(new THREE.TorusGeometry(.85, .018, 8, 64, Math.PI)), amber, ship, [0, .17, -1.695], [1, .67, 1], [0, 0, Math.PI]);
  for (const side of [-1, 1]) {
    bar([side * .77, .37, -1.33], [side * .72, .62, -.59], .022, metal);
    box([.038, .48, .72], [side * 1.02, .12, .12], rubber);
    box([.04, .42, .64], [side * 1.042, .12, .12], pale);
    box([.04, .033, .15], [side * 1.07, .15, .22], gold);
    box([.04, .11, .16], [side * 1.07, -.02, .16], dark);
    box([.38, .15, 2.14], [side * 1.13, -.13, .19], metal);
    box([.27, .34, 1.08], [side * 1.12, -.12, .67], dark);
    box([.046, .05, .71], [side * 1.28, .025, .44], amber);
    box([.58, .08, .72], [side * 1.24, -.16, .2], pale, ship, [0, side * .17, side * -.04]);
    bar([side * .76, -.24, -.68], [side * 1.71, -.22, -.87], .12, metal);
    bar([side * .82, -.19, .85], [side * 1.71, -.2, 1.05], .12, metal);
    box([.095, .63, .79], [side * .79, .37, 1.18], pale, ship, [0, 0, side * -.24]);
    box([.095, .095, .74], [side * .86, .62, 1.18], dark, ship, [0, 0, side * -.24]);
    for (let i = 0; i < 9; i++) box([.035, .13, .023], [side * 1.16, -.03, .36 + i * .075], rubber);
    for (const z of [-.86, 1.05]) {
      part(ownGeometry(new THREE.CylinderGeometry(.25, .32, 1.08, 32)), metal, ship, [side * 1.72, -.17, z], [1, 1, 1], [Math.PI / 2, 0, 0]);
      part(unitSphere, pale, ship, [side * 1.72, -.17, z - .53], [.258, .258, .16]);
      part(ownGeometry(new THREE.CylinderGeometry(.239, .275, .29, 32)), dark, ship, [side * 1.72, -.17, z + .62], [1, 1, 1], [Math.PI / 2, 0, 0]);
      torus(.251, .025, [side * 1.72, -.17, z + .78], gold);
      torus(.173, .028, [side * 1.72, -.17, z + .787], teal);
      box([.36, .045, .55], [side * 1.72, .145, z - .05], pale);
      for (let j = 0; j < 6; j++) {
        const a = j / 6 * Math.PI * 2;
        box([.045, .045, .38], [side * 1.72 + Math.cos(a) * .266, -.17 + Math.sin(a) * .266, z + .12], rubber, ship, [0, 0, a]);
      }
      for (let j = 0; j < 8; j++) {
        const a = j / 8 * Math.PI * 2;
        part(detailSphere, metal, ship, [side * 1.72 + Math.cos(a) * .232, -.17 + Math.sin(a) * .232, z + .78], [.022, .022, .015]);
      }
    }
    bar([side * .5, -.46, -.41], [side * .72, -.85, -.49], .04, metal);
    bar([side * .51, -.46, .91], [side * .72, -.85, 1.02], .04, metal);
    box([.32, .055, .23], [side * .72, -.88, -.49], rubber);
    box([.32, .055, .23], [side * .72, -.88, 1.02], rubber);
    part(detailSphere, side < 0 ? red : teal, ship, [side * 1.39, -.12, -.29], [.055, .026, .06]);
  }
  torus(.47, .09, [0, .03, 1.58], metal); torus(.35, .07, [0, .03, 1.68], rubber);
  box([.68, .115, .65], [0, .78, .27], metal); box([.3, .08, .25], [0, .88, .21], dark);
  bar([0, .87, .56], [0, 1.17, .84], .024, metal); box([.41, .035, .28], [0, 1.18, .84], dark); box([.13, .02, .08], [0, 1.207, .84], gold);
  for (let i = 0; i < 8; i++) box([.028, .025, .34], [(i - 3.5) * .078, .685, .88], rubber);
  box([.28, .075, .02], [0, -.35, -1.59], teal);
  const engineGlows = [], plumeGeometry = ownGeometry(new THREE.ConeGeometry(.18, .88, 24, 1, true));
  for (const side of [-1, 1]) for (const z of [-.86, 1.05]) {
    const glow = new THREE.Mesh(plumeGeometry, exhaust); glow.rotation.x = -Math.PI / 2;
    glow.position.set(side * 1.72, -.17, z + 1.1); ship.add(glow); engineGlows.push(glow);
  }

  const frame = ownMaterial(new THREE.MeshStandardMaterial({ color: '#182833', metalness: .7, roughness: .42 }));
  const outline = [[-.92,-.56,-1.2],[-1.14,.18,-1.2],[-.91,.67,-1.2],[.91,.67,-1.2],[1.14,.18,-1.2],[.92,-.56,-1.2]];
  for (let i = 0; i < outline.length - 1; i++) {
    bar(outline[i], outline[i + 1], .043, frame, cockpit);
    const a = [...outline[i]], b = [...outline[i + 1]]; a[2] -= .01; b[2] -= .01; bar(a, b, .01, gold, cockpit);
  }
  box([2.18, .27, .49], [0, -.72, -.91], frame, cockpit); box([2.13, .055, .49], [0, -.56, -.91], dark, cockpit);
  box([.76, .028, .28], [0, -.505, -.91], rubber, cockpit, [.26, 0, 0]); box([.69, .009, .234], [0, -.481, -.91], screen, cockpit, [.26, 0, 0]);
  for (const side of [-1, 1]) {
    box([.45, .09, .35], [side * .71, -.53, -.88], frame, cockpit, [.18, 0, side * -.05]);
    box([.37, .018, .19], [side * .71, -.461, -.91], screen, cockpit, [.18, 0, 0]);
    for (let i = 0; i < 5; i++) {
      box([.04, .017, .028], [side * .7 + (i - 2) * .066, -.469, -.764], i === 0 ? amber : teal, cockpit);
      bar([side * .7 + (i - 2) * .066, -.502, -.735], [side * .7 + (i - 2) * .066, -.462, -.735], .008, metal, cockpit);
    }
    box([.068, .17, .09], [side * .99, -.475, -.76], rubber, cockpit, [0, 0, side * -.15]); box([.07, .015, .095], [side * .985, -.392, -.76], gold, cockpit);
    for (let i = 0; i < 12; i++) box([.028, .007, .04], [side * .52 + (i % 4) * .047 * side, -.575, -.628 + Math.floor(i / 4) * .05], metal, cockpit);
  }
  box([.88, .01, .025], [0, -.589, -.68], amber, cockpit);
  const dashboardGlow = new THREE.PointLight('#75d9ea', .38, 2.3); dashboardGlow.position.set(0, -.36, -.7); cockpit.add(dashboardGlow);
  for (const [parent, buckets] of staticParts) for (const [material, parts] of buckets) {
    const geometry = ownGeometry(mergeGeometries(parts, false)); parts.forEach(value => value.dispose());
    geometry.computeBoundingSphere(); parent.add(new THREE.Mesh(geometry, material));
  }
  staticParts.clear(); ship.updateMatrixWorld(true);
  const radius = new THREE.Box3().setFromObject(ship).getBoundingSphere(new THREE.Sphere()).radius;
  return {
    ship, cockpit, radius,
    update(time, thrust = 0) {
      const power = THREE.MathUtils.clamp(Math.abs(thrust), 0, 1); exhaust.opacity = .06 + power * .69;
      engineGlows.forEach((glow, index) => { glow.scale.y = .18 + power * .82 + Math.sin(time * 24 + index) * .025 * power; });
    },
    dispose() {
      geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
      geometries.clear(); materials.clear(); textures.clear(); ship.clear(); cockpit.clear(); engineGlows.length = 0;
    },
  };
}
