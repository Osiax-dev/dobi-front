import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MailCheck, MailWarning } from 'lucide-react';
import { api, errText } from '../api';
import { useAuth } from '../auth';
import { Logo, PasswordInput } from '../ui';

function Frame({ title, children, footer }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <div className="mb-6"><Logo tagline size={40} /></div>
      <div className="panel">
        <h2 className="mb-4 text-xl font-bold">{title}</h2>
        {children}
      </div>
      <p className="mt-4 text-sm">{footer}</p>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div className="mb-3">
      <label className="label">{label}</label>
      {props.type === 'password' ? <PasswordInput {...props} /> : <input className="input" {...props} />}
    </div>
  );
}

function useForm(initial, action) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const bind = (k) => ({ value: v[k], onChange: (e) => setV({ ...v, [k]: e.target.value }) });
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try { await action(v); } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  };
  return { bind, submit, error, busy };
}

function ResendButton({ email }) {
  const [state, setState] = useState({ busy: false, msg: '', error: '' });
  const resend = async () => {
    setState({ busy: true, msg: '', error: '' });
    try {
      const d = await api('/auth/email/resend', { method: 'POST', auth: false, body: { email } });
      setState({ busy: false, msg: d.message, error: '' });
    } catch (err) {
      setState({ busy: false, msg: '', error: err.status === 429 ? 'Trop de demandes. Patientez une minute avant de réessayer.' : errText(err) });
    }
  };
  return (
    <div className="mt-3">
      <button type="button" className="btn-ghost" onClick={resend} disabled={state.busy}>Renvoyer l’e-mail de confirmation</button>
      {state.msg && <p className="mt-2 text-sm" role="status">{state.msg}</p>}
      {state.error && <p className="error mt-2">{state.error}</p>}
    </div>
  );
}

export function CheckEmail() {
  const [params] = useSearchParams();
  const email = params.get('email') || '';
  return (
    <Frame title="Vérifiez votre boîte e-mail" footer={<Link className="underline" to="/login">Retour à la connexion</Link>}>
      <MailCheck className="mb-3 text-leaf" size={32} aria-hidden="true" />
      <p>Nous avons envoyé un lien de confirmation à <strong>{email || 'votre adresse e-mail'}</strong>. Cliquez dessus pour activer votre compte, puis connectez-vous.</p>
      <p className="mt-2 text-sm text-forest/70">Le lien est valable 24 heures. Pensez à regarder dans les courriers indésirables.</p>
      {email && <ResendButton email={email} />}
    </Frame>
  );
}

export function EmailVerified() {
  const [params] = useSearchParams();
  const status = params.get('status');
  const changed = status === 'changed';
  const ok = status === 'ok' || changed;
  return (
    <Frame title={changed ? 'Adresse e-mail modifiée' : ok ? 'Adresse e-mail confirmée' : status === 'taken' ? 'Adresse déjà utilisée' : 'Lien non valide'} footer={<Link className="underline" to="/login">Aller à la connexion</Link>}>
      {ok ? (
        <>
          <MailCheck className="mb-3 text-leaf" size={32} aria-hidden="true" />
          <p>{changed ? 'Votre nouvelle adresse e-mail est confirmée. Connectez-vous avec cette adresse.' : 'Votre compte est activé. Vous pouvez maintenant vous connecter.'}</p>
          <Link className="btn mt-4 w-full text-center" to="/login">Se connecter</Link>
        </>
      ) : (
        <>
          <MailWarning className="mb-3 text-forest" size={32} aria-hidden="true" />
          <p>{status === 'taken' ? 'Cette adresse est déjà utilisée par un autre compte. Votre adresse actuelle reste inchangée.' : status === 'expired' ? 'Ce lien a expiré.' : 'Ce lien est invalide ou a déjà été utilisé.'} Pour un lien d’inscription, essayez de vous connecter : un bouton vous permettra de demander un nouveau lien. Pour un changement d’adresse, recommencez depuis Paramètres.</p>
          <Link className="btn mt-4 w-full text-center" to="/login">Aller à la connexion</Link>
        </>
      )}
    </Frame>
  );
}

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [unverified, setUnverified] = useState('');
  const f = useForm({ email: '', password: '' }, async (v) => {
    setUnverified('');
    try { await login(v.email, v.password); nav('/'); } catch (err) {
      if (err.status === 403 && err.code === 'email_not_verified') setUnverified(v.email);
      throw err;
    }
  });
  return (
    <Frame title="Connexion" footer={<>Pas de compte ? <Link className="font-semibold text-leaf underline" to="/register">Créer un compte</Link></>}>
      <form onSubmit={f.submit}>
        {f.error && <p className="error mb-3">{f.error}</p>}
        <Field label="Adresse e-mail" type="email" required autoComplete="email" {...f.bind('email')} />
        <Field label="Mot de passe" type="password" required autoComplete="current-password" {...f.bind('password')} />
        <button className="btn w-full" disabled={f.busy}>Se connecter</button>
        {unverified && <ResendButton email={unverified} />}
        <p className="mt-3 text-sm"><Link className="underline" to="/forgot-password">Mot de passe oublié ?</Link></p>
      </form>
    </Frame>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const f = useForm({ name: '', email: '', password: '', password_confirmation: '' }, async (v) => { const d = await register(v); nav(`/verifier-email?email=${encodeURIComponent(d.email || v.email)}`); });
  return (
    <Frame title="Créer un compte" footer={<>Déjà inscrit ? <Link className="font-semibold text-leaf underline" to="/login">Se connecter</Link></>}>
      <form onSubmit={f.submit}>
        {f.error && <p className="error mb-3">{f.error}</p>}
        <Field label="Nom complet" required {...f.bind('name')} />
        <Field label="Adresse e-mail" type="email" required {...f.bind('email')} />
        <Field label="Mot de passe (8 caractères, lettres et chiffres)" type="password" required autoComplete="new-password" {...f.bind('password')} />
        <Field label="Confirmer le mot de passe" type="password" required autoComplete="new-password" {...f.bind('password_confirmation')} />
        <button className="btn w-full" disabled={f.busy}>Créer mon compte</button>
      </form>
    </Frame>
  );
}

export function Forgot() {
  const [sent, setSent] = useState('');
  const f = useForm({ email: '' }, async (v) => {
    const d = await api('/auth/forgot-password', { method: 'POST', auth: false, body: v });
    setSent(d.message);
  });
  return (
    <Frame title="Mot de passe oublié" footer={<Link className="underline" to="/login">Retour à la connexion</Link>}>
      {sent ? <p>{sent}</p> : (
        <form onSubmit={f.submit}>
          {f.error && <p className="error mb-3">{f.error}</p>}
          <Field label="Adresse e-mail" type="email" required {...f.bind('email')} />
          <button className="btn w-full" disabled={f.busy}>Envoyer le lien</button>
        </form>
      )}
    </Frame>
  );
}

export function Reset() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const f = useForm({ password: '', password_confirmation: '' }, async (v) => {
    await api('/auth/reset-password', { method: 'POST', auth: false, body: { ...v, token: params.get('token'), email: params.get('email') } });
    nav('/login');
  });
  return (
    <Frame title="Nouveau mot de passe" footer={<Link className="underline" to="/login">Retour à la connexion</Link>}>
      <form onSubmit={f.submit}>
        {f.error && <p className="error mb-3">{f.error}</p>}
        <Field label="Nouveau mot de passe" type="password" required {...f.bind('password')} />
        <Field label="Confirmer" type="password" required {...f.bind('password_confirmation')} />
        <button className="btn w-full" disabled={f.busy}>Enregistrer</button>
      </form>
    </Frame>
  );
}
