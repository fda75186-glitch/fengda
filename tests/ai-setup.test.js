import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { createSetupServer, validateSettings } from '../tools/configure-tencent-ai.mjs';

test('local AI setup validates official Tencent endpoints and never accepts a supplied URL',()=>{
  const valid=validateSettings({service:'tokenhub',key:'test-not-a-real-key',model:'hy3'});
  assert.equal(valid.TENCENT_AI_ENDPOINT,'https://tokenhub.tencentmaas.com/v1/chat/completions');
  for(const change of [{service:'http://127.0.0.1:1'},{key:'short'},{key:'test\nheader-injection'},{key:'sk-tp-token-plan'},{model:'hy3\nAuthorization: injected'}])assert.throws(()=>validateSettings({service:'tokenhub',key:'test-not-a-real-key',model:'hy3',...change}));
});
test('local password form needs nonce and same-origin POST, saves ignored settings without echoing the key',async()=>{
  const folder=await mkdtemp(join(tmpdir(),'xingyu-ai-setup-')),configFile=join(folder,'.env.ai.local.json');
  const app=await createSetupServer({configFile});
  try{
    const url=new URL(app.url),nonce=url.pathname.split('/').at(-1);
    const page=await fetch(app.url);assert.equal(page.status,200);
    assert.equal(page.headers.get('Cache-Control'),'no-store');assert.match(await page.text(),/type="password"/);
    assert.equal((await fetch(new URL('/configure/wrong',url))).status,404);
    const data=new URLSearchParams({service:'tokenhub',key:'private-test-value-only',model:'hy3',nonce});
    assert.equal((await fetch(app.url,{method:'POST',body:data,headers:{Origin:'https://hostile.invalid'}})).status,403);
    const response=await fetch(app.url,{method:'POST',body:data,headers:{Origin:url.origin}});
    assert.equal(response.status,200);assert.doesNotMatch(await response.text(),/private-test-value-only/);
    assert.equal(JSON.parse(await readFile(configFile,'utf8')).TENCENT_API_KEY,'private-test-value-only');
  }finally{
    await app.close();
    assert.equal(dirname(resolve(folder)),resolve(tmpdir()));assert.ok(basename(folder).startsWith('xingyu-ai-setup-'));
    await rm(folder,{recursive:true,force:true});
  }
});
