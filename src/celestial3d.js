import * as THREE from 'three';
import { assetUrl } from './assets.js';
export function loadTexture(name){const texture=new THREE.TextureLoader().load(assetUrl('/textures/'+name));texture.colorSpace=THREE.SRGBColorSpace;return texture}
function bandTexture(type){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d');const saturn=type==='saturn';for(let y=0;y<512;y++){const s=Math.sin(y*.085)+.45*Math.sin(y*.39);c.fillStyle=saturn?`hsl(${39+s*3},${32+s*4}%,${62+s*7}%)`:`hsl(${28+s*6},${28+s*6}%,${60+s*13}%)`;c.fillRect(0,y,1024,1)}if(!saturn){c.fillStyle='#ae6954';c.beginPath();c.ellipse(760,325,67,28,-.15,0,Math.PI*2);c.fill();c.strokeStyle='#dbaa80';c.lineWidth=6;c.stroke()}const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t}
export function createCelestial(type='earth'){
 const group=new THREE.Group();const geometry=new THREE.SphereGeometry(1,96,64);let material;
 if(type==='earth')material=new THREE.MeshStandardMaterial({map:loadTexture('earth-color.png'),roughness:.85,metalness:.08});
 else if(type==='moon')material=new THREE.MeshStandardMaterial({map:loadTexture('moon-color.jpg'),bumpMap:loadTexture('moon-height.jpg'),bumpScale:.045,roughness:1});
 else if(['saturn','jupiter'].includes(type))material=new THREE.MeshStandardMaterial({map:bandTexture(type),roughness:1});
 else material=new THREE.MeshStandardMaterial({color:({sun:0xffb94f,mars:0xb26942,venus:0xd4ad6f,mercury:0x8e8983,neptune:0x386ace,uranus:0x75baca})[type]||0xb8c4d4,roughness:.88,emissive:type==='sun'?0xff8217:0,emissiveIntensity:type==='sun'?1.3:0});
 const globe=new THREE.Mesh(geometry,material);group.add(globe);
 if(type==='saturn'){const ring=new THREE.Mesh(new THREE.RingGeometry(1.23,2.15,160,8),new THREE.MeshStandardMaterial({color:0xc6ac7b,side:THREE.DoubleSide,transparent:true,opacity:.85,roughness:1}));ring.rotation.x=-Math.PI/2;group.add(ring);for(let i=0;i<28;i++){const radius=1.24+i*.032;const wire=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.014,128),new THREE.MeshStandardMaterial({color:i%3?0x8a7860:0xe4d2ae,side:THREE.DoubleSide,transparent:true,opacity:.68}));wire.rotation.x=-Math.PI/2;group.add(wire)}group.rotation.z=.43}
 if(type==='earth'){const air=new THREE.Mesh(new THREE.SphereGeometry(1.024,64,48),new THREE.ShaderMaterial({transparent:true,side:THREE.BackSide,depthWrite:false,uniforms:{color:{value:new THREE.Color('#79baff')}},vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',fragmentShader:'uniform vec3 color;varying vec3 n;varying vec3 v;void main(){float a=pow(1.-abs(dot(n,v)),3.);gl_FragColor=vec4(color,a*.58);}'}));group.add(air)}
 return group;
}
export function disposeScene(scene){scene.traverse(o=>{o.geometry?.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose()}})}
