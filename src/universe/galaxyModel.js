import * as THREE from 'three';

// Volumetric stars over a continuous, dusty stellar disc. All dimensions are
// illustrative; individual stars are not catalogue positions.
export function createGalaxyModel(body, { compact = false, pointCloud, geometry, material }) {
  let seed = 2166136261;
  for (const char of body.id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(.00001, random()))) * Math.cos(random() * Math.PI * 2);
  const group = new THREE.Group(), radius = body.radius || 12, color = new THREE.Color();
  if(body.morphology==='elliptical'){
    const positions=[],colors=[],sizes=[],count=compact?18000:48000;
    for(let i=0;i<count;i++){
      const distance=Math.min(.96,Math.abs(normal())*.32),a=random()*Math.PI*2,y=random()*2-1,h=Math.sqrt(1-y*y);
      positions.push(Math.cos(a)*h*distance*radius,y*distance*radius*.73,Math.sin(a)*h*distance*radius*.8);
      color.set('#d6c4a5').multiplyScalar(.45+random()*.17);colors.push(...color.toArray());sizes.push(radius*(.0017+random()**7*.009));
    }
    const stars=pointCloud(positions,colors,sizes,.24);stars.material.blending=THREE.NormalBlending;stars.name='elliptical-volume-stars';group.add(stars);
    const halo=new THREE.Mesh(geometry(new THREE.SphereGeometry(1,40,28)),material(new THREE.MeshBasicMaterial({color:'#c5b49c',transparent:true,opacity:.055,depthWrite:false})));
    halo.scale.set(radius*.62,radius*.46,radius*.51);halo.name='elliptical-stellar-halo';group.add(halo);group.userData.starCount=count;return group;
  }
  const barred = /milky/.test(body.id), count = compact ? 18000 : 64000;
  const positions = [], colors = [], sizes = [];
  for (let index = 0; index < count; index++) {
    const component = random(); let x, y, z, r;
    if (component < .24) {
      x = normal() * radius * (barred ? .15 : .11);
      z = normal() * radius * .058; y = normal() * radius * .041;
      r = Math.hypot(x, z) / radius; color.set('#ffe4b2');
    } else {
      r = .08 + Math.pow(random(), .7) * .9;
      const arm = Math.floor(random() * 4);
      const branch = component > .91 ? .32 : 0;
      const angle = Math.log(r + .1) * 3.4 + arm * Math.PI / 2 + normal() * (.085 + r * .085) + branch;
      x = Math.cos(angle) * r * radius; z = Math.sin(angle) * r * radius;
      y = normal() * radius * (.008 + (1-r) * .012);
      color.set(random() < .025 ? '#f6a5cb' : random() < .6 ? '#a1caff' : '#f4eee1');
    }
    positions.push(x, y, z);
    color.multiplyScalar(.48 + random() * .6); colors.push(color.r, color.g, color.b);
    sizes.push(radius * (.0018 + random() ** 8 * .012));
  }
  const stars = pointCloud(positions, colors, sizes, .86); stars.name = 'galaxy-volume-stars'; group.add(stars);
  const disc = new THREE.Mesh(geometry(new THREE.PlaneGeometry(radius*2.12, radius*2.12)), material(new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide,
    uniforms:{fade:{value:1}, barred:{value:barred ? 1 : 0}},
    vertexShader:'varying vec2 discUV; void main(){discUV=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float fade; uniform float barred; varying vec2 discUV;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){return noise(p)*.53+noise(p*2.03)*.27+noise(p*4.07)*.13+noise(p*8.17)*.07;}
      void main(){
        vec2 p=(discUV-.5)*2.12; float r=length(p),a=atan(p.y,p.x);
        float taper=1.-smoothstep(.73,1.03,r); if(taper<.002)discard;
        float grain=fbm(p*34.), fine=fbm(p*125.);
        float winding=(a-log(r+.1)*3.4)*4.;
        float arm=pow(.5+.5*cos(winding+(grain-.5)*1.8),5.);
        float branch=pow(.5+.5*cos(winding-1.2+(grain-.5)*3.),13.)*.24;
        float core=exp(-dot(p/vec2(mix(.17,.26,barred),.12),p/vec2(mix(.17,.26,barred),.12))*1.5);
        float halo=exp(-r*6.); float dust=pow(.5+.5*cos(winding+.55+(grain-.5)*2.4),12.)*smoothstep(.1,.26,r);
        dust*=smoothstep(.25,.68,grain+fine*.2);
        float glow=(.13+arm*.53+branch)*(grain*.65+fine*.35)*taper;
        vec3 tint=mix(vec3(.23,.37,.63),vec3(.73,.82,.95),arm*.7+fine*.2);
        vec3 light=tint*glow+vec3(1.,.78,.45)*(core*1.35+halo*.17);
        light*=1.-dust*.88;
        float alpha=clamp((glow*.95+core*.96+halo*.12+dust*.24)*taper,0.,.98);
        gl_FragColor=vec4(light/max(alpha,.03),alpha*fade);
      }`,
  })));
  disc.rotation.x = -Math.PI/2; disc.position.y = radius*.012; disc.name = 'galaxy-dust-and-stellar-disc'; group.add(disc);
  group.rotation.set(.17, -.2, -.24);
  group.userData.starCount = count;
  return group;
}
