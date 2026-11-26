import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCookie,
  constantTimeEqual,
  hashPassword,
  parseCookies,
  signToken,
  signWebhookBody,
  verifyPassword,
  verifyToken,
  verifyWebhookSignature,
} from '../src/lib/crypto.ts';

test('hashPassword and verifyPassword round-trip with PBKDF2-SHA256', async () => {
  const hash = await hashPassword('s3cur3-inbox-pass');
  assert.ok(hash.startsWith('pbkdf2$100000$'));
  assert.equal(await verifyPassword('s3cur3-inbox-pass', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  assert.equal(await verifyPassword('s3cur3-inbox-pass', 'malformed$hash'), false);
});

test('signToken and verifyToken enforce signature integrity and expiration', async () => {
  const secret = 'test-session-secret-with-plenty-of-entropy-12345';
  const exp = Math.floor(Date.now() / 1000) + 300;
  const token = await signToken({ scope: 'inbox', sub: 'otp@example.com', exp }, secret);

  const verified = await verifyToken(token, secret);
  assert.deepEqual(verified, { scope: 'inbox', sub: 'otp@example.com', exp });

  // Wrong secret
  assert.equal(await verifyToken(token, 'wrong-secret'), null);

  // Tampered payload
  const [, sig] = token.split('.');
  const fakePayload = Buffer.from(JSON.stringify({ scope: 'admin', sub: 'owner', exp })).toString('base64url');
  assert.equal(await verifyToken(`${fakePayload}.${sig}`, secret), null);

  // Expired token
  const expiredToken = await signToken({ scope: 'inbox', sub: 'otp@example.com', exp: 1000 }, secret);
  assert.equal(await verifyToken(expiredToken, secret), null);
});

test('signWebhookBody and verifyWebhookSignature validate HMAC-SHA256 and clock drift', async () => {
  const secret = 'webhook-shared-secret';
  const ts = String(Math.floor(Date.now() / 1000));
  const rawBody = JSON.stringify({ to: 'otp@example.com', subject: 'Code 123456' });

  const sig = await signWebhookBody(secret, ts, rawBody);
  assert.equal(await verifyWebhookSignature(secret, ts, rawBody, sig), true);
  assert.equal(await verifyWebhookSignature(secret, ts, rawBody + ' ', sig), false);
  assert.equal(await verifyWebhookSignature('other-secret', ts, rawBody, sig), false);

  // Stale timestamp (> 300s old)
  const oldTs = String(Math.floor(Date.now() / 1000) - 600);
  const oldSig = await signWebhookBody(secret, oldTs, rawBody);
  assert.equal(await verifyWebhookSignature(secret, oldTs, rawBody, oldSig, 300), false);
});

test('constantTimeEqual, parseCookies, and buildCookie enforce secure defaults', () => {
  assert.equal(constantTimeEqual('abc', 'abc'), true);
  assert.equal(constantTimeEqual('abc', 'abd'), false);
  assert.equal(constantTimeEqual('abc', 'abcd'), false);

  const cookie = buildCookie('mg_admin', 'tok.sig', { maxAge: 3600, isSecure: true });
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('SameSite=Strict'));
  assert.ok(cookie.includes('Secure'));

  const parsed = parseCookies('foo=bar; mg_admin=tok.sig; encoded=a%20b');
  assert.equal(parsed.mg_admin, 'tok.sig');
  assert.equal(parsed.encoded, 'a b');
});
