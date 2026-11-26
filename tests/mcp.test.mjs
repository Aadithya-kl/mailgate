import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import readline from 'node:readline';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../sdk/cli.mjs');

function startMockServer() {
  let lastAdminToken = '';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };

    if (url.pathname === '/api/health') {
      return send(200, { ok: true, service: 'mailgate', version: '1.1.0', timestamp: new Date().toISOString() });
    }
    if (url.pathname === '/api/inbox/latest-otp') {
      return send(200, {
        ok: true,
        found: true,
        otpCode: '551209',
        verificationLink: 'https://app.example.com/verify?t=mcp123',
        message: {
          id: 'm1',
          recipient_email: url.searchParams.get('email'),
          sender: 'auth@example.com',
          sender_name: 'Auth',
          subject: 'Your code is 551209',
          received_at: new Date().toISOString(),
        },
      });
    }
    if (url.pathname === '/api/inbox/messages') {
      return send(200, {
        ok: true,
        email: url.searchParams.get('email'),
        messages: [
          {
            id: 'm2',
            recipient_email: url.searchParams.get('email'),
            sender: 'auth@example.com',
            sender_name: 'Auth',
            subject: 'Sign in link',
            preview: 'Open link',
            otp_code: null,
            is_read: false,
            received_at: new Date().toISOString(),
          },
        ],
      });
    }
    if (url.pathname === '/api/inbox/messages/m2') {
      return send(200, {
        ok: true,
        message: {
          id: 'm2',
          recipient_email: 'qa@example.com',
          sender: 'auth@example.com',
          sender_name: 'Auth',
          subject: 'Sign in link',
          body_text: 'Open https://app.example.com/magic?tok=abc',
          body_html: '',
          otp_code: null,
          verification_link: 'https://app.example.com/magic?tok=abc',
          is_read: true,
          received_at: new Date().toISOString(),
        },
      });
    }
    if (url.pathname === '/api/admin/simulate' && req.method === 'POST') {
      lastAdminToken = String(req.headers['x-admin-token'] || '');
      return send(201, {
        ok: true,
        result: { stored: true, id: 'sim-1', recipientEmail: 'qa@example.com', otpCode: '334455' },
      });
    }
    return send(404, { ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        getLastAdminToken: () => lastAdminToken,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

test('MailGate MCP stdio server handles initialize, tools/list, and tools/call end-to-end', async () => {
  const srv = await startMockServer();
  const child = spawn(process.execPath, [CLI_PATH, 'mcp'], {
    env: {
      ...process.env,
      MAILGATE_URL: srv.baseUrl,
      MAILGATE_ADMIN_TOKEN: 'adm-secret-token',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const rl = readline.createInterface({ input: child.stdout });
  const pending = new Map();

  rl.on('line', (line) => {
    const msg = JSON.parse(line);
    const waiter = pending.get(msg.id);
    if (waiter) {
      pending.delete(msg.id);
      waiter(msg);
    }
  });

  const rpc = (id, method, params = {}) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`MCP timeout for ${method}`)), 4000);
      pending.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });

  try {
    const init = await rpc(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } });
    assert.equal(init.result.serverInfo.name, 'mailgate-mcp');
    assert.ok(init.result.capabilities.tools);

    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

    const list = await rpc(2, 'tools/list');
    const names = list.result.tools.map((t) => t.name);
    assert.equal(names.length, 7);
    assert.ok(names.includes('mailgate_wait_for_otp'));
    assert.ok(names.includes('mailgate_wait_for_email'));

    const otpCall = await rpc(3, 'tools/call', {
      name: 'mailgate_wait_for_otp',
      arguments: { email: 'qa@example.com', timeoutMs: 2000, pollIntervalMs: 20 },
    });
    assert.equal(otpCall.result.isError, undefined);
    const otpData = JSON.parse(otpCall.result.content[0].text);
    assert.equal(otpData.otpCode, '551209');
    assert.equal(otpData.verificationLink, 'https://app.example.com/verify?t=mcp123');

    const emailCall = await rpc(4, 'tools/call', {
      name: 'mailgate_wait_for_email',
      arguments: { email: 'qa@example.com', subjectIncludes: 'sign in', timeoutMs: 2000, pollIntervalMs: 20 },
    });
    const emailData = JSON.parse(emailCall.result.content[0].text);
    assert.equal(emailData.verification_link, 'https://app.example.com/magic?tok=abc');

    const simCall = await rpc(5, 'tools/call', {
      name: 'mailgate_simulate_email',
      arguments: { to: 'qa@example.com' },
    });
    assert.equal(srv.getLastAdminToken(), 'adm-secret-token');
    assert.equal(JSON.parse(simCall.result.content[0].text).result.otpCode, '334455');

    const badCall = await rpc(6, 'tools/call', {
      name: 'mailgate_wait_for_otp',
      arguments: {},
    });
    assert.equal(badCall.result.isError, true);
  } finally {
    child.stdin.end();
    child.kill();
    rl.close();
    await srv.close();
  }
});
