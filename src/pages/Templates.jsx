import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileStack, Trash2 } from 'lucide-react';
import { api, errText } from '../api';
import { useWorkspace } from '../workspace';

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function UseTemplate({ template, orgId, onClose }) {
  const nav = useNavigate();
  const [title, setTitle] = useState(template.name);
  const [privacy, setPrivacy] = useState('anonymous');
  const create = useMutation({
    mutationFn: () => api(`/organizations/${orgId}/studies/from-template`, { method: 'POST', body: { title, template: template.id, privacy_mode: privacy } }),
    onSuccess: (s) => nav(`/studies/${s.id}`),
  });
  return (
    <form className="mt-3 space-y-3 border-t border-forest/10 pt-3" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
      <div>
        <label className="label" htmlFor={`t-${template.id}`}>Titre de la nouvelle étude</label>
        <input id={`t-${template.id}`} className="input" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor={`p-${template.id}`}>Participants</label>
        <select id={`p-${template.id}`} className="input" value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
          <option value="anonymous">Anonymes</option>
          <option value="identified">Identifiés (nom + e-mail)</option>
        </select>
      </div>
      {create.isError && <p className="error">{errText(create.error)}</p>}
      <div className="flex gap-2">
        <button className="btn" disabled={create.isPending}>Créer l’étude</button>
        <button type="button" className="btn-ghost" onClick={onClose}>Annuler</button>
      </div>
    </form>
  );
}

function Card({ t, orgId, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="panel">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold">{t.name}</h3>
          {t.description && <p className="mt-1 text-sm text-forest/70">{t.description}</p>}
          <p className="mt-2 text-xs text-forest/60">{plural(t.sections_count, 'étape', 'étapes')} · {plural(t.questions_count, 'question', 'questions')}</p>
        </div>
        {t.can_delete && <button className="rounded-lg p-2 hover:bg-forest/5" aria-label={`Supprimer le modèle ${t.name}`} onClick={() => onDelete(t)}><Trash2 size={17} strokeWidth={1.75} /></button>}
      </div>
      {open ? <UseTemplate template={t} orgId={orgId} onClose={() => setOpen(false)} /> : <button className="btn mt-4" onClick={() => setOpen(true)}>Utiliser ce modèle</button>}
    </li>
  );
}

export default function Templates() {
  const { active } = useWorkspace();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['templates', active?.id], queryFn: () => api(`/organizations/${active.id}/templates`), enabled: !!active });
  const del = useMutation({
    mutationFn: (t) => api(`/templates/${t.id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
  const remove = (t) => { if (window.confirm(`Supprimer le modèle « ${t.name} » ? Les études déjà créées avec ce modèle ne changent pas.`)) del.mutate(t); };

  if (!active) return <p>Chargement…</p>;
  if (list.isLoading) return <p>Chargement…</p>;
  if (list.isError) return <p className="error">{errText(list.error)}</p>;
  const { builtin, organization } = list.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Modèles</h1>
        <p className="text-sm text-forest/70">Partez d’un questionnaire prêt à l’emploi, puis adaptez-le. L’étude créée est un brouillon : rien n’est publié.</p>
      </div>
      {del.isError && <p className="error">{errText(del.error)}</p>}
      <section>
        <h2 className="mb-3 text-lg font-bold">Modèles DOBI</h2>
        <ul className="grid gap-3 md:grid-cols-2">{builtin.map((t) => <Card key={t.id} t={t} orgId={active.id} onDelete={remove} />)}</ul>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold">Modèles de {active.name}</h2>
        {organization.length === 0 ? (
          <div className="panel text-center">
            <FileStack size={34} strokeWidth={1.5} className="mx-auto text-forest/60" aria-hidden="true" />
            <p className="mt-3 font-semibold">Aucun modèle enregistré</p>
            <p className="mt-1 text-sm text-forest/70">Ouvrez une étude et cliquez sur « Enregistrer comme modèle » pour réutiliser son questionnaire.</p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">{organization.map((t) => <Card key={t.id} t={t} orgId={active.id} onDelete={remove} />)}</ul>
        )}
      </section>
    </div>
  );
}

/** Bouton + mini formulaire affichés dans une étude : enregistre son questionnaire comme modèle. */
export function SaveAsTemplate({ study }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(study.title);
  const [description, setDescription] = useState('');
  const save = useMutation({
    mutationFn: () => api(`/studies/${study.id}/template`, { method: 'POST', body: { name, description: description || null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); },
  });
  if (save.isSuccess) return <p className="panel mb-4 text-sm font-semibold text-success" role="status">Modèle enregistré. Retrouvez-le dans « Modèles ».</p>;
  if (!open) return <p className="mb-4"><button className="btn-ghost" onClick={() => setOpen(true)}>Enregistrer comme modèle</button></p>;
  return (
    <form className="panel mb-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <p className="mb-3 font-semibold">Enregistrer le questionnaire comme modèle</p>
      <label className="label" htmlFor="tpl-name">Nom du modèle</label>
      <input id="tpl-name" className="input mb-3" required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} />
      <label className="label" htmlFor="tpl-desc">Description (facultative)</label>
      <input id="tpl-desc" className="input mb-3" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
      <p className="mb-3 text-xs text-forest/60">Seuls les étapes, questions, choix et conditions sont copiés. Aucune réponse n’est enregistrée dans le modèle.</p>
      {save.isError && <p className="error mb-3">{errText(save.error)}</p>}
      <div className="flex gap-2"><button className="btn" disabled={save.isPending}>Enregistrer</button><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Annuler</button></div>
    </form>
  );
}
