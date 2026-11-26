-- Local development seed data for `npm run db:seed:local`
-- Password-protected inboxes can be created or updated from the Admin Panel or API.

INSERT OR IGNORE INTO allowed_inboxes (email_address, label, password_hash, is_active)
VALUES
  ('otp@example.com', 'CI / E2E OTP Inbox (Open)', NULL, 1),
  ('billing@example.com', 'Billing & Receipts', NULL, 1);

INSERT OR IGNORE INTO messages (
  id, recipient_email, sender, sender_name, subject, body_text, body_html, otp_code, is_read, received_at
) VALUES
  (
    'seed-msg-001',
    'otp@example.com',
    'no-reply@github.com',
    'GitHub Security',
    '[GitHub] Your sign-in verification code: 849201',
    'Hi,\n\nUse the verification code below to complete your sign-in:\n\n849201\n\nThis code expires in 10 minutes. If you did not request this code, you can safely ignore this email.',
    '<div style="font-family:sans-serif;max-width:520px;line-height:1.6;color:#1f2937"><h2 style="margin:0 0 12px">Verify your sign-in</h2><p>Use this one-time code to continue:</p><p style="font-size:28px;font-weight:700;letter-spacing:0.18em;padding:14px 18px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;display:inline-block">849201</p><p style="font-size:13px;color:#64748b">Expires in 10 minutes. Never share this code with anyone.</p></div>',
    '849201',
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 minutes')
  ),
  (
    'seed-msg-002',
    'otp@example.com',
    'auth@acme.dev',
    'Acme Cloud Auth',
    'Your one-time login link & code 417-932',
    'Enter verification code 417-932 or click the magic sign-in link below:\n\nhttps://app.acme.dev/auth/verify?token=tok_demo_9a812c4\n\nRequest ID: req-9a812c4',
    '<div style="font-family:sans-serif;max-width:520px;line-height:1.6;color:#1f2937"><p>Enter verification code <strong>417-932</strong> or continue directly with your magic link:</p><p><a href="https://app.acme.dev/auth/verify?token=tok_demo_9a812c4" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600">Sign in to Acme Cloud</a></p><p style="font-size:12px;color:#64748b">Request ID: req-9a812c4</p></div>',
    '417932',
    0,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-18 minutes')
  ),
  (
    'seed-msg-003',
    'billing@example.com',
    'receipts@stripe.com',
    'Stripe Billing',
    'Payment receipt #INV-2026-041',
    'We received your payment of $29.00 for your monthly developer plan.\n\nInvoice: INV-2026-041\nStatus: Paid.',
    '<div style="font-family:sans-serif;max-width:520px;line-height:1.6;color:#1f2937"><h3 style="margin:0 0 8px">Payment Received</h3><p>Your payment of <strong>$29.00</strong> has been recorded.</p><p style="font-size:13px;color:#64748b">Invoice: INV-2026-041</p></div>',
    NULL,
    1,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-3 hours')
  );
