import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { CalendarClock, CheckCircle2, Clock, ListChecks, ShieldCheck, UserCheck } from 'lucide-react';
import { api, getToken } from '../api';
import { Logo } from '../ui';
import { enqueue } from '../offline';
import { OfflineBanner, PendingBanner } from '../pwa';
import { CloudOff } from 'lucide-react';

// Valeur réservée pour conserver le texte saisi dans le choix « Autre ».
const OTHER_PREFIX = '__dobi_other__:';
const isOtherValue = (v) => typeof v === 'string' && v.startsWith(OTHER_PREFIX);
const otherText = (v) => isOtherValue(v) ? v.slice(OTHER_PREFIX.length) : '';
const isOtherSelected = (v) => isOtherValue(v);

// Évaluation des règles conditionnelles, alignée sur SubmissionValidator Laravel.
function evaluate(answer, op, value) {
  if (op === 'answered') return !isEmpty(answer);
  if (op === 'not_answered') return isEmpty(answer);
  if (answer === undefined || answer === null) return op === 'not_equals';
  const str = (v) => typeof v === 'boolean' ? String(v) : String(v);
  const expected = String(value ?? '');
  const matches = (v) => expected === '__other__' ? isOtherValue(v) : str(v) === expected;
  const eq = Array.isArray(answer) ? answer.some(matches) : matches(answer);
  if (op === 'equals') return eq;
  if (op === 'not_equals') return !eq;
  if (op === 'contains') return Array.isArray(answer) || expected === '__other__' ? eq : str(answer).toLowerCase().includes(expected.toLowerCase());
  if (op === 'gt') return Number(answer) > Number(value);
  if (op === 'gte') return Number(answer) >= Number(value);
  if (op === 'lt') return Number(answer) < Number(value);
  if (op === 'lte') return Number(answer) <= Number(value);
  return false;
}
const isEmpty = (v) => v === undefined || v === null || v === '' || (isOtherValue(v) && otherText(v).trim() === '') || (Array.isArray(v) && (v.length === 0 || v.every((x) => isOtherValue(x) && otherText(x).trim() === '')));
const rulesPass = (rules = [], answers = {}) => rules.every((r) => evaluate(answers[r.source_question_id], r.operator, r.value));
export const visibleQuestions = (qs, answers) => {
  const clean = {};
  const out = [];
  for (const q of qs) {
    if (rulesPass(q.rules, clean)) {
      out.push(q);
      if (!isEmpty(answers[q.id])) clean[q.id] = answers[q.id];
    }
  }
  return out;
};
export const visibleSections = (sections, questions, answers) => {
  const sorted = [...sections].sort((a,b) => a.position-b.position);
  const clean = {};
  // Les questions sans étape sont placées avant les étapes dans l'ordre du backend.
  for (const q of questions.filter((item) => !item.section_id)) {
    if (rulesPass(q.rules, clean) && !isEmpty(answers[q.id])) clean[q.id] = answers[q.id];
  }
  const result = [];
  for (const section of sorted) {
    const visible = rulesPass(section.rules, clean);
    if (visible) result.push(section);
    if (visible) {
      for (const q of questions.filter((item) => item.section_id === section.id)) {
        if (rulesPass(q.rules, clean) && !isEmpty(answers[q.id])) clean[q.id] = answers[q.id];
      }
    }
  }
  return result;
};
export const buildVisibleSteps = (sections, questions, answers) => {
  const clean = {};
  const groups = [];
  const loose = [];
  for (const q of questions.filter((item) => !item.section_id)) {
    if (rulesPass(q.rules, clean)) {
      loose.push(q);
      if (!isEmpty(answers[q.id])) clean[q.id] = answers[q.id];
    }
  }
  if (loose.length) groups.push({ id: 'loose', title: 'Questions générales', description: '', questions: loose });
  for (const section of [...sections].sort((a,b)=>a.position-b.position)) {
    if (!rulesPass(section.rules, clean)) continue;
    const sectionQuestions = [];
    for (const q of questions.filter((item)=>item.section_id===section.id)) {
      if (!rulesPass(q.rules, clean)) continue;
      sectionQuestions.push(q);
      if (!isEmpty(answers[q.id])) clean[q.id] = answers[q.id];
    }
    if (sectionQuestions.length || section.description || section.title) groups.push({ ...section, questions: sectionQuestions });
  }
  return groups;
};

