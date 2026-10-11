// Shared domain API. Both the local SQLite adapter and Cloudflare D1/R2 call this code.
const encoder = new TextEncoder();
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const PASSWORD_ITERATIONS = 100000;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const CATEGORY_MAP = { '星空摄影': '摄影分享', '行星观测': '观星日记' };
const CATEGORIES = ['观星日记', '天文问答', '摄影分享', '学习交流'];
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIMES = ['video/mp4', 'video/webm'];

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
function fail(status, code, message) { throw new ApiError(status, code, message); }
function hex(bytes) { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); }
function unhex(value) { return Uint8Array.from(value.match(/.{2}/g) || [], value => parseInt(value, 16)); }
async function digest(value) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
function randomHex(length = 32) { return hex(crypto.getRandomValues(new Uint8Array(length))); }
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(salt), iterations: PASSWORD_ITERATIONS }, key, 256);
  return hex(new Uint8Array(bits));
}
function equalHashes(left, right) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}
function valueText(value, min, max, label) {
  if (typeof value !== 'string') fail(400, 'VALIDATION', `${label}格式不正确`);
  const text = value.trim();
  if (text.length < min || text.length > max) fail(400, 'VALIDATION', `${label}需为 ${min}–${max} 个字符`);
  return text;
}
function listText(value, maximum, label) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximum) fail(400, 'VALIDATION', `${label}最多 ${maximum} 项`);
  return [...new Set(value.map(value => valueText(value, 1, 40, label)))];
}
function validateCredentials(input) {
  const username = valueText(input.username, 2, 30, '用户名').normalize('NFKC').trim();
  if (username.length < 2 || username.length > 30 || !/^[\p{L}\p{N}_\-.]+$/u.test(username)) {
    fail(400, 'VALIDATION', '用户名需为 2–30 个字，使用文字、数字、下划线或点号');
  }
  if (typeof input.password !== 'string' || input.password.length < 8 || input.password.length > 128) {
    fail(400, 'VALIDATION', '密码需为 8–128 个字符');
  }
  return { username, usernameKey: username.toLocaleLowerCase('en-US'), password: input.password };
}
function allowedOrigin(origin, context, request) {
  if (!origin || origin === new URL(request.url).origin) return true;
  return context.allowedOrigins?.includes(origin) || (context.allowLoopback && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin));
}
function headersFor(request, context) {
  const headers = new Headers({ 'Cache-Control': 'no-store', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' });
  const origin = request.headers.get('Origin');
  if (origin && allowedOrigin(origin, context, request)) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Filename,Range,Idempotency-Key');
  headers.set('Access-Control-Expose-Headers', 'Content-Range,Accept-Ranges,Content-Length');
  return headers;
}
function json(request, context, value, status = 200) {
  const headers = headersFor(request, context);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(value), { status, headers });
}
async function limitedBytes(request, maximum) {
  if (Number(request.headers.get('Content-Length') || 0) > maximum) fail(413, 'TOO_LARGE', '文件或内容超过大小限制');
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); fail(413, 'TOO_LARGE', '文件或内容超过大小限制'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
async function inputJson(request) {
  const bytes = await limitedBytes(request, 256 * 1024);
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { fail(400, 'BAD_JSON', '请求内容不是有效 JSON'); }
}
async function rate(context, key, maximum, windowMs) {
  const bucket = Math.floor(Date.now() / windowMs);
  const id = `${key}:${bucket}`;
  await context.DB.prepare('INSERT INTO rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').bind(id, (bucket + 1) * windowMs).run();
  const row = await context.DB.prepare('SELECT count FROM rate_limits WHERE key=?').bind(id).first();
  if (row.count > maximum) fail(429, 'RATE_LIMIT', '操作较频繁，请稍后再试');
}
async function authenticated(request, context, required = true) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!/^[a-f0-9]{64}$/.test(token)) {
    if (required) fail(401, 'LOGIN_REQUIRED', '请先登录星语账号');
    return null;
  }
  const tokenHash = await digest(token);
  const row = await context.DB.prepare('SELECT a.id,a.username,s.expires_at FROM account_sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?').bind(tokenHash, Date.now()).first();
  if (!row) {
    if (required) fail(401, 'SESSION_EXPIRED', '登录已过期，请重新登录');
    return null;
  }
  return { user: { id: row.id, name: row.username, avatar: null }, owner: `account:${row.id}`, tokenHash, expiresAt: row.expires_at };
}
async function startSession(context, user) {
  const token = randomHex();
  const expiresAt = Date.now() + SESSION_MS;
  await context.DB.prepare('INSERT INTO account_sessions(token_hash,account_id,expires_at,created_at) VALUES(?,?,?,?)').bind(await digest(token), user.id, expiresAt, Date.now()).run();
  await context.DB.prepare('DELETE FROM account_sessions WHERE expires_at<?').bind(Date.now()).run();
  return { token, user: { id: user.id, name: user.username, avatar: null }, expiresAt };
}
async function accountAction(request, context, action) {
  if (action === 'me') {
    const session = await authenticated(request, context);
    return json(request, context, { user: session.user, expiresAt: session.expiresAt });
  }
  if (action === 'logout') {
    const session = await authenticated(request, context, false);
    if (session) await context.DB.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(session.tokenHash).run();
    return json(request, context, { ok: true });
  }
  const credentials = validateCredentials(await inputJson(request));
  const sourceIp = request.headers.get('CF-Connecting-IP') || context.remoteAddress || 'local';
  await rate(context, `auth-ip:${await digest(sourceIp)}`, 30, 60 * 1000);
  await rate(context, `auth-user:${await digest(credentials.usernameKey)}`, 15, 60 * 1000);
  const existing = await context.DB.prepare('SELECT * FROM accounts WHERE username_key=?').bind(credentials.usernameKey).first();
  if (action === 'register') {
    if (existing) fail(409, 'USERNAME_TAKEN', '这个用户名已被使用');
    const user = { id: crypto.randomUUID(), username: credentials.username };
    const salt = randomHex(16);
    const password = await passwordHash(credentials.password, salt);
    try {
      await context.DB.prepare('INSERT INTO accounts(id,username_key,username,salt,password_hash,created_at) VALUES(?,?,?,?,?,?)').bind(user.id, credentials.usernameKey, user.username, salt, password, Date.now()).run();
    } catch (error) {
      if (/UNIQUE|constraint/i.test(error.message || '')) fail(409, 'USERNAME_TAKEN', '这个用户名已被使用');
      throw error;
    }
    return json(request, context, await startSession(context, user), 201);
  }
  // Execute the same password work for unknown accounts to avoid an account-existence timing shortcut.
  const calculated = await passwordHash(credentials.password, existing?.salt || '00000000000000000000000000000000');
  if (!existing || !equalHashes(calculated, existing.password_hash)) fail(401, 'BAD_CREDENTIALS', '用户名或密码不正确');
  return json(request, context, await startSession(context, existing));
}
function recordEvent(context, owner) {
  return context.DB.prepare('INSERT INTO events(owner,created_at) VALUES(?,?)').bind(owner, Date.now());
}
async function readablePost(context, id, session) {
  const post = await context.DB.prepare('SELECT * FROM posts WHERE id=?').bind(id).first();
  if (!post || (post.visibility === 'private' && post.owner !== session?.owner)) fail(404, 'NOT_FOUND', '内容不存在或无权访问');
  return post;
}
function jsonList(value) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
async function listPosts(request, context, session) {
  const owner = session?.owner || '';
  const result = await context.DB.prepare("SELECT p.*, (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) AS likes, EXISTS(SELECT 1 FROM likes l WHERE l.post_id=p.id AND l.owner=?) AS liked FROM posts p WHERE p.visibility='public' OR p.owner=? ORDER BY p.created_at DESC,p.id DESC LIMIT 200").bind(owner, owner).all();
  const commentResult = await context.DB.prepare("SELECT c.* FROM comments c WHERE c.post_id IN (SELECT id FROM posts WHERE visibility='public' OR owner=? ORDER BY created_at DESC,id DESC LIMIT 200) ORDER BY c.created_at LIMIT 4000").bind(owner).all();
  const comments = new Map();
  for (const comment of commentResult.results) {
    const group = comments.get(comment.post_id) || [];
    group.push({ id: comment.id, author: comment.author, content: comment.content, createdAt: comment.created_at });
    comments.set(comment.post_id, group);
  }
  return json(request, context, { posts: result.results.map(post => ({
    id: post.id, author: post.author, authorId: post.owner.startsWith('account:') ? post.owner.slice(8) : null,
    authorAvatar: null, title: post.title, content: post.content, category: CATEGORY_MAP[post.category] || post.category,
    target: post.target, location: post.location, images: jsonList(post.images), createdAt: post.created_at,
    kind: post.kind, type: post.kind, communities: jsonList(post.communities), topics: jsonList(post.topics),
    tags: jsonList(post.topics), video: post.video, videoUrl: post.video, cover: post.cover, coverImage: post.cover,
    visibility: post.visibility, originality: post.originality, sourceUrl: post.source_url, format: post.format,
    likes: post.likes, liked: Boolean(post.liked), owned: post.owner === owner,
    isExample: post.owner === 'system:editor', comments: comments.get(post.id) || [],
  })) });
}
function mediaId(value) {
  if (typeof value !== 'string') fail(400, 'MEDIA_INVALID', '媒体地址格式不正确');
  const match = value.match(/^\/api\/(?:media|images)\/([a-f0-9-]{36})$/);
  if (!match || !UUID.test(match[1])) fail(400, 'MEDIA_INVALID', '请使用自己上传的媒体文件');
  return match[1];
}
async function ownMedia(context, owner, url, expected) {
  const id = mediaId(url);
  const media = await context.DB.prepare('SELECT * FROM media WHERE id=? AND owner=?').bind(id, owner).first();
  if (!media || !(expected === 'image' ? IMAGE_MIMES : VIDEO_MIMES).includes(media.mime)) fail(403, 'MEDIA_OWNERSHIP', '媒体文件不属于当前账号或类型不符合要求');
  return `/api/media/${id}`;
}
async function createPost(request, context, session) {
  const input = await inputJson(request);
  const title = valueText(input.title, 2, 80, '标题');
  const content = valueText(input.content || '', 1, 20000, '正文');
  const kind = input.kind || input.type || 'image';
  if (!['image', 'article', 'video'].includes(kind)) fail(400, 'VALIDATION', '请选择图文、文章或视频');
  const category = CATEGORY_MAP[input.category] || input.category;
  if (!CATEGORIES.includes(category)) fail(400, 'VALIDATION', '请选择有效的社区分类');
  const communities = listText(input.communities, 2, '关联社区');
  const topics = listText(input.topics || input.tags, 5, '关联话题');
  const images = input.images || [];
  if (!Array.isArray(images) || images.length > 9) fail(400, 'VALIDATION', '最多上传 9 张图片');
  const checkedImages = [];
  for (const url of images) checkedImages.push(await ownMedia(context, session.owner, url, 'image'));
  const video = input.video || input.videoUrl ? await ownMedia(context, session.owner, input.video || input.videoUrl, 'video') : '';
  if (kind === 'video' && !video) fail(400, 'VALIDATION', '请先上传视频');
  if (kind !== 'video' && video) fail(400, 'VALIDATION', '视频只能用于视频发布类型');
  const cover = input.cover || input.coverImage ? await ownMedia(context, session.owner, input.cover || input.coverImage, 'image') : '';
  const visibility = input.visibility || 'public';
  if (!['public', 'private'].includes(visibility)) fail(400, 'VALIDATION', '可见范围不正确');
  const originality = input.originality || 'original';
  if (!['original', 'repost', '原创', '转载'].includes(originality)) fail(400, 'VALIDATION', '内容声明不正确');
  const sourceUrl = valueText(input.sourceUrl || '', 0, 1000, '来源链接');
  if (sourceUrl) { try { if (!['https:', 'http:'].includes(new URL(sourceUrl).protocol)) throw new Error(); } catch { fail(400, 'VALIDATION', '来源链接需为 http 或 https 地址'); } }
  const format = input.format || 'plain';
  if (!['plain', 'markdown'].includes(format)) fail(400, 'VALIDATION', '正文格式不正确');
  const target = valueText(input.target || '', 0, 40, '观测对象');
  const location = valueText(input.location || '', 0, 60, '观测地点');
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await context.DB.batch([
    context.DB.prepare('INSERT INTO posts(id,owner,author,title,content,category,target,location,images,created_at,kind,communities,topics,video,cover,visibility,originality,source_url,format) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, session.owner, session.user.name, title, content, category, target, location, JSON.stringify(checkedImages), createdAt, kind, JSON.stringify(communities), JSON.stringify(topics), video, cover, visibility, originality, sourceUrl, format),
    recordEvent(context, session.owner),
  ]);
  context.notify?.();
  return json(request, context, { id }, 201);
}
function validSignature(bytes, mime) {
  if (bytes.length < 12) return false;
  if (mime === 'image/jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'image/png') return bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10;
  if (mime === 'image/webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  if (mime === 'video/mp4') return new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp';
  return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
}
async function upload(request, context, session, imageOnly) {
  const mime = (request.headers.get('Content-Type') || '').split(';')[0].toLowerCase();
  if (!(imageOnly ? IMAGE_MIMES : [...IMAGE_MIMES, ...VIDEO_MIMES]).includes(mime)) fail(415, 'MEDIA_TYPE', '请上传 JPG、PNG、WebP 图片或 MP4、WebM 视频');
  await rate(context, `uploads:${session.owner}`, 60, 60 * 60 * 1000);
  const maximum = (VIDEO_MIMES.includes(mime) ? 50 : 8) * 1024 * 1024;
  const bytes = await limitedBytes(request, maximum);
  if (!validSignature(bytes, mime)) fail(415, 'MEDIA_SIGNATURE', '文件内容与声明的媒体格式不一致');
  let filename = request.headers.get('X-Filename') || 'upload';
  try { filename = decodeURIComponent(filename); } catch { /* Plain header is also accepted. */ }
  filename = filename.replace(/[\x00-\x1f\x7f/\\]/g, '').slice(0, 180) || 'upload';
  const id = crypto.randomUUID();
  await context.BUCKET.put(`media/${id}`, bytes, { httpMetadata: { contentType: mime } });
  try {
    await context.DB.prepare('INSERT INTO media(id,owner,mime,bytes,filename,created_at) VALUES(?,?,?,?,?,?)').bind(id, session.owner, mime, bytes.byteLength, filename, Date.now()).run();
  } catch (error) { await context.BUCKET.delete(`media/${id}`); throw error; }
  return json(request, context, { url: `/api/media/${id}` }, 201);
}
async function serveMedia(request, context, id) {
  const row = await context.DB.prepare('SELECT * FROM media WHERE id=?').bind(id).first();
  const legacy = !row ? await context.DB.prepare('SELECT * FROM images WHERE id=?').bind(id).first() : null;
  const media = row || legacy;
  if (!media) fail(404, 'NOT_FOUND', '媒体文件不存在');
  const session = await authenticated(request, context, false);
  if (media.owner !== session?.owner) {
    const relative = `/api/media/${id}`;
    const publicPost = await context.DB.prepare("SELECT id FROM posts WHERE visibility='public' AND (images LIKE ? OR video=? OR cover=?) LIMIT 1").bind(`%${id}%`, relative, relative).first();
    if (!publicPost) fail(404, 'NOT_FOUND', '媒体文件不存在或无权访问');
  }
  const headers = headersFor(request, context);
  headers.set('Content-Type', media.mime);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Disposition', 'inline');
  headers.set('Content-Security-Policy', "default-src 'none'");
  // Responses may be authenticated/private; do not share-cache the result.
  let start = 0;
  let end = media.bytes - 1;
  let status = 200;
  const range = request.headers.get('Range');
  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match || (!match[1] && !match[2])) { headers.set('Content-Range', `bytes */${media.bytes}`); return new Response(null, { status: 416, headers }); }
    if (!match[1]) start = Math.max(0, media.bytes - Number(match[2]));
    else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), media.bytes - 1) : media.bytes - 1; }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= media.bytes) { headers.set('Content-Range', `bytes */${media.bytes}`); return new Response(null, { status: 416, headers }); }
    status = 206;
    headers.set('Content-Range', `bytes ${start}-${end}/${media.bytes}`);
  }
  headers.set('Content-Length', String(end - start + 1));
  if (request.method === 'HEAD') return new Response(null, { status, headers });
  const object = await context.BUCKET.get(`${legacy ? 'images' : 'media'}/${id}`, { range: { offset: start, length: end - start + 1 } });
  if (!object) fail(404, 'NOT_FOUND', '媒体文件不存在');
  return new Response(object.body, { status, headers });
}
async function postAction(request, context, session, id, action) {
  const post = await readablePost(context, id, session);
  const input = await inputJson(request);
  if (action === 'comments') {
    const content = valueText(input.content, 1, 500, '评论');
    await context.DB.batch([
      context.DB.prepare('INSERT INTO comments(id,post_id,owner,author,content,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), id, session.owner, session.user.name, content, Date.now()),
      recordEvent(context, session.owner),
    ]);
  } else if (action === 'like') {
    const key = `${id}:${session.owner}`;
    const existing = await context.DB.prepare('SELECT id FROM likes WHERE id=?').bind(key).first();
    await context.DB.batch([
      existing ? context.DB.prepare('DELETE FROM likes WHERE id=?').bind(key) : context.DB.prepare('INSERT INTO likes(id,post_id,owner,created_at) VALUES(?,?,?,?)').bind(key, id, session.owner, Date.now()),
      recordEvent(context, session.owner),
    ]);
  } else {
    if (post.owner !== session.owner) fail(403, 'FORBIDDEN', '只能删除自己发布的内容');
    await context.DB.batch([
      context.DB.prepare('DELETE FROM comments WHERE post_id=?').bind(id),
      context.DB.prepare('DELETE FROM likes WHERE post_id=?').bind(id),
      context.DB.prepare('DELETE FROM posts WHERE id=? AND owner=?').bind(id, session.owner),
      recordEvent(context, session.owner),
    ]);
  }
  context.notify?.();
  return json(request, context, { ok: true }, action === 'comments' ? 201 : 200);
}
function subscribe(request, context) {
  const headers = headersFor(request, context);
  headers.set('Content-Type', 'text/event-stream');
  headers.set('X-Accel-Buffering', 'no');
  let timer;
  let unsubscribe;
  let stopped = false;
  const stream = new ReadableStream({
    start(controller) {
      let revision = -1;
      const send = text => { if (!stopped) controller.enqueue(encoder.encode(text)); };
      const stop = () => { if (stopped) return; stopped = true; clearTimeout(timer); unsubscribe?.(); try { controller.close(); } catch { /* Already canceled. */ } };
      request.signal.addEventListener('abort', stop, { once: true });
      send('retry: 5000\n\n');
      const emit = async () => {
        try {
          const row = await context.DB.prepare('SELECT MAX(id) AS revision FROM events').first();
          const next = row?.revision || 0;
          if (revision !== next) { send(`event: change\ndata: ${next}\n\n`); revision = next; }
          else send(': heartbeat\n\n');
        } catch { send('event: unavailable\ndata: retry\n\n'); stop(); }
      };
      void emit();
      if (context.subscribe) {
        unsubscribe = context.subscribe(() => { void emit(); });
        const heartbeat = () => { if (!stopped) { send(': heartbeat\n\n'); timer = setTimeout(heartbeat, 15000); timer.unref?.(); } };
        timer = setTimeout(heartbeat, 15000); timer.unref?.();
      } else {
        // D1 has no push subscription; this preserves the existing service's SSE revision transport.
        let ticks = 0;
        const tick = async () => { if (stopped) return; await emit(); if (++ticks >= 24) stop(); else timer = setTimeout(tick, 4000); };
        timer = setTimeout(tick, 4000);
      }
    },
    cancel() { stopped = true; clearTimeout(timer); unsubscribe?.(); },
  });
  return new Response(stream, { headers });
}

export async function handleApi(request, context) {
  try {
    if (!allowedOrigin(request.headers.get('Origin'), context, request)) fail(403, 'ORIGIN_DENIED', '此来源无权访问社区服务');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headersFor(request, context) });
    const path = new URL(request.url).pathname;
    if (request.method === 'GET' && path === '/api/health') {
      if (!context.DB || !context.BUCKET) fail(503, 'STORAGE_UNAVAILABLE', '社区存储尚未配置');
      await context.DB.prepare('SELECT COUNT(*) AS n FROM accounts').first();
      return json(request, context, { status: 'ready', version: '0.1.3', storage: context.storageName || 'D1 + R2', auth: 'username-password', video: true });
    }
    const authMatch = path.match(/^\/api\/auth\/(register|login|me|logout)$/);
    if (authMatch && request.method === (authMatch[1] === 'me' ? 'GET' : 'POST')) return await accountAction(request, context, authMatch[1]);
    if (request.method === 'GET' && path === '/api/posts') return await listPosts(request, context, await authenticated(request, context, false));
    if (request.method === 'GET' && path === '/api/events') return subscribe(request, context);
    const mediaMatch = path.match(/^\/api\/(?:media|images)\/([a-f0-9-]{36})$/);
    if (mediaMatch && UUID.test(mediaMatch[1]) && ['GET', 'HEAD'].includes(request.method)) return await serveMedia(request, context, mediaMatch[1]);
    if (path === '/api/session') fail(410, 'ACCOUNT_REQUIRED', '此版本使用真实账号，请注册或登录，不再创建匿名发布会话');
    if (request.method !== 'POST') fail(404, 'NOT_FOUND', '没有找到此接口');
    const session = await authenticated(request, context);
    await rate(context, `writes:${session.owner}`, 40, 60 * 1000);
    if (path === '/api/media' || path === '/api/images') return await upload(request, context, session, path === '/api/images');
    if (path === '/api/posts') return await createPost(request, context, session);
    const postMatch = path.match(/^\/api\/posts\/([a-f0-9-]{36})\/(comments|like|delete)$/);
    if (postMatch && UUID.test(postMatch[1])) return await postAction(request, context, session, postMatch[1], postMatch[2]);
    fail(404, 'NOT_FOUND', '没有找到此接口');
  } catch (error) {
    if (!(error instanceof ApiError)) {
      // Do not log request bodies, passwords, bearer tokens or storage contents.
      console.error('Community API internal failure');
    }
    return json(request, context, { error: error instanceof ApiError ? error.message : '社区数据服务暂时不可用，请稍后重试', code: error.code || 'INTERNAL_ERROR' }, error.status || 500);
  }
}
