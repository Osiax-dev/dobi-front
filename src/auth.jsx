import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api('/me').then((d) => setUser(d.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', auth: false, body: { email, password } });
    setToken(d.token);
    setUser(d.user);
  };
  const register = async (body) => {
    // Pas de token avant la confirmation de l'adresse e-mail.
    return api('/auth/register', { method: 'POST', auth: false, body });
  };
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* token déjà invalide */ }
    setToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
