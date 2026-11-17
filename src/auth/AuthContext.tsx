import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  clearSession,
  getAccessToken,
  getStoredUser,
  ownerLogin,
  saveSession,
  setUnauthorizedHandler,
} from '../api/ownerApi';
import type { OwnerUser } from '../types/owner';

interface AuthContextValue {
  user: OwnerUser | null;
  isAuthenticated: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<OwnerUser | null>(() => {
    const stored = getStoredUser();
    const token = getAccessToken();
    if (stored?.role === 'owner' && token) return stored;
    clearSession();
    return null;
  });

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      navigate('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(() => undefined);
  }, [navigate]);

  const login = useCallback(
    async (phone: string, password: string) => {
      const res = await ownerLogin(phone, password);
      const { access, refresh, user: loggedIn } = res.data;

      if (loggedIn.role !== 'owner') {
        clearSession();
        throw new Error('This account is not an owner. Access denied.');
      }

      saveSession(access, refresh, loggedIn);
      setUser(loggedIn);
      navigate('/farmers', { replace: true });
    },
    [navigate],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user && getAccessToken()),
      login,
      logout,
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
