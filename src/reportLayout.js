// Mise en page d'un rapport : même logique que le serveur (app/Support/ReportLayout.php).
export const CORE = {
  cover: 'Page de présentation',
  general: 'Informations générales sur l’enquête',
  context: 'Introduction et contexte',
  objectives: 'Objectifs de l’enquête',
  methodology: 'Méthodologie de collecte',
  sample: 'Échantillon et participants',
  results: 'Principaux résultats',
  analysis: 'Analyse des résultats',
  conclusions: 'Conclusions',
  recommendations: 'Recommandations',
  annexes: 'Annexes',
};
export const MAX_EXTRAS = 10;

export const emptyCustom = () => ({ order: [], hidden: [], hidden_questions: [], explanations: {}, extras: [] });

export function normalizeCustom(c) {
  const x = c || {};
  return {
    order: [...(x.order || [])].map(String),
    hidden: [...(x.hidden || [])].map(String),
    hidden_questions: [...(x.hidden_questions || [])].map(Number),
    explanations: { ...(Array.isArray(x.explanations) ? {} : x.explanations || {}) },
    extras: (x.extras || []).map((e) => ({ id: e.id, title: e.title || '', body: e.body || '' })),
  };
}

/** Liste ordonnée de toutes les sections : { key, title, hidden, extra, number }. */
export function resolveLayout(custom) {
  const c = normalizeCustom(custom);
  const extras = Object.fromEntries(c.extras.map((e) => [e.id, e]));
  const movable = Object.keys(CORE).filter((k) => k !== 'cover');
  const known = [...movable, ...Object.keys(extras)];
  const order = [...new Set(c.order.filter((k) => known.includes(k)))];
  known.forEach((k) => { if (!order.includes(k)) order.push(k); });

  let n = 0;
  return [{ key: 'cover', title: CORE.cover, hidden: false, extra: false, number: null },
    ...order.map((key) => {
      const hidden = c.hidden.includes(key);
      const extra = !!extras[key];
      return { key, title: extra ? (extras[key].title.trim() || 'Section sans titre') : CORE[key], hidden, extra, number: hidden ? null : ++n };
    })];
}

const fullOrder = (custom) => resolveLayout(custom).slice(1).map((s) => s.key);

export function moveSection(custom, key, direction) {
  const c = normalizeCustom(custom);
  const order = fullOrder(c);
  const i = order.indexOf(key), j = i + direction;
  if (i < 0 || j < 0 || j >= order.length) return c;
  [order[i], order[j]] = [order[j], order[i]];
  return { ...c, order };
}

export function toggleHidden(custom, key) {
  const c = normalizeCustom(custom);
  if (key === 'cover') return c;
  return { ...c, order: fullOrder(c), hidden: c.hidden.includes(key) ? c.hidden.filter((k) => k !== key) : [...c.hidden, key] };
}

export function addExtra(custom) {
  const c = normalizeCustom(custom);
  if (c.extras.length >= MAX_EXTRAS) return c;
  const next = Math.max(0, ...c.extras.map((e) => Number(e.id.slice(1)))) + 1;
  const id = `x${next}`;
  return { ...c, order: [...fullOrder(c), id], extras: [...c.extras, { id, title: '', body: '' }] };
}

export function updateExtra(custom, id, patch) {
  const c = normalizeCustom(custom);
  return { ...c, extras: c.extras.map((e) => (e.id === id ? { ...e, ...patch } : e)) };
}

export function removeExtra(custom, id) {
  const c = normalizeCustom(custom);
  return { ...c, order: c.order.filter((k) => k !== id), hidden: c.hidden.filter((k) => k !== id), extras: c.extras.filter((e) => e.id !== id) };
}

/** Texte choisi par l'enquêteur pour une question ; vide ou identique au texte automatique = retour au texte automatique. */
export function setExplanation(custom, questionId, text, autoText) {
  const c = normalizeCustom(custom);
  const explanations = { ...c.explanations };
  if (!text.trim() || text.trim() === (autoText || '').trim()) delete explanations[String(questionId)];
  else explanations[String(questionId)] = text;
  return { ...c, explanations };
}

export function toggleQuestion(custom, questionId) {
  const c = normalizeCustom(custom);
  const id = Number(questionId);
  return { ...c, hidden_questions: c.hidden_questions.includes(id) ? c.hidden_questions.filter((q) => q !== id) : [...c.hidden_questions, id] };
}
