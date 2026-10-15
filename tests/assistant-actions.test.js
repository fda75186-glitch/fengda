import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantDestinations, assistantPages, assistantArticles, validateToolArguments, validateAssistantAction, knowledgeCardMarkdown } from '../shared/assistant-tools.mjs';
import { createAssistantPublication } from '../src/assistantPublication.js';
import { createAiClient, buildChatMessages } from '../src/aiClient.js';
const id = '11111111-1111-4111-8111-111111111111';
const draft = { title: '一起观察月相变化', content: '月相变化来自月球绕地球公转时，我们看到受光部分比例的变化。让我们连续几天观察月亮的形状，记录自己的发现。', category: '天文问答', topics: ['月相'], visibility: 'public' };
const action = { id, type: 'community_draft', draft };

test('all existing page and universe IDs are actionable while URLs and unknown operations are refused', () => {
  for (const target of Object.keys(assistantPages)) assert.equal(validateToolArguments('site_action', { operation: 'navigate', target, query: '' }).target, target);
  for (const destination of assistantDestinations) assert.equal(validateToolArguments('site_action', { operation: 'explore_universe', target: destination.id, query: '' }).target, destination.id);
  for (const args of [{ operation: 'eval', target: 'alert(1)', query: '' }, { operation: 'navigate', target: 'javascript:alert(1)', query: '' }, { operation: 'open_knowledge', target: 'made-up', query: '' }]) assert.throws(() => validateToolArguments('site_action', args));
});

test('card citation URLs and cover images are reconstructed only from the real local catalogue', () => {
  const source = assistantArticles[0];
  const card = validateAssistantAction({ id, type: 'knowledge_card', card: { title: '宇宙知识', intro: '一张简单的知识卡', points: ['知识一', '知识二', '知识三'], fact: '还有更多值得探索。', level: '入门', sourceIds: [source.id], source: 'javascript:alert(1)', image: 'https://hostile.invalid' } }).card;
  assert.equal(card.source, source.source); assert.equal(card.image, source.image); assert.match(knowledgeCardMarkdown(card), /AI辅助制作/);
});

test('publishing needs explicit approval and the same account, and repeated clicks produce one request', async () => {
  let userId = 'owner', calls = 0, finish;
  const publisher = createAssistantPublication({ action, ownerId: 'owner', getSession: () => ({ userId, token: 'only-test-session' }), publish: (payload, guard) => { calls++; assert.equal(guard.idempotencyKey, id); assert.match(payload.content, /AI辅助整理/); return new Promise(resolve => { finish = resolve; }); } });
  await assert.rejects(publisher.confirm(draft, false), /勾选/);
  userId = 'other'; await assert.rejects(publisher.confirm(draft, true), /账号/); userId = 'owner';
  const one = publisher.confirm(draft, true), two = publisher.confirm(draft, true);
  assert.equal(calls, 1); assert.equal(publisher.locked, true); finish({ id: 'published-post' });
  assert.deepEqual(await one, await two); await publisher.confirm(draft, true); assert.equal(calls, 1);
});

test('a network failure preserves the confirmation key, refuses edited retries, and permits exact replay', async () => {
  let calls = 0;
  const publisher = createAssistantPublication({ action, ownerId: 'owner', getSession: () => ({ userId: 'owner', token: 'only-test-session' }), publish: async (_payload, guard) => { assert.equal(guard.idempotencyKey, id); if (++calls === 1) throw Error('network failed'); return { id: 'same-post' }; } });
  await assert.rejects(publisher.confirm(draft, true), /network/);
  await assert.rejects(publisher.confirm({ ...draft, visibility: 'private' }, true), /核实/);
  assert.equal((await publisher.confirm(draft, true)).id, 'same-post'); assert.equal(calls, 2);
});

test('the real client agent transport validates streamed action cards and tool progress', async () => {
  const event = (type, value) => `event: ${type}\ndata: ${JSON.stringify(value)}\n\n`;
  const received = [];
  const client = createAiClient({ apiBase: 'https://api.example.test', getToken: () => 'test-session', fetchImpl: async (url, options) => {
    assert.equal(new URL(url).pathname, '/api/ai/agent'); assert.equal(options.headers.get('Authorization'), 'Bearer test-session');
    return new Response(event('tool', { name: 'draft_community_post', state: 'complete', step: 1 }) + event('action', action) + event('delta', { text: '草稿已准备好。' }) + event('done', { finishReason: 'stop' }), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  await client.agent({ messages: [{ role: 'user', content: '写文章' }], onEvent: e => received.push(e) });
  assert.equal(received.find(e => e.type === 'action').action.draft.title, draft.title);
  assert.equal(received.at(-1).type, 'done');
});

test('subsequent model turns include prepared content and actual publication receipts without granting tools', () => {
  const result = buildChatMessages([{ role: 'user', text: '帮我写文章' }, { role: 'assistant', status: 'complete', text: '请检查草稿。', actions: [action], receipts: [{ postId: 'actual-post', status: 'published' }] }], '打开刚才发布的内容');
  assert.match(result[1].content, /一起观察月相变化/); assert.match(result[1].content, /actual-post/);
  assert.equal(result.every(m => ['user', 'assistant'].includes(m.role)), true);
});
