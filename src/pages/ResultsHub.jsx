import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, BarChart3 } from 'lucide-react';
import { api, errText } from '../api';
import { StatusBadge } from '../ui';
import { useWorkspace } from '../workspace';

const fmtDay = (s) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const fmt = (x) => (x ? new Date(x).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const RESULT_ROLES = ['owner', 'admin', 'analyst'];

/** Entrée « Résultats & Analyses » du menu : vue d'ensemble de l'espace, puis accès aux résultats détaillés de chaque étude. */
export default function ResultsHub() {
  const { active, loading } = useWorkspace();
  const enabled = !!active && active.role !== 'surveyor';
  const part = useQuery({ queryKey: ['participation', active?.id], queryFn: () => api(`/organizations/${active.id}/participation`), enabled });
  const dash = useQuery({ queryKey: ['dashboard', active?.id], queryFn: () => api(`/organizations/${active.id}/dashboard`), enabled });

  if (active?.role === 'surveyor') return <Navigate to="/collecte" replace />;
  if (loading || part.isLoading || dash.isLoading) return <p>Chargement…</p>;
  if (part.isError || dash.isError) return <p className="error">{errText(part.error || dash.error)}</p>;

  const canSee = RESULT_ROLES.includes(active.role);
  const studies = [...part.data.studies].sort((a, b) => (a.status === 'archived') - (b.status === 'archived') || b.responses_count - a.responses_count);
  const withResponses = studies.filter((s) => s.responses_count > 0).length;
  const k = dash.data.kpis;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Résultats &amp; Analyses</h1>
        <p className="text-sm text-forest/70">Vue d’ensemble de « {active.name} ». Ouvrez une étude pour filtrer, comparer et exporter ses résultats.</p>
      </div>

      {!canSee && <p className="panel text-sm">Votre rôle ({active.role === 'editor' ? 'éditeur' : 'enquêteur'}) ne donne pas accès aux résultats détaillés. Demandez un rôle d’analyste à un administrateur de l’espace.</p>}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Indicateurs">
        {[[part.data.totals.responses, 'Réponses reçues'], [withResponses, 'Études avec réponses'], [k.published, 'Études en cours de collecte']].map(([v, l]) => (
          <div key={l} className="panel"><p className="font-display text-3xl font-bold leading-none">{v}</p><p className="mt-1 text-sm text-forest/70">{l}</p></div>
        ))}
      </section>

      <section className="panel">
        <h2 className="text-lg font-bold">Réponses des 30 derniers jours</h2>
        <p className="mb-2 text-sm text-forest/70">{k.responses_30d} réponse(s) sur la période, toutes études confondues.</p>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dash.data.series} margin={{ left: -16, right: 8, top: 8 }}>
              <XAxis dataKey="date" tickFormatter={fmtDay} minTickGap={32} tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip labelFormatter={fmtDay} formatter={(v) => [v, 'Réponses']} />
              <Area type="monotone" dataKey="responses" stroke="#102F2B" strokeWidth={2} fill="#D5F06A" fillOpacity={0.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Résultats par étude</h2>
        {studies.length === 0 && <p className="panel">Aucune étude dans cet espace. <Link to="/studies" className="font-semibold underline">Créez la première.</Link></p>}
        <ul className="space-y-3">
          {studies.map((s) => (
            <li key={s.id} className="panel flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="min-w-0 flex-1 basis-56">
                <span className="block truncate font-semibold">{s.title}</span>
                <span className="text-sm text-forest/70">Dernière réponse : {fmt(s.last_response_at)}</span>
              </span>
              <StatusBadge status={s.status} />
              <span className="w-28 text-sm font-semibold">{s.responses_count} réponse(s)</span>
              {canSee && (
                <Link to={`/studies/${s.id}?tab=results`} className={s.responses_count ? 'btn' : 'btn-ghost'}>
                  <BarChart3 size={16} /> {s.responses_count ? 'Voir les résultats' : 'Ouvrir'} <ArrowRight size={14} />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
