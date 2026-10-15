import { AiError } from './ai.mjs';
import { validateImageRequest, imageSizes, imageStyles } from '../shared/image-generation.mjs';

const ENDPOINT = 'https://tokenhub.tencentmaas.com/v1/wand/hunyuan-image/v3-generation';
const MODEL = 'hy-image-v3';
const MAX_BYTES = 8 * 1024 * 1024;
const MESSAGES = {
  IMAGE_ACCESS: '腾讯生图模型尚未开通或当前 Key 无权调用，请管理员开通 Hy-Image-3.0 并加入此 Key 的可访问范围。',
  IMAGE_LIMIT: '生图额度或频率受限，请稍后再试。',
  IMAGE_BLOCKED: '图片请求未通过腾讯内容审核，请调整描述。',
  IMAGE_TIMEOUT: '图片生成超时，未自动重试。请先检查本次结果。',
  IMAGE_CANCELLED: '本次等待已停止，未自动重试。',
  IMAGE_UPSTREAM: '腾讯生图服务暂时不可用，请稍后再试。',
  IMAGE_INVALID: '腾讯返回的图片未通过格式或安全检查，未保存。',
  IMAGE_STORAGE: '图片保存未完成，请稍后查看本次结果。',
};
let active = 0;
const fail = (status, code, message = MESSAGES[code]) => { throw new AiError(status, code, message); };
export function getImageStatus(context) {
  return { configured: !context.aiConfigInvalid && typeof context.TENCENT_API_KEY === 'string' && !!context.TENCENT_API_KEY.trim() && context.TENCENT_API_KEY.length <= 2048 && !/[\r\n]/.test(context.TENCENT_API_KEY) && context.TENCENT_IMAGE_ENABLED === 'true', model: MODEL, requiresLogin: true, dailyLimit: 5 };
}
function view(row) {
  return { id: row.id, status: row.status, prompt: row.prompt, ratio: row.ratio, style: row.style, ...(row.status === 'complete' ? { media: `/api/media/${row.media_id}`, mime: row.mime, aiGenerated: true } : row.status === 'failed' ? { code: row.error_code, error: MESSAGES[row.error_code] || MESSAGES.IMAGE_UPSTREAM } : {}) };
}
export async function imageResult(context, owner, id) {
  const row = await context.DB.prepare('SELECT * FROM image_generations WHERE id=? AND owner=?').bind(id, owner).first();
  if (!row) fail(404, 'IMAGE_NOT_FOUND', '未找到当前账号的生图记录');
  if (row.status === 'pending' && Date.now() - row.created_at > 240000) {
    await context.DB.prepare("UPDATE image_generations SET status='failed',error_code='IMAGE_TIMEOUT',updated_at=? WHERE id=? AND status='pending'").bind(Date.now(), id).run();
    return imageResult(context, owner, id);
  }
  return view(row);
}
export async function recentImages(context, owner) {
  const rows = await context.DB.prepare('SELECT * FROM image_generations WHERE owner=? ORDER BY created_at DESC LIMIT 12').bind(owner).all();
  return { images: await Promise.all(rows.results.map(row => imageResult(context, owner, row.id))) };
}
async function readBytes(response, maximum, signal) {
  if (!response.body || Number(response.headers.get('content-length') || 0) > maximum) fail(502, 'IMAGE_INVALID');
  const reader = response.body.getReader(), chunks = []; let length = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw signal.reason;
      const { value, done } = await reader.read();
      if (signal.aborted) throw signal.reason;
      if (done) break;
      length += value.byteLength;
      if (length > maximum) fail(502, 'IMAGE_INVALID');
      chunks.push(value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function safeGeneratedImageUrl(value) {
  let url; try { url = new URL(value); } catch { fail(502, 'IMAGE_INVALID'); }
  const trusted = url.hostname === 'aigc-image.cos.myqcloud.com' || /^aigc-output-image-file-\d+\.cos\.ap-guangzhou\.myqcloud\.com$/.test(url.hostname);
  if (!trusted || url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) fail(502, 'IMAGE_INVALID');
  return url.href;
}
function imageSignature(bytes, mime) {
  if (bytes.length < 12) return false;
  if (mime === 'image/png') return [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b);
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return mime === 'image/webp' && new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
}
export async function generateImage(request, context, session, rate) {
  const id = request.headers.get('Idempotency-Key') || '';
  if (!/^[a-f0-9-]{36}$/.test(id)) fail(400, 'IMAGE_INPUT', '缺少有效的生图请求标识');
  let input;
  const inputSignal = AbortSignal.any([request.signal, AbortSignal.timeout(context.imageInputTimeoutMs || 10000)]);
  if (Number(request.headers.get('content-length') || 0) > 10000) fail(413, 'IMAGE_INPUT', '图片描述超过大小限制');
  try { input = validateImageRequest(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readBytes(request, 10000, inputSignal)))); }
  catch (e) {
    if (request.signal.aborted) fail(408, 'IMAGE_CANCELLED');
    if (inputSignal.aborted) fail(408, 'IMAGE_INPUT', '图片请求内容接收超时');
    fail(400, 'IMAGE_INPUT', '请检查画面描述、比例和风格');
  }
  const existing = await context.DB.prepare('SELECT * FROM image_generations WHERE id=?').bind(id).first();
  if (existing) {
    if (existing.owner !== session.owner || ['prompt', 'ratio', 'style'].some(k => existing[k] !== input[k])) fail(409, 'IMAGE_CONFLICT', '本次请求标识已被使用，请检查原生图结果');
    return imageResult(context, session.owner, id);
  }
  if (!getImageStatus(context).configured) fail(503, 'IMAGE_ACCESS');
  if (active >= 2) fail(429, 'IMAGE_LIMIT');
  const now = Date.now();
  const claim = await context.DB.prepare('INSERT INTO image_generations(id,owner,prompt,ratio,style,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id, session.owner, input.prompt, input.ratio, input.style, now, now).run();
  if (!claim.meta.changes) {
    const row = await context.DB.prepare('SELECT * FROM image_generations WHERE id=?').bind(id).first();
    if (row.owner !== session.owner || ['prompt','ratio','style'].some(k => row[k] !== input[k])) fail(409, 'IMAGE_CONFLICT', '生图请求标识冲突');
    return imageResult(context, session.owner, id);
  }
  if (active >= 2) {
    await context.DB.prepare("UPDATE image_generations SET status='failed',error_code='IMAGE_LIMIT',updated_at=? WHERE id=?").bind(Date.now(), id).run();
    return imageResult(context, session.owner, id);
  }
  active++;
  const controller = new AbortController();
  const cancel = () => controller.abort(new AiError(408, 'IMAGE_CANCELLED', MESSAGES.IMAGE_CANCELLED));
  request.signal.addEventListener('abort', cancel, { once: true });
  if (request.signal.aborted) cancel();
  const timer = setTimeout(() => controller.abort(new AiError(504, 'IMAGE_TIMEOUT', MESSAGES.IMAGE_TIMEOUT)), Math.min(context.imageTimeoutMs || 180000, 180000));
  let storedId = '';
  try {
    await rate(context, `image-minute:${session.owner}`, 1, 60000);
    await rate(context, `image-day:${session.owner}`, 5, 86400000);
    await rate(context, 'image-global', 10, 86400000);
    if (controller.signal.aborted) throw controller.signal.reason;
    const provider = context.imageFetch || fetch;
    const response = await provider(ENDPOINT, {
      method: 'POST', redirect: 'manual', signal: controller.signal,
      headers: { Authorization: `Bearer ${context.TENCENT_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, prompt: `${input.prompt}\n视觉风格：${imageStyles[input.style]}。这是天文科普艺术示意，不是天文实拍或严格比例测绘。不要伪造机构认证、观测数据或摄影署名。`, size: imageSizes[input.ratio].size, footnote: '星语AI生成', revise: false }),
    });
    const bytes = await readBytes(response, 65536, controller.signal);
    let payload; try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail(502, 'IMAGE_INVALID'); }
    if (!response.ok || payload.error) {
      const code = String(payload.error?.code || '');
      if ([401,403].includes(response.status) || code === '401006') fail(503, 'IMAGE_ACCESS');
      if (response.status === 429) fail(429, 'IMAGE_LIMIT');
      if (response.status === 422 || /content_filter|moderation/i.test(code)) fail(422, 'IMAGE_BLOCKED');
      fail(502, 'IMAGE_UPSTREAM');
    }
    if (!Array.isArray(payload.data) || payload.data.length !== 1) fail(502, 'IMAGE_INVALID');
    const imageUrl = safeGeneratedImageUrl(payload.data[0].url);
    // No Authorization header goes to the image CDN. Only documented HTTPS hosts;
    // redirects are rejected, bytes are bounded, signed provider URLs stay private.
    const image = await provider(imageUrl, { redirect: 'manual', signal: controller.signal, headers: { Accept: 'image/png,image/jpeg,image/webp' } });
    if (!image.ok) fail(502, 'IMAGE_UPSTREAM');
    const mime = (image.headers.get('content-type') || '').split(';')[0].toLowerCase();
    const content = await readBytes(image, MAX_BYTES, controller.signal);
    if (!imageSignature(content, mime)) fail(502, 'IMAGE_INVALID');
    if (controller.signal.aborted) throw controller.signal.reason;
    storedId = crypto.randomUUID();
    await context.BUCKET.put(`media/${storedId}`, content, { httpMetadata: { contentType: mime } });
    await context.DB.batch([
      context.DB.prepare('INSERT INTO media(id,owner,mime,bytes,filename,created_at) VALUES(?,?,?,?,?,?)').bind(storedId, session.owner, mime, content.length, `星语AI生成-${id}.${mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]}`, Date.now()),
      context.DB.prepare("UPDATE image_generations SET status='complete',media_id=?,mime=?,updated_at=? WHERE id=? AND status='pending'").bind(storedId, mime, Date.now(), id),
    ]);
    storedId = '';
  } catch (error) {
    if (storedId) await context.BUCKET.delete(`media/${storedId}`).catch(() => {});
    const reason = controller.signal.aborted ? controller.signal.reason : error;
    const code = reason.code === 'RATE_LIMIT' ? 'IMAGE_LIMIT' : Object.hasOwn(MESSAGES, reason.code) ? reason.code : 'IMAGE_UPSTREAM';
    await context.DB.prepare("UPDATE image_generations SET status='failed',error_code=?,updated_at=? WHERE id=? AND status='pending'").bind(code, Date.now(), id).run();
  } finally { clearTimeout(timer); request.signal.removeEventListener('abort', cancel); active--; }
  return imageResult(context, session.owner, id);
}
