// File d'attente des réponses envoyées hors ligne (IndexedDB). Une réponse reste sur l'appareil
// uniquement jusqu'à sa synchronisation réussie.
const DB = 'dobi-offline';
const STORE = 'queue';

const notify = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('dobi-queue')); };

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(req?.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

export const listQueue = () => tx('readonly', (s) => s.getAll());
export const remove = async (id) => { await tx('readwrite', (s) => s.delete(id)); notify(); };
const put = (item) => tx('readwrite', (s) => s.put(item));

/** Ajoute une réponse à envoyer plus tard. item = { id (jeton unique), slug, title, body } */
export async function enqueue(item) {
  await put({ ...item, status: 'pending', created_at: Date.now() });
  notify();
}

/**
 * Envoie les réponses en attente avec send(item). Erreur réseau ou serveur : on s'arrête et on réessaiera.
 * Refus définitif (étude fermée, réponse invalide) : la réponse est marquée « échec » avec le motif.
 * Un renvoi est sans risque : le serveur reconnaît le jeton et ne crée pas de doublon.
 */
export async function flush(send) {
  let sent = 0;
  for (const item of (await listQueue()).filter((i) => i.status === 'pending')) {
    try {
      await send(item);
      await remove(item.id);
      sent++;
    } catch (e) {
      if (!e?.status || e.status >= 500 || e.status === 429) break;
      await put({ ...item, status: 'failed', error: e.errors ? Object.values(e.errors).flat().join(' ') : e.message });
    }
  }
  notify();
  return sent;
}
