import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowDown, ArrowUp, Copy, FolderPlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api, errText } from '../api';
import Results from './Results';
import { Question as PreviewQuestion, buildVisibleSteps, visibleQuestions } from './Public';
import { STATUS } from '../ui';

const OTHER_PREFIX = '__dobi_other__:';
const TYPES = {
  short_text: 'Réponse courte', long_text: 'Réponse longue', integer: 'Nombre entier', decimal: 'Nombre décimal', single_choice: 'Choix unique', dropdown: 'Liste déroulante', multiple_choice: 'Choix multiple',
  yes_no: 'Oui / Non', number: 'Nombre', date: 'Date', time: 'Heure', datetime: 'Date et heure', scale: 'Échelle de notation', location: 'Lieu / adresse', geolocation: 'Position GPS', note: 'Texte informatif',
};
const OPERATORS = { equals: 'est égal à', not_equals: 'est différent de', contains: 'contient', gt: 'est supérieur à', gte: 'est supérieur ou égal à', lt: 'est inférieur à', lte: 'est inférieur ou égal à' };
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
      {tab === 'preview' && <Preview questions={questions} sections={tree.data?.sections || []} />}
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
  if (source && ['single_choice', 'dropdown', 'multiple_choice'].includes(source.type)) {
    return (
      <select className="input" aria-label="Valeur" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choisir…</option>
        {source.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {source.settings?.allow_other && <option value="__other__">Autre</option>}
      </select>
    );
  }
  return <input className="input" aria-label="Valeur" placeholder="Valeur" value={value} onChange={(e) => onChange(e.target.value)} />;
}

