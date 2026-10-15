export const imageSizes = { landscape: { label: '横图 4:3', size: '1024x768' }, square: { label: '方图 1:1', size: '1024x1024' }, portrait: { label: '竖图 3:4', size: '768x1024' } };
export const imageStyles = { realistic: '写实宇宙插画', illustration: '科普插画', poster: '天文海报' };
export function validateImageRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['prompt', 'ratio', 'style'].includes(k))) throw Error('生图参数不正确');
  if (typeof value.prompt !== 'string' || value.prompt.trim().length < 4 || value.prompt.trim().length > 1600) throw Error('请用 4–1600 字描述想生成的图片');
  if (!Object.hasOwn(imageSizes, value.ratio) || !Object.hasOwn(imageStyles, value.style)) throw Error('图片比例或风格不正确');
  return { prompt: value.prompt.trim(), ratio: value.ratio, style: value.style };
}
export function validateGeneratedImage(value) {
  if (!value || !/^[a-f0-9-]{36}$/.test(value.id || '') || value.status !== 'complete' || !/^\/api\/media\/[a-f0-9-]{36}$/.test(value.media || '') || !['image/png', 'image/jpeg', 'image/webp'].includes(value.mime)) throw Error('生成图片数据不完整');
  return { id: value.id, status: 'complete', media: value.media, mime: value.mime, ...validateImageRequest({ prompt: value.prompt, ratio: value.ratio, style: value.style }), aiGenerated: true };
}
