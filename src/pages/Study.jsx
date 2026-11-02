import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowDown, ArrowUp, Copy, FolderPlus, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, errText } from '../api';
import Results from './Results';
import { Question as PreviewQuestion, visibleQuestions } from './Public';
import { STATUS } from '../ui';

const TYPES = {
  short_text: 'Réponse courte', long_text: 'Réponse longue', single_choice: 'Choix unique', multiple_choice: 'Choix multiple',
  yes_no: 'Oui / Non', number: 'Nombre', date: 'Date', scale: 'Note de 1 à 5', location: 'Lieu',
};
const OPERATORS = { equals: 'est égal à', not_equals: 'est différent de', contains: 'contient', gt: 'est supérieur à', lt: 'est inférieur à' };
const ACTION_LABELS = { resume: 'Reprendre', suspend: 'Suspendre', close: 'Clôturer', archive: 'Archiver', restore: 'Restaurer' };
const CONFIRM = {
  close: 'Clôturer cette étude ? Elle n’acceptera plus de réponses.',
  archive: 'Archiver cette étude ? Elle sera en lecture seule, mais vous pourrez la restaurer.',
};
const publishLabel = (status) => (status === 'draft' ? 'Publier' : status === 'published' ? 'Publier une nouvelle version' : 'Republier (nouvelle version)');
const EVENTS = {
  'study.created': 'Étude créée', 'study.updated': 'Étude modifiée', 'study.duplicated': 'Étude dupliquée', 'study.publish': 'Publication',
  'study.resume': 'Reprise', 'study.suspend': 'Suspension', 'study.close': 'Clôture', 'study.archive': 'Archivage',
  'study.restore': 'Restauration', 'study.exported': 'Export des données',
};

