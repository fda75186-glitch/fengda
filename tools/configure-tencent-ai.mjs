import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export const endpoints = {
  tokenhub: 'https://tokenhub.tencentmaas.com/v1/chat/completions',
  hunyuan: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
};
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function equal(a,b) { const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y); }
export function validateSettings(fields) {
  const endpoint=endpoints[fields.service];
  const key=String(fields.key||'').trim(),model=String(fields.model||'').trim();
  if(!endpoint)throw Error('请选择腾讯官方API服务。');
  if(key.length<12||key.length>512||/[\s\0]/.test(key))throw Error('请填写完整的腾讯云API Key。');
  if(key.startsWith('sk-tp-'))throw Error('请使用在线推理API Key；此入口不使用个人Token Plan套餐密钥。');
  if(!/^[a-zA-Z0-9_.:-]{1,80}$/.test(model))throw Error('请填写控制台列出的模型ID，例如hy3。');
  return {TENCENT_API_KEY:key,TENCENT_AI_ENDPOINT:endpoint,TENCENT_AI_MODEL:model};
}
function page(nonce, note='', saved=false) {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>星语 · 腾讯AI配置</title><style>
  *{box-sizing:border-box}body{margin:0;background:#f3f6f8;color:#243b4a;font:16px/1.7 system-ui,sans-serif;padding:36px 18px}main{max-width:620px;margin:auto;background:#fff;border:1px solid #dce5eb;border-radius:20px;padding:32px}h1{font-size:26px;margin:0 0 8px}p{color:#688396}label{display:block;margin:20px 0 6px;font-weight:600}input,select,button{width:100%;font:inherit;border:1px solid #bfd0dc;border-radius:10px;padding:12px;background:#fff;color:inherit}button{margin-top:24px;background:#2b4d61;color:white;cursor:pointer}.note{padding:12px 16px;background:#edf4f8;border-radius:10px;overflow-wrap:anywhere}small{color:#7891a3}a{color:#326781}footer{margin-top:24px;font-size:13px}</style>
  <main><h1>腾讯混元接入星语</h1><p>本页只在你的电脑配置预览服务。元宝App账号不作为API凭据。</p>
  ${note?`<p class="note" role="status">${escape(note)}</p>`:''}
  ${saved?'<p>回到星语预览，打开AI星语后点击刷新状态，登录并发送一个问题即可验证。</p>':`<form method="post" action="/configure/${nonce}">
  <input type="hidden" name="nonce" value="${nonce}"><label for="service">腾讯API服务</label><select id="service" name="service"><option value="tokenhub">TokenHub（新接入）</option><option value="hunyuan">旧版混元（已有API Key）</option></select>
  <label for="key">API Key</label><input id="key" name="key" type="password" autocomplete="off" required maxlength="512" placeholder="填写腾讯云API Key"><small>在此填写，不要发送到聊天中。</small>
  <label for="model">模型ID</label><input id="model" name="model" value="hy3" required maxlength="80"><small>TokenHub默认hy3；旧版混元可填写hunyuan-turbos-latest，需与你控制台已开通模型一致。</small><button type="submit">保存到本机预览</button></form>`}
  <footer>密钥保存在本机忽略文件，排除源码和分享ZIP；本页只保存配置。<br><a href="https://console.cloud.tencent.com/tokenhub/apikey" target="_blank" rel="noopener noreferrer">腾讯云API Key管理</a> · <a href="https://cloud.tencent.com/document/product/1823/130078" target="_blank" rel="noopener noreferrer">官方接入说明</a></footer></main></html>`;
}
export async function createSetupServer({configFile,port=0}={}) {
  if(!configFile||!resolve(configFile).endsWith('.env.ai.local.json'))throw Error('An explicit .env.ai.local.json file is required');
  const target=resolve(configFile),nonce=randomBytes(32).toString('hex');let origin;
  const server=createServer(async(req,res)=>{
    const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
    const reply=(code,html)=>{res.writeHead(code,headers);res.end(html);};
    if(req.socket.remoteAddress!=='127.0.0.1'||req.headers.host!==new URL(origin).host||req.url!==`/configure/${nonce}`){reply(404,'Not found');return;}
    if(req.method==='GET'){reply(200,page(nonce));return;}
    if(req.method!=='POST'||req.headers.origin!==origin||req.headers['content-type']?.split(';')[0]!=='application/x-www-form-urlencoded'){reply(403,'Forbidden');return;}
    try {
      let size=0;const parts=[];for await(const chunk of req){size+=chunk.length;if(size>4096){reply(413,'Request too large');return;}parts.push(chunk);}
      const fields=Object.fromEntries(new URLSearchParams(Buffer.concat(parts).toString('utf8')));
      if(!equal(fields.nonce,nonce)){reply(403,'Forbidden');return;}
      const settings=validateSettings(fields);
      await mkdir(dirname(target),{recursive:true});
      const temporary=target+'.pending';
      await writeFile(temporary,JSON.stringify(settings),{mode:0o600});await rename(temporary,target);
      reply(200,page(nonce,'已保存。本页没有发起模型调用。',true));
    }catch(error){reply(400,page(nonce,error.message?.startsWith('请')?error.message:'配置未保存，请检查本机文件权限后重试。'));}
  });
  await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept);});
  origin=`http://127.0.0.1:${server.address().port}`;
  return {url:`${origin}/configure/${nonce}`,close:()=>new Promise(accept=>server.close(accept)),configFile:target};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const file=resolve(process.argv[2]||'.env.ai.local.json');
  const app=await createSetupServer({configFile:file});console.log(JSON.stringify({url:app.url,credentials:'local ignored configuration; no key in output'}));
  process.once('SIGINT',async()=>{await app.close();process.exit(0);});
}
