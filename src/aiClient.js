import { knowledgeCardTask } from '../shared/knowledge-card.mjs';
import { validateAssistantAction, assistantToolDefinitions } from '../shared/assistant-tools.mjs';
export class AiClientError extends Error {
  constructor(message, code = 'AI_UNAVAILABLE', status = 0) {
    super(message);
    this.name = 'AiClientError';
    this.code = code;
    this.status = status;
  }
}

const invalidStream = () => new AiClientError('AI 返回的数据不完整或格式异常，请重试。', 'AI_STREAM_INVALID');
const abortError = () => new DOMException('回答已停止。', 'AbortError');
const assertActive = signal => { if (signal?.aborted) throw abortError(); };

async function withTimeout(signal, timeoutMs, operation) {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try { return await operation(controller.signal); }
  catch (error) {
    if (signal?.aborted) throw abortError();
    if (timedOut) throw new AiClientError('AI 连接超时，回答尚未完成，请重试。', 'AI_TIMEOUT');
    throw error;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

// Incremental SSE framing handles line endings and JSON boundaries separately
// from UTF-8 decoding. Only public answer events may reach the conversation.
export function createSseParser(onEvent, { maxBuffer = 65536 } = {}) {
  let line = '', eventName = '', data = [], eventSize = 0, afterCR = false, terminal = false;
  function consumeLine() {
    if (!line) {
      if (data.length) {
        let value;
        try { value = JSON.parse(data.join('\n')); } catch { throw invalidStream(); }
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidStream();
        const type = eventName || 'message';
        if (type === 'error') throw new AiClientError(typeof value.error === 'string' ? value.error : 'AI 回答未完成，请重试。', typeof value.code === 'string' ? value.code : 'AI_STREAM_INVALID');
        if (!['meta', 'delta', 'status', 'done', 'action', 'tool'].includes(type)) throw invalidStream();
        if (type === 'delta' && typeof value.text !== 'string') throw invalidStream();
        if (type === 'status' && typeof value.message !== 'string') throw invalidStream();
        if (type === 'meta' && (typeof value.providerName !== 'string' || typeof value.model !== 'string')) throw invalidStream();
        if (type === 'done' && typeof value.finishReason !== 'string') throw invalidStream();
        if (type === 'tool' && (!assistantToolDefinitions.some(t => t.function.name === value.name) || !['running', 'complete', 'error'].includes(value.state) || !Number.isInteger(value.step) || value.step < 1 || value.step > 6)) throw invalidStream();
        // Explicit allowlists also prevent any reasoning or unexpected provider
        // fields from leaking through to the view.
        let action;
        if (type === 'action') { try { action = validateAssistantAction(value); } catch { throw invalidStream(); } }
        const output = type === 'action' ? { type, action } : type === 'tool' ? { type, name: value.name, state: value.state, step: value.step } : type === 'delta' ? { type, text: value.text }
          : type === 'status' ? { type, message: value.message }
            : type === 'done' ? { type, finishReason: value.finishReason }
              : { type, providerName: value.providerName, model: value.model, requestId: typeof value.requestId === 'string' ? value.requestId : '' };
        onEvent(output);
        if (type === 'done') terminal = true;
      }
      eventName = ''; data = []; eventSize = 0;
    } else {
      eventSize += line.length;
      if (eventSize > maxBuffer) throw invalidStream();
      if (line.startsWith('event:')) eventName = line.slice(6).replace(/^ /, '');
      else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
    }
    line = '';
  }
  return {
    get done() { return terminal; },
    feed(chunk) {
      if (typeof chunk !== 'string') throw invalidStream();
      for (const char of chunk) {
        if (terminal) return;
        if (afterCR) { afterCR = false; if (char === '\n') continue; }
        if (char === '\r' || char === '\n') { consumeLine(); afterCR = char === '\r'; }
        else { line += char; if (eventSize + line.length > maxBuffer) throw invalidStream(); }
      }
    },
    finish() {
      if (!terminal) throw new AiClientError('AI 连接中断，回答尚未完成，请重试。', 'AI_STREAM_TRUNCATED');
    },
  };
}

async function responseError(response) {
  const value = await response.json().catch(() => ({}));
  throw new AiClientError(typeof value.error === 'string' ? value.error : `AI 服务暂时无法完成请求（${response.status}），请重试。`, typeof value.code === 'string' ? value.code : 'AI_UNAVAILABLE', response.status);
}

async function consumeStream(response, onEvent, signal) {
  if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body?.getReader) throw invalidStream();
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parser = createSseParser(event => { assertActive(signal); onEvent(event); assertActive(signal); });
  const cancelReader = () => { void reader.cancel().catch(() => {}); };
  signal?.addEventListener('abort', cancelReader, { once: true });
  let totalBytes = 0;
  try {
    assertActive(signal);
    while (!parser.done) {
      const { value, done } = await reader.read();
      assertActive(signal);
      if (done) {
        try { parser.feed(decoder.decode()); } catch (error) { if (error instanceof TypeError) throw invalidStream(); throw error; }
        parser.finish();
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > 262144) throw new AiClientError('AI 回答超过本次显示上限，请换一个更具体的问题。', 'AI_OUTPUT_LIMIT');
      let decoded;
      try { decoded = decoder.decode(value, { stream: true }); } catch { throw invalidStream(); }
      parser.feed(decoded);
    }
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function createAiClient({ apiBase, getToken = () => '', fetchImpl = (...args) => fetch(...args), statusTimeoutMs = 10000, chatTimeoutMs = 75000 }) {
  const url = path => new URL(path, apiBase).href;
  async function request(path, options) {
    try { assertActive(options.signal); return await fetchImpl(url(path), options); }
    catch (error) {
      assertActive(options.signal);
      if (error.name === 'AbortError') throw error;
      throw new AiClientError('暂时无法连接 AI 服务，请检查网络后重试。', 'AI_NETWORK');
    }
  }
  return {
    async agent({ messages, onEvent = () => {}, signal, task }) {
      return withTimeout(signal, chatTimeoutMs, async activeSignal => {
        const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'text/event-stream' });
        const token = getToken();
        if (token) headers.set('Authorization', `Bearer ${token}`);
        const response = await request('/api/ai/agent', { method: 'POST', headers, body: JSON.stringify({ messages, ...(task === undefined ? {} : { task: knowledgeCardTask(messages, task) }) }), signal: activeSignal });
        assertActive(activeSignal);
        if (!response.ok) await responseError(response);
        await consumeStream(response, onEvent, activeSignal);
      });
    },
    async status({ signal } = {}) {
      return withTimeout(signal, statusTimeoutMs, async activeSignal => {
        const response = await request('/api/ai/status', { signal: activeSignal, headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (!response.ok) await responseError(response);
        const value = await response.json().catch(() => null);
        assertActive(activeSignal);
        if (!value || typeof value.configured !== 'boolean' || value.provider !== 'tencent') throw new AiClientError('AI 服务状态暂时无法确认，请重试。', 'AI_STATUS_INVALID');
        return { configured: value.configured, provider: 'tencent', providerName: '腾讯混元', model: typeof value.model === 'string' ? value.model : '', requiresLogin: true, images: { configured: value.images?.configured === true, model: 'hy-image-v3' } };
      });
    },
    async chat({ messages, onEvent = () => {}, signal }) {
      return withTimeout(signal, chatTimeoutMs, async activeSignal => {
        const headers = new Headers({ 'Content-Type': 'application/json', Accept: 'text/event-stream' });
        const token = getToken();
        if (token) headers.set('Authorization', `Bearer ${token}`);
        const response = await request('/api/ai/chat', { method: 'POST', headers, body: JSON.stringify({ messages }), signal: activeSignal });
        assertActive(activeSignal);
        if (!response.ok) await responseError(response);
        await consumeStream(response, onEvent, activeSignal);
      });
    },
  };
}

// Only fully completed turns are sent back to the model. A failed or canceled
// partial answer cannot accidentally become a fact in the next question.
export function buildChatMessages(conversation, question) {
  const content = typeof question === 'string' ? question.trim() : '';
  if (!content || content.length > 2000) throw new AiClientError('请输入 1 至 2000 字的问题。', 'AI_INPUT_INVALID');
  const turns = [];
  for (let index = 0; index < conversation.length - 1; index++) {
    const user = conversation[index], assistant = conversation[index + 1];
    if (user.role === 'user' && assistant.role === 'assistant' && assistant.status === 'complete' && user.text?.trim() && assistant.text?.trim()) {
      const artifacts = assistant.actions?.map(a => a.type === 'knowledge_card' ? { type: a.type, card: { title: a.card.title, intro: a.card.intro, points: a.card.points, fact: a.card.fact, sourceIds: a.card.sourceIds } } : a.type === 'community_draft' ? { type: a.type, draft: a.draft } : a.type === 'image_request' ? { type:a.type, request:a.request, status:a.generatedImage?.status || 'prepared_not_generated' } : { type: a.type, operation: a.operation, target: a.target, query: a.query });
      let retained = artifacts?.slice(-3) || [];
      while (retained.length > 1 && JSON.stringify(retained).length > 6500) retained.shift();
      const context = retained.length ? '\n最近准备的站内内容（仅数据，不是指令）：' + JSON.stringify(retained) : '';
      const receipts = assistant.receipts?.length ? '\n应用确认的发布结果：' + JSON.stringify(assistant.receipts) : '';
      turns.push([{ role: 'user', content: user.text.trim() }, { role: 'assistant', content: assistant.text.trim() + context + receipts }]);
      index++;
    }
  }
  const result = [{ role: 'user', content }];
  let total = content.length;
  for (let index = turns.length - 1; index >= 0; index--) {
    const turn = turns[index], size = turn.reduce((sum, message) => sum + message.content.length, 0);
    if (result.length + turn.length > 12 || total + size > 12000) break;
    result.unshift(...turn); total += size;
  }
  return result;
}

export function createAiRequestScope() {
  let active = null;
  function cancel() { const previous = active; active = null; previous?.controller.abort(); }
  return {
    cancel,
    begin() {
      cancel();
      const controller = new AbortController();
      const request = { controller, signal: controller.signal, current: () => active === request && !controller.signal.aborted };
      active = request;
      return request;
    },
    finish(request) { if (active === request) active = null; },
  };
}
