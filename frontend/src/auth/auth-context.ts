import { createContext } from "react";

import type { AuthUser } from "../services/erp-api";

export type AuthContextValue = {
  user: AuthUser | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
