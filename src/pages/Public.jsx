import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { CalendarClock, CheckCircle2, Clock, ListChecks, ShieldCheck, UserCheck } from 'lucide-react';
import { api } from '../api';
import { Logo } from '../ui';
import { enqueue } from '../offline';
import { OfflineBanner, PendingBanner } from '../pwa';
import { CloudOff } from 'lucide-react';

// Mêmes règles que l'API (SubmissionValidator) pour décider quelles questions sont visibles.
function evaluate(answer, op, value) {
  if (answer === undefined || answer === null) return op === 'not_equals';
  const str = (v) => (typeof v === 'boolean' ? String(v) : String(v));
  const expected = String(value ?? '');
  const eq = Array.isArray(answer) ? answer.map(str).includes(expected) : str(answer) === expected;
  if (op === 'equals') return eq;
  if (op === 'not_equals') return !eq;
  if (op === 'contains') return Array.isArray(answer) ? eq : str(answer).toLowerCase().includes(expected.toLowerCase());
  if (op === 'gt') return Number(answer) > Number(value);
  if (op === 'lt') return Number(answer) < Number(value);
  return false;
}
const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
export const visibleQuestions = (qs, answers) => {
  const clean = {};
  const out = [];
  for (const q of qs) {
    if (q.rules.every((r) => evaluate(clean[r.source_question_id], r.operator, r.value))) {
      out.push(q);
      if (!isEmpty(answers[q.id])) clean[q.id] = answers[q.id];
    }
  }
  return out;
};

