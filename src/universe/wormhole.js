import * as THREE from 'three';
const smooth = (a,b,x) => {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function wormholeState(progress, reducedMotion=false) {
  const p=Math.max(0,Math.min(1,Number(progress)||0));
  return {strength:smooth(0,.17,p)*(1-smooth(.77,1,p))*(reducedMotion?.22:1),boost:smooth(.06,.4,p)*(1-smooth(.67,.96,p)),phase:p<.2?'虫洞入口 · 引擎加速':p<.76?'虫洞穿梭 · 跨越深空':'驶出虫洞 · 减速抵达'};
}
export function shouldUseWormhole({distance,extent,clearance=0,crossRegion=false,launch=false,animate=true}) {
  return !!animate && !launch && (crossRegion || distance>Math.max(12,extent*.48,clearance*160));
}
export function createWormhole() {
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);
  const geometry=new THREE.PlaneGeometry(2,2);
  const material=new THREE.ShaderMaterial({transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    uniforms:{strength:{value:0},boost:{value:0},time:{value:0},aspect:{value:1},motion:{value:1}},
    vertexShader:'varying vec2 tunnelUV;void main(){tunnelUV=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 tunnelUV;uniform float strength;uniform float boost;uniform float time;uniform float aspect;uniform float motion;
      float hash(float x){return fract(sin(x*127.1)*43758.5453);}
      void main(){
        vec2 p=(tunnelUV-.5)*2.;p.x*=aspect;float r=length(p),a=atan(p.y,p.x);
        float z=1./max(r,.035),flow=(time*.48+time*time*.14)*motion;
        float twist=a+z*.13-flow*.15;
        float bands=pow(.5+.5*sin(z*4.8-flow*9.+sin(twist*5.)*.5),12.);
        float filaments=pow(.5+.5*sin(twist*27.+sin(z*1.9-flow*3.)),18.);
        float lane=floor((a+3.141593)*85.);float starPhase=fract(z*.16-flow*(.24+hash(lane)*.25)+hash(lane+9.));
        float streak=pow(max(0.,1.-abs(starPhase-.5)*2.),mix(70.,9.,boost));
        streak*=pow(.5+.5*cos(a*170.),36.)*step(.75,hash(lane));
        float rim=exp(-pow((r-(.12+strength*1.6))/.07,2.));
        float tunnel=(bands*.33+filaments*.2+streak*(.55+boost))*(1.-exp(-r*3.));
        vec3 color=vec3(.055,.18,.29)+vec3(.24,.63,.82)*tunnel+vec3(.8,.68,.4)*rim*.7;
        color+=vec3(.10,.17,.22)*pow(max(0.,1.-r),8.);
        float portal=1.-smoothstep(.06+strength*2.4,.19+strength*2.4,r);
        gl_FragColor=vec4(color,portal*strength);
      }`});
  scene.add(new THREE.Mesh(geometry,material));
  return {scene,camera,update(progress,time,aspect,reducedMotion){const state=wormholeState(progress,reducedMotion);material.uniforms.strength.value=state.strength;material.uniforms.boost.value=state.boost;material.uniforms.time.value=time;material.uniforms.aspect.value=aspect;material.uniforms.motion.value=reducedMotion?0:1;return state;},dispose(){geometry.dispose();material.dispose();scene.clear();}};
}
