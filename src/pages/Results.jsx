import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { api, downloadExport, errText } from '../api';
import { buildReport } from '../report';

const COLORS = ['#102F2B', '#D5F06A', '#D77A52', '#7C91A0', '#2F6F8F', '#B9791A'];
const fmtDay = (s) => new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const fmt = (x) => (x ? new Date(x).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export default function Results({ study, orgName }) {
  const [f, setF] = useState({ from: '', to: '', version: '', by: '' });
  const [msg, setMsg] = useState('');
  const params = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const res = useQuery({ queryKey: ['analytics', study.id, params], queryFn: () => api(`/studies/${study.id}/analytics${params ? `?${params}` : ''}`), placeholderData: (prev) => prev });

  const exportParams = new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== 'by')).toString();
  const doExport = (format) => { setMsg(''); downloadExport(study.id, format, exportParams).catch((e) => setMsg(e.message)); };

  if (res.isLoading) return <p>Chargement…</p>;
  if (res.isError) return <p className="error">{errText(res.error)}</p>;
  const d = res.data;
  const choiceQuestions = d.questions.filter((q) => ['single_choice', 'yes_no'].includes(q.type));
  const set = (k, v) => setF({ ...f, [k]: v });

  return (
    <div className="space-y-4">
      <section className="panel">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className="label" htmlFor="rf">Du</label><input id="rf" type="date" className="input" value={f.from} onChange={(e) => set('from', e.target.value)} /></div>
          <div><label className="label" htmlFor="rt">Au</label><input id="rt" type="date" className="input" value={f.to} onChange={(e) => set('to', e.target.value)} /></div>
          <div>
            <label className="label" htmlFor="rv">Version</label>
            <select id="rv" className="input" value={f.version} onChange={(e) => set('version', e.target.value)}>
              <option value="">Toutes</option>
              {d.versions.map((v) => <option key={v.id} value={v.id}>Version {v.version_number}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rb">Comparer selon</label>
            <select id="rb" className="input" value={f.by} onChange={(e) => set('by', e.target.value)}>
              <option value="">Aucune comparaison</option>
              {choiceQuestions.map((q) => <option key={q.question_id} value={q.question_id}>{q.label}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button className="btn-ghost" onClick={() => doExport('csv')}><Download size={16} /> CSV</button>
          <button className="btn-ghost" onClick={() => doExport('xlsx')}><FileSpreadsheet size={16} /> Excel</button>
          <button className="btn-ghost" onClick={() => buildReport(d, orgName).save(`rapport-${study.slug}.pdf`)}><FileText size={16} /> Rapport PDF</button>
          {(f.from || f.to || f.version || f.by) && <button className="btn-ghost" onClick={() => setF({ from: '', to: '', version: '', by: '' })}>Réinitialiser</button>}
          <span className="text-xs text-forest/60">Les exports tiennent compte des dates et de la version, pas de la comparaison.</span>
        </div>
        {msg && <p className="error mt-3">{msg}</p>}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="panel"><p className="font-display text-3xl font-bold leading-none">{d.totals.responses}</p><p className="mt-1 text-sm text-forest/70">Réponses</p></div>
        <div className="panel"><p className="font-display text-xl font-bold leading-tight">{fmt(d.totals.first_response_at)}</p><p className="mt-1 text-sm text-forest/70">Première réponse</p></div>
        <div className="panel"><p className="font-display text-xl font-bold leading-tight">{fmt(d.totals.last_response_at)}</p><p className="mt-1 text-sm text-forest/70">Dernière réponse</p></div>
      </section>

      {d.per_day.length > 0 ? (
        <section className="panel">
          <h2 className="mb-2 text-lg font-bold">Évolution des réponses</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.per_day} margin={{ left: -16, right: 8, top: 8 }}>
                <XAxis dataKey="date" tickFormatter={fmtDay} minTickGap={32} tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip labelFormatter={fmtDay} formatter={(v) => [v, 'Réponses']} />
                <Area type="monotone" dataKey="responses" stroke="#102F2B" strokeWidth={2} fill="#D5F06A" fillOpacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : <p className="panel">Aucune réponse pour ces critères.</p>}

      {d.compare && (
        <p className="panel text-sm">Comparaison selon « <strong>{d.compare.label}</strong> » : {d.compare.groups.map((g) => `${g.label} (${g.size})`).join(', ')}.
          {d.compare.groups.some((g) => g.hidden) && ` Les groupes de moins de ${d.min_group_size} réponses sont masqués.`}</p>
      )}

      {d.questions.map((q, i) => (
        <section key={q.question_id} className="panel">
          <h3 className="font-semibold">{i + 1}. {q.label}</h3>
          <p className="mb-2 text-sm text-forest/70">{q.n} réponse(s){q.response_rate != null && ` — ${q.response_rate} % des participants`}</p>
          {q.insufficient_data && <p className="text-sm">Pas assez de réponses (minimum {d.min_group_size}) pour afficher le détail.</p>}
          {q.stats && <p className="mb-2 text-sm">Moyenne {q.stats.average} — min {q.stats.min} — max {q.stats.max}</p>}
          {q.breakdown ? (
            <div style={{ height: 80 + q.distribution.length * 44 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" margin={{ left: 8, right: 16 }}
                  data={q.distribution.map((o, k) => Object.fromEntries([['label', o.label], ...q.breakdown.filter((g) => !g.hidden).map((g) => [g.label, g.distribution[k].count])]))}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={110} />
                  <Tooltip /><Legend />
                  {q.breakdown.filter((g) => !g.hidden).map((g, k) => <Bar key={g.key} dataKey={g.label} fill={COLORS[k % COLORS.length]} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : q.distribution && (
            <div style={{ height: 40 + q.distribution.length * 36 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={q.distribution} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="label" width={110} />
                  <Tooltip />
                  <Bar dataKey="count" name="Réponses" fill="#102F2B" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
