import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSimulatedRfc822,
  ingestRawEmail,
  isValidEmailFormat,
  normalizeEmailAddress,
} from '../src/lib/email-ingest.ts';
import { handlePublicApi } from '../src/routes/public.ts';
import type { AllowedInboxRow, Env, MessageRow } from '../src/types.ts';

/**
 * Minimal in-memory D1 mock sufficient to exercise ingestRawEmail and /api/inbox/* routes.
 */
function createMockEnv(initialInboxes: Partial<AllowedInboxRow>[] = []): {
  env: Env;
  inboxes: AllowedInboxRow[];
  messages: MessageRow[];
} {
  const inboxes: AllowedInboxRow[] = initialInboxes.map((row, idx) => ({
    id: row.id ?? idx + 1,
    email_address: (row.email_address ?? '').toLowerCase(),
    label: row.label ?? '',
    password_hash: row.password_hash ?? null,
    is_active: row.is_active ?? 1,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  }));
  const messages: MessageRow[] = [];

  const mockDb = {
    prepare(sql: string) {
      let bindings: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          bindings = args;
          return stmt;
        },
        async first<T>() {
          const normSql = sql.replace(/\s+/g, ' ').trim();
          if (normSql.includes('FROM allowed_inboxes WHERE email_address = ?1')) {
            const email = String(bindings[0]).toLowerCase();
            return (inboxes.find((i) => i.email_address === email) ?? null) as T | null;
          }
          if (normSql.includes('FROM messages') && normSql.includes('otp_code IS NOT NULL')) {
            const email = String(bindings[0]).toLowerCase();
            let matches = messages.filter((m) => m.recipient_email === email && m.otp_code !== null);
            let idx = 1;
            if (normSql.includes('received_at >=')) {
              const since = String(bindings[idx++]);
              matches = matches.filter((m) => m.received_at >= since);
            }
            if (normSql.includes('LOWER(sender) LIKE')) {
              const needle = String(bindings[idx++]).replace(/^%|%$/g, '').toLowerCase();
              matches = matches.filter((m) => m.sender.toLowerCase().includes(needle));
            }
            matches.sort((a, b) => b.received_at.localeCompare(a.received_at));
            return (matches[0] ?? null) as T | null;
          }
          if (normSql.includes('FROM messages WHERE id = ?1')) {
            const id = String(bindings[0]);
            return (messages.find((m) => m.id === id) ?? null) as T | null;
          }
          return null;
        },
        async all<T>() {
          const normSql = sql.replace(/\s+/g, ' ').trim();
          if (normSql.includes('FROM messages') && normSql.includes('recipient_email = ?1')) {
            const email = String(bindings[0]).toLowerCase();
            const matches = messages
              .filter((m) => m.recipient_email === email)
              .sort((a, b) => b.received_at.localeCompare(a.received_at));
            return { results: matches as unknown as T[] };
          }
          return { results: [] as T[] };
        },
        async run() {
          const normSql = sql.replace(/\s+/g, ' ').trim();
          if (normSql.startsWith('INSERT INTO messages')) {
            messages.push({
              id: String(bindings[0]),
              recipient_email: String(bindings[1]).toLowerCase(),
              sender: String(bindings[2]),
              sender_name: String(bindings[3]),
              subject: String(bindings[4]),
              body_text: String(bindings[5]),
              body_html: String(bindings[6]),
              otp_code: bindings[7] ? String(bindings[7]) : null,
              is_read: 0,
              received_at: String(bindings[8]),
            });
            return { meta: { changes: 1 } };
          }
          if (normSql.startsWith('UPDATE messages SET is_read = 1')) {
            const m = messages.find((row) => row.id === String(bindings[0]));
            if (m) m.is_read = 1;
            return { meta: { changes: m ? 1 : 0 } };
          }
          return { meta: { changes: 0 } };
        },
      };
      return stmt;
    },
  };

  const env: Env = {
    DB: mockDb as unknown as D1Database,
    ASSETS: { fetch: async () => new Response('ok') } as unknown as Fetcher,
    MAIL_DOMAIN: 'example.com',
    STRICT_ALLOWLIST: 'true',
    RETENTION_DAYS: '14',
    ALLOW_SIMULATE: 'true',
    ADMIN_TOKEN: 'test-admin-token',
    SESSION_SECRET: 'test-session-secret',
  };

  return { env, inboxes, messages };
}

test('normalizeEmailAddress and isValidEmailFormat handle angle brackets and mailto prefixes', () => {
  assert.equal(normalizeEmailAddress('  "QA User" <OTP@Example.COM> '), 'otp@example.com');
  assert.equal(normalizeEmailAddress('mailto:Verify@Example.com'), 'verify@example.com');
  assert.equal(isValidEmailFormat('otp@example.com'), true);
  assert.equal(isValidEmailFormat('not-an-email'), false);
});

test('ingestRawEmail rejects non-allowlisted recipients when STRICT_ALLOWLIST=true', async () => {
  const { env } = createMockEnv([{ email_address: 'allowed@example.com', is_active: 1 }]);
  const raw = buildSimulatedRfc822({
    to: 'blocked@example.com',
    from: 'no-reply@acme.dev',
    subject: 'Code 112233',
    bodyText: 'Your verification code is 112233',
  });

  const result = await ingestRawEmail(env, raw, 'blocked@example.com', 'no-reply@acme.dev');
  assert.equal(result.stored, false);
  assert.equal(result.reason, 'not_allowlisted');
});

test('ingestRawEmail parses RFC822 MIME, extracts OTP & link, and exposes them via /api/inbox/latest-otp', async () => {
  const { env } = createMockEnv([{ email_address: 'e2e@example.com', is_active: 1 }]);
  const beforeIso = new Date(Date.now() - 1000).toISOString();

  const raw = buildSimulatedRfc822({
    to: 'e2e@example.com',
    from: 'auth@acme.dev',
    fromName: 'Acme Auth',
    subject: 'Sign in to Acme',
    bodyText: 'Your verification code is 628-491.\n\nOr sign in directly: https://acme.dev/auth/verify?token=xyz987',
  });

  const stored = await ingestRawEmail(env, raw, 'e2e@example.com', 'auth@acme.dev');
  assert.equal(stored.stored, true);
  assert.equal(stored.otpCode, '628491');

  const req = new Request(
    `https://mailgate.test/api/inbox/latest-otp?email=e2e@example.com&since=${encodeURIComponent(beforeIso)}&sender=acme.dev`
  );
  const res = await handlePublicApi(req, env, '/api/inbox/latest-otp');
  assert.ok(res);
  assert.equal(res.status, 200);

  const json = (await res.json()) as {
    ok: boolean;
    found: boolean;
    otpCode: string | null;
    verificationLink: string | null;
    message: { sender: string } | null;
  };
  assert.equal(json.ok, true);
  assert.equal(json.found, true);
  assert.equal(json.otpCode, '628491');
  assert.equal(json.verificationLink, 'https://acme.dev/auth/verify?token=xyz987');
  assert.equal(json.message?.sender, 'auth@acme.dev');
});
