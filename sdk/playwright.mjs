/**
 * Playwright helper for MailGate (`mailgate-sdk/playwright`).
 * Wraps `@playwright/test`'s `test` without adding Playwright as a runtime dependency.
 */

import { MailGateClient } from './index.mjs';

/**
 * Creates a scoped test-run helper that automatically timestamps `since`
 * when each test starts, so stale OTPs from previous runs are ignored.
 *
 * @param {MailGateClient} client
 * @param {{ defaultEmail?: string; defaultPassword?: string; startedAt?: Date }} [defaults]
 */
export function createInboxHelper(client, defaults = {}) {
  const startedAt = defaults.startedAt ?? new Date();

  return {
    client,
    startedAt,
    /**
     * @param {{ email?: string; password?: string; since?: Date | string | number; sender?: string; timeoutMs?: number; pollIntervalMs?: number }} [opts]
     */
    waitForOtp(opts = {}) {
      const email = opts.email ?? defaults.defaultEmail;
      if (!email) {
        throw new Error('waitForOtp requires `email` (or set `defaultEmail` in fixture options).');
      }
      return client.waitForOtp({
        ...opts,
        email,
        password: opts.password ?? defaults.defaultPassword,
        since: opts.since ?? startedAt,
      });
    },
    /**
     * @param {{ email?: string; password?: string; since?: Date | string | number; sender?: string; subjectIncludes?: string; timeoutMs?: number; pollIntervalMs?: number }} [opts]
     */
    waitForEmail(opts = {}) {
      const email = opts.email ?? defaults.defaultEmail;
      if (!email) {
        throw new Error('waitForEmail requires `email` (or set `defaultEmail` in fixture options).');
      }
      return client.waitForEmail({
        ...opts,
        email,
        password: opts.password ?? defaults.defaultPassword,
        since: opts.since ?? startedAt,
      });
    },
  };
}

/**
 * Extends Playwright's `test` object with a `mailgate` fixture.
 *
 * Example:
 *   import { test as base, expect } from '@playwright/test';
 *   import { createMailGateTest } from 'mailgate-sdk/playwright';
 *   const test = createMailGateTest(base, { defaultEmail: 'qa@example.com' });
 *
 * @template T
 * @param {T & { extend: Function }} baseTest
 * @param {{ baseUrl?: string; adminToken?: string; defaultEmail?: string; defaultPassword?: string; clearBeforeEach?: boolean }} [options]
 */
export function createMailGateTest(baseTest, options = {}) {
  return baseTest.extend({
    mailgate: async ({}, use) => {
      const baseUrl = options.baseUrl || process.env.MAILGATE_URL;
      const adminToken = options.adminToken || process.env.MAILGATE_ADMIN_TOKEN;
      if (!baseUrl) {
        throw new Error('createMailGateTest requires `options.baseUrl` or process.env.MAILGATE_URL.');
      }
      const client = new MailGateClient({ baseUrl, adminToken });
      if (options.clearBeforeEach && options.defaultEmail && adminToken) {
        await client.clearMessages(options.defaultEmail);
      }
      const helper = createInboxHelper(client, {
        defaultEmail: options.defaultEmail,
        defaultPassword: options.defaultPassword,
        startedAt: new Date(),
      });
      await use(helper);
    },
  });
}
