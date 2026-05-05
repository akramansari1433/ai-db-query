export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validatePgUrl(raw: string): ValidationResult {
  if (!raw || typeof raw !== "string") {
    return { ok: false, reason: "Connection URL is required." };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Not a valid URL." };
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return { ok: false, reason: "URL must start with postgres:// or postgresql://" };
  }

  const host = url.hostname.toLowerCase();
  if (!host) {
    return { ok: false, reason: "URL is missing a host." };
  }
  if (host === "localhost" || host === "0.0.0.0" || host === "::1") {
    return { ok: false, reason: "Local hosts are not allowed." };
  }
  if (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^127\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return { ok: false, reason: "Private IP addresses are not allowed." };
  }

  return { ok: true };
}

export function maskPgUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname || "host";
    const port = url.port ? `:${url.port}` : "";
    const dbName = url.pathname?.replace(/^\//, "") || "";
    const dbDisplay = dbName ? `/${"*".repeat(Math.min(dbName.length, 6))}` : "";
    return `${url.protocol}//****@${host}${port}${dbDisplay}`;
  } catch {
    return "(invalid URL)";
  }
}

export function getHostLabel(raw: string): string {
  try {
    const url = new URL(raw);
    return url.hostname || "unknown";
  } catch {
    return "unknown";
  }
}
