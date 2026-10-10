import test from 'node:test';
import assert from 'node:assert/strict';
import { addCommunityComment, communitySeeds, createCommunityPost, restoreCommunity, toggleCommunityLike } from '../src/community.js';

test('损坏的社区数据恢复精选示例，不导致白屏', () => {
  assert.equal(restoreCommunity('{bad json').recovered, true);
  assert.equal(restoreCommunity('{"version":1,"posts":[null]}').posts.length, 4);
  assert.equal(restoreCommunity(null).recovered, false);
});
test('本机发布先校验标题正文并去除首尾空格', () => {
  assert.throws(() => createCommunityPost({ title: '短', content: '这是一个有效长度的天文科普正文', category: '天文问答' }, 'id', 1), /标题/);
  const post = createCommunityPost({ title: '  为什么月亮会变圆  ', content: '  我想了解月相变化与太阳之间的关系。  ', category: '天文问答' }, 'local-1', 2);
  assert.equal(post.title, '为什么月亮会变圆'); assert.equal(post.example, false); assert.equal(post.createdAt, 2);
});
test('点赞可撤回，评论往返持久化并保留原示例标识', () => {
  const posts = restoreCommunity(null).posts;
  const liked = toggleCommunityLike(posts, posts[0].id);
  assert.equal(liked[0].liked, true); assert.equal(posts[0].liked, false);
  assert.equal(toggleCommunityLike(liked, posts[0].id)[0].liked, false);
  const commented = addCommunityComment(liked, posts[0].id, ' 我观察到了月牙。 ', 'comment-1', 123);
  const restored = restoreCommunity(JSON.stringify({ version: 1, posts: commented })).posts;
  assert.equal(restored[0].comments[0].content, '我观察到了月牙。'); assert.equal(restored[0].liked, true); assert.equal(restored[0].example, true);
  assert.equal(communitySeeds[0].comments.length, 0);
});
test('无效评论被拒绝，持久化中的重复 ID 被过滤', () => {
  assert.throws(() => addCommunityComment(communitySeeds, 'missing', '有效评论', 'c', 1), /不存在/);
  assert.throws(() => addCommunityComment(communitySeeds, communitySeeds[0].id, ' ', 'c', 1), /评论/);
  const restored = restoreCommunity(JSON.stringify({ version: 1, posts: [communitySeeds[0], communitySeeds[0], { id: 'x', title: '无效', content: '无效', category: '未知分类' }] }));
  assert.equal(restored.posts.length, 1);
});

test('超过 150 条本机帖子刷新后完整恢复，保留每条内容及顺序', () => {
  const posts = Array.from({ length: 180 }, (_, index) => createCommunityPost({
    title: `第 ${index + 1} 次观星记录`, content: `我在第 ${index + 1} 次观察中记录了月亮的形状与位置。`, category: '观星日记',
  }, `local-post-${index}`, index + 1));
  const restored = restoreCommunity(JSON.stringify({ version: 1, posts }));
  assert.equal(restored.recovered, false);
  assert.deepEqual(restored.posts, posts);
});

test('超过 100 条本机评论刷新后完整恢复，包括最后一条新评论', () => {
  let posts = restoreCommunity(null).posts;
  for (let index = 0; index < 125; index++) {
    posts = addCommunityComment(posts, posts[0].id, `第 ${index + 1} 次观察：我看见了月亮。`, `local-comment-${index}`, index + 1);
  }
  const restored = restoreCommunity(JSON.stringify({ version: 1, posts }));
  assert.equal(restored.recovered, false);
  assert.deepEqual(restored.posts[0].comments, posts[0].comments);
  assert.equal(restored.posts[0].comments.length, 125);
  assert.equal(restored.posts[0].comments.at(-1).content, '第 125 次观察：我看见了月亮。');
});
