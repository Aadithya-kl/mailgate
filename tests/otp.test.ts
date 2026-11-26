import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPreview,
  extractOtpCode,
  extractVerificationLink,
  sanitizeEmailHtml,
  stripHtmlToText,
} from '../src/lib/otp.ts';

test('extractOtpCode extracts 6-digit English verification code', () => {
  const otp = extractOtpCode(
    'Your verification code',
    'Hello, your verification code is 849201 and expires in 10 minutes.'
  );
  assert.equal(otp, '849201');
});

test('extractOtpCode extracts hyphenated 3-3 OTP code and strips separator', () => {
  const otp = extractOtpCode(
    'One-time login token',
    'Enter one-time token 417-932 to sign in.'
  );
  assert.equal(otp, '417932');
});

test('extractOtpCode extracts Indonesian verification code', () => {
  const otp = extractOtpCode(
    'Kode Verifikasi Masuk',
    'Gunakan kode verifikasi Anda adalah 590412 untuk melanjutkan.'
  );
  assert.equal(otp, '590412');
});

test('extractOtpCode matches short "is" connector without requiring expiry text', () => {
  assert.equal(
    extractOtpCode('Sign in to Acme', 'Your verification code is 628-491.'),
    '628491'
  );
  assert.equal(
    extractOtpCode('Policy update', 'Our verification code policy changed for order 998123.'),
    null
  );
});

test('extractOtpCode falls back to standalone line in HTML-only body', () => {
  const otp = extractOtpCode(
    'Sign in request',
    '',
    '<div><p>Please copy the code below:</p><p>918273</p><p>Valid for 5 minutes.</p></div>'
  );
  assert.equal(otp, '918273');
});

test('extractOtpCode ignores calendar years in receipts and newsletters', () => {
  const otp = extractOtpCode(
    'Invoice #INV-2026-041',
    'Copyright 2026 Acme Corp. Your monthly payment was received on 2025.'
  );
  assert.equal(otp, null);
});

test('extractVerificationLink prioritizes auth/verify URLs and ignores unsubscribe links', () => {
  const body = `
    Click to sign in: https://app.acme.dev/auth/verify?token=abc123456.
    Unsubscribe: https://app.acme.dev/unsubscribe?id=999
    Follow us: https://x.com/acmedev
  `;
  assert.equal(
    extractVerificationLink(body),
    'https://app.acme.dev/auth/verify?token=abc123456'
  );
});

test('sanitizeEmailHtml strips scripts, iframes, inline handlers, javascript: URLs, and remote CSS', () => {
  const dirty =
    '<div onclick="evil()" style="background:url(https://tracker.evil/px.png)">Hello<script>alert(1)</script><iframe src="https://evil.test"></iframe><a href="javascript:alert(2)">Click</a></div>';
  const clean = sanitizeEmailHtml(dirty);
  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('<iframe'));
  assert.ok(!clean.includes('onclick='));
  assert.ok(!clean.includes('javascript:'));
  assert.ok(!clean.includes('tracker.evil'));
  assert.ok(clean.includes('Hello'));
});

test('stripHtmlToText and buildPreview normalize whitespace and decode entities', () => {
  const text = stripHtmlToText('<p>Hello &amp; welcome<br/>to <strong>MailGate</strong>!</p>');
  assert.equal(text, 'Hello & welcome\nto MailGate !');
  assert.equal(buildPreview('', ''), 'No message preview available.');
  assert.equal(buildPreview('A'.repeat(200), '', 20).length, 20);
});
