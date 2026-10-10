import * as THREE from 'three';
import { assetUrl } from '../assets.js';
import { createBlackHole } from './deepSpaceModels.js';
import { createGalaxy } from './galaxyScene.js';

const files = { earth: 'earth_daymap', venus: 'venus_atmosphere' };
const textureName = body => `2k_${files[body] || body}.jpg`;

export function disposeModel(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      for (const uniform of Object.values(material.uniforms || {})) {
        if (uniform.value?.isTexture) textures.add(uniform.value);
      }
    }
  });
  textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
}

function atmosphere(color, radius = 1.035, strength = .42) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide,
    uniforms: { tint: { value: new THREE.Color(color) }, strength: { value: strength } },
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
    fragmentShader: 'uniform vec3 tint; uniform float strength; varying vec3 n; varying vec3 v; void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.);gl_FragColor=vec4(tint,rim*strength);}',
  }));
}

function makeRing(map) {
  const geometry = new THREE.RingGeometry(1.2, 2.28, 192, 4);
  const pos = geometry.attributes.position, uv = geometry.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - 1.2) / 1.08, .5);
  const ring = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map, side: THREE.DoubleSide, transparent: true, alphaTest: .06, roughness: 1, metalness: 0,
  }));
  ring.rotation.x = -Math.PI / 2;
  ring.receiveShadow = true; ring.castShadow = true;
  return ring;
}

export async function createModel(body, compact = false) {
  if (body === 'andromeda') return createGalaxy(compact);
  if (body === 'blackhole') return createBlackHole(compact);
  const loader = new THREE.TextureLoader();
  const names = [textureName(body)];
  if (body === 'earth') names.push('2k_earth_clouds.jpg');
  if (body === 'saturn') names.push('2k_saturn_ring_alpha.png');
  const results = await Promise.allSettled(names.map(name => loader.loadAsync(assetUrl('/textures/' + name))));
  if (results.some(result => result.status === 'rejected')) {
    results.forEach(result => { if (result.status === 'fulfilled') result.value.dispose(); });
    throw new Error('天体纹理暂时没有加载成功');
  }
  const textures = results.map(result => result.value);
  textures.forEach(texture => { texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = compact ? 2 : 4; });
  const root = new THREE.Group(), spin = new THREE.Group(); root.add(spin);
  const material = body === 'sun'
    ? new THREE.MeshBasicMaterial({ map: textures[0], toneMapped: false })
    : new THREE.MeshStandardMaterial({ map: textures[0], roughness: .96, metalness: 0 });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, compact ? 48 : 96, compact ? 32 : 64), material);
  sphere.castShadow = true; sphere.receiveShadow = true; spin.add(sphere);
  if (body === 'earth') {
    textures[1].colorSpace = THREE.NoColorSpace;
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.009, 64, 48), new THREE.MeshStandardMaterial({
      color: 0xffffff, alphaMap: textures[1], transparent: true, opacity: .85, depthWrite: false,
    }));
    spin.add(clouds, atmosphere('#78b6e5'));
    root.rotation.z = -.12; spin.rotation.y = 2.6;
  }
  if (body === 'saturn') { root.add(makeRing(textures[1])); root.rotation.z = -.4; }
  if (body === 'uranus') root.rotation.z = 1.7;
  if (body === 'sun') root.add(atmosphere('#ffad37', 1.08, .22));
  if (body === 'neptune') root.add(atmosphere('#7eb4d4', 1.025, .22));
  root.userData.spin = spin;
  root.userData.radius = body === 'saturn' ? 2.3 : 1.08;
  root.userData.speed = body === 'venus' || body === 'uranus' ? -.08 : .09;
  return root;
}

