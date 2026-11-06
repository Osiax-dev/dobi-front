import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDown, ArrowLeft, ArrowUp, Download, Eye, EyeOff, FileText, History, Lock, LockOpen, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { api, downloadReportDocx, errText } from '../api';
import { buildReportPdf } from '../reportPdf';
import { addExtra, MAX_EXTRAS, moveSection, normalizeCustom, removeExtra, resolveLayout, setExplanation, toggleHidden, toggleQuestion, updateExtra } from '../reportLayout';

export const NOTE_FIELDS = {
  context: 'Introduction et contexte',
  objectives: 'Objectifs de l’enquête',
  analysis: 'Commentaire d’analyse',
  conclusions: 'Conclusions',
  recommendations: 'Recommandations',
};
const NOTE_HELP = {
  context: 'Présentez le sujet et le contexte de l’enquête.',
  objectives: 'Que cherchait-on à savoir ?',
  analysis: 'Interprétez les résultats avec vos propres mots.',
  conclusions: 'Ce que l’on retient de l’enquête.',
  recommendations: 'Les actions proposées à partir des résultats.',
};
const COLORS = ['#102F2B', '#D5F06A', '#D77A52', '#7C91A0', '#2F6F8F', '#B9791A'];
const CHOICE_TYPES = ['single_choice', 'dropdown', 'yes_no'];
export const MAX_COMPARISONS = 3;

const dateLong = (x) => (x ? new Date(x).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null);
const dateShort = (x) => (x ? new Date(x).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const pct = (v) => (v == null ? '—' : `${String(Math.round(v * 10) / 10).replace('.', ',')} %`);
const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'rapport';

export function ReportStatus({ status }) {
  return status === 'final'
    ? <span className="inline-block rounded-full bg-forest px-2.5 py-0.5 text-xs font-bold text-white">Finalisé</span>
    : <span className="inline-block rounded-full bg-lime px-2.5 py-0.5 text-xs font-bold text-forest">En rédaction</span>;
}

const Missing = ({ children = 'À compléter' }) => <span className="rounded bg-terracotta/15 px-2 py-0.5 text-sm font-semibold text-[#8a4320]">{children}</span>;
const paragraphs = (text) => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

function TextView({ value }) {
  return value?.trim() ? <div className="space-y-2 text-sm">{paragraphs(value).map((p, i) => <p key={i} className="whitespace-pre-wrap">{p}</p>)}</div> : <Missing />;
}

const AI_FIELDS = ['analysis', 'conclusions', 'recommendations'];

/** Suggestion de texte par l'IA : rien n'est inséré sans que l'enquêteur le décide. */
export function AiSuggest({ field, value, onChange, reportId }) {
  const [instructions, setInstructions] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');
  const ask = useMutation({
    mutationFn: () => api(`/reports/${reportId}/assist`, { method: 'POST', body: { section: field, instructions: instructions.trim() || undefined, current_text: value?.trim() ? value : undefined } }),
    onSuccess: (d) => { setSuggestion(d.text); setError(''); },
    onError: (e) => setError(errText(e)),
  });
  return <div className="mt-2 space-y-2">
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[12rem] flex-1">
        <label className="label" htmlFor={`ai-${field}`}>Consigne pour l’IA (facultatif)</label>
        <input id={`ai-${field}`} className="input" maxLength={500} placeholder="Ex. ton formel, pour un public de bailleurs" value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <button type="button" className="btn-ghost" disabled={ask.isPending} onClick={() => { setError(''); ask.mutate(); }}><Sparkles size={16} /> {ask.isPending ? 'Rédaction…' : suggestion ? 'Autre suggestion' : 'Suggérer avec l’IA'}</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {suggestion && <div className="space-y-2 rounded-lg border border-forest/20 bg-lime/20 p-3" role="region" aria-label="Suggestion de l’IA">
      <p className="text-xs font-bold uppercase tracking-wide text-forest/70">Suggestion de l’IA — à relire et vérifier avant de l’utiliser</p>
      <p className="whitespace-pre-wrap text-sm">{suggestion}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => { onChange(field, suggestion); setSuggestion(''); }}>Remplacer mon texte</button>
        {value?.trim() && <button type="button" className="btn-ghost" onClick={() => { onChange(field, `${value.trimEnd()}\n\n${suggestion}`); setSuggestion(''); }}>Ajouter à la suite</button>}
        <button type="button" className="btn-ghost" onClick={() => setSuggestion('')}>Ignorer</button>
      </div>
    </div>}
  </div>;
}

