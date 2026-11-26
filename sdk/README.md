# `mailgate-sdk`

Zero-dependency JavaScript/TypeScript client SDK for [MailGate](https://github.com/Dicka18/mailgate) — a self-hosted, receive-only OTP & email inbox on Cloudflare Workers + D1. Built for Playwright, Cypress, Vitest, and CI/CD authentication tests.

## Install

```bash
npm install -D mailgate-sdk
```

## Quick Example (Playwright)

```ts
import { test, expect } from '@playwright/test';
import { MailGateClient } from 'mailgate-sdk';

const mailgate = new MailGateClient({
  baseUrl: process.env.MAILGATE_URL!, // e.g. https://mailgate.example.com
  adminToken: process.env.MAILGATE_ADMIN_TOKEN,
});

test('sign in with email OTP', async ({ page }) => {
  const email = 'e2e-login@example.com';
  const startedAt = new Date();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();

  const { otpCode } = await mailgate.waitForOtp({
    email,
    since: startedAt,
    sender: 'no-reply@yourapp.com',
    timeoutMs: 30_000,
  });

  await page.getByLabel('Verification code').fill(otpCode);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL('/dashboard');
});
```

## Waiting for Magic Links

```ts
const msg = await mailgate.waitForEmail({
  email: 'e2e-magic@example.com',
  since: startedAt,
  subjectIncludes: 'Sign in',
});

await page.goto(msg.verification_link!);
```

## API Surface

- `client.health()`
- `client.checkInbox(email)`
- `client.openInbox(email, password?)`
- `client.listMessages({ email, password?, since?, sender?, limit? })`
- `client.getMessage(id, { email, password? })`
- `client.getLatestOtp({ email, password?, since?, sender? })`
- `client.waitForOtp({ email, password?, since?, sender?, timeoutMs?, pollIntervalMs?, signal? })`
- `client.waitForEmail({ email, password?, since?, sender?, subjectIncludes?, timeoutMs?, pollIntervalMs?, signal? })`
- Admin helpers (`adminToken` required): `createInbox()`, `deleteInbox()`, `clearMessages()`, `simulateEmail()`
