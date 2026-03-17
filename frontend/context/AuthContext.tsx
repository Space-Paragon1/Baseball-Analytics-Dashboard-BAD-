import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import api from "../utils/api";

interface AuthUser {
  username: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("auth_token");
    const storedUser = localStorage.getItem("auth_user");
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser;
        setToken(storedToken);
        setUser(parsedUser);
        api.defaults.headers.common["Authorization"] = `Bearer ${storedToken}`;
      } catch {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
      }
    }
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.post<{ access_token: string; username: string; email: string }>(
      "/auth/login",
      { username, password }
    );
    const { access_token, username: uname, email } = res.data;
    const authUser: AuthUser = { username: uname, email };
    setToken(access_token);
    setUser(authUser);
    localStorage.setItem("auth_token", access_token);
    localStorage.setItem("auth_user", JSON.stringify(authUser));
    api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
  };

  const register = async (username: string, email: string, password: string) => {
    const res = await api.post<{ access_token: string; username: string; email: string }>(
      "/auth/register",
      { username, email, password }
    );
    const { access_token, username: uname, email: em } = res.data;
    const authUser: AuthUser = { username: uname, email: em };
    setToken(access_token);
    setUser(authUser);
    localStorage.setItem("auth_token", access_token);
    localStorage.setItem("auth_user", JSON.stringify(authUser));
    api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    delete api.defaults.headers.common["Authorization"];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
