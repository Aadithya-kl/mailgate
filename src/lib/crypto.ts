const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (input.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toHex(salt)}$${toHex(new Uint8Array(derived))}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') {
    return false;
  }
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 10_000 || iterations > 500_000) {
    return false;
  }
  let salt: Uint8Array;
  try {
    salt = fromHex(parts[2]);
  } catch {
    return false;
  }
  const expectedHex = parts[3];

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return constantTimeEqual(toHex(new Uint8Array(derived)), expectedHex);
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signWebhookBody(
  secret: string,
  timestamp: string,
  rawBody: string
): Promise<string> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  return toHex(new Uint8Array(sig));
}

export async function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
  maxDriftSeconds = 300
): Promise<boolean> {
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > maxDriftSeconds) return false;
  const expected = await signWebhookBody(secret, timestamp, rawBody);
  return constantTimeEqual(expected, signature.trim().toLowerCase());
}

export interface SignedPayload {
  scope: 'inbox' | 'admin';
  sub: string;
  exp: number;
}

export async function signToken(payload: SignedPayload, secret: string): Promise<string> {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifyToken(token: string, secret: string): Promise<SignedPayload | null> {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);
  if (!sigPart) return null;

  try {
    const key = await importHmacKey(secret);
    const sigBytes = fromBase64Url(sigPart);
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(body));
    if (!ok) return null;

    const parsed = JSON.parse(decoder.decode(fromBase64Url(body))) as SignedPayload;
    if (!parsed || typeof parsed.exp !== 'number' || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) {
      try {
        map[key] = decodeURIComponent(value);
      } catch {
        map[key] = value;
      }
    }
  }
  return map;
}

export function buildCookie(
  name: string,
  value: string,
  options: { maxAge: number; isSecure: boolean; path?: string }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? '/'}`,
    `Max-Age=${options.maxAge}`,
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (options.isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
