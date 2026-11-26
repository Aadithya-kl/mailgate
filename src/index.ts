import type { Env } from './types.ts';
import { ingestRawEmail } from './lib/email-ingest.ts';
import { errorJson } from './lib/http.ts';
import { handleAdminApi } from './routes/admin.ts';
import { handlePublicApi } from './routes/public.ts';

function withSecurityHeaders(response: Response, isHtml: boolean, isHttps: boolean): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  if (isHttps) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  if (isHtml) {
    headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; frame-src 'self' about:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  /**
   * 1. HTTP Handler: serves /api/* endpoints and static Web UI assets.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const isHttps = url.protocol === 'https:';

    if (pathname.startsWith('/api/')) {
      try {
        const publicRes = await handlePublicApi(request, env, pathname);
        if (publicRes) return withSecurityHeaders(publicRes, false, isHttps);

        const adminRes = await handleAdminApi(request, env, pathname);
        if (adminRes) return withSecurityHeaders(adminRes, false, isHttps);

        return withSecurityHeaders(
          errorJson('NOT_FOUND', 'API endpoint not found.', 404),
          false,
          isHttps
        );
      } catch (err) {
        console.error('[MailGate API Error]', err);
        return withSecurityHeaders(
          errorJson('INTERNAL_ERROR', 'Internal server error.', 500),
          false,
          isHttps
        );
      }
    }

    const assetRes = await env.ASSETS.fetch(request);
    const contentType = assetRes.headers.get('Content-Type') || '';
    return withSecurityHeaders(assetRes, contentType.includes('text/html'), isHttps);
  },

  /**
   * 2. Cloudflare Email Routing Handler (Catch-All *@example.com).
   */
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      const rawBuffer = await new Response(message.raw).arrayBuffer();
      const result = await ingestRawEmail(env, rawBuffer, message.to, message.from);

      if (!result.stored) {
        console.log(
          `[MailGate Email] Skipped ${result.recipientEmail} (reason=${result.reason ?? 'unknown'})`
        );
        if (result.reason === 'not_allowlisted') {
          message.setReject('Address is not enabled on this receive-only inbox.');
        }
        return;
      }

      console.log(
        `[MailGate Email] Stored id=${result.id} to=${result.recipientEmail} otp=${result.otpCode ?? 'none'}`
      );
    } catch (err) {
      console.error('[MailGate Email Error]', err);
      message.setReject('Temporary processing error while storing incoming message.');
    }
  },

  /**
   * 3. Scheduled Cron Handler: purges messages older than RETENTION_DAYS.
   */
  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const retentionDays = Number(env.RETENTION_DAYS ?? 14);
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      return;
    }

    const cutoffIso = new Date(Date.now() - retentionDays * 86_400_000).toISOString();
    const result = await env.DB.prepare('DELETE FROM messages WHERE received_at < ?1')
      .bind(cutoffIso)
      .run();

    console.log(
      `[MailGate Cleanup] Removed ${result.meta.changes ?? 0} messages older than ${retentionDays} days.`
    );
  },
};
