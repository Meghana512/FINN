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
 * @param {RequestInit & { timeoutMs?: number }} [options] - Fetch options with custom timeout
 */
export async function api(path, options = {}) {
  const token = localStorage.getItem("finn_token");
  const url = `${API}${path}`;

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers || {})
  };

  // Allow up to 120 seconds for deep research synthesis (/api/ask), 30s for standard API calls
  const timeoutMs = options.timeoutMs || (path.startsWith("/api/ask") ? 120000 : 30000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
  }, timeoutMs);

  if (options.signal) {
    options.signal.addEventListener("abort", () => controller.abort(options.signal.reason));
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
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
  } catch (err) {
    if (err.name === "AbortError" || /aborted|timed out/i.test(err.message)) {
      throw new Error(
        err.message.includes("timed out")
          ? err.message
          : `The operation was aborted due to timeout (${Math.round(timeoutMs / 1000)}s limit reached).`
      );
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
