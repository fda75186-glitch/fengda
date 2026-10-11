import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import './style.css';

const W=1920,H=1080,DURATION=8;
const canvas=document.querySelector('#film');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setSize(W,H,false);renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.76;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color('#050d15');
scene.fog=new THREE.FogExp2('#06101b',.007);
const camera=new THREE.PerspectiveCamera(42,W/H,.00025,200);
const pmrem=new THREE.PMREMGenerator(renderer);
const environment=pmrem.fromScene(new RoomEnvironment(),.02);
scene.environment=environment.texture;scene.environmentIntensity=.09;
scene.add(new THREE.HemisphereLight('#749ab5','#020303',.24));
function areaLight(color,intensity,position){const l=new THREE.DirectionalLight(color,intensity);l.position.set(...position);scene.add(l);return l}
areaLight('#bccede',1.9,[-1.4,3,1]);areaLight('#507c98',.5,[1,1.6,2]);areaLight('#a9c5dc',1.1,[2,2,-1]);
const light=new THREE.PointLight('#688199',.38,3,2);light.position.set(-.4,1.3,.2);scene.add(light);

const rubber=new THREE.MeshStandardMaterial({color:'#11171b',roughness:.89,metalness:.03});
const blackMetal=new THREE.MeshStandardMaterial({color:'#1b252a',roughness:.33,metalness:.8});
const brushed=new THREE.MeshStandardMaterial({color:'#98a5b0',roughness:.29,metalness:1});
const blackPaint=new THREE.MeshStandardMaterial({color:'#202932',roughness:.49,metalness:.52});
const enamel=new THREE.MeshStandardMaterial({color:'#a5afb3',roughness:.39,metalness:.12});
const anodized=new THREE.MeshStandardMaterial({color:'#747d84',roughness:.37,metalness:1});
const flatBlack=new THREE.MeshStandardMaterial({color:'#030506',roughness:.99});
const glass=new THREE.MeshPhysicalMaterial({color:'#456458',metalness:.18,roughness:.12,transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false});

