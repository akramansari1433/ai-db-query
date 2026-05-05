import { validatePgUrl } from "./validate-pg-url";

const STORAGE_KEY = "db_query_connection_url";

export function getConnectionUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setConnectionUrl(url: string): { ok: true } | { ok: false; reason: string } {
  const result = validatePgUrl(url);
  if (!result.ok) return result;
  if (typeof window === "undefined") {
    return { ok: false, reason: "Storage unavailable." };
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, url);
    return { ok: true };
  } catch {
    return { ok: false, reason: "Could not save to localStorage." };
  }
}

export function clearConnectionUrl(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
