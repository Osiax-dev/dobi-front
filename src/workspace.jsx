import { createContext, useContext, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

const Ctx = createContext(null);
export const useWorkspace = () => useContext(Ctx);

/** Espace de travail actif (espace personnel ou organisation), mémorisé dans le navigateur. */
export function WorkspaceProvider({ children }) {
  const me = useQuery({ queryKey: ['me'], queryFn: () => api('/me') });
  const orgs = me.data?.organizations || [];
  const [stored, setStored] = useState(() => Number(localStorage.getItem('dobi_org')) || null);
  const active = orgs.find((o) => o.id === stored) || orgs[0] || null;
  const select = (id) => { localStorage.setItem('dobi_org', String(id)); setStored(id); };
  return <Ctx.Provider value={{ orgs, active, select, loading: me.isLoading }}>{children}</Ctx.Provider>;
}
