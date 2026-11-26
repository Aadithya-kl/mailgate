import PostalMime from 'postal-mime';
import type { Env } from '../types.ts';
import { extractOtpCode, sanitizeEmailHtml, stripHtmlToText } from './otp.ts';

const MAX_TEXT_CHARS = 180_000;
const MAX_HTML_CHARS = 450_000;

export function normalizeEmailAddress(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  const extracted = angleMatch ? angleMatch[1].trim() : trimmed;
  return extracted.replace(/^mailto:/, '').trim();
}

export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email);
}

export interface IngestResult {
  stored: boolean;
  reason?: string;
  id?: string;
  recipientEmail: string;
  otpCode: string | null;
}

export async function ingestRawEmail(
  env: Env,
  rawEmail: ArrayBuffer | Uint8Array | string,
  envelopeTo?: string,
  envelopeFrom?: string
): Promise<IngestResult> {
  const parser = new PostalMime();
  const parsed = await parser.parse(rawEmail);

  const recipientCandidate =
    envelopeTo ||
    parsed.to?.[0]?.address ||
    parsed.deliveredTo ||
    '';
  const recipientEmail = normalizeEmailAddress(recipientCandidate);

  if (!recipientEmail || !isValidEmailFormat(recipientEmail)) {
    return {
      stored: false,
      reason: 'invalid_recipient',
      recipientEmail,
      otpCode: null,
    };
  }

  const strictAllowlist = (env.STRICT_ALLOWLIST ?? 'true').toLowerCase() !== 'false';
  if (strictAllowlist) {
    const allowed = await env.DB.prepare(
      'SELECT id, is_active FROM allowed_inboxes WHERE email_address = ?1 LIMIT 1'
    )
      .bind(recipientEmail)
      .first<{ id: number; is_active: number }>();

    if (!allowed || allowed.is_active !== 1) {
      return {
        stored: false,
        reason: 'not_allowlisted',
        recipientEmail,
        otpCode: null,
      };
    }
  }

  const senderEmail = normalizeEmailAddress(
    parsed.from?.address || envelopeFrom || 'unknown@sender.invalid'
  );
  const senderName = (parsed.from?.name || '').trim().slice(0, 120);
  const subject = (parsed.subject || '(No Subject)').trim().slice(0, 300);

  const rawHtml = (parsed.html || '').slice(0, MAX_HTML_CHARS);
  const bodyHtml = sanitizeEmailHtml(rawHtml);
  const rawText = (parsed.text || '').trim();
  const bodyText = (rawText || stripHtmlToText(bodyHtml)).slice(0, MAX_TEXT_CHARS);

  const otpCode = extractOtpCode(subject, bodyText, bodyHtml);
  const id = crypto.randomUUID();
  const receivedAt = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO messages (
      id, recipient_email, sender, sender_name, subject, body_text, body_html, otp_code, is_read, received_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9)`
  )
    .bind(
      id,
      recipientEmail,
      senderEmail,
      senderName,
      subject,
      bodyText,
      bodyHtml,
      otpCode,
      receivedAt
    )
    .run();

  return {
    stored: true,
    id,
    recipientEmail,
    otpCode,
  };
}

export function buildSimulatedRfc822(input: {
  to: string;
  from: string;
  fromName?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
}): string {
  const boundary = `----mailgate-${crypto.randomUUID().slice(0, 8)}`;
  const fromHeader = input.fromName ? `"${input.fromName.replace(/"/g, '')}" <${input.from}>` : input.from;
  const htmlPart =
    input.bodyHtml ||
    `<div style="font-family:sans-serif;line-height:1.6;color:#1e293b">${input.bodyText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>')}</div>`;

  return [
    `From: ${fromHeader}`,
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    input.bodyText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    '',
    htmlPart,
    '',
    `--${boundary}--`,
  ].join('\r\n');
}
