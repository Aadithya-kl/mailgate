/* MailGate Web Application — Login, Full-Viewport Inbox Reader, & Admin Panel */
(() => {
  'use strict';

  const SESSION_KEY = 'mailgate_active_session_v1';
  const THEME_KEY = 'mailgate_theme';
  const POLL_INTERVAL_MS = 10_000;
  const API_BASE = window.MAILGATE_API_BASE || './api';

  const state = {
    phase: 'login', // 'login' | 'inbox' | 'admin'
    config: {
      domain: 'example.com',
      strictAllowlist: true,
      allowSimulate: true,
    },
    activeInbox: null, // { email, label, requiresPassword, token }
    messages: [],
    selectedMessageId: null,
    selectedMessage: null,
    detectedLink: null,
    searchQuery: '',
    autoRefresh: true,
    pollTimer: null,
    createRequiresPassword: false,
    editRequiresPassword: false,
    admin: {
      authenticated: false,
      activeTab: 'inboxes',
      inboxes: [],
      messages: [],
      inboxFilter: '',
      messageFilter: '',
      messageTypeFilter: 'all',
      editingInbox: null,
      readingMessage: null,
      readingLink: null,
    },
    cmdk: {
      items: [],
      activeIndex: 0,
    },
  };

  const $ = (id) => document.getElementById(id);

  const el = {
    phaseLogin: $('phase-login'),
    phaseInbox: $('phase-inbox'),
    phaseAdmin: $('phase-admin'),

    inboxForm: $('inbox-open-form'),
    inboxEmail: $('inbox-email'),
    inboxEmailHelper: $('inbox-email-helper'),
    inboxPassword: $('inbox-password'),
    inboxPasswordHelper: $('inbox-password-helper'),
    passwordModeBadge: $('password-mode-badge'),
    toggleInboxPassword: $('toggle-inbox-password'),
    inboxOpenBtn: $('inbox-open-btn'),
    inboxErrorBanner: $('inbox-error-banner'),

    activeEmail: $('active-inbox-email'),
    activeCount: $('active-inbox-count'),
    lastSyncText: $('last-sync-text'),
    inboxSearchInput: $('inbox-search-input'),
    copyAddressBtn: $('copy-address-btn'),
    autoRefreshBtn: $('auto-refresh-btn'),
    refreshInboxBtn: $('refresh-inbox-btn'),
    closeInboxBtn: $('close-inbox-btn'),
    themeSetLight: $('theme-set-light'),
    themeSetDark: $('theme-set-dark'),

    msgList: $('msg-list'),
    msgListEmpty: $('msg-list-empty'),

    readerEmpty: $('reader-empty'),
    readerContent: $('reader-content'),
    readerAvatar: $('reader-avatar'),
    readerSenderName: $('reader-sender-name'),
    readerOtpBanner: $('reader-otp-banner'),
    readerOtpCode: $('reader-otp-code'),
    readerOtpCopy: $('reader-otp-copy'),
    readerLinkBanner: $('reader-link-banner'),
    readerLinkUrl: $('reader-link-url'),
    readerLinkOpen: $('reader-link-open'),
    readerLinkCopy: $('reader-link-copy'),
    readerSubject: $('reader-subject'),
    readerFrom: $('reader-from'),
    readerTo: $('reader-to'),
    readerDate: $('reader-date'),
    readerIframe: $('reader-iframe'),

    adminBackLoginBtn: $('admin-back-login-btn'),
    adminMetaDomain: $('admin-meta-domain'),
    adminMetaInboxes: $('admin-meta-inboxes'),
    adminMetaPolicy: $('admin-meta-policy'),
    adminMetaMessages: $('admin-meta-messages'),
    adminSummaryLine: $('admin-summary-line'),
    adminRefreshBtn: $('admin-refresh-btn'),
    adminLogoutBtn: $('admin-logout-btn'),

    createInboxForm: $('create-inbox-form'),
    newInboxEmail: $('new-inbox-email'),
    newInboxLabel: $('new-inbox-label'),
    createModeOpen: $('create-mode-open'),
    createModeLocked: $('create-mode-locked'),
    newInboxPasswordWrap: $('new-inbox-password-wrap'),
    newInboxPassword: $('new-inbox-password'),
    generateNewPwBtn: $('generate-new-pw-btn'),
    createInboxFeedback: $('create-inbox-feedback'),
    createInboxBtn: $('create-inbox-btn'),

    simulatePanel: $('simulate-panel'),
    simulateForm: $('simulate-form'),
    simTo: $('sim-to'),
    simFrom: $('sim-from'),
    simSubject: $('sim-subject'),
    simBody: $('sim-body'),
    simulateFeedback: $('simulate-feedback'),
    simulateBtn: $('simulate-btn'),

    tabCountInboxes: $('tab-count-inboxes'),
    tabCountMessages: $('tab-count-messages'),

    adminInboxesTbody: $('admin-inboxes-tbody'),
    adminInboxSearch: $('admin-inbox-search'),
    exportInboxesCsvBtn: $('export-inboxes-csv-btn'),

    adminMessagesTbody: $('admin-messages-tbody'),
    adminMsgSearch: $('admin-msg-search'),
    exportCsvBtn: $('export-csv-btn'),

    adminReadDialog: $('admin-read-dialog'),
    adminReadSubject: $('admin-read-subject'),
    adminReadRecipientChip: $('admin-read-recipient-chip'),
    adminReadClose: $('admin-read-close'),
    adminReadDone: $('admin-read-done'),
    adminReadDelete: $('admin-read-delete'),
    adminReadAvatar: $('admin-read-avatar'),
    adminReadSenderName: $('admin-read-sender-name'),
    adminReadFrom: $('admin-read-from'),
    adminReadTo: $('admin-read-to'),
    adminReadDate: $('admin-read-date'),
    adminReadOtpBanner: $('admin-read-otp-banner'),
    adminReadOtpCode: $('admin-read-otp-code'),
    adminReadOtpCopy: $('admin-read-otp-copy'),
    adminReadLinkBanner: $('admin-read-link-banner'),
    adminReadLinkUrl: $('admin-read-link-url'),
    adminReadLinkOpen: $('admin-read-link-open'),
    adminReadLinkCopy: $('admin-read-link-copy'),
    adminReadIframe: $('admin-read-iframe'),

    cmdkDialog: $('cmdk-dialog'),
    cmdkInput: $('cmdk-input'),
    cmdkResults: $('cmdk-results'),

    editDialog: $('edit-inbox-dialog'),
    editForm: $('edit-inbox-form'),
    editDialogEmail: $('edit-dialog-email'),
    editLabelInput: $('edit-label-input'),
    editModeOpen: $('edit-mode-open'),
    editModeLocked: $('edit-mode-locked'),
    editPasswordWrap: $('edit-password-wrap'),
    editPasswordInput: $('edit-password-input'),
    generateEditPwBtn: $('generate-edit-pw-btn'),
    editDialogError: $('edit-dialog-error'),
    editDialogClose: $('edit-dialog-close'),
    editDialogCancel: $('edit-dialog-cancel'),
    editDialogSave: $('edit-dialog-save'),

    toastRegion: $('toast-region'),
  };

  /* ============================================================
   * HELPERS
   * ============================================================ */

  function persistActiveSession(inbox) {
    try {
      if (inbox) sessionStorage.setItem(SESSION_KEY, JSON.stringify(inbox));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore storage errors
    }
  }

  function readPersistedSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed.email === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  function generateRandomPassword(len = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < len; i += 1) out += chars[bytes[i] % chars.length];
    return out;
  }

  function extractVerificationLink(bodyText, bodyHtml) {
    const sources = [bodyText || '', bodyHtml || ''];
    const urlRegex = /https?:\/\/[^\s"'<>()]+/gi;
    const priority = /(verify|login|signin|sign-in|magic|confirm|auth|token|activate|callback|reset)/i;
    const ignored = /(unsubscribe|privacy|terms|twitter\.com|x\.com|facebook\.com|instagram\.com|linkedin\.com)/i;

    let fallback = null;
    for (const src of sources) {
      const matches = src.match(urlRegex) || [];
      for (const raw of matches) {
        const clean = raw.replace(/[.,;!?]+$/, '');
        if (ignored.test(clean)) continue;
        if (priority.test(clean)) return clean;
        if (!fallback && clean.length > 24) fallback = clean;
      }
    }
    return fallback;
  }

  function formatRelativeTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diffSec < 45) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function formatFullDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  function formatReaderTimestamp(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
    let rel = 'just now';
    if (diffSec >= 60 && diffSec < 3600) rel = `${Math.floor(diffSec / 60)} min ago`;
    else if (diffSec >= 3600 && diffSec < 86400) rel = `${Math.floor(diffSec / 3600)} hr ago`;
    else if (diffSec >= 86400) rel = `${Math.floor(diffSec / 86400)} days ago`;
    const isToday = new Date().toDateString() === d.toDateString();
    if (isToday) return `${timeStr} (${rel})`;
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${dateStr}, ${timeStr} (${rel})`;
  }

  async function apiFetch(url, options = {}) {
    const resolvedUrl = url.startsWith('/api/') ? `${API_BASE}${url.slice(4)}` : url;
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const response = await fetch(resolvedUrl, {
      ...options,
      headers,
      credentials: 'same-origin',
    });
    const data = await response
      .json()
      .catch(() => ({ ok: false, error: { message: 'Invalid server response.' } }));
    return { status: response.status, ok: response.ok && data.ok !== false, data };
  }

  function setButtonLoading(btn, loading, idleLabel) {
    if (loading) {
      btn.dataset.idleLabel = btn.textContent;
      btn.dataset.state = 'loading';
      btn.disabled = true;
      btn.replaceChildren();
      const sp = document.createElement('span');
      sp.className = 'spinner';
      sp.setAttribute('aria-hidden', 'true');
      btn.append(sp, document.createTextNode('Loading…'));
    } else {
      delete btn.dataset.state;
      btn.disabled = false;
      btn.textContent = idleLabel || btn.dataset.idleLabel || btn.textContent;
    }
  }

  async function copyWithButtonFeedback(text, btn, copiedLabel = 'Copied') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }

    const original = btn.dataset.originalLabel || btn.textContent;
    btn.dataset.originalLabel = original;
    btn.dataset.state = 'copied';
    btn.textContent = copiedLabel;

    clearTimeout(btn._copyTimer);
    btn._copyTimer = setTimeout(() => {
      delete btn.dataset.state;
      btn.textContent = btn.dataset.originalLabel || original;
    }, 2200);
  }

  function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'alert');

    const text = document.createElement('span');
    text.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn btn--ghost btn--compact';
    closeBtn.textContent = 'Dismiss';
    closeBtn.addEventListener('click', () => toast.remove());

    toast.append(text, closeBtn);
    el.toastRegion.appendChild(toast);

    setTimeout(() => {
      if (toast.isConnected) toast.remove();
    }, 5500);
  }

  function setNotice(node, type, message) {
    if (!message) {
      node.hidden = true;
      node.textContent = '';
      return;
    }
    node.hidden = false;
    node.className = `notice ${type === 'error' ? 'notice--error' : type === 'success' ? 'notice--success' : ''}`;
    node.textContent = message;
  }

  function getAvatarInitial(nameOrEmail) {
    const clean = (nameOrEmail || '?').replace(/^["'<\s]+/, '').trim();
    return clean ? clean.charAt(0).toUpperCase() : '?';
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildEmailIframeDoc(bodyHtml, bodyText) {
    const hasHtml = Boolean(bodyHtml && bodyHtml.trim());
    const content = hasHtml
      ? bodyHtml.replace(/<a\b([^>]*?)>/gi, (_m, attrs) => {
          let next = attrs;
          if (!/\btarget\s*=/i.test(next)) next += ' target="_blank"';
          if (!/\brel\s*=/i.test(next)) next += ' rel="noopener noreferrer"';
          return `<a${next}>`;
        })
      : `<div style="white-space:pre-wrap;font-size:15px;line-height:1.68;color:#1f2937;">${escapeHtml(
          bodyText || '(Empty message body)'
        ).replace(
          /(https?:\/\/[^\s&lt;&gt;]+)/gi,
          '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
        )}</div>`;

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<base target="_blank" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: #fefefe;
    color: #1f2937;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14.5px;
    line-height: 1.65;
    word-break: break-word;
  }
  .mail-wrap {
    padding: 16px 24px 36px;
    max-width: 780px;
  }
  @media (min-width: 680px) {
    .mail-wrap { padding-left: 72px; }
  }
  a { color: #0f766e; }
  img { max-width: 100%; height: auto; }
  pre, code { font-family: ui-monospace, Consolas, monospace; font-size: 13px; }
</style>
</head>
<body><div class="mail-wrap">${content}</div></body>
</html>`;
  }

  function downloadCsv(filename, headers, rows) {
    const csvEscape = (val) => {
      const str = String(val ?? '');
      return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [headers.map(csvEscape).join(','), ...rows.map((r) => r.map(csvEscape).join(','))];
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ============================================================
   * THEME
   * ============================================================ */

  function getActiveTheme() {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'dark' || attr === 'light') return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
    const isDark = theme === 'dark';
    document.querySelectorAll('.theme-icon-moon').forEach((n) => {
      n.hidden = isDark;
    });
    document.querySelectorAll('.theme-icon-sun').forEach((n) => {
      n.hidden = !isDark;
    });
    if (el.themeSetLight) el.themeSetLight.setAttribute('aria-pressed', String(!isDark));
    if (el.themeSetDark) el.themeSetDark.setAttribute('aria-pressed', String(isDark));
  }

  /* ============================================================
   * PHASE SWITCHING
   * ============================================================ */

  function setPhase(nextPhase) {
    state.phase = nextPhase;
    el.phaseLogin.hidden = nextPhase !== 'login';
    el.phaseInbox.hidden = nextPhase !== 'inbox';
    el.phaseAdmin.hidden = nextPhase !== 'admin';

    if (nextPhase === 'admin') {
      stopPolling();
      if (location.hash !== '#admin') history.replaceState(null, '', '#admin');
      checkAdminSession();
    } else if (nextPhase === 'inbox') {
      if (location.hash !== '#inbox') history.replaceState(null, '', '#inbox');
      startPolling();
    } else {
      stopPolling();
      if (location.hash && location.hash !== '#login') history.replaceState(null, '', '#login');
      el.inboxEmail.focus();
    }
  }

  /* ============================================================
   * PHASE 1: LOGIN
   * ============================================================ */

  function resetPasswordFieldHint() {
    el.passwordModeBadge.className = 'badge';
    el.passwordModeBadge.textContent = 'Optional';
    el.inboxPassword.placeholder = 'Leave blank if not required';
    el.inboxPassword.removeAttribute('aria-invalid');
    el.inboxPassword.removeAttribute('aria-required');
    el.inboxPasswordHelper.className = 'field__helper';
    el.inboxPasswordHelper.textContent = 'Leave empty for open inboxes.';
  }

  async function checkEmailRequirement(rawEmail, autoEnterIfOpen = false) {
    const email = rawEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      resetPasswordFieldHint();
      return null;
    }

    setNotice(el.inboxErrorBanner, '', '');
    el.inboxEmail.removeAttribute('aria-invalid');

    const res = await apiFetch('/api/inbox/check', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    if (!res.ok) {
      el.inboxEmail.setAttribute('aria-invalid', 'true');
      el.inboxEmailHelper.className = 'field__helper field__helper--error';
      el.inboxEmailHelper.textContent = res.data?.error?.message || 'Invalid email address format.';
      resetPasswordFieldHint();
      return null;
    }

    if (!res.data.allowed) {
      el.inboxEmail.setAttribute('aria-invalid', 'true');
      el.inboxEmailHelper.className = 'field__helper field__helper--error';
      el.inboxEmailHelper.textContent = 'Address not found or currently disabled.';
      resetPasswordFieldHint();
      return res.data;
    }

    el.inboxEmailHelper.className = 'field__helper field__helper--success';
    if (res.data.requiresPassword) {
      el.inboxEmailHelper.textContent = 'Inbox found — password required.';
      el.passwordModeBadge.className = 'badge badge--accent';
      el.passwordModeBadge.textContent = 'Required';
      el.inboxPassword.placeholder = 'Enter password';
      el.inboxPassword.setAttribute('aria-required', 'true');
      el.inboxPasswordHelper.className = 'field__helper';
      el.inboxPasswordHelper.textContent = 'Enter the inbox password to open messages.';
      el.inboxPassword.focus();
    } else {
      el.inboxEmailHelper.textContent = 'Open inbox — ready to sign in without a password.';
      el.passwordModeBadge.className = 'badge badge--success';
      el.passwordModeBadge.textContent = 'Not needed';
      el.inboxPassword.value = '';
      el.inboxPassword.placeholder = 'No password required';
      el.inboxPassword.removeAttribute('aria-required');
      el.inboxPassword.removeAttribute('aria-invalid');
      el.inboxPasswordHelper.className = 'field__helper field__helper--success';
      el.inboxPasswordHelper.textContent = 'Click Open Inbox directly.';
      if (autoEnterIfOpen) {
        await openInbox(email, '');
      }
    }

    return res.data;
  }

  async function openInbox(email, password) {
    setNotice(el.inboxErrorBanner, '', '');
    setButtonLoading(el.inboxOpenBtn, true);

    try {
      const res = await apiFetch('/api/inbox/open', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = res.data?.error;
        if (err?.requiresPassword) {
          el.passwordModeBadge.className = 'badge badge--accent';
          el.passwordModeBadge.textContent = 'Required';
          el.inboxPassword.setAttribute('aria-invalid', 'true');
          el.inboxPassword.setAttribute('aria-required', 'true');
          el.inboxPasswordHelper.className = 'field__helper field__helper--error';
          el.inboxPasswordHelper.textContent = err.message;
          el.inboxPassword.focus();
        } else {
          setNotice(el.inboxErrorBanner, 'error', err?.message || 'Unable to open inbox.');
        }
        return false;
      }

      el.inboxPassword.value = '';
      resetPasswordFieldHint();

      if (res.data.role === 'admin') {
        el.inboxEmail.value = '';
        state.admin.authenticated = true;
        setPhase('admin');
        await loadAdminData();
        return true;
      }

      state.activeInbox = {
        email: res.data.inbox.email,
        label: res.data.inbox.label || '',
        requiresPassword: Boolean(res.data.inbox.requiresPassword),
        token: res.data.inboxToken || null,
      };
      state.messages = res.data.messages || [];
      state.selectedMessageId = null;
      state.selectedMessage = null;
      state.detectedLink = null;

      persistActiveSession(state.activeInbox);
      renderInboxHeader();
      renderMessageList();
      resetReader();
      setPhase('inbox');

      if (state.messages.length > 0) {
        await selectMessage(state.messages[0].id);
      }
      return true;
    } finally {
      setButtonLoading(el.inboxOpenBtn, false, 'Open Inbox');
    }
  }

  /* ============================================================
   * PHASE 2: INBOX READER
   * ============================================================ */

  function renderInboxHeader() {
    if (!state.activeInbox) return;
    el.activeEmail.textContent = state.activeInbox.email;
    el.activeCount.textContent = String(state.messages.length);
  }

  function resetReader() {
    el.readerEmpty.hidden = false;
    el.readerContent.hidden = true;
    el.readerOtpBanner.hidden = true;
    el.readerLinkBanner.hidden = true;
    el.readerIframe.srcdoc = '';
  }

  function renderMessageList() {
    el.msgList.replaceChildren();
    const q = (state.searchQuery || '').trim().toLowerCase();
    const visible = q
      ? state.messages.filter((m) =>
          `${m.sender_name || ''} ${m.sender || ''} ${m.subject || ''} ${m.preview || ''} ${m.otp_code || ''}`
            .toLowerCase()
            .includes(q)
        )
      : state.messages;

    el.activeCount.textContent = q
      ? `${visible.length}/${state.messages.length}`
      : String(state.messages.length);

    if (visible.length === 0) {
      el.msgListEmpty.hidden = false;
      return;
    }
    el.msgListEmpty.hidden = true;

    for (const msg of visible) {
      const li = document.createElement('li');
      li.className = `msg-row${state.selectedMessageId === msg.id ? ' is-selected' : ''}${!msg.is_read ? ' is-unread' : ''}`;
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.setAttribute('aria-pressed', state.selectedMessageId === msg.id ? 'true' : 'false');

      li.addEventListener('click', () => selectMessage(msg.id));
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectMessage(msg.id);
        }
      });

      const avatar = document.createElement('span');
      avatar.className = 'avatar-badge';
      avatar.setAttribute('aria-hidden', 'true');
      avatar.textContent = getAvatarInitial(msg.sender_name || msg.sender);

      const content = document.createElement('div');
      content.className = 'msg-row__content';

      const top = document.createElement('div');
      top.className = 'msg-row__top';

      const senderWrap = document.createElement('span');
      senderWrap.className = 'msg-row__sender';
      if (!msg.is_read) {
        const dot = document.createElement('span');
        dot.className = 'unread-dot';
        dot.setAttribute('aria-label', 'Unread');
        senderWrap.appendChild(dot);
      }
      senderWrap.appendChild(document.createTextNode(msg.sender_name || msg.sender));

      const time = document.createElement('span');
      time.className = 'msg-row__time';
      time.textContent = formatRelativeTime(msg.received_at);
      time.title = formatFullDate(msg.received_at);

      top.append(senderWrap, time);

      const subj = document.createElement('div');
      subj.className = 'msg-row__subject';
      subj.textContent = msg.subject;

      const prev = document.createElement('div');
      prev.className = 'msg-row__preview';
      prev.textContent = msg.preview;

      content.append(top, subj, prev);

      if (msg.otp_code) {
        const otpBar = document.createElement('div');
        otpBar.className = 'msg-row__otp-bar';

        const codeSpan = document.createElement('span');
        codeSpan.className = 'otp-pill';
        codeSpan.textContent = `OTP ${msg.otp_code}`;

        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'chip-btn';
        copyBtn.textContent = 'Copy OTP';
        copyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          copyWithButtonFeedback(msg.otp_code, copyBtn, 'Copied');
        });

        otpBar.append(codeSpan, copyBtn);
        content.appendChild(otpBar);
      }

      li.append(avatar, content);
      el.msgList.appendChild(li);
    }
  }

  async function selectMessage(messageId) {
    if (!state.activeInbox) return;
    state.selectedMessageId = messageId;
    renderMessageList();

    const headers = {};
    if (state.activeInbox.token) {
      headers['X-Inbox-Token'] = state.activeInbox.token;
    }

    const res = await apiFetch(`/api/inbox/messages/${encodeURIComponent(messageId)}`, { headers });
    if (!res.ok) {
      showErrorToast(res.data?.error?.message || 'Unable to load message.');
      return;
    }

    const msg = res.data.message;
    state.selectedMessage = msg;
    const summary = state.messages.find((m) => m.id === messageId);
    if (summary) summary.is_read = true;
    renderMessageList();

    el.readerEmpty.hidden = true;
    el.readerContent.hidden = false;
    el.readerSubject.textContent = msg.subject;
    el.readerAvatar.textContent = getAvatarInitial(msg.sender_name || msg.sender);
    el.readerSenderName.textContent = msg.sender_name || msg.sender;
    el.readerFrom.textContent = msg.sender_name ? `<${msg.sender}>` : '';
    el.readerTo.textContent = msg.recipient_email;
    el.readerDate.textContent = formatReaderTimestamp(msg.received_at);
    el.readerDate.title = formatFullDate(msg.received_at);

    if (msg.otp_code) {
      el.readerOtpBanner.hidden = false;
      el.readerOtpCode.textContent = msg.otp_code;
    } else {
      el.readerOtpBanner.hidden = true;
    }

    const link = msg.verification_link || extractVerificationLink(msg.body_text, msg.body_html);
    state.detectedLink = link;
    if (link) {
      el.readerLinkBanner.hidden = false;
      el.readerLinkUrl.textContent = link;
      el.readerLinkOpen.href = link;
    } else {
      el.readerLinkBanner.hidden = true;
    }

    el.readerIframe.srcdoc = buildEmailIframeDoc(msg.body_html, msg.body_text);
  }

  async function refreshActiveInbox(isManual = false) {
    if (!state.activeInbox) return;
    if (isManual) el.refreshInboxBtn.classList.add('is-spinning');

    try {
      const headers = {};
      if (state.activeInbox.token) headers['X-Inbox-Token'] = state.activeInbox.token;
      const qs = new URLSearchParams({ email: state.activeInbox.email });
      const res = await apiFetch(`/api/inbox/messages?${qs.toString()}`, { headers });

      if (res.status === 401 || res.status === 403) {
        closeActiveInbox();
        showErrorToast(res.data?.error?.message || 'Inbox session expired. Please sign in again.');
        return;
      }

      if (!res.ok) {
        if (isManual) showErrorToast(res.data?.error?.message || 'Failed to refresh messages.');
        return;
      }

      state.messages = res.data.messages || [];
      renderInboxHeader();
      renderMessageList();

      const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      el.lastSyncText.textContent = `Updated ${now}`;
    } finally {
      el.refreshInboxBtn.classList.remove('is-spinning');
    }
  }

  function startPolling() {
    stopPolling();
    if (!state.autoRefresh) return;
    state.pollTimer = setInterval(() => {
      if (state.phase === 'inbox' && !document.hidden) {
        refreshActiveInbox(false);
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (state.pollTimer) {
      clearInterval(state.pollTimer);
      state.pollTimer = null;
    }
  }

  function closeActiveInbox() {
    stopPolling();
    state.activeInbox = null;
    state.messages = [];
    state.selectedMessageId = null;
    state.selectedMessage = null;
    persistActiveSession(null);
    resetReader();
    setPhase('login');
  }

  /* ============================================================
   * PHASE 3: ADMIN PANEL
   * ============================================================ */

  function applyAdminMeta(meta) {
    if (!meta) return;
    state.config = {
      domain: meta.domain || 'example.com',
      strictAllowlist: Boolean(meta.strictAllowlist),
      allowSimulate: Boolean(meta.allowSimulate),
    };
    el.adminMetaDomain.textContent = `*@${state.config.domain}`;
    el.adminMetaInboxes.textContent = String(meta.activeInboxes ?? 0);
    el.adminMetaPolicy.textContent = state.config.strictAllowlist ? 'Strict allowlist' : 'Open catch-all';
    el.adminMetaMessages.textContent = String(meta.totalMessages ?? 0);
    el.newInboxEmail.placeholder = `qa-user@${state.config.domain}`;
    el.simTo.placeholder = `otp@${state.config.domain}`;
    el.simulatePanel.hidden = !state.config.allowSimulate;
    el.adminSummaryLine.textContent = `${meta.activeInboxes ?? 0} active inboxes · ${meta.totalMessages ?? 0} stored messages`;
  }

  function switchAdminTab(tab) {
    state.admin.activeTab = tab;
    document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
      const active = btn.dataset.adminTab === tab;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    const inboxesPanel = $('admin-panel-inboxes');
    const messagesPanel = $('admin-panel-messages');
    if (inboxesPanel) inboxesPanel.hidden = tab !== 'inboxes';
    if (messagesPanel) messagesPanel.hidden = tab !== 'messages';
  }

  async function checkAdminSession() {
    const res = await apiFetch('/api/admin/session');
    if (!res.ok || !res.data.authenticated) {
      state.admin.authenticated = false;
      setPhase('login');
      return;
    }
    state.admin.authenticated = true;
    await loadAdminData();
  }

  async function loadAdminData() {
    const [inboxesRes, messagesRes] = await Promise.all([
      apiFetch('/api/admin/inboxes'),
      apiFetch('/api/admin/messages?limit=50'),
    ]);

    if (inboxesRes.status === 401 || messagesRes.status === 401) {
      state.admin.authenticated = false;
      setPhase('login');
      showErrorToast('Admin session expired.');
      return;
    }

    if (inboxesRes.ok) {
      state.admin.inboxes = inboxesRes.data.inboxes || [];
      applyAdminMeta(inboxesRes.data.meta);
      el.tabCountInboxes.textContent = String(state.admin.inboxes.length);
      renderAdminInboxes();
    }

    if (messagesRes.ok) {
      state.admin.messages = messagesRes.data.messages || [];
      el.tabCountMessages.textContent = String(state.admin.messages.length);
      renderAdminMessages();
    }
  }

  function renderAdminInboxes() {
    el.adminInboxesTbody.replaceChildren();
    const q = state.admin.inboxFilter.trim().toLowerCase();
    const rows = q
      ? state.admin.inboxes.filter((i) =>
          `${i.email_address} ${i.label || ''}`.toLowerCase().includes(q)
        )
      : state.admin.inboxes;

    if (rows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.className = 'admin-table-empty';
      td.textContent = q ? 'No inboxes match your filter.' : 'No allowlisted inboxes yet.';
      tr.appendChild(td);
      el.adminInboxesTbody.appendChild(tr);
      return;
    }

    rows.forEach((inbox, idx) => {
      const tr = document.createElement('tr');

      const tdNum = document.createElement('td');
      tdNum.className = 'td-num';
      tdNum.textContent = String(idx + 1);

      const tdEmail = document.createElement('td');
      const chip = document.createElement('span');
      chip.className = 'recipient-chip';
      chip.textContent = inbox.email_address;
      tdEmail.appendChild(chip);

      const tdLabel = document.createElement('td');
      tdLabel.textContent = inbox.label || '—';

      const tdStatus = document.createElement('td');
      const statusWrap = document.createElement('div');
      statusWrap.className = 'action-row';
      const activeBadge = document.createElement('span');
      activeBadge.className = inbox.is_active ? 'badge badge--success' : 'badge badge--error';
      activeBadge.textContent = inbox.is_active ? 'Active' : 'Disabled';
      const authBadge = document.createElement('span');
      authBadge.className = inbox.has_password ? 'badge badge--accent' : 'badge';
      authBadge.textContent = inbox.has_password ? 'Locked' : 'Open';
      statusWrap.append(activeBadge, authBadge);
      tdStatus.appendChild(statusWrap);

      const tdCount = document.createElement('td');
      tdCount.className = 'mono';
      tdCount.textContent = String(inbox.message_count ?? 0);

      const tdActions = document.createElement('td');
      tdActions.className = 'td-actions';
      const grp = document.createElement('div');
      grp.className = 'td-actions-group';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn--soft btn--compact';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => openEditInboxModal(inbox));

      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'btn btn--compact';
      toggleBtn.textContent = inbox.is_active ? 'Disable' : 'Enable';
      toggleBtn.addEventListener('click', () => toggleInboxActive(inbox));

      const purgeBtn = document.createElement('button');
      purgeBtn.type = 'button';
      purgeBtn.className = 'btn btn--ghost btn--compact';
      purgeBtn.textContent = 'Clear';
      purgeBtn.addEventListener('click', () => clearInboxMessages(inbox.email_address));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn--danger btn--compact';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteInboxRecord(inbox));

      grp.append(editBtn, toggleBtn, purgeBtn, delBtn);
      tdActions.appendChild(grp);

      tr.append(tdNum, tdEmail, tdLabel, tdStatus, tdCount, tdActions);
      el.adminInboxesTbody.appendChild(tr);
    });
  }

  function renderAdminMessages() {
    el.adminMessagesTbody.replaceChildren();
    const q = state.admin.messageFilter.trim().toLowerCase();
    const filterType = state.admin.messageTypeFilter;

    const rows = state.admin.messages.filter((m) => {
      if (filterType === 'otp' && !m.otp_code) return false;
      if (!q) return true;
      return `${m.recipient_email} ${m.sender} ${m.sender_name || ''} ${m.subject} ${m.preview || ''} ${m.otp_code || ''}`
        .toLowerCase()
        .includes(q);
    });

    if (rows.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 7;
      td.className = 'admin-table-empty';
      td.textContent = 'No messages match the current filter.';
      tr.appendChild(td);
      el.adminMessagesTbody.appendChild(tr);
      return;
    }

    rows.forEach((msg, idx) => {
      const tr = document.createElement('tr');

      const tdNum = document.createElement('td');
      tdNum.className = 'td-num';
      tdNum.textContent = String(idx + 1);

      const tdTime = document.createElement('td');
      tdTime.className = 'td-time';
      tdTime.textContent = formatRelativeTime(msg.received_at);
      tdTime.title = formatFullDate(msg.received_at);

      const tdTo = document.createElement('td');
      const chip = document.createElement('span');
      chip.className = 'recipient-chip';
      chip.textContent = msg.recipient_email;
      tdTo.appendChild(chip);

      const tdFrom = document.createElement('td');
      tdFrom.textContent = msg.sender_name ? `${msg.sender_name} (${msg.sender})` : msg.sender;

      const tdSubj = document.createElement('td');
      const subjBtn = document.createElement('button');
      subjBtn.type = 'button';
      subjBtn.className = 'td-subject__btn';
      subjBtn.textContent = msg.subject;
      subjBtn.addEventListener('click', () => openAdminReader(msg.id));
      const preview = document.createElement('div');
      preview.className = 'td-subject__preview';
      preview.textContent = msg.preview;
      tdSubj.append(subjBtn, preview);

      const tdOtp = document.createElement('td');
      if (msg.otp_code) {
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'chip-btn';
        copyBtn.textContent = msg.otp_code;
        copyBtn.title = 'Click to copy OTP';
        copyBtn.addEventListener('click', () => copyWithButtonFeedback(msg.otp_code, copyBtn, 'Copied'));
        tdOtp.appendChild(copyBtn);
      } else {
        tdOtp.textContent = '—';
      }

      const tdActions = document.createElement('td');
      tdActions.className = 'td-actions';
      const grp = document.createElement('div');
      grp.className = 'td-actions-group';

      const readBtn = document.createElement('button');
      readBtn.type = 'button';
      readBtn.className = 'btn btn--soft btn--compact';
      readBtn.textContent = 'Read';
      readBtn.addEventListener('click', () => openAdminReader(msg.id));

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn--danger btn--compact';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteAdminMessage(msg.id));

      grp.append(readBtn, delBtn);
      tdActions.appendChild(grp);

      tr.append(tdNum, tdTime, tdTo, tdFrom, tdSubj, tdOtp, tdActions);
      el.adminMessagesTbody.appendChild(tr);
    });
  }

  async function toggleInboxActive(inbox) {
    const res = await apiFetch(`/api/admin/inboxes/${inbox.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !inbox.is_active }),
    });
    if (!res.ok) {
      showErrorToast(res.data?.error?.message || 'Failed to update inbox status.');
      return;
    }
    await loadAdminData();
  }

  async function clearInboxMessages(email) {
    if (!window.confirm(`Delete all stored messages for ${email}?`)) return;
    const qs = new URLSearchParams({ email });
    const res = await apiFetch(`/api/admin/messages?${qs.toString()}`, { method: 'DELETE' });
    if (!res.ok) {
      showErrorToast(res.data?.error?.message || 'Failed to clear messages.');
      return;
    }
    await loadAdminData();
  }

  async function deleteInboxRecord(inbox) {
    if (!window.confirm(`Remove ${inbox.email_address} from allowlist and delete its stored messages?`)) return;
    const res = await apiFetch(`/api/admin/inboxes/${inbox.id}?delete_messages=true`, { method: 'DELETE' });
    if (!res.ok) {
      showErrorToast(res.data?.error?.message || 'Failed to delete inbox.');
      return;
    }
    await loadAdminData();
  }

  async function deleteAdminMessage(id) {
    const res = await apiFetch(`/api/admin/messages/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      showErrorToast(res.data?.error?.message || 'Failed to delete message.');
      return;
    }
    if (el.adminReadDialog.open && state.admin.readingMessage?.id === id) {
      el.adminReadDialog.close();
    }
    await loadAdminData();
  }

  async function openAdminReader(messageId) {
    const res = await apiFetch(`/api/admin/messages/${encodeURIComponent(messageId)}`);
    if (!res.ok) {
      showErrorToast(res.data?.error?.message || 'Failed to load message details.');
      return;
    }
    const msg = res.data.message;
    state.admin.readingMessage = msg;
    el.adminReadRecipientChip.textContent = msg.recipient_email;
    el.adminReadSubject.textContent = msg.subject;
    el.adminReadAvatar.textContent = getAvatarInitial(msg.sender_name || msg.sender);
    el.adminReadSenderName.textContent = msg.sender_name || msg.sender;
    el.adminReadFrom.textContent = msg.sender_name ? `<${msg.sender}>` : '';
    el.adminReadTo.textContent = msg.recipient_email;
    el.adminReadDate.textContent = formatReaderTimestamp(msg.received_at);

    if (msg.otp_code) {
      el.adminReadOtpBanner.hidden = false;
      el.adminReadOtpCode.textContent = msg.otp_code;
    } else {
      el.adminReadOtpBanner.hidden = true;
    }

    const link = msg.verification_link || extractVerificationLink(msg.body_text, msg.body_html);
    state.admin.readingLink = link;
    if (link) {
      el.adminReadLinkBanner.hidden = false;
      el.adminReadLinkUrl.textContent = link;
      el.adminReadLinkOpen.href = link;
    } else {
      el.adminReadLinkBanner.hidden = true;
    }

    el.adminReadIframe.srcdoc = buildEmailIframeDoc(msg.body_html, msg.body_text);
    el.adminReadDialog.showModal();
  }

  function setCreatePasswordMode(locked) {
    state.createRequiresPassword = locked;
    el.createModeOpen.setAttribute('aria-checked', String(!locked));
    el.createModeLocked.setAttribute('aria-checked', String(locked));
    el.newInboxPasswordWrap.hidden = !locked;
    if (!locked) el.newInboxPassword.value = '';
  }

  function setEditPasswordMode(locked) {
    state.editRequiresPassword = locked;
    el.editModeOpen.setAttribute('aria-checked', String(!locked));
    el.editModeLocked.setAttribute('aria-checked', String(locked));
    el.editPasswordWrap.hidden = !locked;
    if (!locked) el.editPasswordInput.value = '';
  }

  function openEditInboxModal(inbox) {
    state.admin.editingInbox = inbox;
    el.editDialogEmail.textContent = inbox.email_address;
    el.editLabelInput.value = inbox.label || '';
    el.editPasswordInput.value = '';
    setNotice(el.editDialogError, '', '');
    setEditPasswordMode(Boolean(inbox.has_password));
    el.editDialog.showModal();
  }

  /* ============================================================
   * COMMAND PALETTE (Ctrl+K / Cmd+K)
   * ============================================================ */

  function buildCommands() {
    const cmds = [
      {
        label: 'Toggle Light / Dark Theme',
        hint: 'Appearance',
        run: () => applyTheme(getActiveTheme() === 'dark' ? 'light' : 'dark'),
      },
    ];
    if (state.phase === 'inbox') {
      cmds.push(
        { label: 'Refresh Messages', hint: 'Inbox', run: () => refreshActiveInbox(true) },
        {
          label: 'Copy Active Email Address',
          hint: 'Clipboard',
          run: () => copyWithButtonFeedback(state.activeInbox?.email || '', el.copyAddressBtn, 'Copied'),
        },
        { label: 'Sign Out of Inbox', hint: 'Session', run: () => closeActiveInbox() }
      );
    }
    if (state.phase === 'admin') {
      cmds.push(
        { label: 'Refresh Admin Dashboard', hint: 'Admin', run: () => loadAdminData() },
        { label: 'View Allowed Inboxes', hint: 'Tab', run: () => switchAdminTab('inboxes') },
        { label: 'View Stored Messages', hint: 'Tab', run: () => switchAdminTab('messages') },
        { label: 'Back to Inbox Login', hint: 'Navigate', run: () => setPhase('login') }
      );
    }
    return cmds;
  }

  function renderCmdk() {
    const q = el.cmdkInput.value.trim().toLowerCase();
    const items = buildCommands().filter((c) => !q || c.label.toLowerCase().includes(q));
    state.cmdk.items = items;
    state.cmdk.activeIndex = Math.min(state.cmdk.activeIndex, Math.max(items.length - 1, 0));
    el.cmdkResults.replaceChildren();

    items.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cmdk-item${idx === state.cmdk.activeIndex ? ' is-active' : ''}`;
      btn.setAttribute('role', 'option');
      const label = document.createElement('span');
      label.textContent = item.label;
      const hint = document.createElement('span');
      hint.className = 'meta-inline';
      hint.textContent = item.hint;
      btn.append(label, hint);
      btn.addEventListener('click', () => {
        el.cmdkDialog.close();
        item.run();
      });
      el.cmdkResults.appendChild(btn);
    });
  }

  /* ============================================================
   * EVENT BINDINGS
   * ============================================================ */

  function bindEvents() {
    document.querySelectorAll('.theme-toggle').forEach((btn) => {
      btn.addEventListener('click', () => applyTheme(getActiveTheme() === 'dark' ? 'light' : 'dark'));
    });
    el.themeSetLight?.addEventListener('click', () => applyTheme('light'));
    el.themeSetDark?.addEventListener('click', () => applyTheme('dark'));

    el.toggleInboxPassword.addEventListener('click', () => {
      el.inboxPassword.type = el.inboxPassword.type === 'password' ? 'text' : 'password';
    });

    let checkTimer = null;
    el.inboxEmail.addEventListener('input', () => {
      clearTimeout(checkTimer);
      const val = el.inboxEmail.value.trim();
      if (!val.includes('@') || !val.includes('.')) {
        resetPasswordFieldHint();
        return;
      }
      checkTimer = setTimeout(() => checkEmailRequirement(val, false), 320);
    });

    el.inboxForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = el.inboxEmail.value.trim().toLowerCase();
      if (!email) {
        setNotice(el.inboxErrorBanner, 'error', 'Please enter an email address.');
        el.inboxEmail.focus();
        return;
      }
      await openInbox(email, el.inboxPassword.value);
    });

    el.copyAddressBtn.addEventListener('click', () => {
      copyWithButtonFeedback(state.activeInbox?.email || '', el.copyAddressBtn, 'Copied');
    });

    el.autoRefreshBtn.addEventListener('click', () => {
      state.autoRefresh = !state.autoRefresh;
      el.autoRefreshBtn.setAttribute('aria-checked', String(state.autoRefresh));
      el.lastSyncText.textContent = state.autoRefresh ? 'Auto-refresh active' : 'Auto-refresh paused';
      if (state.autoRefresh) startPolling();
      else stopPolling();
    });

    el.refreshInboxBtn.addEventListener('click', () => refreshActiveInbox(true));
    el.closeInboxBtn.addEventListener('click', () => closeActiveInbox());
    el.inboxSearchInput.addEventListener('input', () => {
      state.searchQuery = el.inboxSearchInput.value;
      renderMessageList();
    });

    el.readerOtpCopy.addEventListener('click', () => {
      copyWithButtonFeedback(state.selectedMessage?.otp_code || '', el.readerOtpCopy, 'Copied');
    });
    el.readerLinkCopy.addEventListener('click', () => {
      copyWithButtonFeedback(state.detectedLink || '', el.readerLinkCopy, 'Copied');
    });

    // Admin events
    el.adminBackLoginBtn.addEventListener('click', () => setPhase('login'));
    el.adminRefreshBtn.addEventListener('click', () => loadAdminData());
    el.adminLogoutBtn.addEventListener('click', async () => {
      await apiFetch('/api/admin/logout', { method: 'POST' });
      state.admin.authenticated = false;
      setPhase('login');
    });

    document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchAdminTab(btn.dataset.adminTab));
    });

    el.createModeOpen.addEventListener('click', () => setCreatePasswordMode(false));
    el.createModeLocked.addEventListener('click', () => setCreatePasswordMode(true));
    el.generateNewPwBtn.addEventListener('click', () => {
      el.newInboxPassword.value = generateRandomPassword(12);
    });

    el.createInboxForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setNotice(el.createInboxFeedback, '', '');
      const email_address = el.newInboxEmail.value.trim().toLowerCase();
      const label = el.newInboxLabel.value.trim();
      const password = state.createRequiresPassword ? el.newInboxPassword.value.trim() : '';

      setButtonLoading(el.createInboxBtn, true);
      try {
        const res = await apiFetch('/api/admin/inboxes', {
          method: 'POST',
          body: JSON.stringify({ email_address, label, password, is_active: true }),
        });
        if (!res.ok) {
          setNotice(el.createInboxFeedback, 'error', res.data?.error?.message || 'Failed to create inbox.');
          return;
        }
        el.newInboxEmail.value = '';
        el.newInboxLabel.value = '';
        el.newInboxPassword.value = '';
        setCreatePasswordMode(false);
        setNotice(el.createInboxFeedback, 'success', `Allowlisted ${email_address}.`);
        await loadAdminData();
      } finally {
        setButtonLoading(el.createInboxBtn, false, 'Create Inbox');
      }
    });

    el.simulateForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      setNotice(el.simulateFeedback, '', '');
      setButtonLoading(el.simulateBtn, true);
      try {
        const res = await apiFetch('/api/admin/simulate', {
          method: 'POST',
          body: JSON.stringify({
            to: el.simTo.value.trim(),
            from: el.simFrom.value.trim(),
            subject: el.simSubject.value.trim(),
            body_text: el.simBody.value.trim(),
          }),
        });
        if (!res.ok) {
          setNotice(el.simulateFeedback, 'error', res.data?.error?.message || 'Simulation failed.');
          return;
        }
        const otp = res.data.result?.otpCode;
        setNotice(
          el.simulateFeedback,
          'success',
          otp ? `Simulated email stored (extracted OTP: ${otp}).` : 'Simulated email stored.'
        );
        await loadAdminData();
      } finally {
        setButtonLoading(el.simulateBtn, false, 'Send Simulated Email');
      }
    });

    el.adminInboxSearch.addEventListener('input', () => {
      state.admin.inboxFilter = el.adminInboxSearch.value;
      renderAdminInboxes();
    });

    el.adminMsgSearch.addEventListener('input', () => {
      state.admin.messageFilter = el.adminMsgSearch.value;
      renderAdminMessages();
    });

    document.querySelectorAll('[data-msg-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.admin.messageTypeFilter = btn.dataset.msgFilter;
        document.querySelectorAll('[data-msg-filter]').forEach((b) => {
          b.classList.toggle('is-active', b === btn);
        });
        renderAdminMessages();
      });
    });

    el.exportInboxesCsvBtn.addEventListener('click', () => {
      downloadCsv(
        'mailgate-inboxes.csv',
        ['Email', 'Label', 'Active', 'Password Protected', 'Messages', 'Created At'],
        state.admin.inboxes.map((i) => [
          i.email_address,
          i.label,
          i.is_active ? 'Yes' : 'No',
          i.has_password ? 'Yes' : 'No',
          i.message_count,
          i.created_at,
        ])
      );
    });

    el.exportCsvBtn.addEventListener('click', () => {
      downloadCsv(
        'mailgate-messages.csv',
        ['Received At', 'Recipient', 'Sender', 'Subject', 'OTP Code', 'Preview'],
        state.admin.messages.map((m) => [
          m.received_at,
          m.recipient_email,
          m.sender,
          m.subject,
          m.otp_code || '',
          m.preview,
        ])
      );
    });

    // Edit inbox modal
    el.editModeOpen.addEventListener('click', () => setEditPasswordMode(false));
    el.editModeLocked.addEventListener('click', () => setEditPasswordMode(true));
    el.generateEditPwBtn.addEventListener('click', () => {
      el.editPasswordInput.value = generateRandomPassword(12);
    });
    el.editDialogClose.addEventListener('click', () => el.editDialog.close());
    el.editDialogCancel.addEventListener('click', () => el.editDialog.close());

    el.editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const target = state.admin.editingInbox;
      if (!target) return;
      setNotice(el.editDialogError, '', '');

      const payload = {
        label: el.editLabelInput.value.trim(),
      };
      if (!state.editRequiresPassword) {
        payload.clear_password = true;
      } else if (el.editPasswordInput.value.trim()) {
        payload.password = el.editPasswordInput.value.trim();
      } else if (!target.has_password) {
        setNotice(el.editDialogError, 'error', 'Enter a password of at least 4 characters.');
        return;
      }

      const res = await apiFetch(`/api/admin/inboxes/${target.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setNotice(el.editDialogError, 'error', res.data?.error?.message || 'Failed to save changes.');
        return;
      }
      el.editDialog.close();
      await loadAdminData();
    });

    // Admin reader modal
    el.adminReadClose.addEventListener('click', () => el.adminReadDialog.close());
    el.adminReadDone.addEventListener('click', () => el.adminReadDialog.close());
    el.adminReadDelete.addEventListener('click', () => {
      if (state.admin.readingMessage?.id) deleteAdminMessage(state.admin.readingMessage.id);
    });
    el.adminReadOtpCopy.addEventListener('click', () => {
      copyWithButtonFeedback(state.admin.readingMessage?.otp_code || '', el.adminReadOtpCopy, 'Copied');
    });
    el.adminReadLinkCopy.addEventListener('click', () => {
      copyWithButtonFeedback(state.admin.readingLink || '', el.adminReadLinkCopy, 'Copied');
    });

    // Global Ctrl+K / Cmd+K
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        el.cmdkInput.value = '';
        state.cmdk.activeIndex = 0;
        renderCmdk();
        el.cmdkDialog.showModal();
        el.cmdkInput.focus();
      }
    });

    el.cmdkInput.addEventListener('input', () => {
      state.cmdk.activeIndex = 0;
      renderCmdk();
    });

    el.cmdkInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        state.cmdk.activeIndex = Math.min(state.cmdk.activeIndex + 1, Math.max(state.cmdk.items.length - 1, 0));
        renderCmdk();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        state.cmdk.activeIndex = Math.max(state.cmdk.activeIndex - 1, 0);
        renderCmdk();
      } else if (e.key === 'Enter' && state.cmdk.items[state.cmdk.activeIndex]) {
        e.preventDefault();
        const item = state.cmdk.items[state.cmdk.activeIndex];
        el.cmdkDialog.close();
        item.run();
      }
    });
  }

  /* ============================================================
   * BOOTSTRAP
   * ============================================================ */

  async function init() {
    applyTheme(getActiveTheme());
    bindEvents();

    const cfgRes = await apiFetch('/api/config');
    if (cfgRes.ok && cfgRes.data.domain) {
      state.config.domain = cfgRes.data.domain;
      el.inboxEmail.placeholder = `otp@${cfgRes.data.domain}`;
    }

    if (location.hash === '#admin') {
      setPhase('admin');
      return;
    }

    const saved = readPersistedSession();
    if (saved) {
      state.activeInbox = saved;
      renderInboxHeader();
      setPhase('inbox');
      await refreshActiveInbox(false);
      if (state.messages.length > 0) {
        await selectMessage(state.messages[0].id);
      }
      return;
    }

    setPhase('login');
  }

  init();
})();
