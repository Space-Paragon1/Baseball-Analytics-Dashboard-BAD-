import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AUTH_EXPIRED_EVENT, TOKEN_KEY, authLogin, authMe, authRegister } from "../utils/api";
import type { AuthResponse, AuthUser } from "../types";

interface AuthContextType {
  user: AuthUser | null;
  /** False until the stored token has been checked with the server. */
  ready: boolean;
  /** True after a session expired, until the next sign-in. */
  expired: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  register: (username: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  ready: false,
  expired: false,
  login: async () => {
    throw new Error("AuthProvider missing");
  },
  register: async () => {
    throw new Error("AuthProvider missing");
  },
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    // Validate any stored token instead of trusting cached user info.
    const check = localStorage.getItem(TOKEN_KEY)
      ? authMe()
          .then(setUser)
          .catch(() => localStorage.removeItem(TOKEN_KEY))
      : Promise.resolve();
    check.finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setExpired(true);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const accept = useCallback((res: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, res.access_token);
    setUser(res.user);
    setExpired(false);
    return res.user;
  }, []);

  const login = useCallback(async (u: string, p: string) => accept(await authLogin(u, p)), [accept]);
  const register = useCallback(
    async (u: string, e: string, p: string) => accept(await authRegister(u, e, p)),
    [accept]
  );
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, expired, login, register, logout }),
    [user, ready, expired, login, register, logout]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
