import test from 'node:test';
import assert from 'node:assert/strict';
import { cosmicMapNodes, regionMapNodes, mapDestination, zoomMap } from '../src/universe/universeMap.js';
import { journeyStops, exoplanetStop } from '../src/universe/catalog.js';
import { wormholeState, shouldUseWormhole, createWormhole } from '../src/universe/wormhole.js';
import { readFileSync } from 'node:fs';

test('universe overview and regional maps preserve every navigable destination',()=>{
  const all=cosmicMapNodes(journeyStops);assert.equal(all.length,7);
  assert.equal(new Set(all.map(node=>node.id)).size,all.length);
  for(const node of all){assert.equal(mapDestination(node).stop,node.stop);assert.equal(mapDestination(node).bodyId,null);}
  for(const stop of journeyStops){
    const nodes=regionMapNodes(stop);assert.equal(nodes.length,stop.bodies.length);
    for(const node of nodes){assert.ok(Number.isFinite(node.x+node.y+node.radius));assert.equal(mapDestination(node).bodyId,node.body.id);assert.equal(mapDestination(node).stop,stop);assert.ok(node.x>=0&&node.x<=1000&&node.y>=0&&node.y<=600);}
  }
});
test('every archived exoplanet system can be opened as a selectable system map',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../public/universe/exoplanets.json',import.meta.url)));
  for(const system of catalog.systems){const stop=exoplanetStop(system),nodes=regionMapNodes(stop);assert.equal(nodes.length,stop.bodies.length);assert.ok(nodes.every(node=>Number.isFinite(node.x+node.y)));}
});
test('zoom preserves the point under the pointer and clamps supported scale',()=>{
  const view={zoom:1,x:30,y:-10},anchor={x:250,y:180};
  const next=zoomMap(view,1.3,anchor);
  assert.ok(Math.abs((anchor.x-view.x)/view.zoom-(anchor.x-next.x)/next.zoom)<1e-8);
  assert.ok(Math.abs((anchor.y-view.y)/view.zoom-(anchor.y-next.y)/next.zoom)<1e-8);
  assert.equal(zoomMap(view,100).zoom,6);assert.equal(zoomMap(view,.001).zoom,.65);
});
test('wormhole applies to long routes and region changes, never to ground launch or instant setup',()=>{
  assert.equal(shouldUseWormhole({distance:80,extent:90}),true);
  assert.equal(shouldUseWormhole({distance:3,extent:90}),false);
  assert.equal(shouldUseWormhole({distance:3,extent:90,crossRegion:true}),true);
  assert.equal(shouldUseWormhole({distance:80,extent:90,launch:true}),false);
  assert.equal(shouldUseWormhole({distance:80,extent:90,animate:false}),false);
});
test('wormhole enters and exits continuously, reduced motion lowers intensity, resources dispose',()=>{
  assert.equal(wormholeState(0).strength,0);assert.equal(wormholeState(1).strength,0);
  let previous=wormholeState(0);
  for(let i=1;i<=1000;i++){const state=wormholeState(i/1000);assert.ok(Math.abs(state.strength-previous.strength)<.012);assert.ok(state.strength>=0&&state.strength<=1);previous=state;}
  assert.ok(wormholeState(.5,true).strength<.25);assert.match(wormholeState(.5).phase,/穿梭/);assert.match(wormholeState(.9).phase,/驶出/);
  const effect=createWormhole();const mesh=effect.scene.children[0];let disposed=0;
  mesh.geometry.addEventListener('dispose',()=>disposed++);mesh.material.addEventListener('dispose',()=>disposed++);
  effect.update(.5,2,16/9,false);assert.equal(mesh.material.uniforms.strength.value,1);
  effect.update(.5,2,16/9,true);assert.equal(mesh.material.uniforms.motion.value,0);
  effect.dispose();assert.equal(disposed,2);
});
