import type {
  FullMessage,
  LatestOtpResponse,
  MailGateClient,
  WaitForEmailOptions,
  WaitForOtpOptions,
} from './index.d.ts';

export interface ScopedMailGateHelper {
  readonly client: MailGateClient;
  readonly startedAt: Date;
  waitForOtp(
    opts?: Partial<WaitForOtpOptions>
  ): Promise<LatestOtpResponse & { found: true; otpCode: string }>;
  waitForEmail(opts?: Partial<WaitForEmailOptions>): Promise<FullMessage>;
}

export interface CreateMailGateTestOptions {
  baseUrl?: string;
  adminToken?: string;
  defaultEmail?: string;
  defaultPassword?: string;
  clearBeforeEach?: boolean;
}

export function createInboxHelper(
  client: MailGateClient,
  defaults?: { defaultEmail?: string; defaultPassword?: string; startedAt?: Date }
): ScopedMailGateHelper;

export function createMailGateTest<T extends { extend: (...args: any[]) => any }>(
  baseTest: T,
  options?: CreateMailGateTestOptions
): ReturnType<T['extend']>;
