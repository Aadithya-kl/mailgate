import type { Env } from '../types.ts';

export function json(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(data), { status, headers });
}

export function errorJson(
  code: string,
  message: string,
  status = 400,
  details?: Record<string, unknown>
): Response {
  return json({ ok: false, error: { code, message, ...(details ?? {}) } }, status);
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function getSessionSecret(env: Env): string {
  return env.SESSION_SECRET || env.ADMIN_TOKEN || 'mailgate-local-dev-secret-change-me';
}

export function isSecureRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === 'https:';
}
