import { getApiBaseUrl } from './baseUrl';

export type ApiErrorShape = { error?: string; details?: unknown };

export class ApiError extends Error {
  status: number;
  url: string;
  body: unknown;

  constructor(opts: { message: string; status: number; url: string; body: unknown }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.url = opts.url;
    this.body = opts.body;
  }
}

export type AuthTokenProvider = () => Promise<string | null> | string | null;

let authTokenProvider: AuthTokenProvider | null = null;
export function setAuthTokenProvider(provider: AuthTokenProvider | null) {
  authTokenProvider = provider;
}

async function getAuthHeader(): Promise<string | undefined> {
  const token = await authTokenProvider?.();
  if (!token) return undefined;
  return `Bearer ${token}`;
}

export async function apiFetchJson<T>(
  path: string,
  init?: RequestInit & { baseUrl?: string; timeoutMs?: number }
): Promise<T> {
  const baseUrl = init?.baseUrl ?? getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  const auth = await getAuthHeader();
  const headers = new Headers(init?.headers ?? undefined);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (auth && !headers.has('Authorization')) headers.set('Authorization', auth);

  const { timeoutMs, ...fetchInit } = init ?? {};
  const controller = !fetchInit.signal && timeoutMs ? new AbortController() : undefined;
  const timeoutId =
    controller && timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

  let res: Response;
  try {
    res = await fetch(url, {
      ...fetchInit,
      headers,
      signal: controller?.signal ?? fetchInit.signal,
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const msg =
      (typeof body === 'object' && body && 'error' in body && typeof (body as ApiErrorShape).error === 'string'
        ? (body as ApiErrorShape).error
        : `Request failed: ${res.status}`);
    throw new ApiError({ message: msg, status: res.status, url, body });
  }

  return body as T;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

