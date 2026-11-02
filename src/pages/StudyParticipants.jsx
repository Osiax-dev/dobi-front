import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserX } from 'lucide-react';
import { api, errText } from '../api';

const fmt = (x) => (x ? new Date(x).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function StudyParticipants() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');

  const study = useQuery({ queryKey: ['study', id], queryFn: () => api(`/studies/${id}`) });
  const list = useQuery({
    queryKey: ['participants', id, term, page],
    queryFn: () => api(`/studies/${id}/participants?page=${page}${term ? `&q=${encodeURIComponent(term)}` : ''}`),
  });
  const anonymize = useMutation({
    mutationFn: (uuid) => api(`/studies/${id}/participants/${uuid}`, { method: 'DELETE' }),
    onSuccess: () => { setError(''); qc.invalidateQueries({ queryKey: ['participants'] }); },
    onError: (e) => setError(errText(e)),
  });

  const back = <Link to="/participants" className="text-sm underline">← Participants</Link>;
  if (list.isError) {
    return <div>{back}<p className="error mt-3">{list.error.status === 403 ? 'Accès réservé aux propriétaires et administrateurs de l’espace.' : errText(list.error)}</p></div>;
  }
  if (list.isLoading) return <p>Chargement…</p>;
  const { stats, participants: p } = list.data;

  return (
    <div className="space-y-5">
      <div>
        {back}
        <h1 className="mt-2 text-2xl font-bold">Participants — {study.data?.title}</h1>
        <p className="text-sm text-forest/70">Données personnelles : consultation enregistrée dans le journal d’activité. Les réponses ne sont pas affichées ici.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Statistiques">
        <div className="panel"><p className="font-display text-3xl font-bold leading-none">{stats.participants}</p><p className="mt-1 text-sm text-forest/70">Participants identifiés</p></div>
        <div className="panel"><p className="font-display text-3xl font-bold leading-none">{stats.consents}</p><p className="mt-1 text-sm text-forest/70">Consentements enregistrés</p></div>
        <div className="panel"><p className="font-display text-xl font-bold leading-tight">{fmt(stats.last_participation)}</p><p className="mt-1 text-sm text-forest/70">Dernière participation</p></div>
      </section>
      {error && <p className="error">{error}</p>}

      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); setTerm(search.trim()); }}>
        <input className="input" aria-label="Rechercher un participant" placeholder="Rechercher par nom ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn-ghost shrink-0">Rechercher</button>
      </form>

      {p.data.length === 0 ? (
        <p className="panel">{term ? 'Aucun participant ne correspond à cette recherche.' : 'Aucun participant identifié pour l’instant (ou identités déjà anonymisées).'}</p>
      ) : (
        <ul className="space-y-2">
          {p.data.map((x) => (
            <li key={x.uuid} className="panel flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="min-w-0 flex-1 basis-56">
                <span className="block truncate font-semibold">{x.full_name}</span>
                <span className="block truncate text-sm">{x.email}{x.phone && ` — ${x.phone}`}</span>
              </span>
              <span className="text-sm text-forest/70">{fmt(x.submitted_at)}</span>
              <span className="text-sm">
                {x.consent_accepted ? <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-bold">Consentement</span> : <span className="rounded-full bg-terracotta/20 px-2 py-0.5 text-xs font-bold">Aucun</span>}
                {x.notice_version && <span className="ml-2 text-xs text-forest/60">notice v{x.notice_version}</span>}
              </span>
              <button className="btn-ghost" onClick={() => window.confirm(`Supprimer l’identité de ${x.full_name} ? Ses réponses seront conservées de façon anonyme. Cette action est définitive.`) && anonymize.mutate(x.uuid)}>
                <UserX size={16} /> Anonymiser
              </button>
            </li>
          ))}
        </ul>
      )}

      {p.last_page > 1 && (
        <div className="flex items-center justify-between">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</button>
          <span className="text-sm">Page {p.current_page} sur {p.last_page}</span>
          <button className="btn-ghost" disabled={page >= p.last_page} onClick={() => setPage(page + 1)}>Suivant</button>
        </div>
      )}
    </div>
  );
}
