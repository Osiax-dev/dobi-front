import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errText } from '../api';

/** Affectation d'enquêteurs à une étude. Aucune case cochée = tous les enquêteurs de l'espace peuvent collecter. */
export default function CollectorAssignment({ study }) {
  const qc = useQueryClient();
  const res = useQuery({ queryKey: ['assignments', study.id], queryFn: () => api(`/studies/${study.id}/assignments`) });
  const [ids, setIds] = useState(null);
  useEffect(() => { if (res.data) setIds(res.data.surveyors.filter((s) => s.assigned).map((s) => s.id)); }, [res.data]);
  const save = useMutation({
    mutationFn: () => api(`/studies/${study.id}/assignments`, { method: 'PUT', body: { user_ids: ids } }),
    onSuccess: (d) => { qc.setQueryData(['assignments', study.id], d); },
  });

  if (res.isLoading || res.isError || !res.data || ids === null) return null;
  const surveyors = res.data.surveyors;
  if (surveyors.length === 0) return null;
  const toggle = (id) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const dirty = JSON.stringify([...ids].sort()) !== JSON.stringify(res.data.surveyors.filter((s) => s.assigned).map((s) => s.id).sort());

  return (
    <fieldset className="panel mb-4">
      <legend className="px-1 font-semibold">Enquêteurs de cette étude</legend>
      <p className="mb-3 text-sm text-forest/70">
        {ids.length === 0 ? 'Aucun enquêteur choisi : tous les enquêteurs de l’espace peuvent collecter.' : 'Seuls les enquêteurs cochés peuvent collecter cette étude.'}
      </p>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2">
        {surveyors.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ids.includes(s.id)} onChange={() => toggle(s.id)} /> {s.name}</label>
        ))}
      </div>
      {save.isError && <p className="error mb-2">{errText(save.error)}</p>}
      <button className="btn" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>Enregistrer</button>
      {save.isSuccess && !dirty && <span className="ml-3 text-sm font-semibold text-success" role="status">Enregistré.</span>}
    </fieldset>
  );
}
