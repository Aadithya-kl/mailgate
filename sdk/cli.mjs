#!/usr/bin/env node
/**
 * MailGate CLI (`npx mailgate-sdk <command>`).
 *
 * Commands:
 *   mcp                                Start the stdio MCP server (for Claude Code / Cursor)
 *   otp <email>                        Wait for the newest OTP code and print it to stdout
 *   link <email>                       Wait for a matching email and print its verification link
 *   messages <email>                   Print recent messages as JSON
 *   simulate <email>                   Inject a simulated OTP email (requires MAILGATE_ADMIN_TOKEN)
 *   clear <email>                      Delete all messages for an inbox (requires MAILGATE_ADMIN_TOKEN)
 */

import { MailGateClient } from './index.mjs';
import { startMcpServer } from './mcp.mjs';

function printHelp() {
  process.stdout.write(`mailgate-sdk CLI (v1.1.0)

Usage:
  mailgate mcp [--url <url>] [--admin-token <token>]
  mailgate otp <email> [--since <iso>] [--sender <str>] [--password <pw>] [--timeout <ms>] [--json]
  mailgate link <email> [--since <iso>] [--sender <str>] [--subject <str>] [--password <pw>] [--timeout <ms>]
  mailgate messages <email> [--limit <n>] [--password <pw>]
  mailgate simulate <email> [--from <addr>] [--subject <str>] [--body <str>]
  mailgate clear <email>

Environment variables:
  MAILGATE_URL           Base URL of your MailGate Worker (or pass --url)
  MAILGATE_ADMIN_TOKEN   Admin token for simulate/clear (or pass --admin-token)
`);
}

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else if (arg === '-h') {
      flags.help = true;
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const cmd = rawArgs[0];

  if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
    printHelp();
    return;
  }

  if (cmd === 'mcp') {
    startMcpServer(rawArgs.slice(1));
    return;
  }

  const { positionals, flags } = parseArgs(rawArgs.slice(1));
  if (flags.help) {
    printHelp();
    return;
  }

  const baseUrl = String(flags.url || process.env.MAILGATE_URL || '').trim();
  const adminToken = String(flags['admin-token'] || process.env.MAILGATE_ADMIN_TOKEN || '').trim() || undefined;
  if (!baseUrl) {
    process.stderr.write('Error: set MAILGATE_URL or pass --url https://mailgate.example.com\n');
    process.exitCode = 1;
    return;
  }

  const client = new MailGateClient({ baseUrl, adminToken });
  const email = positionals[0];
  if (!email) {
    process.stderr.write(`Error: missing <email> argument for "${cmd}".\n`);
    process.exitCode = 1;
    return;
  }

  const timeoutMs = flags.timeout ? Number(flags.timeout) : 30_000;
  const pollIntervalMs = flags.poll ? Number(flags.poll) : 1_000;

  if (cmd === 'otp') {
    const res = await client.waitForOtp({
      email,
      password: flags.password ? String(flags.password) : undefined,
      since: flags.since ? String(flags.since) : undefined,
      sender: flags.sender ? String(flags.sender) : undefined,
      timeoutMs,
      pollIntervalMs,
    });
    if (flags.json) {
      process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
    } else {
      process.stdout.write(`${res.otpCode}\n`);
    }
    return;
  }

  if (cmd === 'link') {
    const msg = await client.waitForEmail({
      email,
      password: flags.password ? String(flags.password) : undefined,
      since: flags.since ? String(flags.since) : undefined,
      sender: flags.sender ? String(flags.sender) : undefined,
      subjectIncludes: flags.subject ? String(flags.subject) : undefined,
      timeoutMs,
      pollIntervalMs,
    });
    if (!msg.verification_link) {
      process.stderr.write('Error: matching email arrived, but no verification link was detected.\n');
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`${msg.verification_link}\n`);
    return;
  }

  if (cmd === 'messages') {
    const list = await client.listMessages({
      email,
      password: flags.password ? String(flags.password) : undefined,
      limit: flags.limit ? Number(flags.limit) : 20,
    });
    process.stdout.write(`${JSON.stringify(list, null, 2)}\n`);
    return;
  }

  if (cmd === 'simulate') {
    const res = await client.simulateEmail({
      to: email,
      from: flags.from ? String(flags.from) : undefined,
      subject: flags.subject ? String(flags.subject) : undefined,
      body_text: flags.body ? String(flags.body) : undefined,
    });
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
    return;
  }

  if (cmd === 'clear') {
    const res = await client.clearMessages(email);
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
    return;
  }

  process.stderr.write(`Unknown command: ${cmd}\nRun "mailgate --help" for usage.\n`);
  process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
