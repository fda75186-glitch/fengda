import test from 'node:test';
import assert from 'node:assert/strict';
import { articles, findArticles, answerQuestion, createKnowledgeCard } from '../src/knowledge.js';

test('组合筛选能同时限制分类和搜索词', () => {
  const found = findArticles(articles, '太阳系', '土星');
  assert.equal(found.length, 1);
  assert.equal(found[0].id, 'saturn');
  assert.equal(findArticles(articles, '恒星世界', '土星').length, 0);
});
test('未知问题不冒充模型回答，明确演示范围', () => {
  const answer = answerQuestion('火星明天下雨吗', []);
  assert.match(answer.text, /离线演示/);
  assert.equal(answer.article, null);
});
test('追问使用前一条问答的知识主题', () => {
  const first = answerQuestion('土星的环是什么', []);
  const next = answerQuestion('为什么呢？', [{ role: 'assistant', article: first.article }]);
  assert.equal(next.article.id, 'saturn');
  assert.ok(next.text.length > 40);
});
test('知识卡有真实来源，未知主题不输出虚构科普', () => {
  const card = createKnowledgeCard('木星大红斑', '入门');
  assert.ok(card.points.length >= 3);
  assert.match(card.source, /^https:\/\//);
  assert.equal(createKnowledgeCard('无法识别的外星物种', '入门'), null);
});
