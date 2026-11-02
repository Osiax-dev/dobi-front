import { useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { BarChart3, Building2, ChevronDown, FolderKanban, LayoutDashboard, LayoutTemplate, LogOut, Menu, Settings, Users, X } from 'lucide-react';
import { useAuth } from './auth';
import { Logo } from './ui';
import { InstallButton, OfflineBanner, UpdateBanner, useQueueSync } from './pwa';
import { WorkspaceProvider, useWorkspace } from './workspace';
import { Forgot, Login, Register, Reset } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Studies from './pages/Studies';
import Organizations from './pages/Organizations';
import Organization from './pages/Organization';
import Participation from './pages/Participation';
import StudyParticipants from './pages/StudyParticipants';
import Study from './pages/Study';
import Invitation from './pages/Invitation';
import { PublicOrg, PublicStudy } from './pages/Public';

// Modules sans écran pour l'instant : affichés « Bientôt », jamais cliquables.
const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard },
  { to: '/studies', label: 'Mes études', icon: FolderKanban },
  { to: '/organizations', label: 'Organisations', icon: Building2 },
  { label: 'Résultats & Analyses', icon: BarChart3 },
  { to: '/participants', label: 'Participants', icon: Users },
  { label: 'Modèles', icon: LayoutTemplate },
  { label: 'Paramètres', icon: Settings },
];

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const { orgs, active, select } = useWorkspace();
  return (
    <div className="flex h-full flex-col bg-deep p-4 text-white">
      <Link to="/" onClick={onNavigate} className="mb-8 mt-2 px-2"><Logo light tagline /></Link>
      <nav aria-label="Navigation principale" className="flex-1 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) =>
          to ? (
            <NavLink key={label} to={to} end={to === '/'} onClick={onNavigate}
              className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold ${isActive ? 'bg-lime text-forest' : 'text-white/85 hover:bg-white/10'}`}>
              <Icon size={19} strokeWidth={1.75} /> {label}
            </NavLink>
          ) : (
            <span key={label} aria-disabled="true" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-white/40">
              <Icon size={19} strokeWidth={1.75} /> {label}
              <span className="ml-auto rounded-full border border-white/20 px-2 text-[11px] font-semibold">Bientôt</span>
            </span>
          ),
        )}
      </nav>
      <InstallButton />
      <div className="mb-3">
        <label htmlFor="ws" className="mb-1 block px-1 text-xs text-white/60">Espace actif</label>
        <div className="relative">
          <Building2 size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70" />
          <select id="ws" value={active?.id ?? ''} onChange={(e) => select(Number(e.target.value))}
            className="w-full appearance-none rounded-lg border border-white/25 bg-transparent py-2.5 pl-9 pr-8 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-lime">
            {orgs.map((o) => <option key={o.id} value={o.id} className="text-forest">{o.name}</option>)}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/70" />
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-white/15 pt-3">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-lime font-display font-bold text-forest">{user?.name?.[0]?.toUpperCase()}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{user?.name}</span>
        <button onClick={logout} aria-label="Se déconnecter" className="rounded-lg p-2 hover:bg-white/10"><LogOut size={18} strokeWidth={1.75} /></button>
      </div>
    </div>
  );
}

export function Shell({ children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block"><Sidebar /></aside>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-forest/10 bg-ivory px-4 py-3 lg:hidden">
        <Logo size={28} />
        <button onClick={() => setOpen(true)} aria-label="Ouvrir le menu" className="rounded-lg p-2 hover:bg-forest/5"><Menu size={22} /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <button aria-label="Fermer le menu" className="absolute inset-0 bg-forest/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%]">
            <Sidebar onNavigate={() => setOpen(false)} />
            <button onClick={() => setOpen(false)} aria-label="Fermer" className="absolute right-3 top-3 rounded-lg p-2 text-white hover:bg-white/10"><X size={20} /></button>
          </aside>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}

function Private({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-6">Chargement…</p>;
  return user ? <WorkspaceProvider><Shell>{children}</Shell></WorkspaceProvider> : <Navigate to="/login" replace />;
}

export default function App() {
  useQueueSync();
  return (
    <>
    <OfflineBanner />
    <UpdateBanner />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<Forgot />} />
      <Route path="/reset-password" element={<Reset />} />
      <Route path="/invitations/:token" element={<Invitation />} />
      <Route path="/s/:slug" element={<PublicStudy />} />
      <Route path="/o/:slug" element={<PublicOrg />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/studies" element={<Private><Studies /></Private>} />
      <Route path="/organizations" element={<Private><Organizations /></Private>} />
      <Route path="/organizations/:id" element={<Private><Organization /></Private>} />
      <Route path="/participants" element={<Private><Participation /></Private>} />
      <Route path="/studies/:id/participants" element={<Private><StudyParticipants /></Private>} />
      <Route path="/studies/:id" element={<Private><Study /></Private>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
