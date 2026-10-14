import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { journeyStops } from '../src/universe/catalog.js';
import { explorationFor,branchStops,scaleIndex } from '../src/universe/exploration.js';
import { createLargeScaleModel } from '../src/universe/largeScaleModel.js';
import { createGalaxyModel } from '../src/universe/galaxyModel.js';
import { planSafeFlight,obstacleRadius } from '../src/universe/flightNavigation.js';
import { regionMapNodes } from '../src/universe/universeMap.js';
import { systemOverview } from '../src/universe/flightPresentation.js';

test('every interactive cosmic structure has an internal exploration destination',()=>{
  const cosmic=journeyStops.find(stop=>stop.id==='cosmic');
  for(const body of cosmic.bodies)assert.ok(explorationFor(body,null,cosmic),body.id);
  const filament=explorationFor(cosmic.bodies.find(body=>body.id==='cosmic-web'),null,cosmic);
  for(const body of filament.bodies.filter(item=>!item.nonInteractive))assert.ok(explorationFor(body,null,filament));
});
test('all named galaxies can enter internal stars and return to their parent region',()=>{
  const regions=[journeyStops.find(stop=>stop.id==='local-group'),branchStops.find(stop=>stop.id==='virgo')];
  for(const region of regions)for(const galaxy of region.bodies.filter(item=>item.kind==='galaxy'&&!item.targetStop)){
    const inside=explorationFor(galaxy,null,region);assert.equal(inside.returnStop,region);
    assert.equal(scaleIndex(inside),scaleIndex(region));assert.ok(inside.entryPose);
    const stars=inside.bodies.filter(item=>item.demonstrationSystem);assert.equal(stars.length,8);
    for(const star of stars){const system=explorationFor(star,null,inside);assert.equal(system.returnStop,inside);assert.equal(system.bodies.filter(body=>body.kind==='planet').length,4);assert.match(system.description,/不表示观测/);assert.ok(system.bodies.filter(body=>body.kind==='planet').every(body=>body.name.includes('示意')));}
  }
});
test('background tracers are excluded from map selection and never become solid obstacles',()=>{
  for(const region of branchStops){
    const map=regionMapNodes(region);assert.equal(map.length,region.bodies.filter(body=>!body.nonInteractive).length);
    for(const body of region.bodies.filter(body=>body.nonInteractive)){assert.equal(explorationFor(body,null,region),null);assert.equal(obstacleRadius(body),0);assert.ok(!map.some(node=>node.id===body.id));}
  }
});
test('cosmic tracers have finite fine geometry with bounded normal blending and no wire triangles',()=>{
  for(const kind of ['cluster','web']){
    const resources=[],geometry=value=>(resources.push(value),value),material=value=>(resources.push(value),value);
    const model=createLargeScaleModel({id:'test-'+kind,kind,radius:14},{geometry,material});
    assert.equal(model.userData.structure,kind==='web'?'filaments':'galaxy-cluster');
    assert.equal(model.children.length,kind==='web'?2:1);
    for(const child of model.children){
      assert.ok(child.isPoints&&!child.isLineSegments);assert.equal(child.material.blending,THREE.NormalBlending);
      const colors=child.geometry.getAttribute('color').array,positions=child.geometry.getAttribute('position').array;
      assert.ok([...positions].every(Number.isFinite));assert.ok([...colors].every(value=>value>=0&&value<.65));
      assert.ok(child.material.uniforms.spritePixels.value.y<=24);
      assert.match(child.material.fragmentShader,/#include <colorspace_fragment>/);
    }
    resources.forEach(value=>value.dispose());
  }
});
test('cosmic overview tracers retain a resolvable footprint at desktop, narrow and adaptive resolutions',()=>{
  const cosmic=journeyStops.find(stop=>stop.id==='cosmic');
  const entries=cosmic.bodies.map(body=>({body,radius:body.radius,position:new THREE.Vector3(...body.position)}));
  for(const [width,height] of [[750,693],[1280,720],[375,720]])for(const ratio of [.85,1,1.7]){
    const pose=systemOverview(entries,55,width/height),camera=new THREE.PerspectiveCamera(55,width/height,.01,10000);
    camera.position.copy(pose.position);camera.lookAt(pose.target);camera.updateMatrixWorld(true);
    for(const body of cosmic.bodies){
      const resources=[],track=value=>(resources.push(value),value);
      const model=createLargeScaleModel(body,{geometry:track,material:track,pointScale:height*ratio*.88,pixelRatio:ratio});
      const points=model.getObjectByName('large-scale-galaxy-tracers');
      const {pointScale,pixelRatio,spritePixels,strength}=points.material.uniforms;
      const positions=points.geometry.getAttribute('position'),sizes=points.geometry.getAttribute('size');
      let visible=0,legacySubpixel=0;
      for(let i=0;i<positions.count;i+=17){
        const point=new THREE.Vector3().fromBufferAttribute(positions,i).add(new THREE.Vector3(...body.position));
        const ndc=point.clone().project(camera);if(Math.abs(ndc.x)>1||Math.abs(ndc.y)>1)continue;
        const depth=-point.applyMatrix4(camera.matrixWorldInverse).z;if(depth<=0)continue;
        const projected=sizes.getX(i)*pointScale.value/Math.max(.5,depth);
        if(Math.max(.65,projected)<1)legacySubpixel++;
        const pixels=THREE.MathUtils.clamp(projected,spritePixels.value.x*pixelRatio.value,spritePixels.value.y*pixelRatio.value);
        assert.ok(pixels>=1.5,'a subpixel tracer loses its core during rasterization');
        assert.ok(pixels/ratio<=7.01,'nearby tracers must not become giant blobs');
        visible++;
      }
      assert.ok(visible>100);assert.ok(legacySubpixel>0,'exercise the reported distant-particle case');
      // Two-CSS-pixel sprites need a broad, readable profile, not a narrow
      // elliptical core meant for close-up galaxies.
      assert.ok(Math.exp(-.5*.5*3.5)*strength.value>.25);
      assert.match(points.material.vertexShader,/detail=smoothstep\(3\.,6\.,gl_PointSize\/pixelRatio\)/);
      assert.match(points.material.fragmentShader,/mix\(exp\(-r\*r\*3.5\),profile,detail\)/);
      resources.forEach(value=>value.dispose());
    }
  }
});
test('elliptical galaxies use a volume and smooth halo rather than a spiral disc',()=>{
  const resources=[],geometry=g=>(resources.push(g),g),material=m=>(resources.push(m),m);
  const model=createGalaxyModel({id:'m87',radius:5,morphology:'elliptical'},{compact:true,geometry,material,pointCloud:(positions,colors,sizes)=>{
    const g=geometry(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));return new THREE.Points(g,material(new THREE.PointsMaterial()));
  }});
  assert.ok(model.getObjectByName('elliptical-volume-stars'));assert.ok(model.getObjectByName('elliptical-stellar-halo'));assert.ok(!model.getObjectByName('galaxy-dust-and-stellar-disc'));
  resources.forEach(value=>value.dispose());
});
test('new internal routes keep full hull clearance around sampled stars and planets',()=>{
  const virgo=branchStops.find(stop=>stop.id==='virgo'),inside=explorationFor(virgo.bodies[0],null,virgo);
  const sample=explorationFor(inside.bodies.find(body=>body.demonstrationSystem),null,inside);
  const obstacles=sample.bodies.map(body=>({id:body.id,center:new THREE.Vector3(...body.position),radius:obstacleRadius(body)}));
  const start=new THREE.Vector3(0,5,22),clearance=.05;
  for(const body of sample.bodies){
    const target=new THREE.Vector3(...body.position).add(new THREE.Vector3(0,body.radius*2.9,0));
    const plan=planSafeFlight(start,target,obstacles,clearance);
    for(let i=0;i<=80;i++){const point=plan.curve.getPoint(i/80);for(const obstacle of obstacles)assert.ok(point.distanceTo(obstacle.center)>obstacle.radius+clearance-1e-4);}
  }
});