function TextBlock({ field, value, onChange, readOnly, ai }) {
  if (readOnly) return <TextView value={value} />;
  return <div>
    <label className="label" htmlFor={`note-${field}`}>{NOTE_FIELDS[field]}</label>
    <textarea id={`note-${field}`} className="input" rows={4} maxLength={10000} value={value} placeholder={NOTE_HELP[field]} onChange={(e) => onChange(field, e.target.value)} />
    {!value.trim() && <p className="mt-1 text-xs text-forest/65">Section à compléter avant de finaliser le rapport.</p>}
    {ai?.enabled && AI_FIELDS.includes(field) && <AiSuggest field={field} value={value} onChange={onChange} reportId={ai.reportId} />}
  </div>;
}

const tick = { fontSize: 12 };

function DistributionChart({ rows }) {
  return <div className="h-auto" style={{ height: 40 + rows.length * 34 }} aria-hidden="true">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" allowDecimals={false} tick={tick} />
        <YAxis type="category" dataKey="label" width={110} tick={tick} />
        <Tooltip /><Bar dataKey="count" name="Réponses" fill="#102F2B" />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

/** Comparaisons d'une question : liste « breakdowns » (rapports récents) ou ancienne comparaison unique. */
export function comparisonsOf(q, content) {
  if (q.breakdowns?.length) return q.breakdowns.map((b) => ({ label: b.by_label, groups: b.groups }));
  return q.breakdown?.length ? [{ label: content.compare?.label ?? '', groups: q.breakdown }] : [];
}

function ComparisonChart({ q, groups: all }) {
  const groups = all.filter((g) => !g.hidden && g.rows.length);
  if (!groups.length) return null;
  const data = q.rows.map((r, k) => Object.fromEntries([['label', r.label], ...groups.map((g) => [g.label, g.rows[k]?.count ?? 0])]));
  return <div style={{ height: 80 + q.rows.length * 44 }} aria-hidden="true">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" allowDecimals={false} tick={tick} />
        <YAxis type="category" dataKey="label" width={110} tick={tick} />
        <Tooltip /><Legend />
        {groups.map((g, k) => <Bar key={g.label} dataKey={g.label} fill={COLORS[k % COLORS.length]} />)}
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

function EvolutionChart({ perDay }) {
  const day = (s) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return <div>
    <h3 className="mb-1 text-sm font-semibold">Évolution des réponses par jour</h3>
    <div className="h-48" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={perDay} margin={{ left: -16, right: 8, top: 8 }}>
          <XAxis dataKey="date" tickFormatter={day} minTickGap={32} tick={tick} />
          <YAxis allowDecimals={false} tick={tick} />
          <Tooltip labelFormatter={day} formatter={(v) => [v, 'Réponses']} />
          <Area type="monotone" dataKey="responses" stroke="#102F2B" strokeWidth={2} fill="#D5F06A" fillOpacity={0.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>;
}

function ValuesTable({ rows }) {
  return <table className="mt-1 w-full text-sm">
    <thead><tr className="border-b border-forest/10 text-left"><th className="py-1 pr-3 font-semibold">Réponse</th><th className="py-1 pr-3 font-semibold">Effectif</th><th className="py-1 font-semibold">Part des répondants</th></tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-forest/5"><td className="py-1 pr-3">{r.label}</td><td className="py-1 pr-3 tabular-nums">{r.count}</td><td className="py-1 tabular-nums">{pct(r.percent)}</td></tr>)}</tbody>
  </table>;
}

const iconBtn = 'rounded-lg p-2 hover:bg-forest/10 disabled:opacity-30';

function SectionFrame({ s, index, total, editing, onMove, onHide, onDelete, children }) {
  return <section className="panel space-y-3" aria-labelledby={`rs-${s.key}`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h2 id={`rs-${s.key}`} className="text-lg font-bold">{s.number !== null && <span className="mr-2 text-forest/50">{s.number}.</span>}{s.title}</h2>
      {editing && s.key !== 'cover' && <div className="flex items-center">
        <button className={iconBtn} aria-label={`Monter la section ${s.title}`} title="Monter" disabled={index <= 1} onClick={() => onMove(s.key, -1)}><ArrowUp size={16} /></button>
        <button className={iconBtn} aria-label={`Descendre la section ${s.title}`} title="Descendre" disabled={index >= total - 1} onClick={() => onMove(s.key, 1)}><ArrowDown size={16} /></button>
        <button className={iconBtn} aria-label={`Masquer la section ${s.title}`} title="Masquer du rapport" onClick={() => onHide(s.key)}><EyeOff size={16} /></button>
        {s.extra && <button className={iconBtn} aria-label={`Supprimer la section ${s.title}`} title="Supprimer" onClick={() => onDelete(s.key)}><Trash2 size={16} /></button>}
      </div>}
    </div>
    {children}
  </section>;
}

/** Document du rapport : présentation et édition (les calculs viennent du serveur). */
export function ReportDocument({ report, notes, custom, onNote, onCustom = () => {}, readOnly, ai }) {
  const c = report.content;
  const sample = c.sample;
  const cu = normalizeCustom(custom);
  const layout = resolveLayout(cu);
  const editing = !readOnly;
  const change = (fn, ...args) => onCustom(fn(cu, ...args));

  const visibleQuestions = c.results.questions.filter((q) => !cu.hidden_questions.includes(q.question_id));
  const hiddenQuestions = c.results.questions.filter((q) => cu.hidden_questions.includes(q.question_id));

  const body = (s) => {
    if (s.extra) {
      const e = cu.extras.find((x) => x.id === s.key);
      if (readOnly) return <TextView value={e.body} />;
      return <div className="space-y-2">
        <div><label className="label" htmlFor={`extra-title-${e.id}`}>Titre de la section</label><input id={`extra-title-${e.id}`} className="input" maxLength={200} value={e.title} onChange={(ev) => change(updateExtra, e.id, { title: ev.target.value })} /></div>
        <div><label className="label" htmlFor={`extra-body-${e.id}`}>Texte</label><textarea id={`extra-body-${e.id}`} className="input" rows={4} maxLength={10000} value={e.body} onChange={(ev) => change(updateExtra, e.id, { body: ev.target.value })} /></div>
      </div>;
    }
    switch (s.key) {
      case 'cover': return <>
        <h3 className="font-display text-2xl font-bold">{report.title}</h3>
        <p className="text-sm text-forest/80">{c.cover.organization}</p>
        <p className="text-sm text-forest/80">Étude : {c.cover.title}</p>
        <p className="text-sm text-forest/80">Généré le {dateLong(c.meta.generated_at)}{c.cover.author ? ` par ${c.cover.author}` : ''}</p>
      </>;
      case 'general': return <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {c.general.fields.map((f) => <div key={f.key}><dt className="font-semibold">{f.label}</dt><dd>{f.value ?? <Missing />}</dd></div>)}
      </dl>;
      case 'context': case 'objectives': case 'conclusions': case 'recommendations':
        return <TextBlock field={s.key} value={notes[s.key]} onChange={onNote} readOnly={readOnly} ai={ai} />;
      case 'methodology': return <ul className="list-disc space-y-1 pl-5 text-sm">{c.methodology.facts.map((t, i) => <li key={i}>{t}</li>)}</ul>;
      case 'sample': return <>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-forest/5 p-3"><p className="font-display text-2xl font-bold">{sample.participants}</p><p className="text-sm text-forest/70">Participants</p></div>
          <div className="rounded-lg bg-forest/5 p-3"><p className="font-display text-2xl font-bold">{sample.responses}</p><p className="text-sm text-forest/70">Réponses</p></div>
          <div className="rounded-lg bg-forest/5 p-3"><p className="font-display text-base font-bold leading-tight">{dateShort(sample.first_response_at)} – {dateShort(sample.last_response_at)}</p><p className="text-sm text-forest/70">Période de collecte réelle</p></div>
        </div>
        {sample.note && <p className="text-sm text-forest/75">{sample.note}</p>}
        {sample.peak_day && <p className="text-sm">Jour le plus actif : {dateLong(sample.peak_day.date)} ({sample.peak_day.responses} réponse(s)).</p>}
        {sample.by_version.length > 1 && <p className="text-sm">Répartition par version : {sample.by_version.map((v) => `${v.label} (${v.count})`).join(', ')}.</p>}
        {sample.responses === 0 && <p className="text-sm"><Missing>Aucune réponse pour le moment</Missing></p>}
        {sample.per_day?.length > 1 && <EvolutionChart perDay={sample.per_day} />}
      </>;
      case 'results': return <>
        {(c.compares?.length || c.compare) && <p className="text-sm text-forest/75">Résultats comparés selon {(c.compares?.length ? c.compares : [c.compare]).map((x, i) => <span key={i}>{i > 0 && ', '}« <strong>{x.label}</strong> »</span>)}.</p>}
        {c.results.questions.length === 0 && <p className="text-sm"><Missing>Aucun questionnaire publié</Missing></p>}
        {visibleQuestions.map((q, i) => {
          const override = cu.explanations[String(q.question_id)];
          return <article key={q.question_id} className="rounded-lg border border-forest/10 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold">{i + 1}. {q.label}</h3>
              {editing && <button className={iconBtn} aria-label={`Masquer la question ${q.label}`} title="Masquer cette question du rapport" onClick={() => change(toggleQuestion, q.question_id)}><EyeOff size={15} /></button>}
            </div>
            <p className="mb-2 text-xs text-forest/65">{q.type_label} · {q.n} réponse(s){q.response_rate != null ? ` · ${q.response_rate} % des participants` : ''}</p>
            {!q.insufficient && q.rows.length > 0 && <>
              {(() => {
                const cmps = comparisonsOf(q, c).filter((m) => m.groups.some((g) => !g.hidden && g.rows.length));
                if (!cmps.length) return <DistributionChart rows={q.rows} />;
                return cmps.map((m, k) => <div key={k}>{(cmps.length > 1 || m.label) && <p className="mt-1 text-xs font-semibold text-forest/75">Selon « {m.label} »</p>}<ComparisonChart q={q} groups={m.groups} /></div>);
              })()}
              <ValuesTable rows={q.rows} />
            </>}
            {q.other_answers?.length > 0 && <p className="mt-2 text-sm">Précisions « Autre » : {q.other_answers.map((o) => `${o.text} (${o.count})`).join(', ')}.</p>}
            {readOnly
              ? <p className="mt-2 rounded bg-forest/5 p-2 text-sm">{override ?? q.explanation}</p>
              : <div className="mt-2">
                <label className="label" htmlFor={`expl-${q.question_id}`}>Explication</label>
                <textarea id={`expl-${q.question_id}`} className="input" rows={2} maxLength={2000} value={override ?? q.explanation} onChange={(e) => change(setExplanation, q.question_id, e.target.value, q.explanation)} />
                {override !== undefined && <button className="mt-1 inline-flex items-center gap-1 text-xs font-semibold underline" onClick={() => change(setExplanation, q.question_id, '', q.explanation)}><RotateCcw size={12} /> Rétablir le texte automatique</button>}
              </div>}
          </article>;
        })}
        {editing && hiddenQuestions.map((q) => <p key={q.question_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-forest/25 p-3 text-sm">
          <span>Question masquée : <strong>{q.label}</strong></span>
          <button className="btn-ghost" onClick={() => change(toggleQuestion, q.question_id)}><Eye size={15} /> Afficher</button>
        </p>)}
      </>;
      case 'analysis': return <>
        {c.analysis.highlights.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm">{c.analysis.highlights.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        {c.analysis.warnings.length > 0 && <div className="space-y-1 rounded-lg border border-terracotta/40 bg-terracotta/10 p-3 text-sm" role="note">
          <p className="font-semibold">Points de vigilance</p>
          <ul className="list-disc space-y-1 pl-5">{c.analysis.warnings.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>}
        <TextBlock field="analysis" value={notes.analysis} onChange={onNote} readOnly={readOnly} ai={ai} />
      </>;
      case 'annexes': return <>
        <h3 className="text-sm font-semibold">Questionnaire utilisé</h3>
        {c.annexes.questions.length === 0 ? <p className="text-sm"><Missing>Aucune question publiée</Missing></p> : <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="border-b border-forest/10 text-left"><th className="py-1 pr-3">N°</th><th className="py-1 pr-3">Question</th><th className="py-1 pr-3">Type</th><th className="py-1">Obligatoire</th></tr></thead>
            <tbody>{c.annexes.questions.map((q) => <tr key={q.position} className="border-b border-forest/5"><td className="py-1 pr-3">{q.position}</td><td className="py-1 pr-3">{q.label}</td><td className="py-1 pr-3">{q.type_label}</td><td className="py-1">{q.required ? 'Oui' : 'Non'}</td></tr>)}</tbody></table>
        </div>}
        {c.annexes.versions.length > 0 && <p className="text-sm">Versions publiées : {c.annexes.versions.map((v) => `version ${v.version} (${dateShort(v.published_at)})`).join(', ')}.</p>}
      </>;
      default: return null;
    }
  };

  return <div className="space-y-4">
    {layout.map((s, index) => {
      if (s.hidden) {
        return editing ? <div key={s.key} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-forest/25 p-3 text-sm">
          <span>Section masquée : <strong>{s.title}</strong></span>
          <span className="flex gap-1">
            <button className="btn-ghost" onClick={() => change(toggleHidden, s.key)}><Eye size={15} /> Afficher</button>
            {s.extra && <button className="btn-ghost" onClick={() => change(removeExtra, s.key)}><Trash2 size={15} /> Supprimer</button>}
          </span>
        </div> : null;
      }
      return <SectionFrame key={s.key} s={s} index={index} total={layout.length} editing={editing}
        onMove={(k, d) => change(moveSection, k, d)} onHide={(k) => change(toggleHidden, k)} onDelete={(k) => change(removeExtra, k)}>
        {body(s)}
      </SectionFrame>;
    })}
    {editing && <div><button className="btn-ghost" disabled={cu.extras.length >= MAX_EXTRAS} onClick={() => change(addExtra)}><Plus size={16} /> Ajouter une section libre</button>{cu.extras.length >= MAX_EXTRAS && <span className="ml-2 text-xs text-forest/65">Maximum {MAX_EXTRAS} sections libres.</span>}</div>}
  </div>;
}

/** Historique des enregistrements : relire un ancien état, puis le restaurer (l'état actuel est conservé). */
export function HistoryPanel({ report, dirty, final, onRestored, onError }) {
  const [openId, setOpenId] = useState(null);
  const list = useQuery({ queryKey: ['report-history', report.id, report.revision], queryFn: () => api(`/reports/${report.id}/revisions`) });
  const one = useQuery({ queryKey: ['report-revision', report.id, openId], queryFn: () => api(`/reports/${report.id}/revisions/${openId}`), enabled: !!openId });
  const restore = useMutation({
    mutationFn: (id) => api(`/reports/${report.id}/revisions/${id}/restore`, { method: 'POST', body: { revision: report.revision } }),
    onSuccess: onRestored,
    onError,
  });
  const ask = (r) => {
    const warn = dirty ? ' Vos modifications non enregistrées seront perdues.' : '';
    if (window.confirm(`Restaurer la version du ${dateLong(r.saved_at)} ? Le titre, les textes et la mise en page reviendront à cet état ; l’état actuel reste dans l’historique.${warn}`)) restore.mutate(r.id);
  };

  return <section className="panel space-y-3" aria-labelledby="report-history-title">
    <h2 id="report-history-title" className="text-lg font-bold">Historique des versions</h2>
    {final && <p className="text-sm text-forest/70">Rapport finalisé : rouvrez-le pour restaurer une ancienne version.</p>}
    {list.isLoading && <p className="text-sm">Chargement…</p>}
    {list.isError && <p className="error">{errText(list.error)}</p>}
    {list.data && list.data.data.length === 0 && <p className="text-sm text-forest/70">Aucune version précédente pour le moment : l’historique se remplit à chaque enregistrement.</p>}
    <ul className="space-y-2">
      {list.data?.data.map((r) => <li key={r.id} className="rounded-lg border border-forest/10 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0 text-sm"><p className="font-semibold">{r.title}</p><p className="text-forest/70">Enregistrée par {r.author ?? 'un ancien membre'} · remplacée le {dateLong(r.saved_at)} · {r.filled} section(s) rédigée(s)</p></div>
          <div className="flex gap-1">
            <button className="btn-ghost" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)}>{openId === r.id ? 'Masquer' : 'Voir'}</button>
            {!final && <button className="btn-ghost" disabled={restore.isPending} onClick={() => ask(r)}><RotateCcw size={15} /> Restaurer</button>}
          </div>
        </div>
        {openId === r.id && <div className="mt-2 space-y-2 border-t border-forest/10 pt-2 text-sm">
          {one.isLoading && <p>Chargement…</p>}
          {one.isError && <p className="error">{errText(one.error)}</p>}
          {one.data && Object.entries(NOTE_FIELDS).map(([k, label]) => <div key={k}><p className="font-semibold">{label}</p>{(one.data.notes[k] || '').trim() ? <TextView value={one.data.notes[k]} /> : <p className="text-forest/60">— vide —</p>}</div>)}
        </div>}
      </li>)}
    </ul>
  </section>;
}

const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function ReportEditor({ report, onBack, flash, onFlash }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(report.title);
  const [notes, setNotes] = useState(report.notes);
  const [custom, setCustom] = useState(() => normalizeCustom(report.custom));
  const [msg, setMsg] = useState(flash ? { type: 'ok', text: flash } : { type: '', text: '' });
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => { if (flash) onFlash(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [exporting, setExporting] = useState('');
  const final = report.status === 'final';
  const dirty = title !== report.title
    || Object.keys(NOTE_FIELDS).some((k) => (notes[k] || '') !== (report.notes[k] || ''))
    || !sameJson(normalizeCustom(custom), normalizeCustom(report.custom));

  const done = (data) => { qc.setQueryData(['report', report.id], data); qc.invalidateQueries({ queryKey: ['reports'] }); };
  const save = useMutation({
    mutationFn: (body) => api(`/reports/${report.id}`, { method: 'PUT', body: { revision: report.revision, ...body } }),
    onSuccess: (data) => { onFlash('Rapport enregistré.'); setMsg({ type: 'ok', text: 'Rapport enregistré.' }); done(data); },
    onError: (e) => setMsg({ type: e.code === 'report_conflict' ? 'conflict' : 'error', text: errText(e) }),
  });
  const remove = useMutation({
    mutationFn: () => api(`/reports/${report.id}`, { method: 'DELETE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); onBack(); },
    onError: (e) => setMsg({ type: 'error', text: errText(e) }),
  });
  const reload = () => { setMsg({ type: '', text: '' }); onFlash(''); qc.invalidateQueries({ queryKey: ['report', report.id] }); };

  const changeStatus = (status) => {
    if (dirty && !window.confirm('Des modifications ne sont pas enregistrées. Enregistrez-les d’abord, sinon elles seront perdues. Continuer quand même ?')) return;
    if (status === 'final') {
      const empty = Object.entries(NOTE_FIELDS).filter(([k]) => !(report.notes[k] || '').trim()).map(([, l]) => l);
      if (empty.length && !window.confirm(`Ces sections sont encore vides : ${empty.join(', ')}. Finaliser quand même ?`)) return;
    }
    save.mutate({ status });
  };

  const exportAs = async (format) => {
    setMsg({ type: '', text: '' });
    setExporting(format);
    try {
      if (format === 'docx') await downloadReportDocx(report.id, `${slug(report.title)}.docx`);
      else buildReportPdf(await api(`/reports/${report.id}/document`)).save(`${slug(report.title)}.pdf`);
    } catch (e) {
      setMsg({ type: 'error', text: errText(e) });
    } finally {
      setExporting('');
    }
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button className="btn-ghost" onClick={() => onBack()}><ArrowLeft size={16} /> Tous les rapports</button>
      <div className="flex flex-wrap items-center gap-2">
        <ReportStatus status={report.status} />
        {!final && <button className="btn" disabled={!dirty || save.isPending} onClick={() => save.mutate({ title: title.trim() || report.title, notes, custom })}><Save size={16} /> Enregistrer</button>}
        {final
          ? <button className="btn-ghost" disabled={save.isPending} onClick={() => changeStatus('draft')}><LockOpen size={16} /> Rouvrir pour modifier</button>
          : <button className="btn-ghost" disabled={save.isPending} onClick={() => changeStatus('final')}><Lock size={16} /> Finaliser</button>}
        <button className="btn-ghost" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}><History size={16} /> Historique{report.history_count ? ` (${report.history_count})` : ''}</button>
        {report.can_delete && <button className="btn-ghost" disabled={remove.isPending} onClick={() => window.confirm('Supprimer définitivement ce rapport ? Les réponses de l’étude ne sont pas touchées.') && remove.mutate()}><Trash2 size={16} /> Supprimer</button>}
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <button className="btn-ghost" disabled={dirty || !!exporting} onClick={() => exportAs('pdf')}><Download size={16} /> {exporting === 'pdf' ? 'Préparation…' : 'Exporter en PDF'}</button>
      <button className="btn-ghost" disabled={dirty || !!exporting} onClick={() => exportAs('docx')}><Download size={16} /> {exporting === 'docx' ? 'Préparation…' : 'Exporter en Word'}</button>
      {dirty && <span className="text-xs text-forest/65">Enregistrez vos modifications avant d’exporter.</span>}
    </div>

    {showHistory && <HistoryPanel report={report} dirty={dirty} final={final} onRestored={(data) => { onFlash('Version restaurée. L’ancien état reste disponible dans l’historique.'); done(data); }} onError={(e) => setMsg({ type: e.code === 'report_conflict' ? 'conflict' : 'error', text: errText(e) })} />}

    {dirty && !final && <p className="text-sm text-forest/70" role="status">Modifications non enregistrées.</p>}
    {msg.type === 'ok' && <p className="rounded-lg border border-forest/20 bg-lime/30 px-3 py-2 text-sm" role="status">{msg.text}</p>}
    {msg.type === 'error' && <p className="error" role="alert">{msg.text}</p>}
    {msg.type === 'conflict' && <div className="error flex flex-wrap items-center justify-between gap-2" role="alert"><span>{msg.text}</span><button className="btn-ghost" onClick={reload}>Recharger le rapport</button></div>}
    {report.outdated && <p className="panel text-sm" role="note">Ce rapport a été généré avec <strong>{report.content.meta.responses} réponse(s)</strong> ; l’étude en compte maintenant <strong>{report.responses_now}</strong>. Générez un nouveau rapport pour intégrer les dernières réponses : celui-ci est conservé tel quel, avec vos textes.</p>}
    {final && <p className="panel text-sm" role="note">Rapport finalisé le {dateLong(report.finalized_at)}. Rouvrez-le pour modifier le titre, les textes ou la mise en page.</p>}

    {!final && <div className="panel"><label className="label" htmlFor="report-title">Titre du rapport</label><input id="report-title" className="input" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></div>}
    <ReportDocument report={{ ...report, title: final ? report.title : title }} notes={notes} custom={custom} onCustom={setCustom} onNote={(k, v) => setNotes((n) => ({ ...n, [k]: v }))} readOnly={final} ai={{ enabled: !!report.ai_enabled && !final, reportId: report.id }} />
  </div>;
}

function ReportLoader({ id, onBack }) {
  const [flash, setFlash] = useState('');
  const q = useQuery({ queryKey: ['report', id], queryFn: () => api(`/reports/${id}`) });
  if (q.isLoading) return <p>Chargement…</p>;
  if (q.isError) return <div className="space-y-3"><p className="error">{errText(q.error)}</p><button className="btn-ghost" onClick={() => onBack()}>Retour</button></div>;
  return <ReportEditor key={`${id}-${q.data.revision}`} report={q.data} onBack={onBack} flash={flash} onFlash={setFlash} />;
}

/** Choix de 0 à 3 questions pour comparer les résultats par groupe. */
export function ComparePicker({ options, value, onChange }) {
  if (!options.length) return null;
  const full = value.length >= MAX_COMPARISONS;
  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return <fieldset className="panel space-y-2">
    <legend className="label px-1">Comparer les résultats selon (facultatif, {MAX_COMPARISONS} au maximum)</legend>
    <div className="grid gap-1 sm:grid-cols-2">
      {options.map((q) => {
        const checked = value.includes(q.id);
        return <label key={q.id} className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={checked} disabled={!checked && full} onChange={() => toggle(q.id)} />
          <span>{q.label}</span>
        </label>;
      })}
    </div>
    {full && <p className="text-xs text-forest/65">Maximum atteint : décochez une question pour en choisir une autre.</p>}
  </fieldset>;
}

/** Aperçu d'un rapport calculé mais pas encore enregistré. */
function ReportPreview({ data, saving, error, onSave, onCancel }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button className="btn-ghost" onClick={onCancel}><ArrowLeft size={16} /> Retour sans enregistrer</button>
      <button className="btn" disabled={saving} onClick={onSave}><Save size={16} /> {saving ? 'Enregistrement…' : 'Enregistrer ce rapport'}</button>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <p className="panel text-sm" role="note"><strong>Aperçu :</strong> ce rapport n’est pas encore enregistré. Vous pourrez ensuite compléter les textes (contexte, analyse, conclusions…) et adapter la mise en page. Si des réponses arrivent d’ici là, le rapport enregistré les inclura.</p>
    <ReportDocument report={data} notes={data.notes} custom={data.custom} readOnly />
  </div>;
}

/** Onglet « Rapports » d'une étude : liste des rapports, aperçu et génération. */
export default function Reports({ study, questions = [], reportId, setReportId }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [compareBy, setCompareBy] = useState([]);
  const [preview, setPreview] = useState(null);
  const list = useQuery({ queryKey: ['reports', study.id], queryFn: () => api(`/studies/${study.id}/reports`) });
  const body = compareBy.length ? { compare_by: compareBy } : {};
  const generate = useMutation({
    mutationFn: () => api(`/studies/${study.id}/reports`, { method: 'POST', body }),
    onSuccess: (r) => { setError(''); setPreview(null); qc.invalidateQueries({ queryKey: ['reports'] }); setReportId(r.id); },
    onError: (e) => setError(errText(e)),
  });
  const show = useMutation({
    mutationFn: () => api(`/studies/${study.id}/reports/preview`, { method: 'POST', body }),
    onSuccess: (data) => { setError(''); setPreview(data); },
    onError: (e) => setError(errText(e)),
  });

  if (reportId) return <ReportLoader id={reportId} onBack={() => setReportId(null)} />;
  if (preview) return <ReportPreview data={preview} saving={generate.isPending} error={error} onSave={() => generate.mutate()} onCancel={() => { setPreview(null); setError(''); }} />;
  if (list.isLoading) return <p>Chargement…</p>;
  if (list.isError) return <p className="error">{list.error.status === 403 ? 'Les rapports sont réservés aux propriétaires, administrateurs et analystes de l’espace.' : errText(list.error)}</p>;
  const rows = list.data.data;
  const comparable = questions.filter((q) => CHOICE_TYPES.includes(q.type));
  const busy = generate.isPending || show.isPending;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-bold">Rapports & synthèses</h2><p className="text-sm text-forest/70">DOBI prépare un rapport structuré à partir des résultats réels de l’étude. Vous pouvez d’abord le prévisualiser, puis compléter les textes, adapter la mise en page et l’exporter.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-ghost" disabled={busy} onClick={() => show.mutate()}><Eye size={16} /> {show.isPending ? 'Calcul…' : 'Aperçu'}</button>
        <button className="btn" disabled={busy} onClick={() => generate.mutate()}><Plus size={16} /> {generate.isPending ? 'Préparation…' : 'Générer un rapport'}</button>
      </div>
    </div>
    <ComparePicker options={comparable} value={compareBy} onChange={setCompareBy} />
    {error && <p className="error" role="alert">{error}</p>}
    {rows.length === 0 && <div className="panel text-center"><FileText className="mx-auto text-forest/40" size={28} aria-hidden="true" /><h3 className="mt-2 font-semibold">Aucun rapport pour le moment</h3><p className="mt-1 text-sm text-forest/70">Cliquez sur « Aperçu » pour voir le rapport avant de le créer, ou sur « Générer un rapport » pour l’enregistrer tout de suite.</p></div>}
    <ul className="space-y-3">
      {rows.map((r) => <li key={r.id} className="panel flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="font-semibold">{r.title}</p>
          <p className="text-sm text-forest/70">{r.responses} réponse(s) · créé le {dateShort(r.created_at)}{r.author ? ` par ${r.author}` : ''} · modifié le {dateShort(r.updated_at)}</p></div>
        <div className="flex items-center gap-2"><ReportStatus status={r.status} /><button className="btn-ghost" onClick={() => setReportId(r.id)}>Ouvrir</button></div>
      </li>)}
    </ul>
  </div>;
}

/** Bouton « Générer un rapport » placé dans les résultats. */
export function GenerateReportButton({ studyId, onCreated }) {
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const generate = useMutation({
    mutationFn: () => api(`/studies/${studyId}/reports`, { method: 'POST', body: {} }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['reports'] }); onCreated(r.id); },
    onError: (e) => setError(errText(e)),
  });
  return <>
    <button className="btn" disabled={generate.isPending} onClick={() => { setError(''); generate.mutate(); }}><FileText size={16} /> {generate.isPending ? 'Préparation…' : 'Générer un rapport'}</button>
    {error && <span className="error" role="alert">{error}</span>}
  </>;
}
