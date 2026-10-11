const databaseName = 'xingyu-publishing-drafts-v1';
let connection;

function database() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('当前浏览器不支持草稿存储。请保留编辑页面。'));
  if (!connection) connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { connection = null; reject(new Error('无法打开草稿箱，请检查浏览器存储权限。')); };
    request.onblocked = () => { connection = null; reject(new Error('草稿箱正被另一个窗口占用，请关闭旧窗口后重试。')); };
  });
  return connection;
}

async function transaction(mode, operation) {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('drafts', mode);
    let result;
    const request = operation(tx.objectStore('drafts'));
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(new Error(tx.error?.name === 'QuotaExceededError' ? '草稿空间不足，请删除旧草稿或减少视频大小。' : '草稿保存失败，当前编辑内容仍然保留。'));
    tx.onabort = () => reject(new Error('草稿操作中断，当前编辑内容仍然保留。'));
  });
}

export async function savePublishingDraft(draft) { return transaction('readwrite', store => store.put(draft)); }
export async function readPublishingDraft(id) { return transaction('readonly', store => store.get(id)); }
export async function listPublishingDrafts() {
  const values = await transaction('readonly', store => store.getAll());
  return values.filter(item => item.id !== 'current-edit').sort((a, b) => b.updatedAt - a.updatedAt);
}
export async function deletePublishingDraft(id) { return transaction('readwrite', store => store.delete(id)); }
