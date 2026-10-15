import { validateAssistantAction, validateToolArguments } from '../shared/assistant-tools.mjs';

export function createAssistantPublication({ action, ownerId, getSession, publish }) {
  const original = validateAssistantAction(action);
  if (original.type !== 'community_draft') throw Error('该操作不是社区草稿');
  let active = null, snapshot = null, result = null;
  return {
    get locked() { return Boolean(snapshot); },
    async confirm(edited, approved) {
      if (!approved) throw Error('请先检查内容，并勾选发布确认。');
      const session = getSession();
      if (!session.userId || session.userId !== ownerId || !session.token) throw Error('账号已变化，请使用生成草稿的账号重新确认。');
      if (result) return result;
      if (active) return active;
      const d = validateToolArguments('draft_community_post', { title: edited.title, content: edited.content, category: edited.category, topics: edited.topics, visibility: edited.visibility });
      const payload = { ...d, communities: [d.category], images: [], content: d.content + '\n\n---\n*本文由星语AI辅助整理，请核实重要事实。*' };
      if (snapshot && JSON.stringify(snapshot) !== JSON.stringify(payload)) throw Error('上次发布结果待核实，请先查看社区；重试必须保持原内容。');
      snapshot = payload;
      active = publish(snapshot, { ownerId, sessionToken: session.token, idempotencyKey: original.id });
      try { result = await active; return result; } finally { active = null; }
    },
  };
}
