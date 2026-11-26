/**
 * OTP & verification link extraction plus defensive HTML sanitization.
 */

export function stripHtmlToText(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeEmailHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<applet[\s\S]*?<\/applet>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '')
    .replace(/<(embed|base|meta|link|input|textarea|button|frame|frameset)[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/@import\s+[^;]+;/gi, '')
    .replace(/url\(\s*["']?\s*https?:\/\/[^)]+\)/gi, '')
    .replace(/expression\s*\([^)]*\)/gi, '')
    .replace(
      /(href|src|action|formaction)\s*=\s*(["'])\s*(?:javascript|vbscript|data\s*:\s*text\/html):[^"']*\2/gi,
      '$1=$2#$2'
    );
}

function isLikelyYear(code: string): boolean {
  if (code.length !== 4) return false;
  const n = Number(code);
  return n >= 1990 && n <= 2035;
}

export function extractOtpCode(subject: string, bodyText: string, bodyHtml = ''): string | null {
  const plainBody = bodyText?.trim() ? bodyText : stripHtmlToText(bodyHtml);
  const combined = `${subject}\n${plainBody}`;

  // 1. Explicit OTP / verification keyword patterns (English & Indonesian)
  const keywordPatterns: RegExp[] = [
    /(?:verification\s+code|security\s+code|one-time\s+(?:code|passcode|password|token|pin)|login\s+(?:code|token)|confirmation\s+code|passcode|otp(?:\s+code)?|pin\s+code|kode\s+(?:verifikasi|otp|keamanan|masuk|login|konfirmasi))(?:[\s:=\-–—]+(?:is|are|adalah|yaitu|anda|your|berikut|ini)?)*[\s:=\-–—]*(\d{3}[-\s]\d{3}|\d{4,8})\b/i,
    /\b(\d{3}[-\s]\d{3}|\d{4,8})\b[^\n]{0,40}(?:is\s+your\s+(?:verification|security|login|otp|confirmation)|expires\s+in|adalah\s+kode|berlaku\s+selama)/i,
  ];

  for (const regex of keywordPatterns) {
    const match = combined.match(regex);
    if (match?.[1]) {
      const normalized = match[1].replace(/[-\s]/g, '');
      if (!isLikelyYear(normalized)) {
        return normalized;
      }
    }
  }

  // 2. 6-digit or 3-3 hyphenated code in the subject line
  const subjectSix = subject.match(/\b(\d{3}[-\s]\d{3}|\d{6})\b/);
  if (subjectSix?.[1]) {
    return subjectSix[1].replace(/[-\s]/g, '');
  }

  // 3. Standalone line containing 4-8 digits (common in transactional OTP templates)
  const standaloneLine = plainBody.match(/^\s*(\d{3}[-\s]\d{3}|\d{4,8})\s*$/m);
  if (standaloneLine?.[1]) {
    const normalized = standaloneLine[1].replace(/[-\s]/g, '');
    if (!isLikelyYear(normalized)) {
      return normalized;
    }
  }

  return null;
}

export function extractVerificationLink(bodyText: string, bodyHtml = ''): string | null {
  const sources = [bodyText || '', bodyHtml || ''];
  const urlRegex = /https?:\/\/[^\s"'<>()]+/gi;
  const priorityKeywords = /(verify|login|signin|sign-in|magic|confirm|auth|token|activate|callback|reset)/i;
  const ignoredDomains = /(unsubscribe|privacy|terms|twitter\.com|x\.com|facebook\.com|instagram\.com|linkedin\.com)/i;

  let fallbackUrl: string | null = null;
  for (const src of sources) {
    const matches = src.match(urlRegex) || [];
    for (const raw of matches) {
      const clean = raw.replace(/[.,;!?]+$/, '');
      if (ignoredDomains.test(clean)) {
        continue;
      }
      if (priorityKeywords.test(clean)) {
        return clean;
      }
      if (!fallbackUrl && clean.length > 24) {
        fallbackUrl = clean;
      }
    }
  }
  return fallbackUrl;
}

export function buildPreview(bodyText: string, bodyHtml: string, maxLength = 128): string {
  const raw = (bodyText?.trim() ? bodyText : stripHtmlToText(bodyHtml))
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return 'No message preview available.';
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength - 1).trimEnd()}…`;
}
