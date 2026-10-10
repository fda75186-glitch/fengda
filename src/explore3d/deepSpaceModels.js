import * as THREE from 'three';

const vertexShader = `
varying vec2 screenUV;
void main() { screenUV = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const common = `
precision highp float;
varying vec2 screenUV;
uniform vec3 eye, forward, rightward, upward;
uniform vec2 projection;
uniform float elapsed;
const float PI = 3.14159265359;
float hash(vec3 p) { p=fract(p*vec3(.1031,.11369,.13787)); p+=dot(p,p.yzx+19.19); return fract((p.x+p.y)*p.z); }
float noise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p) { return .55*noise(p)+.28*noise(p*2.07+11.)+.17*noise(p*4.13+37.); }
vec3 viewingRay() { vec2 xy=(screenUV*2.-1.)*projection; return normalize(forward+xy.x*rightward+xy.y*upward); }
vec2 sphereHit(vec3 p,vec3 d,float radius) {
  float b=dot(p,d), h=b*b-dot(p,p)+radius*radius;
  if(h<0.)return vec2(-1.); h=sqrt(h); return vec2(-b-h,-b+h);
}
vec3 starfield(vec3 d) {
  vec2 sky=vec2(atan(d.z,d.x)/(2.*PI)+.5,asin(clamp(d.y,-1.,1.))/PI+.5);
  vec3 color=vec3(.0015,.002,.004);
  for(int layer=0;layer<2;layer++) {
    float density=layer==0?410.:710.; vec2 grid=sky*vec2(density,density*.5);
    vec2 cell=floor(grid), local=fract(grid);
    float pick=hash(vec3(cell,float(layer)*17.));
    vec2 center=vec2(hash(vec3(cell,7.)),hash(vec3(cell,23.)))*.7+.15;
    float distance=length(local-center), size=mix(.025,.09,hash(vec3(cell,51.)));
    float star=exp(-distance*distance/(size*size));
    float halo=exp(-distance*distance/.03)*.03;
    float intensity=smoothstep(.982,.998,pick)*(star+halo);
    color+=mix(vec3(.64,.79,1.),vec3(1.,.86,.65),hash(vec3(cell,83.)))*intensity*1.45;
  }
  return color;
}
`;

// Illustrative curved-ray integration. Visual parameters are tuned for education,
// not for extracting physical measurements or reproducing a particular observation.
const blackHoleShader = common + `
vec3 diskEmission(vec3 p, vec3 direction) {
  float r=length(p.xz), theta=atan(p.z,p.x);
  float mask=smoothstep(1.05,1.3,r)*(1.-smoothstep(2.9,3.45,r));
  float angle=theta-elapsed*.19/pow(max(r,1.),1.5);
  float turbulent=fbm(vec3(r*11.,sin(angle)*3.,cos(angle)*3.));
  float bands=.72+.18*sin(r*105.+turbulent*4.)+.1*sin(r*203.+theta*2.);
  float heat=pow(1.2/max(r,1.2),1.1);
  vec3 tint=mix(vec3(.71,.51,.29),vec3(1.,.96,.86),heat);
  vec3 tangent=normalize(vec3(-p.z,0.,p.x));
  float doppler=clamp(1.+dot(tangent,-direction)*.65,.4,1.8);
  float intensity=(1.1+heat*2.5)*bands*(.8+turbulent*.4)*pow(doppler,2.);
  return tint*intensity*mask;
}
void main() {
  vec3 ray=viewingRay(), initial=ray;
  vec2 bounds=sphereHit(eye,ray,4.4);
  vec3 color=vec3(0.); float transmission=1.; bool captured=false;
  float nearest=100., traveled=0.;
  if(bounds.y>0.) {
    vec3 p=eye+ray*max(bounds.x,0.);
    float h2=dot(cross(p,ray),cross(p,ray));
    for(int step=0;step<RAY_STEPS;step++) {
      float r=length(p); nearest=min(nearest,r);
      if(r<.405) { captured=true; break; }
      if(r>4.7 && dot(p,ray)>0.)break;
      float dt=clamp(r*.055,.009,.21);
      vec3 acceleration=-.6*h2*p/pow(max(r,.4),5.);
      vec3 next=p+ray*dt+.5*acceleration*dt*dt;
      ray+=acceleration*dt;
      if(p.y*next.y<=0. && abs(p.y-next.y)>.00001) {
        float t=clamp(p.y/(p.y-next.y),0.,1.);
        vec3 crossing=mix(p,next,t);
        float radial=length(crossing.xz);
        if(radial>1.05 && radial<3.45) {
          vec3 emission=diskEmission(crossing,normalize(ray));
          color+=transmission*emission*.8;
          float edge=smoothstep(1.05,1.3,radial)*(1.-smoothstep(2.9,3.45,radial));
          transmission*=1.-edge*.86;
        }
      }
      // Thin luminous gas above and below the disc adds a soft, spatial halo.
      float radius=length(p.xz);
      float fog=exp(-p.y*p.y/.012)*smoothstep(1.05,1.4,radius)*(1.-smoothstep(2.8,3.8,radius));
      color+=transmission*vec3(.9,.78,.6)*fog*dt*.12;
      p=next; traveled+=dt;
    }
    if(!captured)color+=starfield(normalize(ray))*transmission;
  } else color=starfield(initial);
  // A fine photon ring reinforces the boundary without filling the black shadow.
  float impact=length(cross(eye,initial));
  float ring=exp(-pow((impact-1.048)/.008,2.))*.35;
  color+=vec3(1.,.9,.72)*ring;
  float vignette=1.-.18*dot(screenUV-.5,screenUV-.5);
  gl_FragColor=vec4(color*vignette,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const galaxyShader = common + `
void main() {
  vec3 ray=viewingRay(); vec2 bounds=sphereHit(eye,ray,3.75);
  vec3 color=starfield(ray)*.38;
  if(bounds.y>0.) {
    float start=max(0.,bounds.x), lengthRay=bounds.y-start;
    float ds=lengthRay/float(VOLUME_STEPS), trans=1.;
    vec3 light=vec3(0.);
    for(int step=0;step<VOLUME_STEPS;step++) {
      vec3 p=eye+ray*(start+(float(step)+.5)*ds);
      float r=length(p.xz), theta=atan(p.z,p.x);
      float spiral=theta*2.-log(r+.24)*5.4;
      float clouds=fbm(vec3(p.xz*4.,p.y*7.)+elapsed*.018);
      float arms=pow(.5+.5*cos(spiral+clouds*1.2),3.);
      float profile=exp(-p.y*p.y/(.008+r*.005));
      float edge=1.-smoothstep(2.6,3.45,r);
      float density=profile*exp(-r*.85)*(.19+arms*1.5)*(clouds*.8+.48)*edge;
      float bulge=exp(-dot(p*vec3(1.7,2.4,1.7),p*vec3(1.7,2.4,1.7)));
      vec3 diskTint=mix(vec3(1.,.77,.43),vec3(.4,.6,.97),smoothstep(.65,2.6,r));
      float lane=pow(.5+.5*cos(spiral+.65+clouds),11.)*profile*edge;
      float dust=lane*exp(-r*.4)*(clouds*.8+.2);
      vec3 emission=diskTint*density*3.5+vec3(1.,.88,.67)*bulge*7.;
      float opacity=(density*.85+dust*2.8+bulge*.25)*ds;
      light+=trans*emission*ds;
      trans*=exp(-opacity);
    }
    color=color*trans+light;
    // Embedded stars use soft circular profiles rather than square point sprites.
    if(abs(ray.y)>.001) {
      float distanceToPlane=-eye.y/ray.y;
      vec3 p=eye+ray*distanceToPlane;
      float r=length(p.xz);
      if(distanceToPlane>0. && r<3.25) {
        vec2 grid=p.xz*72., cell=floor(grid), local=fract(grid)-.5;
        float pick=hash(vec3(cell,3.));
        float star=exp(-dot(local,local)/.011)*smoothstep(.965,.997,pick);
        float glow=exp(-dot(local,local)/.065)*smoothstep(.992,1.,pick)*.2;
        color+=mix(vec3(.58,.75,1.),vec3(1.,.89,.7),hash(vec3(cell,17.)))*(star+glow)*.7*(1.-smoothstep(2.1,3.25,r));
      }
    }
  }
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

function createVolumeScene(fragmentShader, compact, kind) {
  const root = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, depthTest: false, depthWrite: false,
    defines: { RAY_STEPS: compact ? 96 : 160, VOLUME_STEPS: compact ? 48 : 88 },
    uniforms: {
      eye: { value: new THREE.Vector3() }, forward: { value: new THREE.Vector3() },
      rightward: { value: new THREE.Vector3() }, upward: { value: new THREE.Vector3() },
      projection: { value: new THREE.Vector2() }, elapsed: { value: 0 },
    },
  });
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  surface.frustumCulled = false;
  const inverse = new THREE.Matrix4(), cameraDirection = new THREE.Vector3();
  surface.onBeforeRender = (renderer, scene, camera) => {
    inverse.copy(root.matrixWorld).invert();
    material.uniforms.eye.value.copy(camera.position).applyMatrix4(inverse);
    camera.getWorldDirection(cameraDirection);
    material.uniforms.forward.value.copy(cameraDirection).transformDirection(inverse);
    material.uniforms.rightward.value.set(1, 0, 0).applyQuaternion(camera.quaternion).transformDirection(inverse);
    material.uniforms.upward.value.set(0, 1, 0).applyQuaternion(camera.quaternion).transformDirection(inverse);
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    material.uniforms.projection.value.set(tangent * camera.aspect, tangent);
  };
  root.add(surface);
  root.rotation.z = kind === 'galaxy' ? -.26 : -.12;
  if (kind === 'galaxy') root.rotation.x = .12;
  root.userData = {
    spin: root, radius: 3.55, speed: kind === 'galaxy' ? .012 : 0,
    view: new THREE.Vector3(0, kind === 'galaxy' ? .36 : .23, 1),
    update: (delta, running) => { if (running) material.uniforms.elapsed.value += delta; },
    shaderTextures: [],
  };
  return root;
}

export const createGalaxy = compact => createVolumeScene(galaxyShader, compact, 'galaxy');
export const createBlackHole = compact => createVolumeScene(blackHoleShader, compact, 'blackhole');
