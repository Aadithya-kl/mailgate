import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../sdk/cli.mjs');

function startCliMockServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    res.writeHead(200, { 'Content-Type': 'application/json' });

    if (url.pathname === '/api/inbox/latest-otp') {
      return res.end(
        JSON.stringify({
          ok: true,
          found: true,
          otpCode: '918273',
          verificationLink: 'https://app.example.com/magic?t=cli',
          message: { id: 'c1', sender: 'auth@example.com', subject: 'Code 918273', received_at: new Date().toISOString() },
        })
      );
    }
    if (url.pathname === '/api/inbox/messages') {
      return res.end(
        JSON.stringify({
          ok: true,
          email: url.searchParams.get('email'),
          messages: [{ id: 'c1', subject: 'Sign in', sender: 'auth@example.com', received_at: new Date().toISOString() }],
        })
      );
    }
    if (url.pathname === '/api/inbox/messages/c1') {
      return res.end(
        JSON.stringify({
          ok: true,
          message: {
            id: 'c1',
            subject: 'Sign in',
            body_text: 'https://app.example.com/magic?t=cli',
            body_html: '',
            otp_code: '918273',
            verification_link: 'https://app.example.com/magic?t=cli',
            received_at: new Date().toISOString(),
          },
        })
      );
    }
    return res.end(JSON.stringify({ ok: true }));
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

test('CLI `otp` and `link` commands output raw OTP and magic link cleanly to stdout', async () => {
  const srv = await startCliMockServer();
  try {
    const otpOut = await execFileAsync(process.execPath, [
      CLI_PATH,
      'otp',
      'qa@example.com',
      '--url',
      srv.baseUrl,
      '--timeout',
      '2000',
    ]);
    assert.equal(otpOut.stdout.trim(), '918273');

    const linkOut = await execFileAsync(process.execPath, [
      CLI_PATH,
      'link',
      'qa@example.com',
      '--url',
      srv.baseUrl,
      '--subject',
      'Sign in',
      '--timeout',
      '2000',
    ]);
    assert.equal(linkOut.stdout.trim(), 'https://app.example.com/magic?t=cli');
  } finally {
    await srv.close();
  }
});
