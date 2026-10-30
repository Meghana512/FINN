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

/**
 * Stream the /api/ask response token-by-token using Server-Sent Events.
 * Calls onDelta(text) for each token chunk, onDone(finalResult) when complete.
 * Falls back gracefully to standard JSON if streaming is unavailable.
 *
 * @param {object} params - { symbol, question, context }
 * @param {(delta: string) => void} onDelta - called with each streamed text chunk
 * @param {(result: object) => void} onDone  - called once with the complete result
 * @param {AbortSignal} [signal] - optional external abort signal
 */
export async function askFinnStream({ symbol, question, context = "" }, onDelta, onDone, signal) {
  const token = localStorage.getItem("finn_token");
  const url   = `${API}/api/ask`;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 120000);
  if (signal) signal.addEventListener("abort", () => controller.abort());

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ symbol, question, context: context.slice(0, 1000) }),
      signal: controller.signal
    });

    // If server doesn't support SSE (e.g. old deploy), fall back to JSON
    if (!response.headers.get("content-type")?.includes("text/event-stream")) {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
      onDelta(data.answer || "");
      onDone(data);
      return;
    }

    const reader  = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = "";
    let fullText  = "";
    let finalResult = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        try {
          const parsed = JSON.parse(trimmed.slice(6));
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.delta) {
            fullText += parsed.delta;
            onDelta(parsed.delta);
          }
          if (parsed.done) {
            finalResult = {
              answer: fullText,
              symbol:      parsed.symbol ?? symbol,
              sources:     parsed.sources ?? null,
              aiConfigured: parsed.aiConfigured ?? true,
              _timings:    parsed.timings ?? null
            };
          }
        } catch (parseErr) {
          if (parseErr.message && !/JSON/.test(parseErr.message)) throw parseErr;
        }
      }
    }

    onDone(finalResult ?? { answer: fullText, symbol, aiConfigured: true });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timed out after 120 seconds.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
