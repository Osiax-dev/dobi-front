import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errText } from '../api';
import { setToken } from '../api';
import { useAuth } from '../auth';
import { PasswordInput } from '../ui';
import { useWorkspace } from '../workspace';

const ROLES = { owner: 'Propriétaire', admin: 'Administrateur', editor: 'Éditeur', surveyor: 'Enquêteur', analyst: 'Analyste' };

function Notice({ state }) {
  if (state.error) return <p className="error mt-3" role="alert">{state.error}</p>;
  if (state.ok) return <p className="mt-3 text-sm font-semibold text-success" role="status">{state.ok}</p>;
  return null;
}

function useAction(fn) {
  const [state, setState] = useState({ busy: false, ok: '', error: '' });
  const run = async (...args) => {
    setState({ busy: true, ok: '', error: '' });
    try { const ok = await fn(...args); setState({ busy: false, ok: ok || '', error: '' }); return true; } catch (e) { setState({ busy: false, ok: '', error: errText(e) }); return false; }
  };
  return [state, run];
}

function Profile() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [saveState, save] = useAction(async () => {
    const d = await api('/me', { method: 'PUT', body: { name } });
    setUser(d.user);
    return 'Nom enregistré.';
  });
  return (
    <section className="panel">
      <h2 className="mb-3 text-lg font-bold">Mon profil</h2>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="label" htmlFor="p-name">Nom complet</label>
        <input id="p-name" className="input mb-3" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label" htmlFor="p-email">Adresse e-mail</label>
        <input id="p-email" className="input mb-1" value={user?.email || ''} readOnly disabled />
        <p className="mb-3 text-xs text-forest/60">Pour changer d’adresse e-mail, utilisez la section « Changer d’adresse e-mail » plus bas.</p>
        <button className="btn" disabled={saveState.busy}>Enregistrer</button>
        <Notice state={saveState} />
      </form>
    </section>
  );
}

function Password() {
  const empty = { current_password: '', password: '', password_confirmation: '' };
  const [v, setV] = useState(empty);
  const [state, save] = useAction(async () => {
    await api('/me', { method: 'PUT', body: v });
    setV(empty);
    return 'Mot de passe modifié. Vos autres appareils ont été déconnectés.';
  });
  const bind = (k) => ({ value: v[k], onChange: (e) => setV({ ...v, [k]: e.target.value }) });
  return (
    <section className="panel">
      <h2 className="mb-3 text-lg font-bold">Mot de passe</h2>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="label" htmlFor="pw-cur">Mot de passe actuel</label>
        <PasswordInput id="pw-cur" className="input mb-3" required autoComplete="current-password" {...bind('current_password')} />
        <label className="label" htmlFor="pw-new">Nouveau mot de passe (8 caractères, lettres et chiffres)</label>
        <PasswordInput id="pw-new" className="input mb-3" required autoComplete="new-password" {...bind('password')} />
        <label className="label" htmlFor="pw-conf">Confirmer le nouveau mot de passe</label>
        <PasswordInput id="pw-conf" className="input mb-3" required autoComplete="new-password" {...bind('password_confirmation')} />
        <button className="btn" disabled={state.busy}>Changer le mot de passe</button>
        <Notice state={state} />
      </form>
    </section>
  );
}

function EmailChange() {
  const { user } = useAuth();
  const [v, setV] = useState({ email: '', current_password: '' });
  const [state, save] = useAction(async () => {
    const d = await api('/me/email', { method: 'PUT', body: v });
    setV({ email: '', current_password: '' });
    return d.message;
  });
  return (
    <section className="panel">
      <h2 className="mb-1 text-lg font-bold">Changer d’adresse e-mail</h2>
      <p className="mb-3 text-sm text-forest/70">Adresse actuelle : {user?.email}. Un lien de confirmation sera envoyé à la nouvelle adresse ; rien ne change tant que vous n’avez pas cliqué dessus.</p>
      <form onSubmit={(e) => { e.preventDefault(); save(); }}>
        <label className="label" htmlFor="em-new">Nouvelle adresse e-mail</label>
        <input id="em-new" className="input mb-3" type="email" required autoComplete="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <label className="label" htmlFor="em-pw">Mot de passe actuel</label>
        <PasswordInput id="em-pw" className="input mb-3" required autoComplete="current-password" value={v.current_password} onChange={(e) => setV({ ...v, current_password: e.target.value })} />
        <button className="btn" disabled={state.busy}>Envoyer le lien de confirmation</button>
        <Notice state={state} />
      </form>
    </section>
  );
}