function Input({ q, value, onChange }) {
  const set = (v) => onChange(v);
  switch (q.type) {
    case 'note': return null;
    case 'long_text': return <textarea className="input" rows={4} value={value ?? ''} onChange={(e) => set(e.target.value)} />;
    case 'single_choice': {
      const other = isOtherSelected(value);
      return <>
        {q.options.map((o) => <label key={o.value} className="mb-2 flex items-center gap-2"><input type="radio" name={`q${q.id}`} checked={!other && value === o.value} onChange={() => set(o.value)} /> {o.label}</label>)}
        {q.settings?.allow_other && <div className="mt-2">
          <label className="mb-2 flex items-center gap-2"><input type="radio" name={`q${q.id}`} checked={other} onChange={() => set(`${OTHER_PREFIX}${otherText(value)}`)} /> Autre</label>
          {other && <input className="input" type="text" maxLength={2000} value={otherText(value)} onChange={(e) => set(`${OTHER_PREFIX}${e.target.value}`)} placeholder="Précisez votre réponse…" aria-label={`Précisez votre réponse pour ${q.label}`} />}
        </div>}
      </>;
    }
    case 'dropdown': return <select className="input" value={value ?? ''} onChange={(e)=>set(e.target.value)}><option value="">Sélectionner…</option>{q.options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>;
    case 'multiple_choice': {
      const cur = Array.isArray(value) ? value : [];
      const otherValue = cur.find(isOtherValue) || `${OTHER_PREFIX}`;
      const other = cur.some(isOtherValue);
      const toggle = (v) => set(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
      return <>
        {q.options.map((o) => <label key={o.value} className="mb-2 flex items-center gap-2"><input type="checkbox" checked={cur.includes(o.value)} onChange={() => toggle(o.value)} /> {o.label}</label>)}
        {q.settings?.allow_other && <div className="mt-2">
          <label className="mb-2 flex items-center gap-2"><input type="checkbox" checked={other} onChange={() => toggle(otherValue)} /> Autre</label>
          {other && <input className="input" type="text" maxLength={2000} value={otherText(otherValue)} onChange={(e) => set(cur.map((x) => isOtherValue(x) ? `${OTHER_PREFIX}${e.target.value}` : x))} placeholder="Précisez votre réponse…" aria-label={`Précisez votre réponse pour ${q.label}`} />}
        </div>}
      </>;
    }
    case 'yes_no': return <div className="flex flex-wrap gap-3">{[[true, 'Oui'], [false, 'Non']].map(([v,l])=><label key={l} className={`flex min-w-28 flex-1 items-center gap-2 rounded-lg border p-3 ${value===v?'border-forest bg-forest/5':''}`}><input type="radio" name={`q${q.id}`} checked={value===v} onChange={()=>set(v)}/>{l}</label>)}</div>;
    case 'scale': { const min=q.settings?.min??1,max=q.settings?.max??5; return <div className="flex flex-wrap gap-2">{Array.from({length:Math.max(0,max-min+1)},(_,i)=>min+i).map(n=><button type="button" key={n} onClick={()=>set(n)} className={value===n?'btn':'btn-ghost'} aria-pressed={value===n}>{n}</button>)}</div>; }
    case 'integer': return <input className="input" type="number" step="1" value={value??''} onChange={(e)=>set(e.target.value===''?'':Number(e.target.value))}/>;
    case 'decimal': case 'number': return <input className="input" type="number" step="any" value={value??''} onChange={(e)=>set(e.target.value===''?'':Number(e.target.value))}/>;
    case 'date': return <input className="input" type="date" value={value??''} onChange={(e)=>set(e.target.value)}/>;
    case 'time': return <input className="input" type="time" value={value??''} onChange={(e)=>set(e.target.value)}/>;
    case 'datetime': return <input className="input" type="datetime-local" value={value??''} onChange={(e)=>set(e.target.value)}/>;
    case 'geolocation': return <div className="space-y-2"><button type="button" className="btn-ghost" onClick={()=>{if(!navigator.geolocation)return; navigator.geolocation.getCurrentPosition((p)=>set({lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy}),()=>{});}}>Obtenir ma position GPS</button>{value?.lat!==undefined&&<p className="text-sm text-forest/70">Position relevée : {Number(value.lat).toFixed(5)}, {Number(value.lng).toFixed(5)}</p>}</div>;
    default: return <input className="input" value={value??''} onChange={(e)=>set(e.target.value)}/>;
  }
}

export function Question({ q, value, onChange, error }) {
  return (
    <div className="panel mb-3">
      <p className="mb-1 font-semibold">{q.label}{q.required && <span className="text-alert"> *</span>}</p>
      {q.description && <p className="mb-2 text-sm">{q.description}</p>}
      <Input q={q} value={value} onChange={onChange} />
      {error && <p className="mt-2 text-sm text-alert">{error.join(' ')}</p>}
    </div>
  );
}

function PublicShell({ orgName, orgSlug, children }) {
  return (
    <div className="flex min-h-screen flex-col">
      <OfflineBanner collect />
      <header className="border-b border-forest/10">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Logo size={28} />
          {orgName && (orgSlug ? <Link to={`/o/${orgSlug}`} className="truncate text-sm font-semibold underline">{orgName}</Link> : <span className="truncate text-sm font-semibold">{orgName}</span>)}
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6"><PendingBanner />{children}</main>
      <footer className="px-4 py-6 text-center text-xs text-forest/60">
        <p className="font-semibold">Propulsé par DOBI</p>
        <p>Les données ont une histoire.</p>
      </footer>
    </div>
  );
}

function Chip({ icon: Icon, children }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm"><Icon size={15} strokeWidth={1.75} />{children}</span>;
}

export function PublicStudy() {
  const { slug } = useParams();
  const [urlParams] = useSearchParams(); // hook : doit rester avant tout return conditionnel
  const data = useQuery({ queryKey: ['public', slug], queryFn: () => api(`/public/studies/${slug}`, { auth: false }) });
  const [phase, setPhase] = useState('intro');
  const [answers, setAnswers] = useState({});
  const [who, setWho] = useState({ full_name: '', email: '', phone: '' });
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState('');
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState('');
  const [busy, setBusy] = useState(false);
  const [token] = useState(() => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const questions = data.data?.questionnaire?.questions || [];
  const sections = data.data?.questionnaire?.sections || [];
  const steps = useMemo(() => {
    if (!sections.length) return [{ id: 'all', title: 'Questions', description: '', questions: visibleQuestions(questions, answers) }];
    return buildVisibleSteps(sections, questions, answers);
  }, [sections, questions, answers]);
  const allVisible = steps.flatMap((group)=>group.questions);

  if (data.isLoading) return <PublicShell><p>Chargement…</p></PublicShell>;
  if (data.isError) {
    const closed = data.error.status === 410;
    return <PublicShell><div className="panel text-center"><h1 className="text-2xl font-bold">{closed ? 'Cette étude est clôturée' : 'Étude indisponible'}</h1><p className="mt-2">{closed ? 'La collecte est terminée. Merci de votre intérêt.' : 'Cette étude n’existe pas, n’est pas encore ouverte ou n’est plus accessible.'}</p></div></PublicShell>;
  }

  const { study, privacy_notice: notice } = data.data;
  const org = study.organization;
  const identified = study.privacy_mode === 'identified';
  // Mode collecte : un enquêteur connecté saisit la réponse d'une autre personne (jamais bloqué par appareil).
  const collecting = urlParams.get('collecte') === '1' && !!getToken();
  const doneKey = `dobi_done_${slug}`;
  const markDone = () => { try { if (study.one_response_per_person && !identified && !collecting) localStorage.setItem(doneKey, '1'); } catch { /* stockage indisponible */ } };
  const alreadyDone = () => { try { return !!study.one_response_per_person && !identified && !collecting && localStorage.getItem(doneKey) === '1'; } catch { return false; } };
  const minutes = Math.max(1, Math.round(questions.length / 2));
  const currentIndex = Math.min(step, Math.max(steps.length-1,0));
  const currentStep = steps[currentIndex];
  const currentQuestions = currentStep?.questions || [];
  const answered = allVisible.filter(q=>!isEmpty(answers[q.id])).length;
  const set = (id, v) => { setAnswers((old)=>({...old,[id]:v})); setErrors((old)=>({...old,[id]:undefined})); };

  const submit = async () => {
    setBusy(true); setMessage(''); setErrors({});
    const clean = {};
    allVisible.forEach((q) => { if (!isEmpty(answers[q.id])) clean[q.id] = answers[q.id]; });
    const body = { answers: clean, website: trap, client_token: token, version: data.data.version, ...(identified ? { participant: who, consent } : {}) };
    const saveOffline = async () => { await enqueue({ id: token, slug, title: study.title, body, collect: collecting }); markDone(); setPhase('queued'); window.scrollTo({ top: 0 }); };
    if (!navigator.onLine) { await saveOffline(); setBusy(false); return; }
    try {
      const res = collecting
        ? await api(`/collect/studies/${slug}/responses`, { method: 'POST', body })
        : await api(`/public/studies/${slug}/responses`, { method: 'POST', auth: false, body });
      setReceipt(res.receipt || ''); markDone(); setPhase('done'); window.scrollTo({ top: 0 });
    } catch (e) {
      if (!e.status) { await saveOffline(); setBusy(false); return; }
      if (e.status === 409) { setMessage(e.message); return; }
      const map = {};
      Object.entries(e.errors || {}).forEach(([k, v]) => { map[k.replace('answers.', '')] = v; });
      setErrors(map);
      setMessage(e.status === 429 ? 'Trop de tentatives. Patientez une minute puis réessayez.' : e.errors ? 'Corrigez les champs signalés ci-dessous.' : e.message);
      const firstStep = steps.findIndex(g=>g.questions.some(q=>map[q.id]));
      if(firstStep>=0)setStep(firstStep);
    } finally { setBusy(false); }
  };
  const next = () => {
    const missing = currentQuestions.find(q=>q.type!=='note' && q.required && isEmpty(answers[q.id]));
    if(missing){setErrors({[missing.id]:['Cette question est obligatoire.']});return;}
    setErrors({}); setStep(Math.min(currentIndex+1,steps.length-1)); window.scrollTo({top:0,behavior:'smooth'});
  };
  const previous = () => { setStep(Math.max(0,currentIndex-1)); window.scrollTo({top:0,behavior:'smooth'}); };

  if (phase === 'intro' && alreadyDone()) return <PublicShell orgName={org.name} orgSlug={org.slug}><div className="panel text-center"><CheckCircle2 size={44} strokeWidth={1.5} className="mx-auto text-success"/><h1 className="mt-3 text-2xl font-bold">Vous avez déjà répondu</h1><p className="mt-2">Une seule réponse par personne est acceptée pour « {study.title} ». Merci pour votre participation.</p></div></PublicShell>;
  if (phase === 'queued') return <PublicShell orgName={org.name} orgSlug={org.slug}><div className="panel text-center"><CloudOff size={44} strokeWidth={1.5} className="mx-auto text-forest"/><h1 className="mt-3 text-2xl font-bold">Réponse enregistrée sur cet appareil</h1><p className="mt-2">Elle sera envoyée automatiquement dès que la connexion reviendra. Gardez ce navigateur sur cet appareil.</p></div></PublicShell>;
  if (phase === 'done') return <PublicShell orgName={org.name} orgSlug={org.slug}><div className="panel text-center"><CheckCircle2 size={44} strokeWidth={1.5} className="mx-auto text-success"/><h1 className="mt-3 text-3xl font-bold">Merci !</h1><p className="mt-2">Votre réponse à « {study.title} » a bien été enregistrée.</p>{receipt&&<p className="mt-4 text-sm text-forest/70">Numéro de réception<br/><code className="break-all font-semibold text-forest">{receipt}</code></p>}{collecting ? <div className="mt-6 flex flex-wrap justify-center gap-2"><button className="btn" onClick={() => window.location.reload()}>Collecter une autre réponse</button><Link to="/collecte" className="btn-ghost">Retour à la collecte</Link></div> : <Link to={`/o/${org.slug}`} className="btn mt-6">Voir les autres études de {org.name}</Link>}</div></PublicShell>;
  if (phase === 'intro') return <PublicShell orgName={org.name} orgSlug={org.slug}><section className="rounded-2xl bg-deep p-6 text-white sm:p-8"><p className="text-sm text-white/70">{org.name}{study.category?` — ${study.category}`:''}</p><h1 className="mt-1 text-3xl font-bold sm:text-4xl">{study.title}</h1>{study.description&&<p className="mt-3 text-white/85">{study.description}</p>}<div className="mt-5 flex flex-wrap gap-2"><Chip icon={Clock}>Environ {minutes} min</Chip><Chip icon={ListChecks}>{questions.length} question{questions.length>1?'s':''}</Chip><Chip icon={identified?UserCheck:ShieldCheck}>{identified?'Réponses identifiées':'Réponses anonymes'}</Chip>{study.ends_at&&<Chip icon={CalendarClock}>Jusqu’au {new Date(study.ends_at).toLocaleDateString('fr-FR',{day:'numeric',month:'long'})}</Chip>}</div></section>{study.objective&&<div className="panel mt-4"><h2 className="font-bold">Objectif de l’étude</h2><p className="mt-1">{study.objective}</p></div>}{(study.target_population||study.geographic_zone)&&<p className="mt-4 text-sm">{study.target_population&&<>Public concerné : <strong>{study.target_population}</strong>. </>}{study.geographic_zone&&<>Zone : <strong>{study.geographic_zone}</strong>.</>}</p>}<div className="panel mt-4"><h2 className="font-bold">Vos données</h2><p className="mt-1 text-sm">{notice.text}</p></div><div className="mt-6 flex flex-wrap items-center justify-between gap-4"><button className="btn px-6 py-3 text-base" onClick={()=>setPhase('form')}>Commencer l’enquête</button><div className="flex items-center gap-3 text-xs text-forest/70"><QRCodeSVG value={window.location.href} size={64}/>Scannez pour ouvrir<br/>sur un autre appareil</div></div></PublicShell>;

  const IdentityBlock = identified && currentIndex === steps.length-1 && <div className="panel mt-4"><p className="mb-2 font-semibold">Vos informations</p>{[['full_name','Nom complet','text'],['email','Adresse e-mail','email'],['phone','Téléphone (facultatif)','tel']].map(([k,l,t])=><div key={k} className="mb-2"><input className="input" type={t} aria-label={l} placeholder={l} value={who[k]} onChange={(e)=>setWho({...who,[k]:e.target.value})}/>{errors[`participant.${k}`]&&<p className="mt-1 text-sm text-alert">{errors[`participant.${k}`].join(' ')}</p>}</div>)}<label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(e)=>setConsent(e.target.checked)}/>J’ai lu l’information sur mes données et j’accepte leur traitement.</label>{errors.consent&&<p className="mt-1 text-sm text-alert">{errors.consent.join(' ')}</p>}</div>;
  const last = currentIndex >= steps.length-1;
  return <PublicShell orgName={org.name} orgSlug={org.slug}>
    <h1 className="mb-1 text-2xl font-bold">{study.title}</h1>
    <div className="mb-5" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={currentIndex+1}><div className="h-2 overflow-hidden rounded-full bg-forest/10"><div className="h-2 rounded-full bg-forest transition-all" style={{width:`${((currentIndex+1)/Math.max(steps.length,1))*100}%`}}/></div><p className="mt-1 text-xs text-forest/70">Étape {currentIndex+1} sur {steps.length} · {answered} réponse(s) sur {allVisible.filter(q=>q.type!=='note').length}</p></div>
    {message&&<p className="error mb-3" role="alert">{message}</p>}<input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e)=>setTrap(e.target.value)}/>
    <section className="mb-4"><p className="text-xs font-bold uppercase tracking-wider text-forest/60">Étape {currentIndex+1}</p><h2 className="mt-1 text-2xl font-bold">{currentStep?.title||'Questions'}</h2>{currentStep?.description&&<p className="mt-2 text-forest/75">{currentStep.description}</p>}</section>
    {currentQuestions.map(q=><Question key={q.id} q={q} value={answers[q.id]} onChange={(v)=>set(q.id,v)} error={errors[q.id]?[...errors[q.id]]:null}/>)}
    {IdentityBlock}
    <div className="mt-6 flex items-center justify-between gap-3"><button className="btn-ghost" disabled={step===0} onClick={previous}>← Précédent</button>{last?<button className="btn" disabled={busy} onClick={submit}>{busy?'Envoi…':'Soumettre le formulaire'}</button>:<button className="btn" onClick={next}>Étape suivante →</button>}</div>
  </PublicShell>;
}

