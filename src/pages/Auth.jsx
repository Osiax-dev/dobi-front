import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errText } from '../api';
import { useAuth } from '../auth';
import { Logo } from '../ui';

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
      <input className="input" {...props} />
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

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const f = useForm({ email: '', password: '' }, async (v) => { await login(v.email, v.password); nav('/'); });
  return (
    <Frame title="Connexion" footer={<>Pas de compte ? <Link className="font-semibold text-leaf underline" to="/register">Créer un compte</Link></>}>
      <form onSubmit={f.submit}>
        {f.error && <p className="error mb-3">{f.error}</p>}
        <Field label="Adresse e-mail" type="email" required autoComplete="email" {...f.bind('email')} />
        <Field label="Mot de passe" type="password" required autoComplete="current-password" {...f.bind('password')} />
        <button className="btn w-full" disabled={f.busy}>Se connecter</button>
        <p className="mt-3 text-sm"><Link className="underline" to="/forgot-password">Mot de passe oublié ?</Link></p>
      </form>
    </Frame>
  );
}

export function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const f = useForm({ name: '', email: '', password: '', password_confirmation: '' }, async (v) => { await register(v); nav('/'); });
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
