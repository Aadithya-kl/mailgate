import PostalMime from 'postal-mime';

export interface Env {
  INGEST_WEBHOOK_URL: string;
  INGEST_SECRET: string;
}

const encoder = new TextEncoder();

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function signWebhookBody(secret: string, timestamp: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`));
  return toHex(new Uint8Array(sig));
}

export default {
  async fetch(): Promise<Response> {
    return new Response('OK', {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  },

  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
    if (!env.INGEST_WEBHOOK_URL || !env.INGEST_SECRET) {
      console.error('[MailGate Bridge] Missing INGEST_WEBHOOK_URL or INGEST_SECRET');
      message.setReject('Email bridge is not configured.');
      return;
    }

    try {
      const rawBuffer = await new Response(message.raw).arrayBuffer();
      const parser = new PostalMime();
      const parsed = await parser.parse(rawBuffer);

      const payload = {
        to: message.to || parsed.to?.[0]?.address || '',
        from: parsed.from?.address || message.from || '',
        from_name: parsed.from?.name || '',
        subject: parsed.subject || '(No Subject)',
        body_text: (parsed.text || '').slice(0, 180_000),
        body_html: (parsed.html || '').slice(0, 450_000),
      };

      const rawBody = JSON.stringify(payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = await signWebhookBody(env.INGEST_SECRET, timestamp, rawBody);

      const res = await fetch(env.INGEST_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ingest-Timestamp': timestamp,
          'X-Ingest-Signature': signature,
        },
        body: rawBody,
      });

      if (res.status === 403) {
        console.log(`[MailGate Bridge] Rejected non-allowlisted address: ${payload.to}`);
        message.setReject('Address is not enabled on this receive-only inbox.');
        return;
      }

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[MailGate Bridge] Upstream HTTP ${res.status}: ${errText.slice(0, 200)}`);
        message.setReject('Temporary error forwarding email to webhook receiver.');
        return;
      }

      console.log(`[MailGate Bridge] Signed & forwarded email for ${payload.to} -> HTTP ${res.status}`);
    } catch (err) {
      console.error('[MailGate Bridge] Exception:', err);
      message.setReject('Temporary processing error while parsing email.');
    }
  },
};
