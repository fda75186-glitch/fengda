import { validateGeneratedImage, validateImageRequest } from '../shared/image-generation.mjs';

export function createImageClient({ apiBase, getSession, fetchImpl = (...args) => fetch(...args), timeoutMs = 200000 }) {
  function sessionFor(ownerId) {
    const s = getSession();
    if (!s?.token || !s.userId || s.userId !== ownerId) throw Error('请使用生成图片的账号登录后继续。');
    return s;
  }
  async function request(path, ownerId, options = {}) {
    const session = sessionFor(ownerId), controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${session.token}`);
    const check = () => { const current = sessionFor(ownerId); if (current.token !== session.token) throw Error('登录状态已变化，图片不会带入其他账号。'); if (controller.signal.aborted) throw new DOMException('已停止等待，稍后可检查本次结果。', 'AbortError'); };
    try {
      check();
      const response = await fetchImpl(new URL(path, apiBase), { ...options, headers, signal: controller.signal, redirect: 'error', cache: 'no-store' });
      check();
      if (!response.ok) {
        const data = await response.json().catch(() => ({})); check();
        const error = Error(data.error || '图片服务暂时不可用，请稍后重试。'); error.code = data.code; throw error;
      }
      if (options.blob) {
        const mime = (response.headers.get('content-type') || '').split(';')[0];
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw Error('返回的文件不是有效图片。');
        const blob = await response.blob(); check();
        if (!blob.size || blob.size > 8 * 1024 * 1024) throw Error('图片大小超出限制。');
        return blob;
      }
      const data = await response.json(); check(); return data;
    } catch (e) { if (e instanceof TypeError) throw Error('图片连接中断，请点击检查本次结果，不会自动重复生图。'); throw e; }
    finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
  }
  function result(value) {
    if (value.status === 'complete') return validateGeneratedImage(value);
    if (!['pending', 'failed'].includes(value.status) || !/^[a-f0-9-]{36}$/.test(value.id || '')) throw Error('图片任务响应异常。');
    return { id: value.id, status: value.status, ...validateImageRequest({ prompt: value.prompt, ratio: value.ratio, style: value.style }), error: typeof value.error === 'string' ? value.error : '', code: value.code };
  }
  return {
    async generate(id, input, ownerId, signal) { return result(await request('/api/ai/images', ownerId, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': id }, body: JSON.stringify(validateImageRequest(input)), signal })); },
    async get(id, ownerId, signal) { if (!/^[a-f0-9-]{36}$/.test(id)) throw Error('图片请求标识不正确'); return result(await request(`/api/ai/images/${id}`, ownerId, { signal })); },
    async recent(ownerId, signal) { const data = await request('/api/ai/images', ownerId, { signal }); if (!Array.isArray(data.images) || data.images.length > 12) throw Error('图片记录格式异常'); return data.images.map(result); },
    async read(value, ownerId, signal) { const image = validateGeneratedImage(value); return request(image.media, ownerId, { blob: true, signal }); },
  };
}
