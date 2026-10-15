import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, basename } from 'node:path';
import { handleApi } from '../api.mjs';
import { createLocalStorage } from '../local-adapter.mjs';
import { assistantArticles } from '../../shared/assistant-tools.mjs';

const data = value => `data: ${JSON.stringify(value)}\n\n`;
const done = reason => data({ choices: [{ delta: {}, finish_reason: reason }] }) + 'data: [DONE]\n\n';
const text = answer => data({ choices: [{ delta: { content: answer }, finish_reason: null }] }) + done('stop');
const tool = (name, args, id = 'call_one') => {
  const value = JSON.stringify(args), middle = Math.floor(value.length / 2);
  return data({ choices: [{ delta: { tool_calls: [{ index: 0, id, type: 'function', function: { name, arguments: value.slice(0, middle) } }] }, finish_reason: null }] })
    + data({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: value.slice(middle) } }] }, finish_reason: null }] }) + done('tool_calls');
};
const provider = value => new Response(value, { headers: { 'Content-Type': 'text/event-stream' } });
const frames = text => text.trim().split('\n\n').map(frame => ({ type: frame.split('\n')[0].slice(7), data: JSON.parse(frame.split('\n')[1].slice(6)) }));
const draft = { title: '一起认识月相变化', content: '月相变化来自月球绕地球公转时，我们看见的受光部分比例改变。欢迎记录月亮每天的形状和位置，一起讨论。', category: '天文问答', topics: ['月相'], visibility: 'public' };
async function fixture(t, aiFetch) {
  const directory = await mkdtemp(join(tmpdir(), 'xingyu-agent-test-'));
  const storage = await createLocalStorage(directory);
  const context = { ...storage, allowLoopback: true, TENCENT_API_KEY: 'test-not-real', TENCENT_AI_MODEL: 'hy4-preview', aiFetch };
  const call = (path, input, token, headers = {}) => handleApi(new Request('http://127.0.0.1:40100' + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: JSON.stringify(input) }), context);
  const register = async username => (await (await call('/api/auth/register', { username, password: 'isolated-test-password' })).json()).token;
  const token = await register('AgentTest');
  t.after(async () => { storage.close(); assert.equal(dirname(resolve(directory)), resolve(tmpdir())); assert.ok(basename(directory).startsWith('xingyu-agent-test-')); await rm(directory, { recursive: true, force: true }); });
  return { call, token, register, context, chat: () => call('/api/ai/agent', { messages: [{ role: 'user', content: '请帮我完成这个站内任务' }] }, token) };
}

