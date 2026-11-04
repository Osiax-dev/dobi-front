import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, errText } from '../api';
import { StatusBadge } from '../ui';
import { useWorkspace } from '../workspace';

export default function Studies() {
  const nav = useNavigate();
  const [form, setForm] = useState({ title: '', privacy_mode: 'anonymous', collection_mode: 'classic', one_response_per_person: false });
  const [error, setError] = useState('');
  const [view, setView] = useState('active');

  const { active, loading } = useWorkspace();
  const org = active?.id;
  const studies = useQuery({ queryKey: ['studies', org, view], queryFn: () => api(`/organizations/${org}/studies${view === 'archived' ? '?status=archived' : ''}`), enabled: !!org });

  const create = useMutation({
    mutationFn: () => api(`/organizations/${org}/studies`, { method: 'POST', body: form }),
    onSuccess: (s) => nav(`/studies/${s.id}`),
    onError: (e) => setError(errText(e)),
  });

  if (loading) return <p>Chargement…</p>;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mes études</h1>
          <div className="flex gap-2">
            <button className={view === 'active' ? 'btn' : 'btn-ghost'} onClick={() => setView('active')}>En cours</button>
            <button className={view === 'archived' ? 'btn' : 'btn-ghost'} onClick={() => setView('archived')}>Archivées</button>
          </div>
        </div>
        {studies.isLoading && <p>Chargement…</p>}
        {studies.data?.data?.length === 0 && <p className="panel">Aucune étude pour l’instant. Créez la première avec le formulaire.</p>}
        <ul className="space-y-2">
          {studies.data?.data?.map((s) => (
            <li key={s.id}>
              <Link to={`/studies/${s.id}`} className="panel flex items-center justify-between hover:border-leaf">
                <span className="font-semibold">{s.title}</span>
                <span className="flex items-center gap-3 text-sm"><StatusBadge status={s.status} />{s.responses_count} réponse(s)</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <aside className="panel h-fit">
        <h2 className="mb-3 text-lg font-bold">Nouvelle étude</h2>
        {error && <p className="error mb-3">{error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); setError(''); create.mutate(); }}>
          <label className="label">Titre</label>
          <input className="input mb-3" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <label className="label">Participants</label>
          <select className="input mb-3" value={form.privacy_mode} onChange={(e) => setForm({ ...form, privacy_mode: e.target.value })}>
            <option value="anonymous">Anonymes</option>
            <option value="identified">Identifiés (nom + e-mail)</option>
          </select>
          <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.one_response_per_person} onChange={(e) => setForm({ ...form, one_response_per_person: e.target.checked })} /> Une seule réponse par personne</label>
          <label className="label">Mode de réponse</label>
          <select className="input mb-4" value={form.collection_mode} onChange={(e) => setForm({ ...form, collection_mode: e.target.value })}>
            <option value="classic">Formulaire classique</option>
            <option value="conversational">Une question à la fois</option>
          </select>
          <button className="btn w-full" disabled={create.isPending || !org}>Créer l’étude</button>
        </form>
      </aside>
    </div>
  );
}
