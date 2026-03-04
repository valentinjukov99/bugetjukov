// Minimal IndexedDB helper for storing projects under 'projects' store
const DB_NAME = 'buget-db-v1';
const STORE = 'projects';

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    } catch (e) { rej(e); }
  });
}

export async function getAllProjects(): Promise<any[]> {
  const db = await openDB();
  return new Promise((res, rej) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => rej(req.error);
    } catch (e) { rej(e); }
  });
}

export async function getProject(id: string): Promise<any | null> {
  const db = await openDB();
  return new Promise((res, rej) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => rej(req.error);
    } catch (e) { rej(e); }
  });
}

export async function putProject(obj: any): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.put(obj);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    } catch (e) { rej(e); }
  });
}

export async function clearProjects(): Promise<void> {
  const db = await openDB();
  return new Promise((res, rej) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      const req = store.clear();
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    } catch (e) { rej(e); }
  });
}

// Migrate existing localStorage key 'local_projects_v1' into IndexedDB (best-effort)
export async function migrateFromLocalStorage(): Promise<void> {
  try {
    const raw = window.localStorage.getItem('local_projects_v1');
    if (!raw) return;
    const arr = JSON.parse(raw) as any[];
    for (const p of arr) { try { await putProject(p); } catch { /* ignore per-item errors */ } }
  } catch { /* ignore migration errors */ }
}

export default { openDB, getAllProjects, getProject, putProject, clearProjects, migrateFromLocalStorage };
