import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errText } from '../api';
import { ORG_TYPES, ROLES, StatusBadge } from '../ui';

export default function Organization() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [info, setInfo] = useState({ name: '', description: '' });
  const [invite, setInvite] = useState({ email: '', role: 'editor' });

  const org = useQuery({ queryKey: ['org', id], queryFn: () => api(`/organizations/${id}`) });
  const members = useQuery({ queryKey: ['members', id], queryFn: () => api(`/organizations/${id}/members`), enabled: !!org.data && org.data.role !== 'surveyor' });
  const studies = useQuery({ queryKey: ['org-studies', id], queryFn: () => api(`/organizations/${id}/studies`) });
  const invitations = useQuery({ queryKey: ['invitations', id], queryFn: () => api(`/organizations/${id}/invitations`), enabled: !!org.data && ['owner', 'admin'].includes(org.data.role) });

  useEffect(() => { if (org.data) setInfo({ name: org.data.name, description: org.data.description || '' }); }, [org.data]);

  const done = (keys) => () => { setError(''); keys.forEach((k) => qc.invalidateQueries({ queryKey: k })); };
  const fail = (e) => { setNotice(''); setError(errText(e)); };
  const save = useMutation({ mutationFn: () => api(`/organizations/${id}`, { method: 'PUT', body: info }), onSuccess: done([['org', id], ['orgs'], ['me']]), onError: fail });
  const add = useMutation({ mutationFn: () => api(`/organizations/${id}/invitations`, { method: 'POST', body: invite }), onSuccess: () => { setInvite({ email: '', role: 'editor' }); setError(''); setNotice('Invitation envoyée par e-mail.'); done([['invitations', id]])(); }, onError: fail });
  const cancelInvite = useMutation({ mutationFn: (iid) => api(`/organizations/${id}/invitations/${iid}`, { method: 'DELETE' }), onSuccess: done([['invitations', id]]), onError: fail });
  const setRole = useMutation({ mutationFn: ({ uid, role }) => api(`/organizations/${id}/members/${uid}`, { method: 'PUT', body: { role } }), onSuccess: done([['members', id]]), onError: fail });
  const remove = useMutation({ mutationFn: (uid) => api(`/organizations/${id}/members/${uid}`, { method: 'DELETE' }), onSuccess: done([['members', id], ['org', id]]), onError: fail });

  if (org.isLoading) return <p>Chargement…</p>;
  if (org.isError) return <p className="error">{errText(org.error)}</p>;
  const o = org.data;
  const personal = o.type === 'personal';
  const canManage = ['owner', 'admin'].includes(o.role);
  const isOwner = o.role === 'owner';

  return (
    <div className="space-y-6">
      <div>
        <Link to="/organizations" className="text-sm underline">← Espaces de travail</Link>
        <h1 className="mt-2 text-2xl font-bold">{o.name}</h1>
        <p className="text-sm text-forest/70">{ORG_TYPES[o.type]} · votre rôle : {ROLES[o.role]}</p>
      </div>
      {error && <p className="error">{error}</p>}
      {notice && <p className="rounded-lg border border-forest/15 bg-forest/5 px-4 py-3 text-sm font-semibold text-forest">{notice}</p>}

      <section className="panel">
        <h2 className="mb-3 text-lg font-bold">Profil</h2>
        {personal && <p className="mb-3 text-sm">Sur les pages publiques, vos études apparaissent sous votre nom.</p>}
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-3 sm:max-w-xl">
          <div>
            <label className="label" htmlFor="n">Nom</label>
            <input id="n" className="input" disabled={!canManage || personal} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="d">Présentation</label>
            <textarea id="d" className="input" rows={3} disabled={!canManage} value={info.description} onChange={(e) => setInfo({ ...info, description: e.target.value })} />
          </div>
          {canManage && <button className="btn self-start" disabled={save.isPending}>Enregistrer</button>}
        </form>
        <p className="mt-4 text-sm">Page publique : <a className="break-all font-semibold underline" href={o.public_url} target="_blank" rel="noreferrer">{o.public_url}</a></p>
      </section>

      {!personal && (
        <section className="panel">
          <h2 className="mb-3 text-lg font-bold">Membres ({o.members_count})</h2>
          <ul className="divide-y divide-forest/10">
            {members.data?.data.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="min-w-0 flex-1 basis-48"><span className="block truncate font-semibold">{m.name}</span><span className="block truncate text-sm text-forest/70">{m.email}</span></span>
                {m.role === 'owner' || !canManage || (m.role === 'admin' && !isOwner) ? (
                  <span className="text-sm font-semibold">{ROLES[m.role]}</span>
                ) : (
                  <>
                    <select aria-label={`Rôle de ${m.name}`} className="input w-auto" value={m.role} onChange={(e) => setRole.mutate({ uid: m.id, role: e.target.value })}>
                      {Object.entries(ROLES).filter(([k]) => k !== 'owner' && (isOwner || k !== 'admin')).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                    <button className="btn-ghost" onClick={() => window.confirm(`Retirer ${m.name} ?`) && remove.mutate(m.id)}>Retirer</button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <form onSubmit={(e) => { e.preventDefault(); add.mutate(); }} className="mt-4 flex flex-wrap items-end gap-3 border-t border-forest/10 pt-4">
              <div className="flex-1 basis-56">
                <label className="label" htmlFor="ie">Inviter par e-mail</label>
                <input id="ie" type="email" required className="input" placeholder="adresse e-mail" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />
              </div>
              <select aria-label="Rôle" className="input w-auto" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                {Object.entries(ROLES).filter(([k]) => k !== 'owner' && (isOwner || k !== 'admin')).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <button className="btn" disabled={add.isPending}>{add.isPending ? 'Envoi…' : 'Envoyer l’invitation'}</button>
            </form>
          )}
          {canManage && (invitations.data?.data?.length > 0) && (
            <div className="mt-5 border-t border-forest/10 pt-4">
              <h3 className="mb-2 font-semibold">Invitations en attente</h3>
              <ul className="divide-y divide-forest/10">
                {invitations.data.data.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1"><strong className="block truncate">{item.email}</strong><span className="text-forest/70">{ROLES[item.role]} · {item.expired ? 'Expirée' : `Expire le ${new Date(item.expires_at).toLocaleDateString('fr-FR')}`}</span></span>
                    <button className="btn-ghost" onClick={() => cancelInvite.mutate(item.id)}>Annuler</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="panel">
        <h2 className="mb-3 text-lg font-bold">Études de cet espace ({o.studies_count})</h2>
        {studies.data?.data.length === 0 && <p className="text-sm">Aucune étude dans cet espace.</p>}
        <ul className="divide-y divide-forest/10">
          {studies.data?.data.map((s) => (
            <li key={s.id}><Link to={`/studies/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-forest/5"><span className="font-semibold">{s.title}</span><StatusBadge status={s.status} /></Link></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
