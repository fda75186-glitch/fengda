import test from 'node:test';
import assert from 'node:assert/strict';
import { clampPosition, restorePosition, isDragGesture } from '../src/interaction.js';

test('悬浮助手拖到视口外时回到可见范围', () => {
  assert.deepEqual(clampPosition({x:-80,y:900},{width:390,height:844},{width:192,height:60}),{x:12,y:772});
});
test('小屏调整后已保存的位置不会落在屏幕外', () => {
  assert.deepEqual(restorePosition({x:1200,y:850},{width:320,height:640},{width:192,height:60}),{x:116,y:568});
  assert.deepEqual(restorePosition(null,{width:1440,height:900},{width:192,height:60}),{x:1224,y:816});
});
test('损坏的持久化位置回退到右下角', () => {
  assert.deepEqual(restorePosition({x:'invalid',y:NaN},{width:390,height:844},{width:192,height:60}),{x:174,y:760});
});
test('拖动阈值区分点击和拖动，不会误打开助手', () => {
  assert.equal(isDragGesture({x:50,y:50},{x:53,y:52}),false);
  assert.equal(isDragGesture({x:50,y:50},{x:60,y:50}),true);
});
