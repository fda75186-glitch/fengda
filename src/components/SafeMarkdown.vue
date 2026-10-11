<script>
import { defineComponent, h } from 'vue';

function safeUrl(value, image = false) {
  if(!value || typeof value!=='string')return '';
  try {
    const url = new URL(value, document.baseURI);
    return (image ? ['https:', 'http:', 'blob:'] : ['https:', 'http:', 'mailto:']).includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function inline(text, images) {
  const pattern = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`/g;
  const nodes = [];
  let offset = 0, match;
  while ((match = pattern.exec(text))) {
    if (match.index > offset) nodes.push(text.slice(offset, match.index));
    if (match[1] !== undefined) {
      const imageIndex = /^image:(\d+)$/.exec(match[2]);
      const source = imageIndex ? images[Number(imageIndex[1]) - 1] : match[2];
      const url = safeUrl(typeof source === 'string' ? source : source?.url || source?.src || '', true);
      nodes.push(url ? h('img', { src: url, alt: match[1], loading: 'lazy' }) : h('span', { class: 'markdown-missing-image' }, `[图片：${match[1] || '等待上传'}]`));
    } else if (match[3] !== undefined) {
      const url = safeUrl(match[4]);
      nodes.push(url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, match[3]) : match[0]);
    } else if (match[5] !== undefined) nodes.push(h('strong', match[5]));
    else nodes.push(h('code', match[6]));
    offset = pattern.lastIndex;
  }
  if (offset < text.length) nodes.push(text.slice(offset));
  return nodes;
}

function blocks(content, images) {
  const lines = content.split('\n'), nodes = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (/^```/.test(line)) {
      const code = []; index++;
      while (index < lines.length && !/^```/.test(lines[index])) code.push(lines[index++]);
      index++; nodes.push(h('pre', [h('code', code.join('\n'))])); continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) { nodes.push(h(`h${heading[1].length + 2}`, inline(heading[2], images))); index++; continue; }
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ''));
      nodes.push(h('blockquote', inline(quote.join('\n'), images))); continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line), items = [], matcher = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
      while (index < lines.length && matcher.test(lines[index])) items.push(h('li', inline(lines[index++].replace(matcher, ''), images)));
      nodes.push(h(ordered ? 'ol' : 'ul', items)); continue;
    }
    const paragraph = [];
    while (index < lines.length && lines[index].trim() && (index === 0 || !/^(#{1,3}\s|>\s?|[-*]\s+|\d+\.\s+|```)/.test(lines[index]))) {
      if (paragraph.length) paragraph.push(h('br'));
      paragraph.push(...inline(lines[index++], images));
    }
    if (!paragraph.length) paragraph.push(...inline(lines[index++], images));
    nodes.push(h('p', paragraph));
  }
  return nodes;
}

export default defineComponent({
  name: 'SafeMarkdown',
  props: { content: { type: String, default: '' }, images: { type: Array, default: () => [] } },
  setup(props) { return () => h('div', { class: 'safe-markdown' }, blocks(props.content, props.images)); },
});
</script>
