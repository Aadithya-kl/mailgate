# Contributing to MailGate

Thank you for considering contributing to MailGate! Whether you're adding OTP extraction patterns for new email templates, improving `@mailgate/sdk`, hardening HTML sanitization, or fixing docs, contributions are welcome.

## Development Setup

```bash
git clone https://github.com/Dicka18/mailgate.git
cd mailgate
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

## Verification Before Opening a PR

Run both checks locally — CI enforces them on every pull request:

```bash
npm run typecheck
npm test
```

## Guidelines

- **Keep dependencies minimal.** The Worker only depends on `postal-mime`, and `sdk/` must remain zero-dependency.
- **No external runtime CDN scripts.** All UI JavaScript must stay self-hosted to preserve the strict `Content-Security-Policy`.
- **Add regression tests.** If you fix an OTP extraction edge case or HTML sanitization bypass, add a test case in `tests/otp.test.ts`.
- **Never commit real domains, tokens, or `.dev.vars`.** Always use `example.com` and placeholder secrets in tests and docs.
