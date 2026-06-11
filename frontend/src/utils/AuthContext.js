import React, { createContext, useContext, useState, useEffect } from "react";
import { getMe, refreshSession } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(localStorage.getItem("ts_token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      getMe()
        .then((res) => setUser(res.data.user))
        .catch(async () => {
          try {
            await refresh();
          } catch {
            localStorage.removeItem("ts_token");
            localStorage.removeItem("ts_refresh");
            setToken(null);
          }
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken, newUser) => {
    const tokenValue = typeof newToken === "object" ? newToken.token : newToken;
    const refreshValue = typeof newToken === "object" ? newToken.refreshToken : null;
    localStorage.setItem("ts_token", tokenValue);
    if (refreshValue) localStorage.setItem("ts_refresh", refreshValue);
    setToken(tokenValue);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("ts_token");
    localStorage.removeItem("ts_refresh");
    setToken(null);
    setUser(null);
  };

  async function refresh() {
    const storedRefresh = localStorage.getItem("ts_refresh");
    if (!storedRefresh) return null;
    const res = await refreshSession(storedRefresh);
    login({ token: res.data.token, refreshToken: res.data.refreshToken }, res.data.user);
    return res.data.user;
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refresh, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