function Input({ q, value, onChange }) {
  const set = (v) => onChange(v);
  switch (q.type) {
    case 'long_text': return <textarea className="input" rows={4} value={value ?? ''} onChange={(e) => set(e.target.value)} />;
    case 'single_choice':
      return q.options.map((o) => (
        <label key={o.value} className="mb-1 flex items-center gap-2"><input type="radio" name={`q${q.id}`} checked={value === o.value} onChange={() => set(o.value)} /> {o.label}</label>
      ));
    case 'multiple_choice':
      return q.options.map((o) => {
        const cur = value || [];
        return <label key={o.value} className="mb-1 flex items-center gap-2"><input type="checkbox" checked={cur.includes(o.value)} onChange={() => set(cur.includes(o.value) ? cur.filter((x) => x !== o.value) : [...cur, o.value])} /> {o.label}</label>;
      });
    case 'yes_no':
      return (
        <div className="flex gap-4">
          {[[true, 'Oui'], [false, 'Non']].map(([v, l]) => (
            <label key={l} className="flex items-center gap-2"><input type="radio" name={`q${q.id}`} checked={value === v} onChange={() => set(v)} /> {l}</label>
          ))}
        </div>
      );
    case 'scale': {
      const min = q.settings?.min ?? 1, max = q.settings?.max ?? 5;
      return (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((n) => (
            <button type="button" key={n} onClick={() => set(n)} className={value === n ? 'btn' : 'btn-ghost'} aria-pressed={value === n}>{n}</button>
          ))}
        </div>
      );
    }
    case 'number': return <input className="input" type="number" value={value ?? ''} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} />;
    case 'date': return <input className="input" type="date" value={value ?? ''} onChange={(e) => set(e.target.value)} />;
    default: return <input className="input" value={value ?? ''} onChange={(e) => set(e.target.value)} />;
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
  // Jeton propre à cette réponse : un renvoi après coupure ne crée jamais de doublon.
  const [token] = useState(() => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  const questions = data.data?.questionnaire?.questions || [];
  const visible = useMemo(() => visibleQuestions(questions, answers), [questions, answers]);

  if (data.isLoading) return <PublicShell><p>Chargement…</p></PublicShell>;
  if (data.isError) {
    const closed = data.error.status === 410;
    return (
      <PublicShell>
        <div className="panel text-center">
          <h1 className="text-2xl font-bold">{closed ? 'Cette étude est clôturée' : 'Étude indisponible'}</h1>
          <p className="mt-2">{closed ? 'La collecte est terminée. Merci de votre intérêt.' : 'Cette étude n’existe pas, n’est pas encore ouverte ou n’est plus accessible.'}</p>
        </div>
      </PublicShell>
    );
  }

  const { study, privacy_notice: notice } = data.data;
  const org = study.organization;
  const identified = study.privacy_mode === 'identified';
  const conversational = study.collection_mode === 'conversational';
  const minutes = Math.max(1, Math.round(questions.length / 2));
  const set = (id, v) => { setAnswers({ ...answers, [id]: v }); if (errors[id]) setErrors({ ...errors, [id]: undefined }); };
  const answered = visible.filter((q) => !isEmpty(answers[q.id])).length;

  const submit = async () => {
    setBusy(true); setMessage(''); setErrors({});
    const clean = {};
    visible.forEach((q) => { if (!isEmpty(answers[q.id])) clean[q.id] = answers[q.id]; });
    const body = { answers: clean, website: trap, client_token: token, version: data.data.version, ...(identified ? { participant: who, consent } : {}) };
    const saveOffline = async () => { await enqueue({ id: token, slug, title: study.title, body }); setPhase('queued'); window.scrollTo({ top: 0 }); };
    if (!navigator.onLine) { await saveOffline(); setBusy(false); return; }
    try {
      const res = await api(`/public/studies/${slug}/responses`, { method: 'POST', auth: false, body });
      setReceipt(res.receipt || '');
      setPhase('done');
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (!e.status) { await saveOffline(); setBusy(false); return; } // coupure réseau : on garde la réponse sur l'appareil
      const map = {};
      Object.entries(e.errors || {}).forEach(([k, v]) => { map[k.replace('answers.', '')] = v; });
      setErrors(map);
      setMessage(e.status === 429 ? 'Trop de tentatives. Patientez une minute puis réessayez.' : e.errors ? 'Corrigez les champs signalés ci-dessous.' : e.message);
      if (conversational) { const first = visible.findIndex((q) => map[q.id]); setStep(first >= 0 ? first : visible.length - 1); }
    } finally { setBusy(false); }
  };

  const next = () => {
    const q = visible[step];
    if (q.required && isEmpty(answers[q.id])) { setErrors({ [q.id]: ['Cette question est obligatoire.'] }); return; }
    setErrors({});
    setStep(step + 1);
  };

  if (phase === 'queued') {
    return (
      <PublicShell orgName={org.name} orgSlug={org.slug}>
        <div className="panel text-center">
          <CloudOff size={44} strokeWidth={1.5} className="mx-auto text-forest" />
          <h1 className="mt-3 text-2xl font-bold">Réponse enregistrée sur cet appareil</h1>
          <p className="mt-2">Elle sera envoyée automatiquement dès que la connexion reviendra. Gardez ce navigateur sur cet appareil.</p>
        </div>
      </PublicShell>
    );
  }

  if (phase === 'done') {
    return (
      <PublicShell orgName={org.name} orgSlug={org.slug}>
        <div className="panel text-center">
          <CheckCircle2 size={44} strokeWidth={1.5} className="mx-auto text-success" />
          <h1 className="mt-3 text-3xl font-bold">Merci !</h1>
          <p className="mt-2">Votre réponse à « {study.title} » a bien été enregistrée.</p>
          {receipt && <p className="mt-4 text-sm text-forest/70">Numéro de réception<br /><code className="break-all font-semibold text-forest">{receipt}</code></p>}
          <Link to={`/o/${org.slug}`} className="btn mt-6">Voir les autres études de {org.name}</Link>
        </div>
      </PublicShell>
    );
  }

  if (phase === 'intro') {
    return (
      <PublicShell orgName={org.name} orgSlug={org.slug}>
        <section className="rounded-2xl bg-deep p-6 text-white sm:p-8">
          <p className="text-sm text-white/70">{org.name}{study.category ? ` — ${study.category}` : ''}</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{study.title}</h1>
          {study.description && <p className="mt-3 text-white/85">{study.description}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            <Chip icon={Clock}>Environ {minutes} min</Chip>
            <Chip icon={ListChecks}>{questions.length} question{questions.length > 1 ? 's' : ''}</Chip>
            <Chip icon={identified ? UserCheck : ShieldCheck}>{identified ? 'Réponses identifiées' : 'Réponses anonymes'}</Chip>
            {study.ends_at && <Chip icon={CalendarClock}>Jusqu’au {new Date(study.ends_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}</Chip>}
          </div>
        </section>
        {study.objective && <div className="panel mt-4"><h2 className="font-bold">Objectif de l’étude</h2><p className="mt-1">{study.objective}</p></div>}
        {(study.target_population || study.geographic_zone) && (
          <p className="mt-4 text-sm">{study.target_population && <>Public concerné : <strong>{study.target_population}</strong>. </>}{study.geographic_zone && <>Zone : <strong>{study.geographic_zone}</strong>.</>}</p>
        )}
        <div className="panel mt-4"><h2 className="font-bold">Vos données</h2><p className="mt-1 text-sm">{notice.text}</p></div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <button className="btn px-6 py-3 text-base" onClick={() => setPhase('form')}>Commencer l’enquête</button>
          <div className="flex items-center gap-3 text-xs text-forest/70"><QRCodeSVG value={window.location.href} size={64} />Scannez pour ouvrir<br />sur un autre appareil</div>
          {navigator.serviceWorker?.controller && <p className="basis-full text-xs text-forest/70">Cette étude reste disponible sur cet appareil même sans connexion.</p>}
        </div>
      </PublicShell>
    );
  }

  const IdentityBlock = identified && (
    <div className="panel mb-3">
      <p className="mb-2 font-semibold">Vos informations</p>
      {[['full_name', 'Nom complet', 'text'], ['email', 'Adresse e-mail', 'email'], ['phone', 'Téléphone (facultatif)', 'tel']].map(([k, l, t]) => (
        <div key={k} className="mb-2">
          <input className="input" type={t} aria-label={l} placeholder={l} value={who[k]} onChange={(e) => setWho({ ...who, [k]: e.target.value })} />
          {errors[`participant.${k}`] && <p className="mt-1 text-sm text-alert">{errors[`participant.${k}`].join(' ')}</p>}
        </div>
      ))}
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> J’ai lu l’information sur mes données et j’accepte leur traitement.</label>
      {errors.consent && <p className="mt-1 text-sm text-alert">{errors.consent.join(' ')}</p>}
    </div>
  );

  const last = step >= visible.length - 1;
  const current = visible[Math.min(step, visible.length - 1)];

  return (
    <PublicShell orgName={org.name} orgSlug={org.slug}>
      <h1 className="mb-1 text-2xl font-bold">{study.title}</h1>
      <div className="mb-4" role="progressbar" aria-valuemin={0} aria-valuemax={visible.length} aria-valuenow={conversational ? step + 1 : answered}>
        <div className="h-2 rounded-full bg-forest/10"><div className="h-2 rounded-full bg-forest" style={{ width: `${((conversational ? step + 1 : answered) / Math.max(visible.length, 1)) * 100}%` }} /></div>
        <p className="mt-1 text-xs text-forest/70">{conversational ? `Question ${step + 1} sur ${visible.length}` : `${answered} réponse(s) sur ${visible.length} question(s)`}</p>
      </div>
      {message && <p className="error mb-3" role="alert">{message}</p>}
      <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} />

      {conversational && current ? (
        <>
          <Question q={current} value={answers[current.id]} onChange={(v) => set(current.id, v)} error={errors[current.id]} />
          {last && IdentityBlock}
          <div className="flex justify-between gap-3">
            <button className="btn-ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Précédent</button>
            {last ? <button className="btn" disabled={busy} onClick={submit}>Envoyer mes réponses</button> : <button className="btn" onClick={next}>Suivant</button>}
          </div>
        </>
      ) : (
        <>
          {visible.map((q) => <Question key={q.id} q={q} value={answers[q.id]} onChange={(v) => set(q.id, v)} error={errors[q.id]} />)}
          {IdentityBlock}
          <button className="btn w-full py-3" disabled={busy} onClick={submit}>Envoyer mes réponses</button>
        </>
      )}
    </PublicShell>
  );
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