export default function Study() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState('questions');
  const [error, setError] = useState('');

  const study = useQuery({ queryKey: ['study', id], queryFn: () => api(`/studies/${id}`) });
  const tree = useQuery({ queryKey: ['tree', id], queryFn: () => api(`/studies/${id}/questionnaire`) });
  const refresh = () => ['study', 'tree', 'history', 'analytics'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const run = (a) => { if (CONFIRM[a] && !window.confirm(CONFIRM[a])) return; act.mutate(a); };

  const act = useMutation({
    mutationFn: (a) => api(`/studies/${id}/${a}`, { method: 'POST' }),
    onSuccess: () => { setError(''); refresh(); },
    onError: (e) => setError(errText(e)),
  });

  if (study.isLoading || tree.isLoading) return <p>Chargement…</p>;
  if (study.isError) return <p className="error">{errText(study.error)}</p>;
  const s = study.data;
  const questions = tree.data?.questions || [];
  const archived = s.status === 'archived';

  return (
    <div>
      <Link to="/studies" className="text-sm underline">← Mes études</Link>
      <div className="mb-4 mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{s.title}</h1>
          <p className="text-sm">{STATUS[s.status]} · {s.privacy_mode === 'anonymous' ? 'Anonyme' : 'Identifiée'} · {s.responses_count} réponse(s){s.version_number ? ` · version ${s.version_number}` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(s.allowed_actions || []).map((a) => (
            <button key={a} className={['publish', 'resume', 'restore'].includes(a) ? 'btn' : 'btn-ghost'} disabled={act.isPending} onClick={() => run(a)}>
              {a === 'publish' ? publishLabel(s.status) : ACTION_LABELS[a]}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="error mb-4">{error}</p>}
      {archived && <p className="panel mb-4">Cette étude est archivée : elle est en lecture seule. Restaurez-la pour la modifier ; ses réponses et ses versions sont conservées.</p>}

      {s.privacy_mode === 'identified' && <p className="mb-4"><Link to={`/studies/${s.id}/participants`} className="btn-ghost">Voir les participants</Link></p>}

      {s.status === 'published' && (
        <div className="panel mb-4 flex flex-wrap items-center gap-4">
          <QRCodeSVG value={s.public_url} size={96} />
          <div>
            <p className="font-semibold">Lien public de l’étude</p>
            <a className="break-all text-leaf underline" href={s.public_url} target="_blank" rel="noreferrer">{s.public_url}</a>
          </div>
        </div>
      )}

      <div className="mb-4 flex gap-2">
        {[['questions', 'Questionnaire'], ['preview', 'Aperçu'], ['results', 'Résultats'], ['history', 'Historique']].map(([k, l]) => (
          <button key={k} className={tab === k ? 'btn' : 'btn-ghost'} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'questions' && <Builder study={s} questions={questions} sections={tree.data?.sections || []} onChange={refresh} readOnly={archived} />}
      {tab === 'preview' && <Preview questions={questions} />}
      {tab === 'results' && <Results study={s} orgName={s.organization_name} />}
      {tab === 'history' && <History study={s} />}
    </div>
  );
}

function RuleValue({ source, value, onChange }) {
  if (source?.type === 'yes_no') {
    return (
      <select className="input" aria-label="Valeur" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choisir…</option><option value="true">Oui</option><option value="false">Non</option>
      </select>
    );
  }
  if (source && ['single_choice', 'multiple_choice'].includes(source.type)) {
    return (
      <select className="input" aria-label="Valeur" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choisir…</option>
        {source.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return <input className="input" aria-label="Valeur" placeholder="Valeur" value={value} onChange={(e) => onChange(e.target.value)} />;
}

function Builder({ study, questions, sections, onChange, readOnly }) {
  const blank = { type: 'short_text', label: '', required: false, section_id: '', options: [{ label: '', value: '' }, { label: '', value: '' }], source: '', operator: 'equals', value: '', min: '', max: '' };
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [drag, setDrag] = useState(null);
  const [newSection, setNewSection] = useState('');
  const [error, setError] = useState('');
  const choice = ['single_choice', 'multiple_choice'].includes(f.type);
  const editIndex = editing ? questions.findIndex((q) => q.id === editing) : questions.length;
  const sources = questions.slice(0, Math.max(editIndex, 0));
  const source = sources.find((q) => String(q.id) === String(f.source));

  const ok = () => { setError(''); onChange(); };
  const fail = (e) => setError(errText(e));
  const reset = () => { setF(blank); setEditing(null); };

  const save = useMutation({
    mutationFn: () => {
      const settings = f.type === 'scale' ? { min: 1, max: 5 } : f.type === 'number' ? { ...(f.min !== '' && { min: Number(f.min) }), ...(f.max !== '' && { max: Number(f.max) }) } : null;
      const body = {
        label: f.label, required: f.required, section_id: f.section_id ? Number(f.section_id) : null,
        ...(editing ? {} : { type: f.type }),
        ...(choice && { options: f.options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), ...(o.value && { value: o.value }) })) }),
        ...(settings && { settings }),
        rules: f.source ? [{ source_question_id: Number(f.source), operator: f.operator, value: String(f.value) }] : [],
      };
      return editing ? api(`/questions/${editing}`, { method: 'PUT', body }) : api(`/studies/${study.id}/questions`, { method: 'POST', body });
    },
    onSuccess: () => { reset(); ok(); },
    onError: fail,
  });
  const simple = useMutation({ mutationFn: ({ path, method, body }) => api(path, { method, body }), onSuccess: ok, onError: fail });

  const move = (from, to) => {
    if (to < 0 || to >= questions.length || questions[from].section_id !== questions[to].section_id) return;
    const ids = questions.map((q) => q.id);
    const [m] = ids.splice(from, 1);
    ids.splice(to, 0, m);
    simple.mutate({ path: `/studies/${study.id}/reorder`, method: 'POST', body: { questions: ids } });
  };

  const edit = (q) => {
    setEditing(q.id);
    setF({
      type: q.type, label: q.label, required: q.required, section_id: q.section_id ?? '',
      options: q.options.length ? q.options.map((o) => ({ ...o })) : [{ label: '', value: '' }, { label: '', value: '' }],
      source: q.rules[0]?.source_question_id ?? '', operator: q.rules[0]?.operator ?? 'equals', value: q.rules[0]?.value ?? '',
      min: q.settings?.min ?? '', max: q.settings?.max ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sectionName = (id) => sections.find((s) => s.id === id)?.title;
  const setOpt = (i, patch) => setF({ ...f, options: f.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const iconBtn = 'rounded-lg p-2 hover:bg-forest/10 disabled:opacity-30';

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px]">
      <section>
        {error && <p className="error mb-3">{error}</p>}
        {!readOnly && (
          <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (newSection.trim()) { simple.mutate({ path: `/studies/${study.id}/sections`, method: 'POST', body: { title: newSection.trim() } }); setNewSection(''); } }}>
            <input className="input" aria-label="Nouvelle section" placeholder="Nouvelle section (ex. Vie sur le campus)" value={newSection} onChange={(e) => setNewSection(e.target.value)} />
            <button className="btn-ghost shrink-0"><FolderPlus size={16} /> Ajouter</button>
          </form>
        )}
        {questions.length === 0 && <p className="panel">Aucune question. Ajoutez la première avec le formulaire.</p>}
        <ol className="space-y-2">
          {questions.map((q, i) => {
            const src = q.rules[0] && questions.find((x) => x.id === q.rules[0].source_question_id);
            const newGroup = i === 0 ? q.section_id !== null : q.section_id !== questions[i - 1].section_id;
            return (
              <li key={q.id} onDragOver={(e) => drag !== null && questions[drag].section_id === q.section_id && e.preventDefault()}
                onDrop={() => { if (drag !== null && drag !== i && questions[drag].section_id === q.section_id) move(drag, i); setDrag(null); }}>
                {newGroup && q.section_id !== null && (
                  <div className="mb-2 mt-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold">{sectionName(q.section_id)}</h3>
                    {!readOnly && (
                      <span className="flex gap-1">
                        <button aria-label="Renommer la section" title="Renommer" className={iconBtn} onClick={() => { const t = window.prompt('Nom de la section', sectionName(q.section_id)); if (t?.trim()) simple.mutate({ path: `/sections/${q.section_id}`, method: 'PUT', body: { title: t.trim() } }); }}><Pencil size={15} /></button>
                        <button aria-label="Supprimer la section" title="Supprimer (les questions restent)" className={iconBtn} onClick={() => window.confirm('Supprimer cette section ? Ses questions sont conservées.') && simple.mutate({ path: `/sections/${q.section_id}`, method: 'DELETE' })}><Trash2 size={15} /></button>
                      </span>
                    )}
                  </div>
                )}
                <div className={`panel ${editing === q.id ? 'border-forest' : ''}`} draggable={!readOnly} onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}>
                  <div className="flex items-start gap-2">
                    {!readOnly && <GripVertical size={18} className="mt-0.5 shrink-0 cursor-grab text-forest/40" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{i + 1}. {q.label}{q.required && ' *'}</p>
                      <p className="text-sm">{TYPES[q.type]}{q.options.length > 0 && ` : ${q.options.map((o) => o.label).join(', ')}`}</p>
                      {src && <p className="text-sm text-forest/70">Affichée si « {src.label} » {OPERATORS[q.rules[0].operator]} {q.rules[0].value}</p>}
                    </div>
                    {!readOnly && (
                      <span className="flex shrink-0 flex-wrap justify-end">
                        <button aria-label="Monter" title="Monter" className={iconBtn} disabled={i === 0 || questions[i - 1].section_id !== q.section_id} onClick={() => move(i, i - 1)}><ArrowUp size={16} /></button>
                        <button aria-label="Descendre" title="Descendre" className={iconBtn} disabled={i === questions.length - 1 || questions[i + 1].section_id !== q.section_id} onClick={() => move(i, i + 1)}><ArrowDown size={16} /></button>
                        <button aria-label="Modifier" title="Modifier" className={iconBtn} onClick={() => edit(q)}><Pencil size={16} /></button>
                        <button aria-label="Dupliquer" title="Dupliquer" className={iconBtn} onClick={() => simple.mutate({ path: `/questions/${q.id}/duplicate`, method: 'POST' })}><Copy size={16} /></button>
                        <button aria-label="Supprimer" title="Supprimer" className={iconBtn} onClick={() => window.confirm('Supprimer cette question ?') && simple.mutate({ path: `/questions/${q.id}`, method: 'DELETE' })}><Trash2 size={16} /></button>
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm">Chaque action est enregistrée aussitôt. Les modifications ne sont visibles du public qu’après « Publier ».</p>
      </section>

      {!readOnly && (
        <aside className="panel h-fit md:sticky md:top-4">
          <h2 className="mb-3 text-lg font-bold">{editing ? 'Modifier la question' : 'Ajouter une question'}</h2>
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <label className="label" htmlFor="qt">Type</label>
            <select id="qt" className="input mb-3" disabled={!!editing} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              {Object.entries(TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label className="label" htmlFor="ql">Question</label>
            <input id="ql" className="input mb-3" required value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />
            {choice && (
              <fieldset className="mb-3">
                <legend className="label">Choix</legend>
                {f.options.map((o, i) => (
                  <div key={i} className="mb-2 flex gap-2">
                    <input className="input" aria-label={`Choix ${i + 1}`} value={o.label} onChange={(e) => setOpt(i, { label: e.target.value })} />
                    <button type="button" aria-label="Retirer ce choix" className={iconBtn} onClick={() => setF({ ...f, options: f.options.filter((_, j) => j !== i) })}><X size={16} /></button>
                  </div>
                ))}
                <button type="button" className="btn-ghost" onClick={() => setF({ ...f, options: [...f.options, { label: '', value: '' }] })}><Plus size={15} /> Ajouter un choix</button>
              </fieldset>
            )}
            {f.type === 'number' && (
              <div className="mb-3 grid grid-cols-2 gap-2">
                <div><label className="label" htmlFor="mn">Minimum</label><input id="mn" type="number" className="input" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} /></div>
                <div><label className="label" htmlFor="mx">Maximum</label><input id="mx" type="number" className="input" value={f.max} onChange={(e) => setF({ ...f, max: e.target.value })} /></div>
              </div>
            )}
            {sections.length > 0 && (
              <>
                <label className="label" htmlFor="qs">Section</label>
                <select id="qs" className="input mb-3" value={f.section_id} onChange={(e) => setF({ ...f, section_id: e.target.value })}>
                  <option value="">Sans section</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </>
            )}
            <label className="mb-3 flex items-center gap-2"><input type="checkbox" checked={f.required} onChange={(e) => setF({ ...f, required: e.target.checked })} /> Réponse obligatoire</label>
            {sources.length > 0 && (
              <fieldset className="mb-3 rounded-lg border border-forest/15 p-3">
                <legend className="px-1 text-sm font-semibold">Condition d’affichage (facultatif)</legend>
                <select className="input mb-2" aria-label="Question de départ" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value, value: '' })}>
                  <option value="">Toujours afficher</option>
                  {sources.map((q) => <option key={q.id} value={q.id}>Si « {q.label} »</option>)}
                </select>
                {f.source && (
                  <>
                    <select className="input mb-2" aria-label="Opérateur" value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })}>
                      {Object.entries(OPERATORS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <RuleValue source={source} value={f.value} onChange={(v) => setF({ ...f, value: v })} />
                  </>
                )}
              </fieldset>
            )}
            <div className="flex gap-2">
              <button className="btn flex-1" disabled={save.isPending}>{editing ? 'Enregistrer' : 'Ajouter'}</button>
              {editing && <button type="button" className="btn-ghost" onClick={reset}>Annuler</button>}
            </div>
          </form>
        </aside>
      )}
    </div>
  );
}

function Preview({ questions }) {
  const [answers, setAnswers] = useState({});
  const visible = visibleQuestions(questions, answers);
  return (
    <div className="mx-auto max-w-xl">
      <p className="panel mb-3 text-sm">Aperçu du formulaire tel que le verront les participants. Rien n’est enregistré.</p>
      {visible.length === 0 && <p className="panel">Ajoutez des questions pour voir l’aperçu.</p>}
      {visible.map((q) => <PreviewQuestion key={q.id} q={q} value={answers[q.id]} onChange={(v) => setAnswers({ ...answers, [q.id]: v })} />)}
    </div>
  );
}

function History({ study }) {
  const h = useQuery({ queryKey: ['history', study.id], queryFn: () => api(`/studies/${study.id}/history`) });
  if (h.isLoading) return <p>Chargement…</p>;
  if (h.isError) return <p className="error">{errText(h.error)}</p>;
  const date = (x) => new Date(x).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="panel">
        <h2 className="mb-3 text-lg font-bold">Versions publiées</h2>
        {h.data.versions.length === 0 && <p className="text-sm">Aucune version publiée pour l’instant.</p>}
        <ul className="divide-y divide-forest/10">
          {h.data.versions.map((v) => (
            <li key={v.version_number} className="py-2 text-sm">
              <span className="font-semibold">Version {v.version_number}</span>{v.is_current && <span className="ml-2 rounded-full bg-lime px-2 py-0.5 text-xs font-bold">en cours</span>}
              <span className="block text-forest/70">{date(v.published_at)} · {v.responses_count} réponse(s)</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h2 className="mb-3 text-lg font-bold">Journal d’activité</h2>
        {h.data.activity.length === 0 && <p className="text-sm">Aucune activité enregistrée.</p>}
        <ul className="divide-y divide-forest/10">
          {h.data.activity.map((a, i) => (
            <li key={i} className="py-2 text-sm"><span className="font-semibold">{EVENTS[a.action] || a.action}</span><span className="block text-forest/70">{a.user_name || 'Un membre'} · {date(a.created_at)}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
