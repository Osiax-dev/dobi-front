import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
// Composants d'identité DOBI : logo et badges de statut.
const STATUS_STYLES = {
  draft: ['Brouillon', 'bg-slate/20 text-forest'],
  published: ['Publiée', 'bg-lime text-forest'],
  suspended: ['Suspendue', 'bg-terracotta/20 text-[#8a4320]'],
  closed: ['Clôturée', 'bg-forest text-white'],
  archived: ['Archivée', 'bg-forest/10 text-forest/70'],
};

export function PasswordInput({ className = 'input', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${className} pr-11`} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} aria-pressed={show}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-forest/70 hover:text-forest">
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
}

export function StatusBadge({ status }) {
  const [label, cls] = STATUS_STYLES[status] || [status, 'bg-slate/20'];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{label}</span>;
}

/** Symbole : un « D » dont la courbe enferme un point de donnée. */
export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="DOBI">
      <rect x="3" y="3" width="6" height="26" rx="2" fill="#D5F06A" />
      <path d="M13 3h4a13 13 0 0 1 0 26h-4v-6h4a7 7 0 0 0 0-14h-4z" fill="#D5F06A" />
      <circle cx="17.5" cy="16" r="2.6" fill="#D77A52" />
    </svg>
  );
}

export function Logo({ light = false, tagline = false, size = 32 }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className="leading-tight">
        <span className={`block font-display text-2xl font-bold tracking-tight ${light ? 'text-white' : 'text-forest'}`}>DOBI</span>
        {tagline && <span className={`block text-xs ${light ? 'text-white/70' : 'text-forest/70'}`}>Les données ont une histoire.</span>}
      </span>
    </span>
  );
}

export const STATUS = Object.fromEntries(Object.entries(STATUS_STYLES).map(([k, v]) => [k, v[0]]));
export const STATUS_COLORS = { draft: '#7C91A0', published: '#D5F06A', suspended: '#D77A52', closed: '#102F2B', archived: '#B7C2C9' };

export const ROLES = { owner: 'Propriétaire', admin: 'Administrateur', editor: 'Éditeur', surveyor: 'Enquêteur', analyst: 'Analyste' };
export const ORG_TYPES = { personal: 'Espace personnel', company: 'Société', ngo: 'ONG', association: 'Association', institution: 'Institution' };
