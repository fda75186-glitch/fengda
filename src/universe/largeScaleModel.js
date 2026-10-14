import * as THREE from 'three';

// Fine galaxy-sized tracers; normal alpha blending bounds brightness even
// where many filaments overlap. Clusters and the cosmic web have different
// distributions. Coordinates remain an educational reconstruction.
export function createLargeScaleModel(body,{geometry,material,pointScale=600,pixelRatio=1}) {
  let seed=2166136261;for(const c of body.id)seed=Math.imul(seed^c.charCodeAt(0),16777619);
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const normal=()=>Math.sqrt(-2*Math.log(Math.max(.00001,random())))*Math.cos(random()*Math.PI*2);
  const radius=body.radius||14,web=body.kind==='web',group=new THREE.Group();
  const knots=Array.from({length:web?28:7},()=>new THREE.Vector3((random()-.5)*radius*1.5,(random()-.5)*radius*.7,(random()-.5)*radius*1.5));
  const edges=[];
  if(web)for(let i=0;i<knots.length;i++){
    const nearest=knots.map((node,j)=>({node,j,d:node.distanceTo(knots[i])})).filter(item=>item.j!==i).sort((a,b)=>a.d-b.d).slice(0,3);
    for(const item of nearest)if(item.j>i&&item.d<radius*.83)edges.push([knots[i],item.node]);
  }
  function tracers(count,haze=false){
    const positions=[],colors=[],sizes=[],angles=[],shapes=[];const color=new THREE.Color();
    for(let i=0;i<count;i++){
      let point;
      if(web&&edges.length&&random()<.79){
        const [a,b]=edges[Math.floor(random()*edges.length)],t=random(),width=radius*(haze?.019:.008)*(1+Math.sin(t*Math.PI));
        point=a.clone().lerp(b,t).add(new THREE.Vector3(normal(),normal(),normal()).multiplyScalar(width));
        point.y+=Math.sin(t*Math.PI*2)*radius*.018;
      }else{
        const origin=knots[Math.floor(random()*knots.length)];
        const spread=radius*(web?.02:.15)*(.35+random());
        point=origin.clone().add(new THREE.Vector3(normal(),normal()*.6,normal()).multiplyScalar(spread));
      }
      positions.push(...point.toArray());color.set(haze?'#527fa5':random()<.38?'#dfbc91':'#8dbdde');
      color.multiplyScalar(haze?.85:.70+random()*.15);colors.push(...color.toArray());
      sizes.push(radius*(haze?.034+random()*.018:.002+random()**4*.009));
      angles.push(random()*Math.PI*2);shapes.push(random()<.45?1:0);
    }
    const buffer=geometry(new THREE.BufferGeometry());
    buffer.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));buffer.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    buffer.setAttribute('size',new THREE.Float32BufferAttribute(sizes,1));buffer.setAttribute('angle',new THREE.Float32BufferAttribute(angles,1));buffer.setAttribute('shape',new THREE.Float32BufferAttribute(shapes,1));
    const shader=material(new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,blending:THREE.NormalBlending,toneMapped:false,
      // CSS-pixel floors keep distant tracers resolvable even when the adaptive
      // renderer lowers its buffer resolution. Small sprites use a broad round
      // profile; elliptical detail only appears once there are pixels for it.
      uniforms:{fade:{value:1},pointScale:{value:pointScale},pixelRatio:{value:pixelRatio},haze:{value:haze?1:0},spritePixels:{value:new THREE.Vector2(haze?4:2,haze?24:7)},strength:{value:haze?.14:.78}},
      vertexShader:`attribute float size;attribute float angle;attribute float shape;
        uniform float pointScale;uniform float pixelRatio;uniform vec2 spritePixels;
        varying vec3 tint;varying float rotation;varying float morphology;varying float detail;
        void main(){tint=color;rotation=angle;morphology=shape;
          vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;
          gl_PointSize=clamp(size*pointScale/max(.5,-p.z),spritePixels.x*pixelRatio,spritePixels.y*pixelRatio);
          detail=smoothstep(3.,6.,gl_PointSize/pixelRatio);
        }`,
      fragmentShader:`uniform float fade;uniform float haze;uniform float strength;varying vec3 tint;varying float rotation;varying float morphology;varying float detail;
        void main(){vec2 p=(gl_PointCoord-.5)*2.;float c=cos(rotation),s=sin(rotation);p=mat2(c,-s,s,c)*p;
          float r=length(p);if(r>1.)discard;
          float ellipse=length(p*vec2(1.,mix(1.1,2.3,morphology)));
          float core=exp(-ellipse*ellipse*18.);float a=atan(p.y,p.x);float spiral=.5+.5*cos(a*2.-r*8.);
          float profile=core*.7+exp(-ellipse*ellipse*5.)*(.17+spiral*.18);
          float resolvedProfile=mix(exp(-r*r*3.5),profile,detail);
          float alpha=mix(resolvedProfile,exp(-r*r*3.),haze)*strength*fade;
          gl_FragColor=vec4(clamp(tint,vec3(0.),vec3(.60)),alpha);
          #include <colorspace_fragment>
        }`,
    }));
    const points=new THREE.Points(buffer,shader);points.frustumCulled=false;points.name=haze?'large-scale-diffuse-filaments':'large-scale-galaxy-tracers';group.add(points);
  }
  if(web)tracers(16000,true);
  tracers(web?28000:14000);
  group.userData.tracerCount=web?44000:14000;group.userData.structure=web?'filaments':'galaxy-cluster';
  return group;
}
