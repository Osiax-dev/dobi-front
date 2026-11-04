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
    if (auth && (res.status === 401 || (res.status === 403 && data?.code === 'email_not_verified'))) setToken(null);
    const err = new Error(data?.message || 'Une erreur est survenue.');
    err.status = res.status;
    err.code = data?.code || null;
    err.errors = data?.errors || null;
    throw err;
  }
  return data;
}

/** Texte lisible d'une erreur API (messages de validation inclus). */
const FR = [
  [/email has already been taken/i, 'Cette adresse e-mail est déjà utilisée.'],
  [/(\w[\w ]*) field is required/i, 'Un champ obligatoire est vide.'],
  [/must be a valid email/i, 'Adresse e-mail invalide.'],
  [/password field must be at least (\d+)/i, 'Le mot de passe doit contenir au moins $1 caractères.'],
  [/password field confirmation does not match/i, 'Les deux mots de passe ne sont pas identiques.'],
  [/password field must contain at least one letter/i, 'Le mot de passe doit contenir au moins une lettre.'],
  [/password field must contain at least one number/i, 'Le mot de passe doit contenir au moins un chiffre.'],
  [/must be at least (\d+) characters/i, 'Trop court (minimum $1 caractères).'],
  [/may not be greater than (\d+) characters|must not be greater than (\d+) characters/i, 'Trop long.'],
  [/selected .* is invalid/i, 'Valeur invalide.'],
  [/too many attempts|too many requests/i, 'Trop de tentatives. Réessayez dans un instant.'],
];
/** Traduit les messages de validation anglais de Laravel les plus courants. */
const fr = (m) => { for (const [re, out] of FR) { const x = String(m).match(re); if (x) return out.replace('$1', x[1] || ''); } return m; };
export function errText(e) {
  if (e?.errors) return Object.values(e.errors).flat().map(fr).join(' ');
  return fr(e?.message || 'Une erreur est survenue.');
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