export function PublicOrg() {
  const { slug } = useParams();
  const data = useQuery({ queryKey: ['pub-org', slug], queryFn: () => api(`/public/organizations/${slug}`, { auth: false }) });
  if (data.isLoading) return <PublicShell><p>Chargement…</p></PublicShell>;
  if (data.isError) return <PublicShell><div className="panel text-center"><h1 className="text-2xl font-bold">Organisation introuvable</h1><p className="mt-2">Vérifiez l’adresse du lien.</p></div></PublicShell>;
  const { organization: o, studies } = data.data;
  return (
    <PublicShell>
      <section className="rounded-2xl bg-deep p-6 text-white sm:p-8">
        <h1 className="text-3xl font-bold sm:text-4xl">{o.name}</h1>
        {o.description && <p className="mt-3 text-white/85">{o.description}</p>}
      </section>
      <h2 className="mb-3 mt-6 text-xl font-bold">Études ouvertes</h2>
      {studies.length === 0 && <p className="panel">Aucune étude ouverte pour le moment. Revenez bientôt.</p>}
      <ul className="space-y-3">
        {studies.map((s) => (
          <li key={s.slug}>
            <Link className="panel block hover:border-forest" to={`/s/${s.slug}`}>
              <span className="text-lg font-bold">{s.title}</span>
              {s.category && <span className="ml-2 rounded-full bg-lime px-2 py-0.5 text-xs font-bold">{s.category}</span>}
              {s.description && <span className="mt-1 block text-sm">{s.description}</span>}
              <span className="mt-2 block text-sm font-semibold underline">Participer</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex items-center gap-3 text-xs text-forest/70"><QRCodeSVG value={window.location.href} size={72} />Partagez cette page avec ce QR code</div>
    </PublicShell>
  );
}