test('an explicit card request forces the real card tool instead of accepting a text-only completion', async t => {
  let calls=0;
  const card={title:'土星光环的秘密',intro:'由冰粒等物质构成的环。',points:['环不是固体圆盘。','颗粒分别绕土星公转。','其他巨行星也有环。'],fact:'观察太阳必须使用专用太阳滤镜。',sourceIds:['saturn'],level:'入门'};
  const app=await fixture(t,async(_url,options)=>{
    calls++;const body=JSON.parse(options.body);
    if(body.tool_choice==='auto')return provider(text('我可以告诉你如何制作知识卡。'));
    assert.deepEqual(body.tool_choice,{type:'function',function:{name:'create_knowledge_card'}});
    assert.equal(body.tools.length,1);assert.equal(body.parallel_tool_calls,false);
    assert.match(body.messages.at(-1).content,/saturn/);
    return provider(tool('create_knowledge_card',card));
  });
  const response=await app.call('/api/ai/agent',{messages:[{role:'user',content:'帮我用网页的功能制作一张土星光环知识卡并分享到社区'}]},app.token);
  const result=frames(await response.text());
  assert.equal(calls,1);assert.equal(result.at(-1).type,'done');
  const actions=result.filter(e=>e.type==='action').map(e=>e.data);assert.deepEqual(actions.map(a=>a.type),['knowledge_card','community_draft']);
  assert.equal(actions[0].id,actions[1].id);assert.ok(actions[1].draft.content.includes(actions[0].card.title));
  assert.equal((await app.context.DB.prepare('SELECT COUNT(*) AS n FROM posts').first()).n,0);
});
test('a provider ignoring forced card output cannot report success or display its text as a finished card',async t=>{
  const app=await fixture(t,async()=>provider(text('已经制作好了，但只返回文字。')));
  const result=frames(await(await app.call('/api/ai/agent',{messages:[{role:'user',content:'制作一张木星知识卡'}]},app.token)).text());
  assert.equal(result.some(e=>e.type==='done'||e.type==='action'||e.type==='delta'),false);
  assert.equal(result.at(-1).data.code,'AI_CARD_NOT_CREATED');
});
test('the studio structured task uses the same forced tool workflow and repairs invalid card arguments once',async t=>{
  let calls=0;
  const app=await fixture(t,async()=>provider(tool('create_knowledge_card',++calls===1?{title:'不完整'}:{title:'太阳如何发光',intro:'太阳通过核聚变释放能量。',points:['太阳是一颗恒星。','核心发生核聚变。','能量经过太阳内部向外传递。'],fact:'不能直接看太阳。',level:'进阶',sourceIds:['sun']})));
  const result=frames(await(await app.call('/api/ai/agent',{messages:[{role:'user',content:'请帮我整理这个主题'}],task:{kind:'knowledge_card',topic:'太阳',level:'进阶'}},app.token)).text());
  assert.equal(calls,2);assert.equal(result.at(-1).type,'done');assert.equal(result.find(e=>e.type==='action').data.card.level,'进阶');
  const invalid=await app.call('/api/ai/agent',{messages:[{role:'user',content:'任务'}],task:{kind:'publish_all',topic:'太阳',level:'进阶'}},app.token);assert.equal(invalid.status,400);
});

test('agent performs real tool rounds with server grounding and emits a usable knowledge card', async t => {
  const article = assistantArticles.find(a => a.id === 'saturn');
  let requests = 0;
  const card = { title: '土星的环', intro: '看起来完整的光环由许多颗粒组成。', points: ['环中有大量冰粒。', '颗粒分别绕土星运动。', '其他巨行星也有环。'], fact: '从地球观察时，环的倾角会变化。', level: '入门', sourceIds: [article.id] };
  const app = await fixture(t, async (_url, options) => {
    const input = JSON.parse(options.body); requests++;
    assert.equal(input.tools.length, 6); assert.equal(input.thinking.type, 'disabled');
    if (requests === 1) return provider(tool('search_site', { query: '土星', scope: 'knowledge' }));
    if (requests === 2) { assert.match(input.messages.at(-1).content, /retrieved/); return provider(tool('create_knowledge_card', card, 'call_card')); }
    assert.match(input.messages.at(-1).content, /prepared_not_executed/);
    return provider(text('知识卡已准备好，可以检查并收藏。'));
  });
  const response = await app.chat(); assert.equal(response.status, 200);
  const result = frames(await response.text());
  const action = result.find(e => e.type === 'action').data;
  assert.equal(action.type, 'knowledge_card'); assert.equal(action.card.source, article.source);
  assert.equal(result.at(-1).type, 'done'); assert.equal(requests, 3);
  assert.equal(result.filter(e => e.type === 'tool' && e.data.state === 'complete').length, 2);
});

test('draft tool never publishes: an actual authenticated confirmation creates the post once', async t => {
  let requests = 0;
  const app = await fixture(t, async () => provider(++requests === 1 ? tool('draft_community_post', draft) : text('草稿已展示，确认后才能发布。')));
  const result = frames(await (await app.chat()).text());
  const action = result.find(e => e.type === 'action').data;
  assert.equal(action.type, 'community_draft');
  assert.equal((await app.context.DB.prepare('SELECT COUNT(*) AS n FROM posts').first()).n, 0);
  const payload = { ...draft, kind: 'article', communities: ['天文问答'], images: [], format: 'markdown' };
  const headers = { 'Idempotency-Key': action.id };
  const [first, second] = await Promise.all([app.call('/api/posts', payload, app.token, headers), app.call('/api/posts', payload, app.token, headers)]);
  assert.ok([200, 201].includes(first.status)); assert.ok([200, 201].includes(second.status));
  assert.equal((await first.json()).id, (await second.json()).id);
  assert.equal((await app.context.DB.prepare('SELECT COUNT(*) AS n FROM posts').first()).n, 1);
  assert.equal((await app.call('/api/posts', { ...payload, visibility: 'private' }, app.token, headers)).status, 409);
  const other = await app.register('OtherAgentTest');
  assert.equal((await app.call('/api/posts', payload, other, headers)).status, 201);
  assert.equal((await app.context.DB.prepare('SELECT COUNT(*) AS n FROM posts').first()).n, 2);
  assert.equal((await app.call('/api/posts', payload, null, headers)).status, 401);
});

