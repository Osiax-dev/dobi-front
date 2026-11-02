const BASE = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api/v1').replace(/\/$/, '');

export const getToken = () => localStorage.getItem('dobi_token');
export const setToken = (t) => (t ? localStorage.setItem('dobi_token', t) : localStorage.removeItem('dobi_token'));

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && auth) setToken(null);
    const err = new Error(data?.message || 'Une erreur est survenue.');
    err.status = res.status;
    err.errors = data?.errors || null;
    throw err;
  }
  return data;
}

/** Texte lisible d'une erreur API (messages de validation inclus). */
export function errText(e) {
  if (e?.errors) return Object.values(e.errors).flat().join(' ');
  return e?.message || 'Une erreur est survenue.';
}

export async function downloadCsv(studyId) {
  const res = await fetch(`${BASE}/studies/${studyId}/exports`, {
    headers: { Authorization: `Bearer ${getToken()}`, Accept: 'text/csv' },
  });
  if (!res.ok) throw new Error('Export impossible.');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `etude-${studyId}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Télécharge un export (csv ou xlsx) avec les filtres éventuels (chaîne de paramètres). */
export async function downloadExport(studyId, format, params = '') {
  const res = await fetch(`${BASE}/studies/${studyId}/exports?format=${format}${params ? `&${params}` : ''}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error('Export impossible.');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `etude-${studyId}.${format}`;
  a.click();
  URL.revokeObjectURL(a.href);
}
