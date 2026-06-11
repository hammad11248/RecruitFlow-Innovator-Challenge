/**
 * Centralized API base URL — single source of truth for all frontend HTTP calls.
 * In dev: defaults to http://127.0.0.1:8001/api (matches backend port).
 * In prod: defaults to /api (same-origin via Vercel or FastAPI static serve).
 */
export function getApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '')
  }
  return import.meta.env.DEV ? 'http://127.0.0.1:8001/api' : '/api'
}

export const API_BASE_URL = getApiBaseUrl()
