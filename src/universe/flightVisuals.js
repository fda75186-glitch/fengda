import * as THREE from 'three';

function randomGenerator(seed = 9251) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const gaussian = random => Math.sqrt(-2 * Math.log(Math.max(.00001, random()))) * Math.cos(random() * Math.PI * 2);

// Fixed angular background. Stars have screen-pixel sizes, so increasing the
// universe scale never shrinks them to indistinct sub-pixel dust.
export function createStarfield({ quality = 'high' } = {}) {
  const group = new THREE.Group(), geometries = [], materials = [], textures = [];
  const random = randomGenerator(738921), high = quality !== 'low';
  const shellRadius = 8500, axis = new THREE.Vector3(.14, .84, .53).normalize();
  const side = new THREE.Vector3(1, 0, 0).cross(axis).normalize(), across = axis.clone().cross(side);
  let sprite = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      glow.addColorStop(0, 'rgba(255,255,255,1)'); glow.addColorStop(.13, 'rgba(255,255,255,.95)'); glow.addColorStop(.29, 'rgba(216,231,255,.48)'); glow.addColorStop(.6, 'rgba(175,200,255,.11)'); glow.addColorStop(1, 'rgba(170,190,255,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 64, 64);
      sprite = new THREE.CanvasTexture(canvas); textures.push(sprite);
    }
  }
  const tint = new THREE.Color(), direction = new THREE.Vector3();
  function stars(count, band = false) {
    const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), sizes = new Float32Array(count), phases = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      if (band) {
        const angle = random() * Math.PI * 2;
        direction.copy(side).multiplyScalar(Math.cos(angle)).addScaledVector(across, Math.sin(angle)).addScaledVector(axis, gaussian(random) * .055).normalize();
      } else {
        const y = random() * 2 - 1, angle = random() * Math.PI * 2, horizontal = Math.sqrt(1 - y * y);
        direction.set(Math.cos(angle) * horizontal, y, Math.sin(angle) * horizontal);
      }
      direction.multiplyScalar(shellRadius * (.87 + random() * .12)); positions.set(direction.toArray(), i * 3);
      const hue = random(); tint.set(hue < .14 ? '#ffdaa8' : hue < .37 ? '#a4caff' : '#edf3ff').multiplyScalar(band ? .42 + random() * .42 : .76 + random() * .42); colors.set(tint.toArray(), i * 3);
      const brightness = random(); sizes[i] = band ? .8 + random() * 1.9 : brightness > .997 ? 7 + random() * 5 : brightness > .963 ? 3 + random() * 3.8 : 1.25 + random() * 1.75;
      phases[i] = random() * Math.PI * 2;
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.setAttribute('starSize', new THREE.BufferAttribute(sizes, 1)); geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1)); geometries.push(geometry);
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      uniforms: { opacity: { value: 1 }, time: { value: 0 }, pixelRatio: { value: typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5) }, sprite: { value: sprite }, hasSprite: { value: sprite ? 1 : 0 } },
      vertexShader: 'attribute float starSize; attribute float phase; uniform float pixelRatio; uniform float time; varying vec3 starColor; varying float pulse; void main(){starColor=color; pulse=.88+.12*sin(time*.37+phase); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(starSize*pixelRatio,1.,20.);}',
      fragmentShader: 'uniform float opacity; uniform sampler2D sprite; uniform float hasSprite; varying vec3 starColor; varying float pulse; void main(){float r=length(gl_PointCoord-.5)*2.; if(r>1.)discard; float glow=mix(exp(-r*r*8.)*.8+exp(-r*r*40.)*.5,texture2D(sprite,gl_PointCoord).a,hasSprite); gl_FragColor=vec4(starColor,glow*pulse*opacity);}',
    }); materials.push(material);
    const points = new THREE.Points(geometry, material); points.frustumCulled = false; points.renderOrder = -90; group.add(points);
  }
  stars(high ? 14000 : 7000); stars(high ? 13000 : 6000, true);
  const nebulaGeometry = new THREE.SphereGeometry(shellRadius * 1.04, 48, 32); geometries.push(nebulaGeometry);
  const nebulaMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { opacity: { value: 1 }, axis: { value: axis } },
    vertexShader: 'varying vec3 direction; void main(){direction=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float opacity; uniform vec3 axis; varying vec3 direction;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){vec3 d=normalize(direction); float band=1.-smoothstep(.02,.24,abs(dot(d,axis))); float clouds=noise(d*9.)*.56+noise(d*27.)*.28+noise(d*73.)*.16; float dust=smoothstep(.42,.64,noise(d*44.)); float strength=pow(band,1.4)*(.027+clouds*.13)*(1.-dust*.82); vec3 glow=mix(vec3(.17,.32,.61),vec3(.61,.69,.83),clouds); gl_FragColor=vec4(glow,strength*opacity);}`,
  }); materials.push(nebulaMaterial);
  const milkyWay = new THREE.Mesh(nebulaGeometry, nebulaMaterial); milkyWay.frustumCulled = false; milkyWay.renderOrder = -100; group.add(milkyWay);
  return {
    group,
    update(camera, time = 0, spaceBlend = 1) {
      if (camera?.position) group.position.copy(camera.position);
      const visible = THREE.MathUtils.clamp(Number(spaceBlend) || 0, 0, 1); group.visible = visible > .002;
      for (const material of materials) { material.uniforms.opacity.value = visible; if (material.uniforms.time) material.uniforms.time.value = time; }
    },
    setPixelRatio(value) { for (const material of materials) if (material.uniforms.pixelRatio) material.uniforms.pixelRatio.value = THREE.MathUtils.clamp(value || 1, .75, 2); },
    dispose() { geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); group.clear(); },
  };
}

