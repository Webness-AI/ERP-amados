import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

export const http = axios.create({
  baseURL,
  withCredentials: true,
});

const refreshClient = axios.create({
  baseURL,
  withCredentials: true,
});

let onSessionExpired: (() => void) | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

export function setAccessToken(token: string | null): void {
  if (!token) {
    delete http.defaults.headers.common.Authorization;
    return;
  }

  http.defaults.headers.common.Authorization = `Bearer ${token}`;
}

type RefreshEnvelope = {
  ok: true;
  data: {
    accessToken: string;
  };
};

type RetriableRequestConfig = {
  _retry?: boolean;
  url?: string;
  headers?: Record<string, string>;
};

function canAttemptRefresh(url?: string): boolean {
  if (!url) {
    return true;
  }

  return !(
    url.includes("/auth/login") ||
    url.includes("/auth/bootstrap-admin") ||
    url.includes("/auth/refresh")
  );
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<RefreshEnvelope>("/auth/refresh", {})
      .then((response) => response.data.data.accessToken)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.response || !error.config) {
      return Promise.reject(error);
    }

    const original = error.config as RetriableRequestConfig;
    const status = error.response.status;

    if (status !== 401 || original._retry || !canAttemptRefresh(original.url)) {
      return Promise.reject(error);
    }

    try {
      original._retry = true;
      const nextAccessToken = await refreshAccessToken();

      if (!nextAccessToken) {
        setAccessToken(null);
        onSessionExpired?.();
        return Promise.reject(error);
      }

      setAccessToken(nextAccessToken);
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${nextAccessToken}`;

      return http.request(original);
    } catch {
      setAccessToken(null);
      onSessionExpired?.();
      return Promise.reject(error);
    }
  },
);
