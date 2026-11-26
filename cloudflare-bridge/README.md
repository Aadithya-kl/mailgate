# MailGate Webhook Bridge (Optional)

Need to receive Cloudflare Email Routing messages on your own backend (Node.js, Go, Python, Rails, PHP, or Postgres/MySQL) instead of Cloudflare D1?

Deploy this standalone Worker as your catch-all Email Routing destination. It parses raw RFC822 MIME messages with `postal-mime` and forwards them as **HMAC-SHA256 signed JSON webhooks**.

## Setup

```bash
cd cloudflare-bridge
npm install
npx wrangler secret put INGEST_WEBHOOK_URL
npx wrangler secret put INGEST_SECRET
npm run deploy
```

Then in Cloudflare Dashboard → **Email Routing** → **Routing rules** → **Catch-all address**, send matching mail to the `mailgate-webhook-bridge` Worker.

## Webhook Contract

Every `POST` request sends:

- `Content-Type: application/json`
- `X-Ingest-Timestamp`: Unix timestamp in seconds
- `X-Ingest-Signature`: Hex-encoded `HMAC-SHA256(INGEST_SECRET, "${timestamp}.${rawBody}")`

```json
{
  "to": "otp@example.com",
  "from": "no-reply@github.com",
  "from_name": "GitHub Security",
  "subject": "Your verification code: 849201",
  "body_text": "...",
  "body_html": "..."
}
```

### Verifying the Signature (Node.js)

```js
import crypto from 'node:crypto';

export function verifyMailGateWebhook(secret, timestamp, rawBody, signature) {
  const ageSec = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSec) || ageSec > 300) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

If your webhook responds with HTTP `403`, the Worker rejects the email at the SMTP layer via `message.setReject(...)`.