// An artistic launch-ground scene inspired by coastal Wenchang, not a surveyed
// reconstruction. The terrain follows the planet curvature; +Y is surface-up.
export function createLaunchSite({ radius = 7.5 } = {}) {
  radius = Number.isFinite(radius) ? Math.max(.1, radius) : 7.5;
  const group = new THREE.Group(), staticGroup = new THREE.Group(); group.add(staticGroup);
  const unit = radius / 7.5, random = randomGenerator(584127), geometries = [], materials = [], textures = [];
  const ownGeometry = value => { geometries.push(value); return value; };
  const ownMaterial = value => { materials.push(value); return value; };
  const groundHeight = (x, z) => Math.sqrt(Math.max(radius * radius - x * x - z * z, radius * radius * .05)) - radius;
  const concrete = ownMaterial(new THREE.MeshStandardMaterial({ color: '#c5c8c3', roughness: .89 }));
  const steel = ownMaterial(new THREE.MeshStandardMaterial({ color: '#7e9299', roughness: .4, metalness: .76 }));
  const white = ownMaterial(new THREE.MeshStandardMaterial({ color: '#e1e3dc', roughness: .65, metalness: .23 }));
  const charcoal = ownMaterial(new THREE.MeshStandardMaterial({ color: '#3b4547', roughness: .92 }));
  const grass = ownMaterial(new THREE.MeshStandardMaterial({ color: '#446c45', roughness: .95 }));
  const trunk = ownMaterial(new THREE.MeshStandardMaterial({ color: '#766248', roughness: 1 }));
  const amber = ownMaterial(new THREE.MeshBasicMaterial({ color: '#ffe0a1', toneMapped: false }));
  const cube = ownGeometry(new THREE.BoxGeometry(1, 1, 1)), cylinder = ownGeometry(new THREE.CylinderGeometry(1, 1, 1, 12));
  const instanceBuckets = new Map(), transform = new THREE.Object3D();
  function instance(geometry, material, position, scale, rotation = [0, 0, 0]) {
    const key = `${geometry.id}/${material.id}`; if (!instanceBuckets.has(key)) instanceBuckets.set(key, { geometry, material, matrices: [] });
    transform.position.fromArray(position).multiplyScalar(unit); transform.scale.fromArray(scale).multiplyScalar(unit); transform.rotation.set(...rotation); transform.updateMatrix();
    instanceBuckets.get(key).matrices.push(transform.matrix.clone());
  }
  const box = (scale, position, material, rotation) => instance(cube, material, position, scale, rotation);
  const rod = (a, b, width, material = steel) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    instance(cylinder, material, start.add(end).multiplyScalar(.5).toArray(), [width, delta.length(), width], new THREE.Euler().setFromQuaternion(quaternion).toArray().slice(0, 3));
  };

  const grid = 128, width = radius * 1.2, position = [], colors = [], indices = [], color = new THREE.Color();
  for (let row = 0; row <= grid; row++) for (let column = 0; column <= grid; column++) {
    const x = (column / grid - .5) * width, z = (row / grid - .5) * width;
    const shoreline = radius * .175 + Math.sin(z / radius * 11) * radius * .025;
    const sea = x > shoreline, beach = Math.abs(x - shoreline) < radius * .025;
    position.push(x, groundHeight(x, z) + .0015 * unit, z);
    color.set(sea ? '#419ca7' : beach ? '#c1b89a' : '#546d46').multiplyScalar(.93 + Math.sin(x*5)*Math.cos(z*4)*.045); colors.push(color.r, color.g, color.b);
    if (row < grid && column < grid) { const a = row * (grid + 1) + column, b = a + grid + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const terrainGeometry = ownGeometry(new THREE.BufferGeometry()); terrainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); terrainGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); terrainGeometry.setIndex(indices); terrainGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(terrainGeometry, ownMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88 }))); staticGroup.add(terrain);

  // Tarmac, pad markings, flame-trench cover and feeder roads.
  box([.42, .015, .59], [0, .014, .11], concrete);
  box([.2, .025, .22], [0, .031, .1], charcoal);
  box([.11, .006, .125], [0, .046, .1], steel);
  for (const side of [-1, 1]) box([.012, .006, .56], [side * .18, .024, .1], white);
  box([.42, .006, .012], [0, .024, -.145], white);
  box([.47, .007, .034], [.1, .024, .13], steel);
  for (let i = 0; i < 12; i++) box([.012, .004, .005], [i * .016 - .09, .049, .19], i % 2 ? charcoal : amber);

  // Open lattice servicing gantry, upper deck and umbilical bridges.
  const towerX = -.23, towerZ = -.06, towerHeight = .38;
  for (const x of [towerX - .048, towerX + .048]) for (const z of [towerZ - .045, towerZ + .045]) rod([x, .022, z], [x, towerHeight, z], .005);
  for (let level = 0; level < 6; level++) {
    const y = .04 + level * .055;
    box([.11, .008, .105], [towerX, y, towerZ], steel);
    for (const z of [towerZ - .046, towerZ + .046]) {
      rod([towerX - .048, y, z], [towerX + .048, y + .055, z], .002);
      rod([towerX + .048, y, z], [towerX - .048, y + .055, z], .002);
    }
    box([.018, .007, .012], [towerX + .044, y + .017, towerZ - .056], amber);
  }
  box([.15, .07, .115], [towerX, .385, towerZ], white);
  box([.045, .08, .024], [towerX + .038, .374, towerZ + .069], steel);
  box([.2, .01, .026], [-.135, .207, towerZ], steel);
  box([.035, .016, .035], [-.065, .217, towerZ], amber);
  for (const [x, z] of [[.29,-.22],[-.38,-.24],[.34,.46],[-.39,.45]]) {
    rod([x, 0, z], [x, .44, z], .0045, steel);
    box([.035, .018, .025], [x, .44, z], white); box([.032, .004, .023], [x, .427, z], amber);
    for (let y = .04; y < .35; y += .05) rod([x - .008, y, z], [x + .008, y + .05, z], .0012);
  }
  // Large servicing facilities only. Sky, ground, coast and the launch pad are
  // intentionally excluded; the vertical launch corridor at X=0,Z=.1 is clear.
  const obstacles = [{ id: 'wenchang-service-gantry', center: new THREE.Vector3(towerX, .21, towerZ).multiplyScalar(unit), radius: .22 * unit }];
  const facilities = [[-.76,-1.22,.46,.55,.51],[.78,-1.13,.36,.42,.2],[-1.12,.24,.34,.52,.2],[-.65,.42,.32,.39,.13],[-.63,-.5,.19,.28,.07],[-.27,-.68,.24,.22,.065],[.49,-.61,.22,.23,.07]];
  for (const [index, [x, z, w, d, h]] of facilities.entries()) {
    const y = groundHeight(x * unit, z * unit) / unit;
    box([w, h, d], [x, y + h / 2, z], white); box([w * 1.04, .012, d * 1.04], [x, y + h, z], steel);
    for (let i = 0; i < 5; i++) box([w / 8, .025, .004], [x + (i - 2) * w / 6, y + h * .6, z + d / 2 + .002], charcoal);
    obstacles.push({ id: `wenchang-facility-${index + 1}`, center: new THREE.Vector3(x, y + h / 2, z).multiplyScalar(unit), radius: Math.hypot(w * .52, (h + .024) * .5, d * .52) * unit });
  }
  for (const x of [-.55, -.44, -.33]) instance(cylinder, white, [x, .043, -.32], [.037, .085, .037]);
  for (let i = 0; i < 3; i++) {
    const x = .24 + i * .065, z = .28 + i * .06;
    box([.042, .018, .075], [x, .016, z], white); box([.038, .025, .026], [x, .034, z + .025], steel);
    for (const side of [-1, 1]) instance(cylinder, charcoal, [x + side * .023, .009, z], [.011, .006, .011], [0, 0, Math.PI / 2]);
  }
  for (let i = 0; i < 30; i++) {
    const z = i * .026 - .32;
    const y=groundHeight(.52*unit,z*unit)/unit;
    rod([.52, y, z], [.52, y+.055, z], .0018); box([.003, .034, .024], [.52, y+.033, z], steel);
  }
  // Assembly building: segmented doors, red identification stripe, roof plant
  // and ribs provide a readable industrial silhouette from the launch cockpit.
  const red = ownMaterial(new THREE.MeshStandardMaterial({ color: '#ba4335', roughness: .7 }));
  const hallX=-.76, hallZ=-1.22, hallY=groundHeight(hallX*unit,hallZ*unit)/unit;
  box([.35,.38,.012],[hallX,hallY+.2,hallZ+.282],charcoal);
  for(let i=0;i<10;i++) box([.35,.005,.006],[hallX,hallY+.035+i*.038,hallZ+.291],steel);
  box([.465,.036,.56],[hallX,hallY+.44,hallZ],red);
  for(const x of [-.99,-.53]) box([.015,.52,.56],[x,hallY+.26,hallZ],white);
  for(let i=0;i<4;i++) box([.065,.04,.09],[hallX-.15+i*.1,hallY+.536,hallZ],steel);
  // Additional tower skin, access stairs and service pipes, clear of the ship.
  box([.04,.3,.09],[towerX-.04,.2,towerZ],white);
  for(let i=0;i<12;i++) box([.04,.005,.018],[towerX-.09,.035+i*.025,towerZ+.065],steel);
  for(const z of [-.105,-.075,-.045]) rod([-.34,.025,z],[-.34,.34,z],.004,white);
  for(let i=0;i<4;i++) {
    const x=.68+i*.105,z=-.5,y=groundHeight(x*unit,z*unit)/unit;
    instance(cylinder,white,[x,y+.11,z],[.043,.22,.043]);
    instance(cylinder,steel,[x,y+.2,z],[.047,.014,.047]);
    obstacles.push({id:`wenchang-storage-${i}`,center:new THREE.Vector3(x,y+.11,z).multiplyScalar(unit),radius:.125*unit});
    rod([x,y+.03,z],[x,y+.03,z+.18],.005,steel);
  }
  // Short tangent road segments follow the curved terrain instead of sinking
  // a single long flat road into the globe. Paint sits above the road surface.
  for(let i=0;i<28;i++) {
    const z=-1.9+i*.13,x=.43,y=groundHeight(x*unit,z*unit)/unit;
    const slope=Math.atan2(z,Math.sqrt(radius*radius/unit/unit-z*z-x*x));
    box([.15,.008,.126],[x,y+.008,z],charcoal,[slope,0,0]);
    if(i%2===0) box([.008,.002,.063],[x,y+.014,z],amber,[slope,0,0]);
  }
  for(let i=0;i<13;i++) {
    const x=-.12,z=.44+i*.11,y=groundHeight(x*unit,z*unit)/unit;
    const slope=Math.atan2(z,Math.sqrt(radius*radius/unit/unit-z*z-x*x));
    box([.15,.008,.106],[x,y+.008,z],charcoal,[slope,0,0]);
    if(i%2===0)box([.007,.002,.053],[x,y+.014,z],amber,[slope,0,0]);
  }
  // Base name is an in-world sign, not a screen overlay.
  if(typeof document !== 'undefined') {
    const canvas=document.createElement('canvas'); canvas.width=1024; canvas.height=256;
    const ctx=canvas.getContext('2d');
    if(ctx){
      ctx.fillStyle='#163246';ctx.fillRect(0,0,1024,256);
      ctx.fillStyle='#f1ebe0';ctx.font='bold 80px sans-serif';ctx.textAlign='center';ctx.fillText('文昌 · 星语发射基地',512,112);
      ctx.fillStyle='#c7a575';ctx.font='34px sans-serif';ctx.fillText('WENCHANG  /  LAUNCH COMPLEX 01',512,194);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
      const sign=new THREE.Mesh(ownGeometry(new THREE.PlaneGeometry(.43*unit,.1075*unit)),ownMaterial(new THREE.MeshBasicMaterial({map:texture,toneMapped:false})));
      sign.position.set(hallX*unit,(hallY+.39)*unit,(hallZ+.289)*unit);staticGroup.add(sign);
    }
  }
  // Coastal palms use three instance batches for all trunks and fronds.
  const leafGeometry = ownGeometry(new THREE.ConeGeometry(1, 1, 4, 1));
  for (let i = 0; i < 58; i++) {
    const x = (random() - .5) * 3.2, z = (random() - .5) * 3.6;
    if (Math.abs(x) < .82 && Math.abs(z) < .98 || x > 1.2) continue;
    const y = groundHeight(x * unit, z * unit) / unit, h = .09 + random() * .09;
    rod([x, y, z], [x + .012, y + h, z], .005, trunk);
    for (let j = 0; j < 5; j++) {
      const a = j / 5 * Math.PI * 2 + random() * .12;
      instance(leafGeometry, grass, [x + Math.cos(a) * .039, y + h, z + Math.sin(a) * .039], [.014, .095, .026], [.6, a, 1.1]);
    }
  }
  for (const bucket of instanceBuckets.values()) {
    const object = new THREE.InstancedMesh(bucket.geometry, bucket.material, bucket.matrices.length);
    bucket.matrices.forEach((matrix, index) => object.setMatrixAt(index, matrix)); object.instanceMatrix.needsUpdate = true;
    object.computeBoundingSphere(); staticGroup.add(object);
  }
  instanceBuckets.clear();

  // Blue daytime sky is behind launch structures and disappears with altitude.
  const skyMaterial = ownMaterial(new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false,
    uniforms: { opacity: { value: 1 }, layerFade: { value: 1 } },
    vertexShader: 'varying vec3 direction; void main(){direction=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float opacity; uniform float layerFade; varying vec3 direction; void main(){float height=clamp(normalize(direction).y,0.,1.); vec3 color=mix(vec3(.71,.84,.89),vec3(.055,.27,.53),pow(height,.46)); gl_FragColor=vec4(color,opacity*layerFade);}',
  }));
  const sky = new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(radius * 1.8, 32, 24)), skyMaterial); sky.position.y = -radius * .34; sky.renderOrder = -80; sky.frustumCulled = false; group.add(sky);
  const hazeMaterial = ownMaterial(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { opacity: { value: .15 }, layerFade: { value: 1 } },
    vertexShader: 'varying vec2 cloudUV; void main(){cloudUV=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float opacity; uniform float layerFade; varying vec2 cloudUV; void main(){vec2 edge=abs(cloudUV-.5)*2.; float soft=(1.-smoothstep(.18,1.,edge.x))*(1.-smoothstep(.12,1.,edge.y)); gl_FragColor=vec4(.84,.91,.93,soft*opacity*layerFade);}',
  }));
  const hazeGeometry = ownGeometry(new THREE.PlaneGeometry(radius * 1.1, radius * .055));
  const haze = new THREE.Mesh(hazeGeometry, hazeMaterial); haze.position.set(0, -.17 * unit, -radius * .35); group.add(haze);
  const padBoxes = [
    { size: [.42, .015, .59], center: [0, .014, .11] },
    { size: [.2, .025, .22], center: [0, .031, .1] },
    { size: [.11, .006, .125], center: [0, .046, .1] },
  ].map(({ size, center }) => ({
    min: new THREE.Vector3(...center).addScaledVector(new THREE.Vector3(...size), -.5).multiplyScalar(unit),
    max: new THREE.Vector3(...center).addScaledVector(new THREE.Vector3(...size), .5).multiplyScalar(unit),
  }));
  return {
    group,
    surfaceUp: new THREE.Vector3(0, 1, 0), sitePosition: new THREE.Vector3(0, 0, 0), obstacles, padBoxes,
    localCameraPosition: new THREE.Vector3(0, .115, .1).multiplyScalar(unit),
    localCameraTarget: new THREE.Vector3(-.65, .16, -1.8).multiplyScalar(unit),
    launchWaypoints: [[0,.115,.1],[0,.23,.1],[0,.56,.075],[0,1.05,-.12],[0,1.65,-.64],[0,2.5,-1.55]].map(point => new THREE.Vector3(...point).multiplyScalar(unit)),
    update(altitudeAboveSurface = 0) {
      const height = Math.max(0, Number(altitudeAboveSurface) || 0) / radius;
      const skyOpacity = 1 - THREE.MathUtils.smoothstep(height, .012, .16);
      skyMaterial.uniforms.opacity.value = skyOpacity; sky.visible = skyOpacity > .002; hazeMaterial.uniforms.opacity.value = skyOpacity * .15; haze.visible = sky.visible;
      staticGroup.visible = height < .55;
    },
    dispose() { geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose()); group.clear(); },
  };
}
