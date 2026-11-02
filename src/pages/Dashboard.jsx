import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, Building2, CheckCircle2, FileText, Users } from 'lucide-react';
import { api, errText } from '../api';
import { useAuth } from '../auth';
import { STATUS, STATUS_COLORS, StatusBadge } from '../ui';
import { useWorkspace } from '../workspace';

const fmtDay = (s) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
function ago(iso) {
  const s = (new Date(iso) - Date.now()) / 1000;
  const a = Math.abs(s);
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}
const VERBS = {
  'study.created': 'a créé l’étude', 'study.updated': 'a modifié l’étude', 'study.duplicated': 'a dupliqué l’étude',
  'study.publish': 'a publié l’étude', 'study.suspend': 'a suspendu l’étude', 'study.close': 'a clôturé l’étude',
  'study.archive': 'a archivé l’étude', 'study.resume': 'a repris l’étude', 'study.restore': 'a restauré l’étude', 'study.exported': 'a exporté les données de l’étude',
  'member.added': 'a ajouté un membre', 'member.role_changed': 'a changé le rôle d’un membre', 'member.removed': 'a retiré un membre',
  'organization.created': 'a créé cet espace', 'organization.updated': 'a modifié cet espace', 'auth.registered': 'a créé cet espace',
};

function HeroPattern() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 h-full w-1/2 text-lime opacity-20" preserveAspectRatio="xMaxYMid slice" viewBox="0 0 240 200">
      <defs>
        <pattern id="zig" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M0 30 L10 10 L20 30 L30 10 L40 30" fill="none" stroke="currentColor" strokeWidth="3" />
        </pattern>
      </defs>
      <rect width="240" height="200" fill="url(#zig)" />
    </svg>
  );
}

function Kpi({ icon: Icon, label, value, trend }) {
  return (
    <div className="panel flex items-center gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-forest text-lime"><Icon size={22} strokeWidth={1.75} /></span>
      <div className="min-w-0">
        <p className="font-display text-3xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-sm text-forest/70">{label}</p>
        {trend !== null && trend !== undefined && (
          <p className={`text-xs font-bold ${trend >= 0 ? 'text-success' : 'text-alert'}`}>{trend > 0 ? '+' : ''}{trend} % sur 30 jours</p>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { active, orgs, loading } = useWorkspace();
  const q = useQuery({ queryKey: ['dashboard', active?.id], queryFn: () => api(`/organizations/${active.id}/dashboard`), enabled: !!active });

  if (loading || q.isLoading) return <p>Chargement…</p>;
  if (q.isError) return <p className="error">{errText(q.error)}</p>;
  const d = q.data;
  const k = d.kpis;
  const trend = k.responses_prev_30d > 0 ? Math.round(((k.responses_30d - k.responses_prev_30d) / k.responses_prev_30d) * 100) : null;
  const statusData = Object.entries(d.by_status).map(([status, value]) => ({ status, name: STATUS[status] || status, value: Number(value) })).filter((x) => x.value > 0);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-deep p-6 text-white sm:p-8">
        <HeroPattern />
        <div className="relative max-w-xl">
          <h1 className="text-3xl font-bold sm:text-4xl">Bonjour {user.name.split(' ')[0]}</h1>
          <p className="mt-2 text-white/80">Voici l’activité de « {d.workspace.name} ».</p>
          <Link to="/studies" className="btn mt-5">Créer une étude <ArrowRight size={16} /></Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicateurs">
        <Kpi icon={FileText} label="Études créées" value={k.studies} />
        <Kpi icon={Users} label="Réponses collectées" value={k.responses} trend={trend} />
        <Kpi icon={CheckCircle2} label="Études publiées" value={k.published} />
        <Kpi icon={Building2} label="Espaces de travail" value={orgs.length} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel lg:col-span-2">
          <h2 className="text-lg font-bold">Évolution des réponses</h2>
          <p className="mb-2 text-sm text-forest/70">{k.responses_30d} réponse(s) sur les 30 derniers jours</p>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.series} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="fillLime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D5F06A" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#D5F06A" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tickFormatter={fmtDay} minTickGap={32} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={fmtDay} formatter={(v) => [v, 'Réponses']} />
                <Area type="monotone" dataKey="responses" stroke="#102F2B" strokeWidth={2} fill="url(#fillLime)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <h2 className="mb-2 text-lg font-bold">Études par statut</h2>
          {statusData.length === 0 ? (
            <p className="text-sm">Aucune étude pour l’instant.</p>
          ) : (
            <>
              <div className="relative h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={2} stroke="none">
                      {statusData.map((x) => <Cell key={x.status} fill={STATUS_COLORS[x.status]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <span><span className="block font-display text-3xl font-bold">{k.studies}</span><span className="text-xs">étude(s)</span></span>
                </div>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {statusData.map((x) => (
                  <li key={x.status} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full border border-forest/20" style={{ background: STATUS_COLORS[x.status] }} />{x.name}
                    <span className="ml-auto font-bold">{x.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="panel lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Études récentes</h2>
            <Link to="/studies" className="flex items-center gap-1 text-sm font-semibold underline">Voir tout <ArrowRight size={14} /></Link>
          </div>
          {d.recent_studies.length === 0 ? (
            <p className="text-sm">Aucune étude. <Link to="/studies" className="font-semibold underline">Créez la première.</Link></p>
          ) : (
            <ul className="divide-y divide-forest/10">
              {d.recent_studies.map((s) => (
                <li key={s.id}>
                  <Link to={`/studies/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 hover:bg-forest/5">
                    <span className="min-w-0 flex-1 basis-48 truncate font-semibold">{s.title}</span>
                    <StatusBadge status={s.status} />
                    <span className="w-24 text-sm">{s.responses_count} réponse(s)</span>
                    <span className="w-24 text-sm text-forest/70">{s.ends_at ? fmtDay(s.ends_at) : 'Sans fin prévue'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <h2 className="mb-3 text-lg font-bold">Activité récente</h2>
          {d.activity.length === 0 ? (
            <p className="text-sm">Aucune activité enregistrée.</p>
          ) : (
            <ul className="space-y-3">
              {d.activity.map((a, i) => (
                <li key={i} className="text-sm">
                  <p><span className="font-semibold">{a.user_name || 'Un membre'}</span> {VERBS[a.action] || a.action}{a.study_title && <> « {a.study_title} »</>}</p>
                  <p className="text-xs text-forest/60">{ago(a.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
