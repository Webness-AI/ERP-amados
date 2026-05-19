import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  type AuthUser,
  loginApi,
  logoutApi,
  refreshSessionApi,
} from "../services/erp-api";
import { setAccessToken, setSessionExpiredHandler } from "../services/http";
import { AuthContext, type AuthContextValue } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const initPromiseRef = useRef<Promise<Awaited<
    ReturnType<typeof refreshSessionApi>
  > | null> | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!initPromiseRef.current) {
      initPromiseRef.current = refreshSessionApi().catch(() => null);
    }

    void initPromiseRef.current
      .then((session) => {
        if (cancelled) {
          return;
        }

        if (!session) {
          setAccessToken(null);
          setUser(null);
          return;
        }

        setAccessToken(session.accessToken);
        setUser(session.user);
      })
      .finally(() => {
        if (!cancelled) {
          setIsInitializing(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setAccessToken(null);
      setUser(null);
    });

    return () => {
      setSessionExpiredHandler(null);
    };
  }, []);

  const login: AuthContextValue["login"] = async ({ email, password }) => {
    const result = await loginApi({ email, password });
    setAccessToken(result.accessToken);
    setUser(result.user);
  };

  const logout: AuthContextValue["logout"] = async () => {
    try {
      await logoutApi();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isInitializing,
        isAuthenticated: user !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
