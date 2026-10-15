import { assistantArticles, boundedText, validateAssistantAction, validateToolArguments, knowledgeCardMarkdown } from './assistant-tools.mjs';

export function knowledgeCardTask(messages, explicit) {
  if (explicit !== undefined) {
    if (!explicit || typeof explicit !== 'object' || Array.isArray(explicit) || explicit.kind !== 'knowledge_card' || Object.keys(explicit).some(k => !['kind','topic','level'].includes(k)) || !['入门','进阶'].includes(explicit.level)) throw Error('知识卡任务格式不正确');
    return { kind: 'knowledge_card', topic: boundedText(explicit.topic, 1, 100, '探索主题'), level: explicit.level };
  }
  const text = messages.at(-1)?.content || '';
  if (!/(?:知识|科普|天文|学习)卡(?:片)?|knowledge\s+card/i.test(text) || !/(?:制作|生成|创作|创建|整理|设计|做|帮我|create|make|generate)/i.test(text)) return null;
  if (/(?:不要|不用|不需要|别|不想).{0,12}(?:制作|生成|创作|做|知识卡)/.test(text)) return null;
  if (/(?:知识|科普)卡(?:片)?(?:的)?(?:配图|封面|插画|图片)/.test(text)) return null;
  if (/(?:怎么|如何|怎样).{0,12}(?:制作|生成|创作|做)/.test(text) && !/(?:帮我|给我|调用|直接|替我)/.test(text)) return null;
  if (/^\s*(?:how\s+(?:to|do|can)|what\s+is)/i.test(text) && !/please\s+(?:make|create)|make\s+one\s+for\s+me/i.test(text)) return null;
  const previous = messages.slice(0,-1).findLast(m => m.role === 'user')?.content || '';
  const query = /(?:上面|刚才|这个|那张|上一)/.test(text) ? previous + ' ' + text : text;
  return { kind: 'knowledge_card', topic: query.trim().slice(0,100), level: text.includes('进阶') ? '进阶' : '入门' };
}

export function normalizeKnowledgeCard(card) {
  const match = (card?.cardId || card?.id || '').match(/^ai-([a-f0-9-]{36})$/);
  // Legacy local cards can still be shared. Rebuild their sources from the
  // catalogue, never from an arbitrary locally stored or model-supplied URL.
  const sourceIds = card?.sourceIds || assistantArticles.filter(a => a.source === card?.source || card?.sources?.some(s => s.url === a.source)).map(a => a.id).slice(0,4);
  return validateAssistantAction({ id: match?.[1] || crypto.randomUUID(), type: 'knowledge_card', card: { ...card, sourceIds } });
}

export function knowledgeCardShare(card) {
  const normalized = normalizeKnowledgeCard(card);
  const draft = validateToolArguments('draft_community_post', {
    title: [...`知识卡｜${normalized.card.title}`].slice(0,30).join(''),
    content: knowledgeCardMarkdown(normalized.card), category: '学习交流',
    topics: ['天文知识卡'], visibility: 'public',
  });
  return { id: normalized.id, type: 'community_draft', draft };
}
