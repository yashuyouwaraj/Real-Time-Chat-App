type CorsCallback = (err: Error | null, allow?: boolean | string) => void;

function getConfiguredOrigins(): string[] {
  const origins = new Set<string>(["http://localhost:3000"]);

  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    for (const origin of frontendUrl.split(",")) {
      const trimmed = origin.trim();
      if (trimmed) origins.add(trimmed);
    }
  }

  return Array.from(origins);
}

function isAllowedOrigin(origin: string): boolean {
  if (getConfiguredOrigins().includes(origin)) {
    return true;
  }

  return /^https:\/\/[\w.-]+\.vercel\.app$/.test(origin);
}

export function corsOriginDelegate(
  origin: string | undefined,
  callback: CorsCallback,
): void {
  if (process.env.NODE_ENV !== "production") {
    callback(null, true);
    return;
  }

  if (!origin || isAllowedOrigin(origin)) {
    callback(null, origin ?? true);
    return;
  }

  callback(new Error(`Origin ${origin} is not allowed by CORS`));
}

export function getSocketCorsOrigin():
  | boolean
  | string
  | string[]
  | ((origin: string | undefined, callback: CorsCallback) => void) {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return corsOriginDelegate;
}
