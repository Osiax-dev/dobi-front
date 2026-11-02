import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Building2, User } from 'lucide-react';
import { api, errText } from '../api';
import { ORG_TYPES, ROLES } from '../ui';
import { useWorkspace } from '../workspace';

export default function Organizations() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { select } = useWorkspace();
  const [form, setForm] = useState({ name: '', type: 'association', description: '' });
  const [error, setError] = useState('');
  const list = useQuery({ queryKey: ['orgs'], queryFn: () => api('/organizations') });

  const create = useMutation({
    mutationFn: () => api('/organizations', { method: 'POST', body: form }),
    onSuccess: (o) => {
      qc.invalidateQueries({ queryKey: ['orgs'] });
      qc.invalidateQueries({ queryKey: ['me'] });
      select(o.id);
      nav(`/organizations/${o.id}`);
    },
    onError: (e) => setError(errText(e)),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <h1 className="mb-1 text-2xl font-bold">Espaces de travail</h1>
        <p className="mb-4 text-sm text-forest/70">Travaillez en votre nom ou au nom d’une organisation. Chaque étude appartient à un espace.</p>
        {list.isLoading && <p>Chargement…</p>}
        {list.isError && <p className="error">{errText(list.error)}</p>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.data?.data.map((o) => {
            const Icon = o.type === 'personal' ? User : Building2;
            return (
              <li key={o.id} className="panel flex flex-col">
                <span className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-forest text-lime"><Icon size={21} strokeWidth={1.75} /></span>
                <h2 className="text-lg font-bold">{o.name}</h2>
                <p className="text-sm text-forest/70">{ORG_TYPES[o.type]} · {ROLES[o.role]}</p>
                <p className="mt-1 text-sm">{o.studies_count} étude(s){o.type !== 'personal' && ` · ${o.members_count} membre(s)`}</p>
                <Link to={`/organizations/${o.id}`} className="btn-ghost mt-4 self-start">Voir le détail <ArrowRight size={15} /></Link>
              </li>
            );
          })}
        </ul>
      </section>

      <aside className="panel h-fit">
        <h2 className="mb-3 text-lg font-bold">Créer une organisation</h2>
        {error && <p className="error mb-3">{error}</p>}
        <form onSubmit={(e) => { e.preventDefault(); setError(''); create.mutate(); }}>
          <label className="label" htmlFor="o-name">Nom</label>
          <input id="o-name" className="input mb-3" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <label className="label" htmlFor="o-type">Type</label>
          <select id="o-type" className="input mb-3" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(ORG_TYPES).filter(([k]) => k !== 'personal').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label className="label" htmlFor="o-desc">Présentation (facultatif)</label>
          <textarea id="o-desc" className="input mb-4" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button className="btn w-full" disabled={create.isPending}>Créer l’organisation</button>
        </form>
      </aside>
    </div>
  );
}
