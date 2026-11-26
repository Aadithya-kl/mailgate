# Security Policy

## Supported Versions

Security fixes are applied to the latest commit on `main` and the most recent tagged release.

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities (such as HTML sanitization bypasses, authentication/token flaws, or allowlist bypasses).

Instead, please report privately via **GitHub Security Advisories** ("Report a vulnerability" under the repository's **Security** tab) with:

1. A clear description of the vulnerability and impact.
2. Minimal reproduction steps or sample RFC822 MIME payload.
3. Suggested remediation (if known).

We aim to acknowledge reports within 72 hours and coordinate disclosure once a fix is ready.

## Security Design Notes

- Email HTML is sanitized on ingest (`src/lib/otp.ts`) **and** rendered inside a sandboxed `<iframe>` (`sandbox="allow-popups allow-popups-to-escape-sandbox"`) with strict page-level CSP (`script-src 'self'`).
- Inbox passwords use WebCrypto **PBKDF2-SHA256** (100,000 iterations, random 16-byte salt).
- Session tokens and admin cookies use **HMAC-SHA256** with constant-time comparison and `HttpOnly; SameSite=Strict; Secure` flags.
- Always configure a unique random `SESSION_SECRET` and `ADMIN_TOKEN` via `wrangler secret put` in production, and consider setting `ALLOW_SIMULATE = "false"` if you do not need the email simulator in production.
