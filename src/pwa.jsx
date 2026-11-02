import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, WifiOff } from 'lucide-react';
import { api } from './api';
import { flush, listQueue, remove } from './offline';

export const sendQueued = (it) => api(`/public/studies/${it.slug}/responses`, { method: 'POST', auth: false, body: it.body });

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  return online;
}

/** Synchronise les réponses en attente au démarrage et au retour de la connexion. */
export function useQueueSync() {
  useEffect(() => {
    const run = () => { if (navigator.onLine) flush(sendQueued).catch(() => {}); };
    run();
    window.addEventListener('online', run);
    return () => window.removeEventListener('online', run);
  }, []);
}

export function OfflineBanner({ collect = false }) {
  if (useOnline()) return null;
  return (
    <p role="status" className="flex items-center justify-center gap-2 bg-forest px-4 py-2 text-center text-sm font-semibold text-white">
      <WifiOff size={16} />
      {collect ? 'Vous êtes hors ligne. Vos réponses seront enregistrées sur cet appareil puis envoyées au retour de la connexion.' : 'Vous êtes hors ligne. La connexion est nécessaire pour utiliser DOBI.'}
    </p>
  );
}

export function UpdateBanner() {
  const { needRefresh: [need], updateServiceWorker } = useRegisterSW();
  if (!need) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 bg-lime px-4 py-3 text-sm font-semibold text-forest">
      Une nouvelle version de DOBI est disponible.
      <button className="rounded-lg bg-forest px-3 py-1.5 text-white" onClick={() => updateServiceWorker(true)}>Mettre à jour</button>
    </div>
  );
}

export function InstallButton() {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', h);
    window.addEventListener('appinstalled', () => setEvt(null));
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  if (!evt) return null;
  return (
    <button className="mb-3 flex w-full items-center gap-2 rounded-lg border border-white/25 px-3 py-2.5 text-sm font-semibold text-white hover:bg-white/10" onClick={() => evt.prompt().then(() => setEvt(null))}>
      <Download size={17} strokeWidth={1.75} /> Installer DOBI
    </button>
  );
}

/** Réponses en attente d'envoi sur cet appareil (côté participant). */
export function PendingBanner() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = () => listQueue().then(setItems).catch(() => {});
  useEffect(() => { load(); window.addEventListener('dobi-queue', load); return () => window.removeEventListener('dobi-queue', load); }, []);
  if (items.length === 0) return null;
  const pending = items.filter((i) => i.status === 'pending');
  const failed = items.filter((i) => i.status === 'failed');
  return (
    <div className="mb-4 space-y-2" role="status">
      {pending.length > 0 && (
        <p className="panel flex flex-wrap items-center justify-between gap-2 text-sm">
          {pending.length} réponse(s) en attente d’envoi sur cet appareil.
          <button className="btn-ghost" disabled={busy || !navigator.onLine} onClick={async () => { setBusy(true); await flush(sendQueued).catch(() => {}); setBusy(false); }}>Envoyer maintenant</button>
        </p>
      )}
      {failed.map((i) => (
        <p key={i.id} className="error flex flex-wrap items-center justify-between gap-2">
          Réponse non envoyée{i.title ? ` (« ${i.title} »)` : ''} : {i.error}
          <button className="btn-ghost" onClick={() => remove(i.id)}>Supprimer</button>
        </p>
      ))}
    </div>
  );
}