function mesh(geometry,material,parent=scene,pos=[0,0,0]){const m=new THREE.Mesh(geometry,material);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function cyl(rTop,rBottom,len,material,parent,pos,segments=80){const m=mesh(new THREE.CylinderGeometry(rTop,rBottom,len,segments,1,false),material,parent,pos);m.rotation.x=Math.PI/2;return m}
function tube(inner,outer,zMin,zMax,material,parent){
  const p=[new THREE.Vector2(inner,zMin),new THREE.Vector2(outer,zMin),new THREE.Vector2(outer,zMax),new THREE.Vector2(inner,zMax),new THREE.Vector2(inner,zMin)];
  const m=mesh(new THREE.LatheGeometry(p,96),material,parent);m.rotation.x=Math.PI/2;return m;
}
function lathe(profile,material,parent){const m=mesh(new THREE.LatheGeometry(profile.map(([r,z])=>new THREE.Vector2(r,z)),120),material,parent);m.rotation.x=Math.PI/2;return m}
function ring(radius,thickness,z,material,parent){const m=mesh(new THREE.TorusGeometry(radius,thickness,12,112),material,parent,[0,0,z]);return m}
function rod(a,b,r,material,parent){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=vb.clone().sub(va);const m=mesh(new THREE.CylinderGeometry(r,r,d.length(),24),material,parent,va.add(vb).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m}

const instrument=new THREE.Group();instrument.position.y=1.54;scene.add(instrument);
// Physical proportions: 2-inch diagonal, 1.25-inch eyepiece and 90-mm refractor.
const optic=new THREE.Group();instrument.add(optic);
lathe([[.0195,.074],[.0295,.074],[.032,.078],[.0325,.085],[.031,.092],[.0285,.096],[.019,.096],[.0185,.091],[.0195,.074]],rubber,optic);
ring(.0288,.0014,.089,rubber,optic);ring(.0296,.0005,.078,blackMetal,optic);
tube(.0175,.0278,.023,.074,blackMetal,optic);
ring(.0281,.0006,.065,brushed,optic);ring(.0281,.00045,.055,anodized,optic);
// Dense machined knurling, not a single smooth plastic cylinder.
for(let i=0;i<140;i++){const a=i*Math.PI*2/140;const rib=mesh(new THREE.BoxGeometry(.00055,.00075,.024),i%4===0?anodized:blackMetal,optic,[Math.cos(a)*.0282,Math.sin(a)*.0282,.04]);rib.rotation.z=a;}
tube(.0175,.021,.000,.023,brushed,optic);tube(.0175,.0204,-.045,0,blackMetal,optic);
ring(.0206,.0006,-.025,brushed,optic);
for(let i=0;i<7;i++){ring(.017,.0008,.068-i*.013,flatBlack,optic);}
const lens=mesh(new THREE.CircleGeometry(.0173,96),glass,optic,[0,0,.069]);
const frontGlint=mesh(new THREE.TorusGeometry(.016,.00012,5,96,Math.PI*.47),new THREE.MeshBasicMaterial({color:'#536d77',transparent:true,opacity:.24}),optic,[0,0,.0692]);frontGlint.rotation.z=2.3;
// Eyepiece set screw and diagonal housing. The body is behind the optical opening.
const diagonal=new THREE.Group();diagonal.position.z=-.086;instrument.add(diagonal);
mesh(new THREE.BoxGeometry(.069,.071,.06),blackPaint,diagonal,[0,-.025,0]);
mesh(new THREE.BoxGeometry(.059,.004,.052),anodized,diagonal,[0,.012,0]);
for(const x of [-.025,.025])for(const y of [-.05,-.004]){const s=cyl(.0025,.0025,.001,brushed,diagonal,[x,y,.031],16);mesh(new THREE.BoxGeometry(.0028,.00045,.0003),flatBlack,diagonal,[x,y,.0316]);}
rod([.025,.002,.006],[.043,.002,.006],.0035,brushed,instrument);cyl(.006,.006,.009,blackMetal,instrument,[.047,.002,.006],36).rotation.y=Math.PI/2;

// Telescope tube axis is at 90 degrees to the eyepiece and pitched toward the sky.
const barrel=new THREE.Group();barrel.position.set(.016,-.05,-.10);barrel.rotation.z=-Math.PI*.29;instrument.add(barrel);
const mainTube=mesh(new THREE.CylinderGeometry(.047,.047,.59,100),enamel,barrel,[0,.30,0]);
const rearFocuser=mesh(new THREE.CylinderGeometry(.037,.039,.072,80),blackPaint,barrel,[0,.02,0]);
for(const yy of [-.014,.025,.055,.17,.48,.59]){const collar=mesh(new THREE.CylinderGeometry(yy>.57?.052:.049,yy>.57?.052:.049,.008,80),yy>.57?blackPaint:anodized,barrel,[0,yy,0]);}
const shade=mesh(new THREE.CylinderGeometry(.054,.05,.14,100),blackPaint,barrel,[0,.647,0]);
const objective=mesh(new THREE.CircleGeometry(.047,96),glass,barrel,[0,.719,0]);objective.rotation.x=-Math.PI/2;
// Focus controls show brass/silver shafts, caps, hub divisions and realistic scale.
for(const s of [-1,1]){rod([0,.026,0],[s*.075,.026,0],.004,brushed,barrel);const knob=mesh(new THREE.CylinderGeometry(.018,.018,.011,80),blackMetal,barrel,[s*.07,.026,0]);knob.rotation.z=Math.PI/2;
for(let i=0;i<48;i++){const a=i*Math.PI*2/48;mesh(new THREE.BoxGeometry(.001,.001,.009),anodized,barrel,[s*.07,.026+Math.cos(a)*.0182,Math.sin(a)*.0182]);}
if(s===1){rod([.074,.026,0],[.096,.026,0],.003,brushed,barrel);const fine=mesh(new THREE.CylinderGeometry(.010,.010,.009,64),new THREE.MeshStandardMaterial({color:'#84745a',roughness:.38,metalness:1}),barrel,[.09,.026,0]);fine.rotation.z=Math.PI/2;for(let i=0;i<56;i++){const a=i*Math.PI*2/56;mesh(new THREE.BoxGeometry(.001,.0007,.006),blackMetal,barrel,[.090,.026+Math.cos(a)*.0102,Math.sin(a)*.0102]);}}}
// Fine finder scope sits alongside the objective tube.
const finder=new THREE.Group();finder.position.set(.082,.4,0);barrel.add(finder);
mesh(new THREE.CylinderGeometry(.012,.012,.175,48),blackPaint,finder);
for(const y of [-.09,.09])mesh(new THREE.CylinderGeometry(.014,.014,.013,48),rubber,finder,[0,y,0]);
rod([.037,.34,0],[.077,.34,0],.004,brushed,barrel);rod([.037,.47,0],[.077,.47,0],.004,brushed,barrel);
// Mount below the view, with separated rings/rails/hinges to provide foreground parallax.
for(const y of [.2,.43]){const bracket=mesh(new THREE.TorusGeometry(.049,.004,10,80),blackPaint,barrel,[0,y,0]);bracket.rotation.x=Math.PI/2;}
mesh(new THREE.BoxGeometry(.055,.30,.018),blackMetal,barrel,[0,.32,-.061]);
const mount=new THREE.Group();mount.position.set(.11,-.27,-.14);instrument.add(mount);
mesh(new THREE.BoxGeometry(.11,.035,.10),anodized,mount);
rod([.10,-.27,-.15],[.18,.1,-.15],.018,blackPaint,instrument);
mesh(new THREE.BoxGeometry(.085,.05,.09),blackPaint,instrument,[.18,.1,-.15]);
const eq=mesh(new THREE.CylinderGeometry(.042,.042,.15,64),blackPaint,mount,[0,-.07,0]);eq.rotation.z=-.35;
rod([0,-.12,0],[-.11,-.3,.04],.009,brushed,mount);
const weight=mesh(new THREE.CylinderGeometry(.047,.047,.055,64),blackPaint,mount,[-.10,-.28,.036]);weight.rotation.z=-.48;
rod([0,-.14,0],[0,-1.02,0],.019,brushed,mount);
for(let i=0;i<3;i++){const a=i*Math.PI*2/3;rod([0,-.30,0],[Math.cos(a)*.43,-1.23,Math.sin(a)*.43],.011,brushed,mount);rod([0,-.53,0],[Math.cos(a)*.26,-.86,Math.sin(a)*.26],.003,blackMetal,mount);}

// Sparse distant photographic star field; its depth remains far beyond the instrument.
const loader=new THREE.TextureLoader();
const moonTexture=await loader.loadAsync(`${import.meta.env.BASE_URL}moon-view.jpg`);
moonTexture.colorSpace=THREE.SRGBColorSpace;
const backgroundVideo=document.createElement('video');
backgroundVideo.src=`${import.meta.env.BASE_URL}telescope-ground-background.mp4`;
backgroundVideo.muted=true;backgroundVideo.playsInline=true;backgroundVideo.preload='auto';
await new Promise((resolve,reject)=>{backgroundVideo.addEventListener('loadeddata',resolve,{once:true});backgroundVideo.addEventListener('error',()=>reject(new Error('远景实拍素材载入失败')),{once:true});backgroundVideo.load();});
const backgroundTexture=new THREE.VideoTexture(backgroundVideo);backgroundTexture.colorSpace=THREE.SRGBColorSpace;
const backdropMaterial=new THREE.MeshBasicMaterial({map:backgroundTexture,color:'#ffffff',fog:false,toneMapped:false});
const backdrop=mesh(new THREE.PlaneGeometry(100,56.25),backdropMaterial,scene,[0,1.54,-50]);
// Moon is a dim optical image at depth, framed by real geometry. It casts no light.
const moonView=mesh(new THREE.PlaneGeometry(.022,.012375),new THREE.MeshBasicMaterial({map:moonTexture,color:'#c0c7ce',fog:false}),optic,[0,0,-.045]);
// A real dark optical field stop closes the eyepiece behind its virtual lunar image.
// The external tube/diagonal is not allowed to shine through the inside of the optic.
mesh(new THREE.CircleGeometry(.046,96),new THREE.MeshBasicMaterial({color:'#000000',fog:false,side:THREE.DoubleSide}),optic,[0,0,-.048]);
// Intentionally no procedural floor/ridges: the shot is an optical instrument close-up.
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));
const bokeh=new BokehPass(scene,camera,{focus:.22,aperture:.000021,maxblur:.016,width:W,height:H});composer.addPass(bokeh);composer.addPass(new OutputPass());
composer.setSize(W,H);

