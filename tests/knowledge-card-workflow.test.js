import test from 'node:test';
import assert from 'node:assert/strict';
import { knowledgeCardTask, knowledgeCardShare } from '../shared/knowledge-card.mjs';
import { validateAssistantAction } from '../shared/assistant-tools.mjs';
import { createAssistantPublication } from '../src/assistantPublication.js';
import { createAiClient } from '../src/aiClient.js';

const id='12700000-0000-4000-8000-000000000001';
const card=validateAssistantAction({id,type:'knowledge_card',card:{title:'土星光环的秘密',intro:'光环由许多冰粒与碎屑组成。',points:['环不是一整块固体。','各颗粒分别绕土星公转。','卡西尼曾近距离研究土星系统。'],fact:'其他巨行星也有环。',sourceIds:['saturn'],level:'入门'}}).card;
test('explicit card requests become creation tasks; informational questions and opt-outs remain chat',()=>{
  for(const content of ['帮我调用网站功能制作一张土星知识卡','做一张太阳的进阶知识卡片','请整理一张黑洞科普卡','Create a knowledge card about Saturn'])assert.ok(knowledgeCardTask([{role:'user',content}]));
  for(const content of ['知识卡是什么？','如何制作知识卡？','请问如何制作知识卡？','How to create a knowledge card?','帮我生成土星知识卡封面','不要生成知识卡，只解释土星','不用做知识卡'])assert.equal(knowledgeCardTask([{role:'user',content}]),null);
  assert.equal(knowledgeCardTask([{role:'user',content:'做一张太阳的进阶知识卡片'}]).level,'进阶');
  assert.equal(knowledgeCardTask([],{kind:'knowledge_card',topic:'木星',level:'入门'}).topic,'木星');
  assert.throws(()=>knowledgeCardTask([],{kind:'knowledge_card',topic:'木星',level:'入门',execute:'publish'}));
});
test('card sharing preserves the exact card and reference links as an editable real community article',()=>{
  const share=knowledgeCardShare(card); assert.equal(share.id,id); assert.equal(share.draft.type,'article'); assert.equal(share.draft.category,'学习交流');
  for(const text of [card.title,card.intro,...card.points,card.fact,card.source])assert.ok(share.draft.content.includes(text));
  assert.match(share.draft.content,/AI辅助制作/); assert.equal(share.draft.visibility,'public');
  assert.equal(knowledgeCardShare({...card,source:'https://hostile.invalid'}).draft.content.includes('hostile'),false);
});
test('sharing is never a background write; account consent and idempotency protect the same card across entry points',async()=>{
  let count=0;
  const action=knowledgeCardShare(card),publisher=createAssistantPublication({action,ownerId:'owner',getSession:()=>({userId:'owner',token:'test-session'}),publish:async(payload,guard)=>{count++;assert.equal(guard.idempotencyKey,id);assert.match(payload.content,/土星光环/);return{id:'actual-post'};}});
  assert.equal(count,0);await assert.rejects(publisher.confirm(action.draft,false));assert.equal(count,0);
  assert.equal((await publisher.confirm(action.draft,true)).id,'actual-post');await publisher.confirm(action.draft,true);assert.equal(count,1);
});
test('the studio task reaches the same real agent transport and returns the same usable card contract',async()=>{
  const events=[];
  const client=createAiClient({apiBase:'https://api.example.test',getToken:()=> 'test-session',fetchImpl:async(url,options)=>{
    assert.equal(new URL(url).pathname,'/api/ai/agent');assert.deepEqual(JSON.parse(options.body).task,{kind:'knowledge_card',topic:'土星',level:'入门'});
    return new Response(`event: action\ndata: ${JSON.stringify({id,type:'knowledge_card',card})}\n\nevent: done\ndata: {"finishReason":"stop"}\n\n`,{headers:{'Content-Type':'text/event-stream'}});
  }});
  await client.agent({messages:[{role:'user',content:'请制作知识卡'}],task:{kind:'knowledge_card',topic:'土星',level:'入门'},onEvent:event=>events.push(event)});
  assert.equal(events[0].action.card.cardId,card.cardId);assert.equal(events.at(-1).type,'done');
});