function Devices() {
  const [state, run] = useAction(async () => (await api('/me/logout-others', { method: 'POST' })).message);
  return (
    <section className="panel">
      <h2 className="mb-1 text-lg font-bold">Appareils connectés</h2>
      <p className="mb-3 text-sm text-forest/70">Si vous avez oublié de vous déconnecter sur un autre téléphone ou ordinateur, fermez ces sessions. Celle-ci reste ouverte.</p>
      <button className="btn-ghost" disabled={state.busy} onClick={() => run()}>Déconnecter les autres appareils</button>
      <Notice state={state} />
    </section>
  );
}

function Transfer({ orgId, orgName }) {
  const members = useQuery({ queryKey: ['members', orgId], queryFn: () => api(`/organizations/${orgId}/members`) });
  const [v, setV] = useState({ user_id: '', password: '' });
  const [state, run] = useAction(async () => {
    await api(`/organizations/${orgId}/transfer`, { method: 'POST', body: { user_id: Number(v.user_id), password: v.password } });
    window.location.assign('/parametres');
  });
  const candidates = (members.data?.data || []).filter((m) => m.role !== 'owner');
  if (candidates.length === 0) return <p className="mt-5 border-t border-forest/10 pt-4 text-sm text-forest/70">Pour transférer la propriété de cette organisation, invitez d’abord un autre membre.</p>;
  return (
    <form className="mt-5 border-t border-forest/10 pt-4" onSubmit={(e) => { e.preventDefault(); if (window.confirm(`Transférer la propriété de « ${orgName} » ? Vous deviendrez administrateur.`)) run(); }}>
      <h3 className="mb-1 font-semibold">Transférer la propriété</h3>
      <p className="mb-3 text-sm text-forest/70">Le nouveau propriétaire gère l’organisation à votre place. Vous restez administrateur.</p>
      <label className="label" htmlFor="tr-user">Nouveau propriétaire</label>
      <select id="tr-user" className="input mb-3" required value={v.user_id} onChange={(e) => setV({ ...v, user_id: e.target.value })}>
        <option value="">Choisir un membre…</option>
        {candidates.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.email})</option>)}
      </select>
      <label className="label" htmlFor="tr-pw">Votre mot de passe</label>
      <PasswordInput id="tr-pw" className="input mb-3" required autoComplete="current-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
      <button className="btn-ghost" disabled={state.busy}>Transférer la propriété</button>
      <Notice state={state} />
    </form>
  );
}

function DeleteAccount() {
  const [v, setV] = useState({ password: '', confirmation: '' });
  const [state, run] = useAction(async () => {
    await api('/me', { method: 'DELETE', body: v });
    setToken(null);
    window.location.assign('/login');
  });
  return (
    <section className="panel border-terracotta/40">
      <h2 className="mb-1 text-lg font-bold">Supprimer mon compte</h2>
      <p className="mb-3 text-sm text-forest/70">Action définitive. Votre espace personnel et ses études sont supprimés. Vos études dans les autres organisations restent à ces organisations. Si vous êtes propriétaire d’une organisation de travail, transférez-la d’abord.</p>
      <form onSubmit={(e) => { e.preventDefault(); if (window.confirm('Supprimer définitivement votre compte ?')) run(); }}>
        <label className="label" htmlFor="del-pw">Mot de passe</label>
        <PasswordInput id="del-pw" className="input mb-3" required autoComplete="current-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
        <label className="label" htmlFor="del-conf">Tapez SUPPRIMER pour confirmer</label>
        <input id="del-conf" className="input mb-3" required value={v.confirmation} onChange={(e) => setV({ ...v, confirmation: e.target.value })} />
        <button className="btn-ghost" disabled={state.busy || v.confirmation !== 'SUPPRIMER'}>Supprimer mon compte</button>
        <Notice state={state} />
      </form>
    </section>
  );
}

