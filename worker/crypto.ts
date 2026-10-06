// Dependency-free helpers (WebCrypto only) shared by the Worker and scripts/seed-admin.ts.
const enc = new TextEncoder();
const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford; 256 % 32 === 0, so no modulo bias

/** Sortable, opaque 26-char id (ULID layout). */
export function ulid(now = Date.now()): string {
  let t = now;
  let ts = "";
  for (let i = 0; i < 10; i++) {
    ts = B32[t % 32] + ts;
    t = Math.floor(t / 32);
  }
  let rs = "";
  for (const b of crypto.getRandomValues(new Uint8Array(16))) rs += B32[b % 32];
  return ts + rs;
}

export const nowIso = () => new Date().toISOString();

export function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
export function fromB64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
export const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const PIN_PATTERN = /^\d{4,8}$/;
// Sized for the Workers free plan's 10 ms CPU limit (ADR-0004); stored per user so it can be raised later.
export const PIN_ITERATIONS = 10_000;

/** PBKDF2-SHA256 over HMAC(pepper, "<userId>:<pin>"). The pepper lives only in Worker secrets / .dev.vars. */
export async function hashPin(
  pin: string,
  userId: string,
  salt: Uint8Array,
  iterations: number,
  pepper: string,
): Promise<Uint8Array> {
  const hmacKey = await crypto.subtle.importKey("raw", enc.encode(pepper), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const material = await crypto.subtle.sign("HMAC", hmacKey, enc.encode(`${userId}:${pin}`));
  const base = await crypto.subtle.importKey("raw", material, "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, base, 256);
  return new Uint8Array(bits);
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Everything needed to store a new PIN. Never returns or logs the PIN itself. */
export async function newPinRecord(pin: string, userId: string, pepper: string) {
  const salt = randomBytes(16);
  const hash = await hashPin(pin, userId, salt, PIN_ITERATIONS, pepper);
  return { pin_hash: toB64(hash), pin_salt: toB64(salt), pin_iterations: PIN_ITERATIONS };
}
