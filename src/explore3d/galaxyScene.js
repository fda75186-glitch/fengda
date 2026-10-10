import * as THREE from 'three';
import { assetUrl } from '../assets.js';

const vertexShader = `
varying vec2 screenUV;
void main(){screenUV=uv;gl_Position=vec4(position.xy,0.,1.);}
`;

// A textured volume rather than a flat image: the disk has finite thickness,
// a spherical central bulge, and a view-dependent path through its dusty layers.
const fragmentShader = `
precision highp float;
varying vec2 screenUV;
uniform vec3 eye,forward,rightward,upward;
uniform vec2 projection;
uniform sampler2D galaxyMap;
const float PI=3.14159265359;
float hash(vec3 p){p=fract(p*vec3(.1031,.11369,.13787));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
vec3 sky(vec3 direction){
  vec2 sphere=vec2(atan(direction.z,direction.x)/(2.*PI)+.5,asin(clamp(direction.y,-1.,1.))/PI+.5);
  float mist=noise(direction*8.)*.65+noise(direction*21.)*.35;
  vec3 color=vec3(.0018,.003,.009)+vec3(.004,.008,.024)*pow(mist,3.);
  for(int layer=0;layer<2;layer++){
    float scale=layer==0?340.:610.;
    vec2 grid=sphere*vec2(scale,scale*.5),cell=floor(grid),local=fract(grid);
    float pick=hash(vec3(cell,float(layer)*21.));
    vec2 center=vec2(hash(vec3(cell,7.)),hash(vec3(cell,23.)))*.6+.2;
    float distance=length(local-center),size=mix(.025,.08,hash(vec3(cell,39.)));
    float point=exp(-distance*distance/(size*size));
    float halo=exp(-distance*distance/.02)*.08;
    float mask=smoothstep(.978,.997,pick);
    color+=mix(vec3(.45,.66,1.),vec3(1.,.87,.69),hash(vec3(cell,57.)))*(point+halo)*mask*.7;
  }
  return color;
}
void main(){
  vec2 pixel=(screenUV*2.-1.)*projection;
  vec3 direction=normalize(forward+pixel.x*rightward+pixel.y*upward);
  vec3 background=sky(direction),light=vec3(0.);
  float b=dot(eye,direction),h=b*b-dot(eye,eye)+3.7*3.7;
  float trans=1.;
  if(h>0.){
    h=sqrt(h);
    float start=max(0.,-b-h),finish=-b+h;
    if(finish>start){
      float ds=(finish-start)/float(VOLUME_STEPS);
      for(int step=0;step<VOLUME_STEPS;step++){
        vec3 p=eye+direction*(start+(float(step)+.5)*ds);
        float radius=length(p.xz);
        if(radius>3.5)continue;
        vec2 mapUV=p.xz/7.+.5;
        // Tiny, depth-dependent offsets give parallax within the disk without
        // smearing the reference-led filaments into smooth geometric spirals.
        mapUV+=p.y*vec2(.012,-.009)*smoothstep(.2,2.,radius);
        vec4 texel=texture2D(galaxyMap,mapUV);
        float thickness=.045+.06*exp(-radius*radius/.28)+.012*radius;
        float vertical=exp(-p.y*p.y/(thickness*thickness));
        float edge=1.-smoothstep(3.1,3.5,radius);
        float opacity=texel.a*vertical*edge*7.;
        float layerAlpha=1.-exp(-opacity*ds);
        // Read the warm core, blue arms and dark dust directly from the detailed
        // illustration; saturation and texture contrast survive volume compositing.
        vec3 emission=texel.rgb*2.2;
        float bulge=exp(-dot(p*vec3(5.5,7.,5.5),p*vec3(5.5,7.,5.5)));
        emission+=vec3(1.,.9,.67)*bulge*.85;
        light+=trans*emission*layerAlpha;
        trans*=1.-layerAlpha;
        if(trans<.015)break;
      }
    }
  }
  gl_FragColor=vec4(background*trans+light,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export async function createGalaxy(compact) {
  const texture = await new THREE.TextureLoader().loadAsync(assetUrl('/textures/galaxy-reference-v3.png'));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = compact ? 2 : 4;
  const root = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, depthTest: false, depthWrite: false,
    defines: { VOLUME_STEPS: compact ? 88 : 160 },
    uniforms: {
      eye: { value: new THREE.Vector3() }, forward: { value: new THREE.Vector3() },
      rightward: { value: new THREE.Vector3() }, upward: { value: new THREE.Vector3() },
      projection: { value: new THREE.Vector2() }, galaxyMap: { value: texture },
    },
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2,2), material);
  plane.frustumCulled = false;
  const inverse = new THREE.Matrix4(), direction = new THREE.Vector3();
  plane.onBeforeRender = (renderer, scene, camera) => {
    inverse.copy(root.matrixWorld).invert();
    material.uniforms.eye.value.copy(camera.position).applyMatrix4(inverse);
    camera.getWorldDirection(direction);
    material.uniforms.forward.value.copy(direction).transformDirection(inverse);
    material.uniforms.rightward.value.set(1,0,0).applyQuaternion(camera.quaternion).transformDirection(inverse);
    material.uniforms.upward.value.set(0,1,0).applyQuaternion(camera.quaternion).transformDirection(inverse);
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    material.uniforms.projection.value.set(tangent*camera.aspect,tangent);
  };
  root.add(plane);
  root.rotation.z = -.36;
  root.rotation.x = .08;
  root.userData = {
    spin: root, radius: 3.4, speed: .005,
    view: new THREE.Vector3(0,.68,1),
  };
  return root;
}
