export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public data: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

let onUnauthorized: () => void = () => {};
/** Called when a signed-in request comes back 401 (expired session, user deactivated). */
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const write = method !== "GET";
  const res = await fetch(`/api${path}`, {
    method,
    headers: write ? { "content-type": "application/json" } : undefined,
    body: write ? JSON.stringify(opts.body ?? {}) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith("/login") && path !== "/me") onUnauthorized();
    throw new ApiError(res.status, String(data.error ?? "error"), data);
  }
  return data as T;
}