const smooth=t=>t*t*(3-2*t);
function pose(seconds){
  const t=Math.min(1,Math.max(0,seconds/DURATION));
  // Shoulder/eye shift (0–2 s), actual dolly (2–7.7 s), then enter the dark optical edge.
  const align=smooth(Math.min(1,t/.25));
  const advance=smooth(Math.max(0,(t-.21)/.79));
  const z=THREE.MathUtils.lerp(.30,-.012,advance);
  const x=THREE.MathUtils.lerp(.08,0,align);
  const y=1.54+THREE.MathUtils.lerp(.03,0,align);
  const breathing=Math.sin(t*Math.PI*2)*.0012*(1-advance);
  camera.position.set(x+breathing,y+breathing*.6,z);
  // Once the eye crosses the rubber cup, only the eyepiece's internal optical volume is visible.
  // This culling models the opaque baffle, rather than introducing a screen-space circle wipe.
  for(const part of instrument.children){if(part!==optic)part.visible=z>.105;}
  const sight=new THREE.Vector3(0,1.54,-.080);
  camera.lookAt(sight);
  // Focus converges with physical camera-to-eyepiece distance, then changes to the optical image.
  bokeh.uniforms.focus.value=THREE.MathUtils.lerp(Math.max(.025,Math.abs(z-.065)),Math.max(.012,z+.045),smooth(Math.max(0,(advance-.83)/.17)));
  bokeh.uniforms.aperture.value=THREE.MathUtils.lerp(.000021,.0000007,advance);
  camera.updateMatrixWorld();composer.render();
}
export async function renderFrameAt(seconds){
  backgroundVideo.pause();
  const stamp=Math.min(Math.max(0,seconds),Math.max(0,backgroundVideo.duration-1/30));
  if(Math.abs(backgroundVideo.currentTime-stamp)>.0001){await new Promise((resolve,reject)=>{backgroundVideo.addEventListener('seeked',resolve,{once:true});backgroundVideo.addEventListener('error',reject,{once:true});backgroundVideo.currentTime=stamp;});}
  pose(seconds);
}
pose(0);
const recordButton=document.querySelector('#record'),previewButton=document.querySelector('#preview'),resetButton=document.querySelector('#reset'),progress=document.querySelector('#progress'),download=document.querySelector('#download');
let running=false,objectURL;
for(const btn of [recordButton,previewButton,resetButton])btn.disabled=false;
recordButton.textContent='开始录制 8 秒';progress.textContent='已就绪 · 真实三维摄像机推进';
function controls(disabled){for(const btn of [recordButton,previewButton,resetButton])btn.disabled=disabled;}
async function animate(record){
  if(running)return;running=true;controls(true);download.hidden=true;pose(0);
  backgroundVideo.currentTime=0;await backgroundVideo.play();
  let recorder,stream;const chunks=[];
  if(record){stream=canvas.captureStream(30);const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(x=>MediaRecorder.isTypeSupported(x));recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:18000000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};recorder.start();}
  const started=performance.now();
  await new Promise(resolve=>{function frame(now){const secs=Math.min(DURATION,(now-started)/1000);pose(secs);progress.textContent=`${record?'录制':'预览'} ${secs.toFixed(1)} / ${DURATION}.0 秒`;if(secs<DURATION)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame)});
  if(recorder){await new Promise(resolve=>{recorder.onstop=resolve;recorder.stop()});stream.getTracks().forEach(t=>t.stop());if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(new Blob(chunks,{type:recorder.mimeType}));download.href=objectURL;download.download='telescope-first-person-dolly-8s.webm';download.hidden=false;download.textContent='下载 WebM 素材';progress.textContent='录制完成 · 8 秒第一人称推进';}
  else progress.textContent='预览结束 · 可录制或回到开始';
  backgroundVideo.pause();
  running=false;controls(false);
}
recordButton.addEventListener('click',()=>animate(true).catch(e=>{progress.textContent=`录制失败：${e.message}`;running=false;controls(false)}));previewButton.addEventListener('click',()=>animate(false));resetButton.addEventListener('click',()=>{backgroundVideo.pause();backgroundVideo.currentTime=0;backgroundVideo.addEventListener('seeked',()=>pose(0),{once:true});pose(0);progress.textContent='已回到开始'});
