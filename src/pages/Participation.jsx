import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { api, errText } from '../api';
import { StatusBadge } from '../ui';
import { useWorkspace } from '../workspace';

const fmt = (x) => (x ? new Date(x).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function Participation() {
  const { active, loading } = useWorkspace();
  const q = useQuery({ queryKey: ['participation', active?.id], queryFn: () => api(`/organizations/${active.id}/participation`), enabled: !!active && active.role !== 'surveyor' });
  if (active?.role === 'surveyor') return <Navigate to="/collecte" replace />;
  if (loading || q.isLoading) return <p>Chargement…</p>;
  if (q.isError) return <p className="error">{errText(q.error)}</p>;
  const { totals, studies } = q.data;
  const canSeeIdentity = ['owner', 'admin'].includes(active.role);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Participants</h1>
        <p className="text-sm text-forest/70">Participation aux études de « {active.name} ». Les identités ne sont visibles que pour les propriétaires et administrateurs.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Indicateurs">
        {[[totals.responses, 'Réponses reçues'], [totals.identified_studies, 'Études identifiées'], [totals.anonymous_studies, 'Études anonymes']].map(([v, l]) => (
          <div key={l} className="panel"><p className="font-display text-3xl font-bold leading-none">{v}</p><p className="mt-1 text-sm text-forest/70">{l}</p></div>
        ))}
      </section>
      {studies.length === 0 && <p className="panel">Aucune étude dans cet espace.</p>}
      <ul className="space-y-3">
        {studies.map((s) => (
          <li key={s.id} className="panel flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="min-w-0 flex-1 basis-56">
              <Link to={`/studies/${s.id}`} className="block truncate font-semibold hover:underline">{s.title}</Link>
              <span className="text-sm text-forest/70">Dernière réponse : {fmt(s.last_response_at)}</span>
            </span>
            <StatusBadge status={s.status} />
            <span className="w-28 text-sm font-semibold">{s.responses_count} réponse(s)</span>
            <span className="flex items-center gap-1.5 text-sm">
              {s.privacy_mode === 'identified' ? <><UserCheck size={16} /> Identifiée</> : <><ShieldCheck size={16} /> Anonyme</>}
            </span>
            {s.privacy_mode === 'identified' && canSeeIdentity && <Link to={`/studies/${s.id}/participants`} className="btn-ghost">Voir les participants <ArrowRight size={15} /></Link>}
          </li>
        ))}
      </ul>
    </div>
  );
}
