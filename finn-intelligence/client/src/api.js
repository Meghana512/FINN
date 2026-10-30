/**
 * api.js — Centralized API client for FINN Intelligence
 * Configures API base URL using VITE_API_BASE for production deployment (Vercel + Render).
 */

const rawApiBase = import.meta.env.VITE_API_BASE;

export const API = (
  rawApiBase && rawApiBase.trim() !== ""
    ? rawApiBase.trim()
    : (import.meta.env.DEV ? "http://localhost:4000" : "")
).replace(/\/+$/, "");

if (import.meta.env.PROD && !rawApiBase) {
  console.warn(
    "[FINN Config] VITE_API_BASE is not defined in production environment. " +
    "API requests will default to the current host origin."
  );
}

/**
 * Perform authenticated or unauthenticated API request to FINN backend
 * @param {string} path - URL path starting with /api/
 * @param {RequestInit} [options] - Fetch options
 */
export async function api(path, options = {}) {
  const token = localStorage.getItem("finn_token");
  const url = `${API}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      data.error ||
      (response.status === 401
        ? "Session expired or authentication required. Please sign in again."
        : `Request failed with status ${response.status}`);
    throw new Error(errorMsg);
  }

  return data;
}

