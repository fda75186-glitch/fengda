import test from 'node:test';
import assert from 'node:assert/strict';
import { isObservatoryAnchorVisible, observatoryLabelOffsets } from '../src/components/observatoryLabelLayout.js';

test('zooming to Shanghai cannot leave off-screen FAST clamped to the left edge', () => {
  const labels = [{id:'fast',x:-12000,y:280,width:130,height:30},{id:'shanghai',x:700,y:350,width:100,height:30}];
  const result = observatoryLabelOffsets(labels,1000,8,600);
  assert.equal(result.has('fast'),false);
  assert.equal(result.get('shanghai'),0);
});
test('stations outside each edge and invalid projections are not eligible labels', () => {
  for (const point of [{x:-1,y:100},{x:1001,y:100},{x:100,y:-1},{x:100,y:601},{x:NaN,y:100},{x:100,y:Infinity}]) assert.equal(isObservatoryAnchorVisible(point,1000,600),false);
  assert.equal(isObservatoryAnchorVisible({x:0,y:0},1000,600),true);
});
test('label collision correction keeps real pins and only separates nearby visible names', () => {
  const labels = [{id:'beijing',x:480,y:240,anchorY:290,width:100,height:30},{id:'xinglong',x:500,y:245,anchorY:295,width:110,height:30}];
  const original = structuredClone(labels);
  const result = observatoryLabelOffsets(labels,1000,8,600);
  assert.ok(500+result.get('xinglong')-(480+result.get('beijing')) >= 112);
  assert.deepEqual(labels,original);
});