function Builder({ study, questions, sections, onChange, readOnly }) {
  const blank = { type: 'short_text', label: '', description: '', required: false, allow_other: false, section_id: '', options: [{ label: '', value: '' }, { label: '', value: '' }], source: '', operator: 'equals', value: '', min: '', max: '', min_length: '', max_length: '', format: '' };
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? null);
  const [sectionForm, setSectionForm] = useState({ title: '', description: '' });
  const [editingSection, setEditingSection] = useState(null);
  const [error, setError] = useState('');
  const [showSectionForm, setShowSectionForm] = useState(false);
  const choice = ['single_choice', 'dropdown', 'multiple_choice'].includes(f.type);
  const ordered = [...questions].sort((a, b) => {
    const sa = sections.find((x) => x.id === a.section_id)?.position ?? -1;
    const sb = sections.find((x) => x.id === b.section_id)?.position ?? -1;
    return sa - sb || a.position - b.position || a.id - b.id;
  });
  const currentQuestionIndex = editing ? ordered.findIndex((q) => q.id === editing) : ordered.length;
  const sources = ordered.slice(0, Math.max(0, currentQuestionIndex)).filter((q) => !['note', 'geolocation'].includes(q.type));
  const source = sources.find((q) => String(q.id) === String(f.source));
  const ok = () => { setError(''); onChange(); };
  const fail = (e) => setError(errText(e));
  const reset = () => { setF({ ...blank, section_id: activeSection ?? '' }); setEditing(null); };
  const simple = useMutation({ mutationFn: ({ path, method, body }) => api(path, { method, body }), onSuccess: ok, onError: fail });

  const saveSection = useMutation({
    mutationFn: () => editingSection
      ? api(`/sections/${editingSection}`, { method: 'PUT', body: sectionForm })
      : api(`/studies/${study.id}/sections`, { method: 'POST', body: sectionForm }),
    onSuccess: (section) => { setSectionForm({ title: '', description: '' }); setEditingSection(null); setShowSectionForm(false); setActiveSection(section.id); ok(); },
    onError: fail,
  });
  const save = useMutation({
    mutationFn: () => {
      const settings = {};
      if (['integer', 'decimal', 'number', 'scale'].includes(f.type)) {
        if (f.min !== '') settings.min = Number(f.min);
        if (f.max !== '') settings.max = Number(f.max);
      }
      if (f.type === 'scale') { settings.min ??= 1; settings.max ??= 5; }
      if (f.min_length !== '') settings.min_length = Number(f.min_length);
      if (f.max_length !== '') settings.max_length = Number(f.max_length);
      if (f.format) settings.format = f.format;
      if (['single_choice', 'multiple_choice'].includes(f.type) && f.allow_other) settings.allow_other = true;
      const body = {
        label: f.label.trim(), description: f.description.trim() || null, required: f.type === 'note' ? false : f.required,
        section_id: f.section_id ? Number(f.section_id) : null,
        ...(!editing ? { type: f.type } : {}),
        ...(choice ? { options: f.options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), ...(o.value ? { value: o.value } : {}) })) } : {}),
        settings: Object.keys(settings).length ? settings : null,
        rules: f.source ? [{ source_question_id: Number(f.source), operator: f.operator, value: String(f.value ?? '') }] : [],
      };
      return editing ? api(`/questions/${editing}`, { method: 'PUT', body }) : api(`/studies/${study.id}/questions`, { method: 'POST', body });
    },
    onSuccess: () => { reset(); ok(); }, onError: fail,
  });

  const editQuestion = (q) => {
    setEditing(q.id);
    setActiveSection(q.section_id ?? null);
    setF({ ...blank, type: q.type, label: q.label, description: q.description || '', required: q.required, section_id: q.section_id ?? '',
      options: q.options?.length ? q.options.map((o) => ({ ...o })) : [{ label: '', value: '' }, { label: '', value: '' }],
      source: q.rules?.[0]?.source_question_id ?? '', operator: q.rules?.[0]?.operator ?? 'equals', value: q.rules?.[0]?.value ?? '',
      min: q.settings?.min ?? '', max: q.settings?.max ?? '', min_length: q.settings?.min_length ?? '', max_length: q.settings?.max_length ?? '', format: q.settings?.format ?? '', allow_other: !!q.settings?.allow_other });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const editStep = (section) => { setEditingSection(section.id); setSectionForm({ title: section.title, description: section.description || '' }); setShowSectionForm(true); };
  const saveLayout = (nextSections, nextQuestions) => {
    const steps = nextSections.map((section) => ({ id: section.id, questions: nextQuestions.filter((q) => q.section_id === section.id).map((q) => q.id) }));
    const loose = nextQuestions.filter((q) => !q.section_id).map((q) => q.id);
    if (loose.length) steps.unshift({ id: null, questions: loose });
    simple.mutate({ path: `/studies/${study.id}/layout`, method: 'PUT', body: { steps } });
  };
  const moveQuestion = (question, targetSectionId) => {
    const nextQuestions = ordered.map((q) => q.id === question.id ? { ...q, section_id: targetSectionId } : q);
    saveLayout(sections, nextQuestions);
  };
  const moveSection = (section, direction) => {
    const sorted = [...sections].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((s) => s.id === section.id), target = index + direction;
    if (target < 0 || target >= sorted.length) return;
    [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
    simple.mutate({ path: `/studies/${study.id}/reorder`, method: 'POST', body: { sections: sorted.map((s) => s.id) } });
  };
  const iconBtn = 'rounded-lg p-2 hover:bg-forest/10 disabled:opacity-30';
  const sectionQuestions = (id) => ordered.filter((q) => q.section_id === id);

  return <div className="space-y-5">
    {error && <p className="error" role="alert">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-bold">Structure du formulaire</h2><p className="text-sm text-forest/70">Organisez votre enquête en étapes. Chaque étape peut contenir plusieurs questions.</p></div>
      {!readOnly && <button className="btn" onClick={() => { setEditingSection(null); setSectionForm({ title: '', description: '' }); setShowSectionForm(true); }}><FolderPlus size={16}/> Ajouter une étape</button>}
    </div>
    {showSectionForm && !readOnly && <form className="panel space-y-3" onSubmit={(e) => { e.preventDefault(); saveSection.mutate(); }}>
      <h3 className="font-bold">{editingSection ? 'Modifier l’étape' : 'Nouvelle étape'}</h3>
      <div><label className="label">Titre de l’étape</label><input className="input" required maxLength={200} placeholder="Ex. Identification du répondant" value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })}/></div>
      <div><label className="label">Description (facultative)</label><textarea className="input" rows={2} maxLength={2000} placeholder="Expliquez brièvement ce que le participant doit renseigner…" value={sectionForm.description} onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value })}/></div>
      <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => { setShowSectionForm(false); setEditingSection(null); }}>Annuler</button><button className="btn" disabled={saveSection.isPending}>Enregistrer l’étape</button></div>
    </form>}
    {sections.length === 0 && <div className="panel text-center"><h3 className="font-semibold">Aucune étape pour le moment</h3><p className="mt-1 text-sm text-forest/70">Commencez par créer la première étape de votre formulaire.</p>{!readOnly && <button className="btn mt-3" onClick={() => setShowSectionForm(true)}><Plus size={16}/> Créer l’étape 1</button>}</div>}
    <div className="space-y-4">
      {[...sections].sort((a,b) => a.position-b.position).map((section, index) => {
        const qs = sectionQuestions(section.id);
        const stepSources = ordered.filter((q) => q.section_id !== section.id && !['note','geolocation'].includes(q.type) && (sections.find((s) => s.id === q.section_id)?.position ?? -1) < section.position);
        return <section key={section.id} className={`overflow-hidden rounded-xl border ${activeSection === section.id ? 'border-forest ring-1 ring-forest/20' : 'border-forest/15'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3 bg-forest/5 p-4">
            <button className="min-w-0 flex-1 text-left" onClick={() => setActiveSection(section.id)}><p className="text-xs font-bold uppercase tracking-wider text-forest/60">Étape {index + 1} · {qs.length} question(s)</p><h3 className="mt-1 text-lg font-bold">{section.title}</h3>{section.description && <p className="mt-1 text-sm text-forest/75">{section.description}</p>}</button>
            {!readOnly && <div className="flex items-center gap-1"><button className={iconBtn} title="Monter" disabled={index===0} onClick={() => moveSection(section,-1)}><ArrowUp size={16}/></button><button className={iconBtn} title="Descendre" disabled={index===sections.length-1} onClick={() => moveSection(section,1)}><ArrowDown size={16}/></button><button className={iconBtn} title="Modifier l’étape" onClick={() => editStep(section)}><Pencil size={16}/></button><button className={iconBtn} title="Supprimer l’étape" onClick={() => window.confirm('Supprimer cette étape ? Les questions seront conservées sans étape.') && simple.mutate({path:`/sections/${section.id}`,method:'DELETE'})}><Trash2 size={16}/></button></div>}
          </div>
          <div className="space-y-3 p-4">
            {section.rules?.length > 0 && <p className="rounded-lg bg-amber-50 p-2 text-sm">Cette étape est conditionnelle : {section.rules.map((r) => { const src=ordered.find((q)=>q.id===r.source_question_id); return src ? `« ${src.label} » ${OPERATORS[r.operator] || r.operator} ${r.value}` : ''; }).filter(Boolean).join(' et ')}</p>}
            {qs.length === 0 && <p className="rounded-lg border border-dashed border-forest/20 p-4 text-center text-sm text-forest/60">Aucune question dans cette étape.</p>}
            {qs.map((q, qi) => <div key={q.id} className="panel flex items-start gap-3">
              <span className="mt-0.5 text-sm font-bold text-forest/50">{qi+1}.</span><div className="min-w-0 flex-1"><p className="font-semibold">{q.label}{q.required && ' *'}</p><p className="text-sm text-forest/65">{TYPES[q.type] || q.type}{q.options?.length ? ` · ${q.options.map(o=>o.label).join(', ')}${q.settings?.allow_other ? ', Autre' : ''}` : ''}</p>{q.description && <p className="mt-1 text-sm">{q.description}</p>}{q.rules?.length>0 && <p className="mt-1 text-xs text-forest/65">Condition : {q.rules.map(r=>{const src=ordered.find(x=>x.id===r.source_question_id);return src?`« ${src.label} » ${OPERATORS[r.operator]||r.operator} ${r.value}`:''}).join(' et ')}</p>}</div>
              {!readOnly && <div className="flex shrink-0 gap-1"><button className={iconBtn} title="Modifier" onClick={()=>editQuestion(q)}><Pencil size={15}/></button><button className={iconBtn} title="Dupliquer" onClick={()=>simple.mutate({path:`/questions/${q.id}/duplicate`,method:'POST'})}><Copy size={15}/></button><button className={iconBtn} title="Supprimer" onClick={()=>window.confirm('Supprimer cette question ?')&&simple.mutate({path:`/questions/${q.id}`,method:'DELETE'})}><Trash2 size={15}/></button></div>}
            </div>)}
            {!readOnly && <div className="flex flex-wrap items-center gap-2"><button className="btn" onClick={()=>{reset();setActiveSection(section.id);}}><Plus size={16}/> Ajouter une question</button><label className="text-sm text-forest/70">Déplacer une question vers cette étape : <select className="input mt-1" value="" onChange={(e)=>{const q=ordered.find(x=>String(x.id)===e.target.value);if(q)moveQuestion(q,section.id);}}><option value="">Choisir une question…</option>{ordered.filter(q=>q.section_id!==section.id).map(q=><option key={q.id} value={q.id}>{q.label}</option>)}</select></label></div>}
            {!readOnly && stepSources.length>0 && <SectionConditions section={section} sources={stepSources} onSave={(rules)=>simple.mutate({path:`/sections/${section.id}`,method:'PUT',body:{title:section.title,description:section.description,rules}})}/>}
          </div>
        </section>;
      })}
    </div>
    {!readOnly && <aside className="panel space-y-3" id="question-editor">
      <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{editing?'Modifier la question':'Nouvelle question'}</h2>{editing&&<button className="btn-ghost" onClick={reset}><X size={16}/> Annuler</button>}</div>
      <form className="space-y-3" onSubmit={(e)=>{e.preventDefault();save.mutate();}}>
        <div><label className="label">Étape</label><select className="input" value={f.section_id} onChange={(e)=>setF({...f,section_id:e.target.value})}><option value="">Sans étape</option>{sections.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></div>
        <div><label className="label">Type de question</label><select className="input" disabled={!!editing} value={f.type} onChange={(e)=>setF({...f,type:e.target.value})}>{Object.entries({short_text:'Réponse courte',long_text:'Réponse longue',integer:'Nombre entier',decimal:'Nombre décimal',single_choice:'Choix unique',dropdown:'Liste déroulante',multiple_choice:'Choix multiple',yes_no:'Oui / Non',date:'Date',time:'Heure',datetime:'Date et heure',scale:'Échelle de notation',location:'Lieu / adresse',geolocation:'Position GPS',note:'Texte informatif'}).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label">Intitulé de la question ou consigne</label><input className="input" required maxLength={500} value={f.label} onChange={(e)=>setF({...f,label:e.target.value})} placeholder="Ex. Disposez-vous d'un accès à l'eau potable ?"/></div>
        <div><label className="label">Description ou aide (facultative)</label><textarea className="input" rows={2} maxLength={2000} value={f.description} onChange={(e)=>setF({...f,description:e.target.value})} placeholder="Précisez ce qui est attendu…"/></div>
        {choice && <fieldset className="space-y-2"><legend className="label">Options de réponse</legend>{f.options.map((o,i)=><div className="flex gap-2" key={i}><input className="input" required aria-label={`Option ${i+1}`} placeholder={`Option ${i+1}`} value={o.label} onChange={(e)=>setF({...f,options:f.options.map((x,j)=>j===i?{...x,label:e.target.value}:x)})}/><button type="button" className={iconBtn} aria-label="Supprimer l’option" onClick={()=>setF({...f,options:f.options.filter((_,j)=>j!==i)})}><X size={16}/></button></div>)}<button type="button" className="btn-ghost" onClick={()=>setF({...f,options:[...f.options,{label:'',value:''}]})}><Plus size={15}/> Ajouter une option</button>{['single_choice','multiple_choice'].includes(f.type)&&<label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={f.allow_other} onChange={(e)=>setF({...f,allow_other:e.target.checked})}/> <span><strong>Ajouter un choix « Autre »</strong><span className="block text-xs text-forest/65">Le participant pourra préciser sa propre réponse.</span></span></label>}</fieldset>}
        {['integer','decimal','number','scale'].includes(f.type)&&<div className="grid grid-cols-2 gap-2"><div><label className="label">Minimum</label><input className="input" type="number" value={f.min} onChange={(e)=>setF({...f,min:e.target.value})}/></div><div><label className="label">Maximum</label><input className="input" type="number" value={f.max} onChange={(e)=>setF({...f,max:e.target.value})}/></div></div>}
        {['short_text','long_text','location'].includes(f.type)&&<div className="grid grid-cols-2 gap-2"><div><label className="label">Longueur min.</label><input className="input" type="number" min="0" value={f.min_length} onChange={(e)=>setF({...f,min_length:e.target.value})}/></div><div><label className="label">Longueur max.</label><input className="input" type="number" min="1" value={f.max_length} onChange={(e)=>setF({...f,max_length:e.target.value})}/></div></div>}
        {['short_text','long_text'].includes(f.type)&&<div><label className="label">Format attendu</label><select className="input" value={f.format} onChange={(e)=>setF({...f,format:e.target.value})}><option value="">Texte libre</option><option value="email">Adresse e-mail</option><option value="phone">Téléphone</option><option value="url">Adresse web</option></select></div>}
        {f.type!=='note'&&<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.required} onChange={(e)=>setF({...f,required:e.target.checked})}/> Réponse obligatoire</label>}
        {sources.length>0&&<fieldset className="space-y-2 rounded-lg border border-forest/15 p-3"><legend className="px-1 text-sm font-semibold">Condition d’affichage (facultatif)</legend><select className="input" value={f.source} onChange={(e)=>setF({...f,source:e.target.value,value:''})}><option value="">Toujours afficher</option>{sources.map(q=><option key={q.id} value={q.id}>{q.label}</option>)}</select>{f.source&&<><select className="input" value={f.operator} onChange={(e)=>setF({...f,operator:e.target.value})}>{Object.entries(OPERATORS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><RuleValue source={source} value={f.value} onChange={(v)=>setF({...f,value:v})}/></>}</fieldset>}
        <button className="btn w-full" disabled={save.isPending}>{save.isPending?'Enregistrement…':editing?'Enregistrer la question':'Ajouter la question'}</button>
      </form>
    </aside>}
    <p className="text-sm text-forest/65">Chaque modification est enregistrée automatiquement. Les participants ne voient les changements qu'après publication d'une nouvelle version.</p>
  </div>;
}

function SectionConditions({ section, sources, onSave }) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState(section.rules?.[0]?.source_question_id ?? '');
  const [operator, setOperator] = useState(section.rules?.[0]?.operator ?? 'equals');
  const [value, setValue] = useState(section.rules?.[0]?.value ?? '');
  const source = sources.find((q) => String(q.id) === String(sourceId));
  return <div className="rounded-lg border border-dashed border-forest/20 p-3"><button className="text-sm font-semibold underline" onClick={()=>setOpen(!open)}>{section.rules?.length ? 'Modifier la condition de cette étape' : 'Ajouter une condition à cette étape'}</button>{open&&<div className="mt-3 grid gap-2 sm:grid-cols-3"><select className="input" value={sourceId} onChange={(e)=>{setSourceId(e.target.value);setValue('');}}><option value="">Question précédente…</option>{sources.map(q=><option key={q.id} value={q.id}>{q.label}</option>)}</select><select className="input" value={operator} onChange={(e)=>setOperator(e.target.value)}>{Object.entries(OPERATORS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select>{source?.type==='yes_no'?<select className="input" value={value} onChange={(e)=>setValue(e.target.value)}><option value="">Choisir…</option><option value="true">Oui</option><option value="false">Non</option></select>:<input className="input" placeholder="Valeur attendue" value={value} onChange={(e)=>setValue(e.target.value)}/>}<div className="sm:col-span-3 flex justify-end gap-2"><button className="btn-ghost" onClick={()=>onSave([])}>Supprimer la condition</button><button className="btn" disabled={!sourceId || value===''} onClick={()=>onSave([{source_question_id:Number(sourceId),operator,value:String(value)}])}>Enregistrer la condition</button></div></div>}</div>;
}

function Preview({ questions, sections = [] }) {
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const steps = sections.length ? buildVisibleSteps(sections, questions, answers) : [{ id: 'all', title: 'Questions', description: '', questions: visibleQuestions(questions, answers) }];
  const current = steps[Math.min(step, Math.max(steps.length - 1, 0))];
  return <div className="mx-auto max-w-xl space-y-3">
    <p className="panel text-sm">Aperçu interactif du formulaire. Les réponses saisies ici ne sont pas enregistrées.</p>
    {steps.length === 0 && <p className="panel">Ajoutez des étapes et des questions pour voir l’aperçu.</p>}
    {current && <><div className="panel"><p className="text-xs font-bold uppercase tracking-wide text-forest/60">Étape {step+1} sur {steps.length}</p><h2 className="mt-1 text-xl font-bold">{current.title}</h2>{current.description&&<p className="mt-1 text-sm">{current.description}</p>}<div className="mt-3 h-2 overflow-hidden rounded-full bg-forest/10"><div className="h-2 rounded-full bg-forest" style={{width:`${((step+1)/steps.length)*100}%`}}/></div></div>
      {current.questions.map((q)=><PreviewQuestion key={q.id} q={q} value={answers[q.id]} onChange={(v)=>setAnswers((old)=>({...old,[q.id]:v}))}/>)}
      <div className="flex justify-between"><button className="btn-ghost" disabled={step===0} onClick={()=>setStep((n)=>Math.max(0,n-1))}>← Précédent</button><button className="btn" disabled={step>=steps.length-1} onClick={()=>setStep((n)=>Math.min(steps.length-1,n+1))}>Étape suivante →</button></div>
    </>}
  </div>;
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