function OrganizationSettings() {
  const { active } = useWorkspace();
  const qc = useQueryClient();
  const org = useQuery({ queryKey: ['org', active?.id], queryFn: () => api(`/organizations/${active.id}`), enabled: !!active });
  const [form, setForm] = useState(null);
  const [saveState, save] = useAction(async () => {
    await api(`/organizations/${active.id}`, { method: 'PUT', body: form });
    ['org', 'me'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    return 'Organisation enregistrée.';
  });
  const leave = useMutation({
    mutationFn: () => api(`/organizations/${active.id}/leave`, { method: 'POST' }),
    onSuccess: () => { localStorage.removeItem('dobi_org'); window.location.assign('/'); },
  });

  if (!active) return null;
  if (org.isLoading) return <p>Chargement…</p>;
  if (org.isError) return <p className="error">{errText(org.error)}</p>;
  const o = org.data;
  const canEdit = ['owner', 'admin'].includes(o.role);
  const values = form ?? { name: o.name, description: o.description || '' };
  const personal = o.type === 'personal';

  return (
    <section className="panel">
      <h2 className="mb-1 text-lg font-bold">Organisation : {o.display_name || o.name}</h2>
      <p className="mb-3 text-sm text-forest/70">Votre rôle : {ROLES[o.role] || o.role} · {o.members_count} membre(s) · {o.studies_count} étude(s)</p>
      {canEdit ? (
        <form onSubmit={(e) => { e.preventDefault(); setForm(values); save(); }}>
          <label className="label" htmlFor="o-name">Nom</label>
          <input id="o-name" className="input mb-3" required maxLength={150} value={values.name} onChange={(e) => setForm({ ...values, name: e.target.value })} />
          <label className="label" htmlFor="o-desc">Description</label>
          <textarea id="o-desc" className="input mb-3" rows={3} maxLength={2000} value={values.description} onChange={(e) => setForm({ ...values, description: e.target.value })} />
          <button className="btn" disabled={saveState.busy}>Enregistrer</button>
          <Notice state={saveState} />
        </form>
      ) : (
        <p className="text-sm text-forest/70">Seuls le propriétaire et les administrateurs peuvent modifier l’organisation.</p>
      )}
      {o.public_url && !personal && <p className="mt-4 text-sm">Page publique : <a className="underline" href={o.public_url} target="_blank" rel="noreferrer">{o.public_url}</a></p>}
      {!personal && o.role === 'owner' && <Transfer orgId={o.id} orgName={o.name} />}
      {!personal && o.role !== 'owner' && (
        <div className="mt-5 border-t border-forest/10 pt-4">
          <p className="mb-2 text-sm text-forest/70">Vous n’aurez plus accès aux études de cette organisation. Une nouvelle invitation sera nécessaire pour revenir.</p>
          <button className="btn-ghost" disabled={leave.isPending} onClick={() => { if (window.confirm(`Quitter l’organisation « ${o.name} » ?`)) leave.mutate(); }}>Quitter cette organisation</button>
          {leave.isError && <p className="error mt-2">{errText(leave.error)}</p>}
        </div>
      )}
    </section>
  );
}

export default function Settings() {
  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Paramètres</h1>
      <Profile />
      <EmailChange />
      <Password />
      <Devices />
      <OrganizationSettings />
      <DeleteAccount />
    </div>
  );
}
