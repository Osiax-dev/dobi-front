import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { api } from './api';
import { useWorkspace } from './workspace';

/** « il y a 5 min », « hier », sinon la date. */
export function ago(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 172800) return 'hier';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/** Cloche : le propriétaire et les administrateurs voient ce que font les autres membres. */
export default function NotificationBell() {
  const { active } = useWorkspace();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const allowed = ['owner', 'admin'].includes(active?.role);

  const q = useQuery({
    queryKey: ['notifications', active?.id],
    queryFn: () => api(`/notifications?organization=${active.id}`),
    enabled: allowed,
    refetchInterval: 60000,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  const readOne = useMutation({ mutationFn: (id) => api(`/notifications/${id}/read`, { method: 'POST' }), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST', body: { organization: active.id } }), onSuccess: refresh });

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  if (!allowed) return null;
  const unread = q.data?.unread ?? 0;
  const items = q.data?.data ?? [];

  const go = (n) => {
    if (!n.read) readOne.mutate(n.id);
    setOpen(false);
    nav(n.study_id ? `/studies/${n.study_id}` : `/organizations/${n.organization_id}`);
  };

  return (
    <div className="relative" ref={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="true"
        aria-label={unread ? `Alertes : ${unread} non lue${unread > 1 ? 's' : ''}` : 'Alertes'}
        className="relative rounded-lg p-2 text-forest hover:bg-forest/5">
        <Bell size={22} strokeWidth={1.75} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-terracotta px-1 text-[11px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="region" aria-label="Alertes" className="absolute right-0 z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-forest/15 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-forest/10 px-4 py-3">
            <h2 className="text-sm font-bold">Activité de l’équipe</h2>
            {unread > 0 && <button type="button" className="text-xs font-semibold underline" onClick={() => readAll.mutate()} disabled={readAll.isPending}>Tout marquer comme lu</button>}
          </div>
          {q.isError && <p className="p-4 text-sm">Alertes indisponibles pour le moment.</p>}
          {!q.isError && items.length === 0 && <p className="p-4 text-sm text-forest/70">Aucune alerte pour l’instant. Vous serez prévenu quand un membre modifie une étude, une question ou l’équipe, ou quand une réponse arrive.</p>}
          <ul className="max-h-96 divide-y divide-forest/10 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => go(n)} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-forest/5 ${n.read ? '' : 'bg-lime/20'}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-terracotta'}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.read ? '' : 'font-semibold'}`}>{n.message}</span>
                    <span className="mt-0.5 block text-xs text-forest/60">{ago(n.at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