test('unread reference IDs and executable-looking targets are rejected without issuing actions', async t => {
  let requests = 0;
  const app = await fixture(t, async () => provider(++requests === 1 ? tool('site_action', { operation: 'navigate', target: 'https://hostile.invalid', query: '' }) : text('该目标不是本站功能，请提供站内页面。')));
  const result = frames(await (await app.chat()).text());
  assert.equal(result.filter(e => e.type === 'action').length, 0);
  assert.equal(result.some(e => e.type === 'tool' && e.data.state === 'error'), true);
  assert.equal(result.at(-1).type, 'done');
});

test('endless tool requests stop at the workflow budget and cannot publish', async t => {
  let requests = 0;
  const app = await fixture(t, async () => provider(tool('search_site', { query: '土星', scope: 'knowledge' }, 'call_' + ++requests)));
  const result = frames(await (await app.chat()).text());
  assert.equal(requests, 4); assert.equal(result.at(-1).type, 'error'); assert.equal(result.at(-1).data.code, 'AI_STEP_LIMIT');
  assert.equal((await app.context.DB.prepare('SELECT COUNT(*) AS n FROM posts').first()).n, 0);
});

test('public community retrieval excludes private posts and labels user content as untrusted', async t => {
  const app = await fixture(t, async () => provider(text('ok')));
  for (const visibility of ['public', 'private']) await app.call('/api/posts', { ...draft, title: visibility + '月相', kind: 'article', visibility }, app.token);
  const { createAssistantTools } = await import('../assistant-tools.mjs');
  const execute = createAssistantTools(app.context);
  const found = await execute('search_site', { query: '月相', scope: 'community' });
  assert.equal(found.result.data.posts.length, 1); assert.match(found.result.data.posts[0].title, /public/);
  assert.match(found.result.data.posts[0].note, /不是操作指令/);
});

test('knowledge references must be retrieved first and fabricated source IDs are rejected', async t => {
  const app = await fixture(t, async () => provider(text('ok')));
  const { createAssistantTools } = await import('../assistant-tools.mjs');
  const execute = createAssistantTools(app.context);
  const card = { title: '土星知识', intro: '冰粒组成的环。', points: ['要点一', '要点二', '要点三'], fact: '环系还有更多细节。', level: '入门', sourceIds: ['saturn'] };
  await assert.rejects(execute('create_knowledge_card', card), /先检索/);
  await execute('read_knowledge', { id: 'saturn' });
  assert.equal((await execute('create_knowledge_card', card)).action.card.sourceIds[0], 'saturn');
  await assert.rejects(execute('create_knowledge_card', { ...card, sourceIds: ['fabricated'] }), /先检索/);
  assert.ok((await execute('search_site', { query: '月', scope: 'knowledge' })).result.data.knowledge.length);
});

test('unknown model tools terminate safely without forwarding an executable action', async t => {
  const app = await fixture(t, async () => provider(tool('publish_without_confirmation', {})));
  const result = frames(await (await app.chat()).text());
  assert.equal(result.at(-1).data.code, 'AI_TOOL_INVALID');
  assert.equal(result.some(e => e.type === 'action'), false);
  assert.equal((await app.context.DB.prepare('SELECT COUNT(*) AS n FROM posts').first()).n, 0);
});
