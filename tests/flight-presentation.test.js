import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { systemOverview, arrangeFlightLabels, rectanglesOverlap } from '../src/universe/flightPresentation.js';
import { useFlightDepth } from '../src/universe/flightDepth.js';
import { journeyStops } from '../src/universe/catalog.js';
import { createGalaxyModel } from '../src/universe/galaxyModel.js';

const entries = journeyStops.find(stop=>stop.id==='solar').bodies.map(body=>({body,position:new THREE.Vector3(...body.position),radius:body.radius*(body.ring?2.3:1)}));
test('major solar bodies stay framed in portrait and landscape with a closer overview',()=>{
  for(const aspect of [390/844,1,16/9,21/9]){
    const pose=systemOverview(entries,58,aspect), camera=new THREE.PerspectiveCamera(58,aspect,.01,20000);
    camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld(true);
    for(const entry of entries.filter(item=>!/moon|dwarf/.test(item.body.kind))){
      for(const direction of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]){
        const point=entry.position.clone().addScaledVector(direction,entry.radius).project(camera);
        assert.ok(Math.abs(point.x)<.87&&Math.abs(point.y)<.87,`${aspect} ${entry.body.id} clipped`);
      }
    }
    const bounds=new THREE.Box3();for(const entry of entries){bounds.expandByPoint(entry.position.clone().addScalar(entry.radius*1.1));bounds.expandByPoint(entry.position.clone().addScalar(-entry.radius*1.1));}
    const oldDistance=bounds.getSize(new THREE.Vector3()).length()/2/Math.sin(Math.atan(Math.tan(THREE.MathUtils.degToRad(29))*Math.min(1,aspect)))*.94;
    assert.ok(pose.position.distanceTo(pose.target)<oldDistance*.82,'overview must be materially closer');
  }
});
test('crowded labels never overlap each other or the information panel, selected target wins',()=>{
  const panel={left:800,right:1080,top:120,bottom:600};
  const labels=Array.from({length:29},(_,i)=>({id:`planet-${i}`,name:`行星 ${i}`,x:530+i%3*7,y:310+i%4*8,visible:true,priority:1,selected:i===28}));
  const layout=arrangeFlightLabels(labels,1100,720,[panel]),visible=layout.filter(item=>item.visible);
  assert.ok(visible.length>1&&visible.length<29);
  assert.ok(visible.some(item=>item.id==='planet-28'));
  for(const [index,item] of visible.entries()){
    assert.ok(!rectanglesOverlap(item.rect,panel));
    for(const other of visible.slice(index+1))assert.ok(!rectanglesOverlap(item.rect,other.rect));
    assert.ok(Math.hypot(item.x-item.anchorX,item.y-item.anchorY)<150);
  }
  assert.deepEqual(layout,arrangeFlightLabels(labels,1100,720,[panel]));
});
test('labels respect small screen bounds and reject invalid or behind-camera points',()=>{
  const labels=[{id:'edge',name:'很长的恒星系统名称',x:20,y:60,visible:true},{id:'bad',name:'invalid',x:NaN,y:50,visible:true},{id:'back',name:'behind',x:160,y:240,visible:false}];
  const layout=arrangeFlightLabels(labels,320,480);
  assert.ok(!layout.find(item=>item.id==='bad').visible&&!layout.find(item=>item.id==='back').visible);
  for(const item of layout.filter(item=>item.visible))assert.ok(item.rect.left>=12&&item.rect.right<=308&&item.rect.top>=16&&item.rect.bottom<=458);
});
test('custom shaders consistently share logarithmic depth, without injecting chunks twice',()=>{
  const shader=new THREE.ShaderMaterial({vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'void main(){gl_FragColor=vec4(1.);}'});
  useFlightDepth(shader); const before=shader.vertexShader;useFlightDepth(shader);
  assert.equal(shader.vertexShader,before);
  for(const chunk of ['common','logdepthbuf_pars_vertex','logdepthbuf_vertex'])assert.ok(shader.vertexShader.includes(`#include <${chunk}>`));
  for(const chunk of ['logdepthbuf_pars_fragment','logdepthbuf_fragment'])assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`));
  shader.dispose();
});
test('detailed galaxies retain finite volumetric stars, fine point sizes, dust and bounded draw calls',()=>{
  for(const compact of [false,true]){
    const resources=[], geometry=g=>(resources.push(g),g), material=m=>(resources.push(m),useFlightDepth(m));
    const galaxy=createGalaxyModel({id:'milky-way-disc',radius:12},{compact,geometry,material,pointCloud:(positions,colors,sizes)=>{
      assert.equal(positions.length,colors.length);assert.equal(positions.length,sizes.length*3);
      assert.ok(sizes.every(value=>value>0&&value<.17));assert.ok(positions.every(Number.isFinite));
      assert.ok(positions.some((value,i)=>i%3===1&&Math.abs(value)>.2),'bulge has actual depth');
      const g=geometry(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      return new THREE.Points(g,material(new THREE.PointsMaterial()));
    }});
    assert.equal(galaxy.userData.starCount,compact?18000:64000);
    assert.equal(galaxy.children.length,2,'detail must not create one draw call per star');
    assert.ok(galaxy.getObjectByName('galaxy-dust-and-stellar-disc'));
    resources.forEach(value=>value.dispose());
  }
});
