import { useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && !error.response) {
    return "No se pudo conectar con el backend. Verifica que el servidor esté levantado en http://localhost:4000.";
  }

  if (typeof error === "object" && error !== null) {
    const maybeResponse = error as {
      response?: {
        data?: {
          error?: {
            message?: string;
          };
        };
      };
    };
    return (
      maybeResponse.response?.data?.error?.message ??
      "No se pudo completar la operación"
    );
  }

  return "No se pudo completar la operación";
}

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const state = location.state as { redirectTo?: string } | null;
  const redirectTo = state?.redirectTo ?? "/dashboard";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login({ email, password });

      navigate(redirectTo, { replace: true });
    } catch (error) {
      setErrorMessage(extractErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <article className="auth-card">
        <h1>Ingresar al ERP</h1>
        <p>Autentícate para acceder a módulos protegidos.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Correo
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Clave
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </label>

          {errorMessage && <p className="form-error">{errorMessage}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Procesando..." : "Ingresar"}
          </button>
        </form>
      </article>
    </main>
  );
}
