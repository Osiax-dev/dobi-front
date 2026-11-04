import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import { api, errText } from '../api';

/** Écran de l'enquêteur : les études ouvertes à la collecte et son nombre de réponses collectées. */
export default function Collecte() {
  const list = useQuery({ queryKey: ['collect-studies'], queryFn: () => api('/collect/studies') });

  if (list.isLoading) return <p>Chargement…</p>;
  if (list.isError) return <p className="error">{errText(list.error)}</p>;
  const studies = list.data.data;

  return (
    <div>
      <h1 className="text-2xl font-bold">Collecte</h1>
      <p className="mb-5 text-sm text-forest/70">Choisissez une étude pour saisir les réponses d’une personne. Chaque réponse est enregistrée à votre nom.</p>
      {studies.length === 0 ? (
        <div className="panel text-center">
          <ClipboardList size={36} strokeWidth={1.5} className="mx-auto text-forest/60" aria-hidden="true" />
          <p className="mt-3 font-semibold">Aucune étude ouverte à la collecte</p>
          <p className="mt-1 text-sm text-forest/70">Dès qu’une étude est publiée dans votre espace, elle apparaît ici.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {studies.map((s) => (
            <li key={s.id} className="panel flex flex-col justify-between gap-4">
              <div>
                <p className="text-xs text-forest/60">{s.organization}</p>
                <h2 className="text-lg font-bold">{s.title}</h2>
                <p className="mt-1 text-sm text-forest/70">{s.mine} réponse(s) collectée(s) par vous</p>
              </div>
              <Link className="btn" to={`/s/${s.slug}?collecte=1`}>Collecter une réponse</Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
