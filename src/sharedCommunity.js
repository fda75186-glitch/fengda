import { ref } from 'vue';
export const COMMUNITY_API='https://xingyu-shared-community.aptbook6.chatgpt.site';
export const communityPosts=ref([]),communityStatus=ref('loading');
let sessionToken='',connection,connections=0;
try{sessionToken=localStorage.getItem('xingyu-community-session-v2')||''}catch{}
export async function communityRequest(path,options={}){
 const headers=new Headers(options.headers);if(sessionToken)headers.set('Authorization','Bearer '+sessionToken);
 const response=await fetch(COMMUNITY_API+path,{...options,headers});const data=await response.json();if(!response.ok)throw new Error(data.error||'社区暂时无法连接，请稍后重试');return data;
}
export async function ensureSession(){if(sessionToken)return;const data=await communityRequest('/api/session',{method:'POST'});sessionToken=data.token;try{localStorage.setItem('xingyu-community-session-v2',sessionToken)}catch{}}
export async function refreshCommunity(){try{const data=await communityRequest('/api/posts');communityPosts.value=data.posts;communityStatus.value='ready'}catch(e){communityStatus.value='error';throw e}}
export function connectCommunity(){connections++;if(connection)return()=>disconnect();refreshCommunity().catch(()=>{});connection=new EventSource(COMMUNITY_API+'/api/events');connection.addEventListener('change',()=>refreshCommunity().catch(()=>{}));connection.onopen=()=>{communityStatus.value='ready';refreshCommunity().catch(()=>{})};connection.onerror=()=>{if(!communityPosts.value.length)communityStatus.value='error'};return()=>disconnect()}
function disconnect(){connections--;if(connections<=0){connection?.close();connection=null;connections=0}}
export async function communityWrite(path,data){await ensureSession();return communityRequest(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})}
export async function uploadPhoto(file){await ensureSession();if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请选择 JPG、PNG 或 WebP 图片');if(file.size>8*1024*1024)throw new Error('单张图片请小于 8 MB');const data=await communityRequest('/api/images',{method:'POST',headers:{'Content-Type':file.type},body:file});return data.url}
