import axios, { AxiosError } from 'axios';
import { decodeAccessToken } from './auth-helpers';

const API_URL = import.meta.env.VITE_API_URL;

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const refreshToken = localStorage.getItem('refreshToken');

    if (error.response?.status === 401 && original && !original._retry && refreshToken) {
      original._retry = true;
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const tokens = data.data as { accessToken: string; refreshToken: string };
        let accessToken = tokens.accessToken;
        // Multi-restaurants : le refresh n'est pas scopé → on ré-applique le restaurant actif.
        const activeId = parseInt(localStorage.getItem('activeRestaurantId') ?? '', 10);
        const claims = decodeAccessToken(accessToken);
        if (!Number.isNaN(activeId) && typeof claims.restaurantId === 'number' && claims.restaurantId !== activeId) {
          const sw = await axios.post(
            `${API_URL}/auth/switch-restaurant`,
            { restaurantId: activeId },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const swTokens = sw.data.data as { accessToken: string; refreshToken: string };
          accessToken = swTokens.accessToken;
          localStorage.setItem('refreshToken', swTokens.refreshToken);
        } else {
          localStorage.setItem('refreshToken', tokens.refreshToken);
        }
        localStorage.setItem('accessToken', accessToken);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshErr) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        if (window.location.pathname !== '/') window.location.href = '/';
        return Promise.reject(refreshErr);
      }
    }
    return Promise.reject(error);
  }
);

// Extrait un message d'erreur lisible depuis la reponse API.
export function getApiError(error: unknown, fallback = 'Une erreur est survenue'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: { message?: string } } | undefined;
    return data?.error?.message ?? error.message ?? fallback;
  }
  return fallback;
}
