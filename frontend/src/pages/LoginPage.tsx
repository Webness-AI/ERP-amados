import { useState } from "react";
import type { FormEvent } from "react";
import axios from "axios";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";

type AuthMode = "login" | "bootstrap";

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error) && !error.response) {
    return "No se pudo conectar con el backend. Verifica que el servidor este levantado en http://localhost:3000.";
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
      "No se pudo completar la operacion"
    );
  }

  return "No se pudo completar la operacion";
}

export function LoginPage() {
  const { isAuthenticated, login, bootstrapAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      if (mode === "login") {
        await login({ email, password });
      } else {
        await bootstrapAdmin({
          firstName,
          lastName,
          email,
          password,
        });
      }

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
        <h1>{mode === "login" ? "Ingresar al ERP" : "Crear admin inicial"}</h1>
        <p>
          {mode === "login"
            ? "Autenticate para acceder a modulos protegidos."
            : "Usa bootstrap solo para la primera cuenta del sistema."}
        </p>

        <div className="auth-card__switch">
          <button
            type="button"
            className={`btn ${mode === "login" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            type="button"
            className={`btn ${mode === "bootstrap" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setMode("bootstrap")}
          >
            Bootstrap
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === "bootstrap" && (
            <>
              <label>
                Nombre
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  minLength={2}
                />
              </label>
              <label>
                Apellido
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  minLength={2}
                />
              </label>
            </>
          )}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Clave
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>

          {errorMessage && <p className="form-error">{errorMessage}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? "Procesando..."
              : mode === "login"
                ? "Ingresar"
                : "Crear admin"}
          </button>
        </form>

        <small>
          Si ya existe un usuario, bootstrap devolvera conflicto. Volve a{" "}
          <Link to="/login">login</Link>.
        </small>
      </article>
    </main>
  );
}
