/**
 * Telegram admin surface for coupons (docs/coupon-management).
 *
 * Long-polls getUpdates in-process and answers only the configured admin chat.
 * Like ADMIN_SECRET in routes/admin.ts, an unset token means the bot stays fully
 * off rather than half-enabled.
 *
 * Only one process may poll a given bot token: a second poller silently steals
 * updates from the first. Run a separate BotFather bot for local development
 * rather than pointing dev and prod at the same token.
 */

import QRCode from 'qrcode';
import { db } from '../storage/db.js';
import {
  CouponError,
  addCap,
  addCoupon,
  allGates,
  accountStats,
  clearCoupons,
  couponStats,
  formatDuration,
  limitStatus,
  listLimits,
  listLiveCoupons,
  mintManual,
  parseDuration,
  parseStatsRange,
  removeLimit,
  resolveLiveCoupon,
  retireCoupon,
  revokeTokens,
  setCouponGlobal,
  setGate,
  tokenStats,
  type GateName,
  type LimitStatusRow,
} from './coupon-service.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID;
const POLL_TIMEOUT_SECONDS = 50;

const API = (method: string) => `https://api.telegram.org/bot${TOKEN}/${method}`;

// =============================================================================
// OFFSET PERSISTENCE
// =============================================================================

function getOffset(): number {
  const row = db.prepare(`SELECT value FROM bot_state WHERE key = 'telegram_offset'`).get() as any;
  return row ? Number(row.value) : 0;
}

function setOffset(offset: number): void {
  db.prepare(`
    INSERT INTO bot_state (key, value) VALUES ('telegram_offset', ?)
    ON CONFLICT(key) DO UPDATE SET value = ?
  `).run(String(offset), String(offset));
}

// =============================================================================
// SENDING
// =============================================================================

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Monospace block — the only reliable way to keep columns aligned in Telegram. */
function pre(text: string): string {
  return `<pre>${escapeHtml(text)}</pre>`;
}

async function send(text: string): Promise<void> {
  try {
    const res = await fetch(API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text: text.slice(0, 4096),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    const body = await res.json() as any;
    if (!body.ok) console.error('[telegram] sendMessage failed:', body.description);
  } catch (err) {
    console.error('[telegram] sendMessage threw:', err);
  }
}

async function sendQr(token: string, caption: string): Promise<void> {
  try {
    const png = await QRCode.toBuffer(token, { type: 'png', width: 512, margin: 2 });
    const form = new FormData();
    form.append('chat_id', String(ADMIN_CHAT_ID));
    form.append('caption', caption.slice(0, 1024));
    form.append('parse_mode', 'HTML');
    form.append('photo', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'token.png');

    const res = await fetch(API('sendPhoto'), { method: 'POST', body: form });
    const body = await res.json() as any;
    if (!body.ok) {
      console.error('[telegram] sendPhoto failed:', body.description);
      // The token is unrecoverable once minted, so fall back to text rather than
      // losing it to a failed image upload.
      await send(`${caption}\n\n(QR image failed to send)`);
    }
  } catch (err) {
    console.error('[telegram] sendPhoto threw:', err);
    await send(`${caption}\n\n(QR image failed to send)`);
  }
}

// =============================================================================
// FORMATTING
// =============================================================================

function formatLimitRow(row: LimitStatusRow): string {
  const id = `#${row.id}`.padEnd(5);
  if (row.kind === 'inherit_global') return `  ${id}inherit global`;

  const cap = `${row.maxCount} / ${formatDuration(row.windowSeconds)}`.padEnd(16);
  const usage = `${row.used} used, ${row.remaining} left`;
  const frees = row.freesAt
    ? `   exhausted, frees ${new Date(row.freesAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  return `  ${id}${cap}${usage}${frees}`;
}

function formatLimitStatus(couponId?: number | null): string {
  const { rows, inertCoupons } = limitStatus(couponId);
  if (rows.length === 0 && inertCoupons.length === 0) {
    return 'No limits configured anywhere. Nothing can be minted.';
  }

  const lines: string[] = [];
  const scopes = [...new Set(rows.map(r => r.scope))];
  // GLOBAL first; it binds everything else.
  scopes.sort((a, b) => (a === 'GLOBAL' ? -1 : b === 'GLOBAL' ? 1 : a.localeCompare(b)));

  for (const scope of scopes) {
    lines.push(scope === 'GLOBAL' ? 'GLOBAL' : `COUPON ${scope}`);
    for (const row of rows.filter(r => r.scope === scope)) lines.push(formatLimitRow(row));
  }

  if (!scopes.includes('GLOBAL')) {
    lines.unshift('GLOBAL', '  (none — global imposes no ceiling)');
  }
  if (inertCoupons.length) {
    lines.push('', `INERT (no rules, unusable): ${inertCoupons.join(', ')}`);
  }
  return pre(lines.join('\n'));
}

const HELP = [
  '<b>Coupon management</b>',
  '',
  '/mint [credits] — mint a token directly (bypasses gates and limits)',
  '',
  '/coupon list',
  '/coupon add CODE [credits] — new coupon, or reprice an existing one',
  '/coupon remove CODE — stop future minting, free the code for reuse',
  '/coupon clear',
  '',
  '/limit — summary',
  '/limit status — live usage of every rule',
  '/limit list | /limit N | /limit N DURATION | /limit rm ID',
  '/limit CODE ... — same, scoped to one coupon',
  '/limit CODE global — that coupon uses only the global caps',
  '',
  '/revoke ID | TOKEN | DURATION | all — kills unredeemed tokens only',
  '/stop coupon | /stop redemption',
  '/resume coupon | /resume redemption',
  '/stats [coupons|tokens|accounts] [DURATION] [DURATION]',
  '',
  'A coupon cannot be minted from until it has a limit.',
  'Tokens are stored hashed — a minted token is shown once and cannot be recovered.',
].join('\n');

// =============================================================================
// COMMAND HANDLERS
// =============================================================================

async function handleMint(args: string[]): Promise<void> {
  const credits = args.length ? Number(args[0]) : 1;
  if (!Number.isFinite(credits) || credits <= 0) {
    return send(`Usage: /mint [credits]  (got "${escapeHtml(args[0] ?? '')}")`);
  }

  const minted = mintManual(credits);
  await sendQr(
    minted.token,
    [
      `<b>Token #${minted.tokenId}</b> — ${credits} credit${credits === 1 ? '' : 's'}`,
      `<code>${escapeHtml(minted.token)}</code>`,
      '',
      'Admin mint: ignored by every limit. Shown once — not recoverable.',
    ].join('\n')
  );
}

async function handleCoupon(args: string[]): Promise<void> {
  const sub = (args[0] ?? '').toLowerCase();

  if (!sub || sub === 'list') {
    const coupons = listLiveCoupons();
    if (!coupons.length) return send('No coupons. Add one with /coupon add CODE [credits]');

    const lines = coupons.map(c => {
      const limits = listLimits(c.id);
      const state = limits.length === 0
        ? 'INERT — set a limit to activate'
        : limits.some(l => l.kind === 'inherit_global') && limits.length === 1
          ? 'live (global limits only)'
          : `live (${limits.filter(l => l.kind === 'cap').length} own cap(s))`;
      return `${c.code.padEnd(14)}${String(c.valueCredits).padStart(5)} cr   ${state}`;
    });
    return send(pre(lines.join('\n')));
  }

  if (sub === 'add') {
    if (!args[1]) return send('Usage: /coupon add CODE [credits]');
    const credits = args[2] !== undefined ? Number(args[2]) : 1;
    if (!Number.isFinite(credits)) return send(`"${escapeHtml(args[2]!)}" is not a number`);

    const { coupon, repriced } = addCoupon(args[1], credits);
    if (repriced) {
      return send(
        `${coupon.code} repriced to ${coupon.valueCredits} credits.\n` +
        `Tokens already minted keep their original value.`
      );
    }
    return send(
      `${coupon.code} created at ${coupon.valueCredits} credits (id ${coupon.id}).\n\n` +
      `<b>It is inert until you set a limit.</b>\n` +
      `/limit ${coupon.code} N DURATION — own cap\n` +
      `/limit ${coupon.code} global — global caps only`
    );
  }

  if (sub === 'remove') {
    if (!args[1]) return send('Usage: /coupon remove CODE');
    const { coupon, limitsRemoved, activeTokens } = retireCoupon(args[1]);
    const note = activeTokens
      ? `\n${activeTokens} unredeemed token(s) from it remain valid — use /revoke to kill them.`
      : '';
    return send(
      `${coupon.code} retired (${limitsRemoved} limit rule(s) removed). ` +
      `The code is free to add again as a fresh coupon.${note}`
    );
  }

  if (sub === 'clear') {
    const n = clearCoupons();
    return send(`Retired ${n} coupon(s). Unredeemed tokens are untouched.`);
  }

  return send(`Unknown: /coupon ${escapeHtml(sub)}\n\n${HELP}`);
}

async function handleLimit(args: string[]): Promise<void> {
  if (args.length === 0) {
    const globals = listLimits(null).filter(l => l.kind === 'cap');
    const summary = globals.length
      ? `${globals.length} global cap(s).`
      : 'No global caps — global imposes no ceiling.';
    return send(`${summary}\n\n${formatLimitStatus()}`);
  }

  const first = args[0].toLowerCase();

  // Global-scope forms.
  if (first === 'status') return send(formatLimitStatus());
  if (first === 'list') return send(formatLimitStatus(null));
  if (first === 'rm') {
    if (!args[1]) return send('Usage: /limit rm ID');
    removeLimit(null, Number(args[1].replace('#', '')));
    return send(`Removed global limit #${args[1].replace('#', '')}.\n\n${formatLimitStatus()}`);
  }
  if (/^\d+$/.test(first)) return applyCap(null, args, 'GLOBAL');

  // Otherwise the first token is a coupon code.
  const coupon = resolveLiveCoupon(first);
  if (!coupon) return send(`No live coupon "${escapeHtml(args[0])}"`);

  const rest = args.slice(1);
  const sub = (rest[0] ?? '').toLowerCase();

  if (!sub || sub === 'status' || sub === 'list') {
    return send(formatLimitStatus(coupon.id));
  }

  if (sub === 'global') {
    const { removed } = setCouponGlobal(coupon.id);
    const globals = listLimits(null).filter(l => l.kind === 'cap');
    const warning = globals.length === 0
      ? '\n\n<b>Warning:</b> there are no global caps, so this coupon is now live and effectively uncapped.'
      : '';
    const cleared = removed ? ` ${removed} own rule(s) removed.` : '';
    return send(`${coupon.code} now uses the global caps only.${cleared}${warning}`);
  }

  if (sub === 'rm') {
    if (!rest[1]) return send(`Usage: /limit ${coupon.code} rm ID`);
    const { nowInert } = removeLimit(coupon.id, Number(rest[1].replace('#', '')));
    const note = nowInert
      ? `\n\n<b>${coupon.code} has no rules left and can no longer be minted.</b>`
      : '';
    return send(`Removed limit #${rest[1].replace('#', '')}.${note}\n\n${formatLimitStatus(coupon.id)}`);
  }

  if (/^\d+$/.test(sub)) return applyCap(coupon.id, rest, coupon.code);

  return send(`Unknown: /limit ${escapeHtml(coupon.code)} ${escapeHtml(sub)}\n\n${HELP}`);
}

async function applyCap(couponId: number | null, args: string[], scopeLabel: string): Promise<void> {
  const maxCount = Number(args[0]);
  let windowSeconds: number | null = null;

  if (args[1] !== undefined) {
    windowSeconds = parseDuration(args[1]);
    if (windowSeconds === null) {
      return send(`Can't read "${escapeHtml(args[1])}" as a duration (try 30s, 5m, 2h, 7d, 1w)`);
    }
  }

  const limit = addCap(couponId, maxCount, windowSeconds);
  const scope = couponId === null ? 'Global' : scopeLabel;
  return send(
    `${scope} cap #${limit.id}: ${maxCount} per ${formatDuration(windowSeconds)}.\n\n` +
    formatLimitStatus(couponId)
  );
}

async function handleRevoke(args: string[]): Promise<void> {
  if (!args.length) return send('Usage: /revoke ID | TOKEN | DURATION | all');
  const { revoked, description } = revokeTokens(args.join(' '));
  return send(
    revoked
      ? `Revoked ${revoked} token(s) — ${description}. Already-redeemed tokens were not touched.`
      : `Nothing to revoke for ${description} (no unredeemed matches).`
  );
}

async function handleGate(open: boolean, args: string[]): Promise<void> {
  const verb = open ? 'resume' : 'stop';
  const target = (args[0] ?? '').toLowerCase();
  const state = () => {
    const g = allGates();
    return `coupon minting: ${g.coupon ? 'OPEN' : 'CLOSED'}\nredemption: ${g.redemption ? 'OPEN' : 'CLOSED'}`;
  };

  if (target !== 'coupon' && target !== 'redemption') {
    return send(`Usage: /${verb} coupon | /${verb} redemption\n\n${state()}`);
  }

  setGate(target as GateName, open);
  return send(`${target} ${open ? 'resumed' : 'stopped'}.\n\n${state()}`);
}

async function handleStats(args: string[]): Promise<void> {
  const bucket = (args[0] ?? '').toLowerCase();
  const known = ['coupons', 'tokens', 'accounts'];
  const rangeArgs = known.includes(bucket) ? args.slice(1) : args;
  const range = parseStatsRange(rangeArgs);

  const sections: string[] = [];

  if (!known.includes(bucket) || bucket === 'tokens') {
    const s = tokenStats(range);
    sections.push(pre([
      `TOKENS (${range.label})`,
      `  minted    ${s.minted}   (web ${s.web}, admin ${s.admin})`,
      `  redeemed  ${s.redeemed}`,
      `  active    ${s.active}`,
      `  revoked   ${s.revoked}`,
      `  credits granted  ${s.creditsGranted}`,
    ].join('\n')));
  }

  if (!known.includes(bucket) || bucket === 'coupons') {
    const rows = couponStats(range);
    if (!rows.length) {
      sections.push('No coupons yet.');
    } else {
      // Keyed on id, so a reused code shows as separate rows: two coupons that
      // share a label are different campaigns.
      const lines = rows.map(r =>
        `${r.code.padEnd(12)}${r.createdAt.slice(0, 10)}  ` +
        `minted ${String(r.minted).padStart(4)}  redeemed ${String(r.redeemed).padStart(4)}  ` +
        `${String(r.creditsGranted).padStart(5)} cr${r.retired ? '  (retired)' : ''}`
      );
      sections.push(pre([`COUPONS (${range.label})`, ...lines].join('\n')));
    }
  }

  if (!known.includes(bucket) || bucket === 'accounts') {
    const s = accountStats(range);
    sections.push(pre([
      `ACCOUNTS (${range.label})`,
      `  credited  ${s.accountsCredited}`,
      `  credits   ${s.creditsGranted}`,
    ].join('\n')));
  }

  return send(sections.join('\n'));
}

// =============================================================================
// DISPATCH
// =============================================================================

async function handleCommand(text: string): Promise<void> {
  // Strip the @BotName suffix Telegram appends in groups.
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase().replace(/@.*$/, '');
  const args = parts.slice(1);

  switch (command) {
    case '/help':
    case '/start':
      return send(HELP);
    case '/mint':
      return handleMint(args);
    case '/coupon':
    case '/coupons':
      return handleCoupon(args);
    case '/limit':
    case '/limits':
      return handleLimit(args);
    case '/revoke':
      return handleRevoke(args);
    case '/stop':
      return handleGate(false, args);
    case '/resume':
      return handleGate(true, args);
    case '/stats':
      return handleStats(args);
    default:
      return send(`Unknown command ${escapeHtml(command)}\n\n${HELP}`);
  }
}

async function processUpdate(update: any): Promise<void> {
  const message = update.message ?? update.edited_message;
  const chatId = message?.chat?.id;
  if (!message || chatId === undefined) return;

  if (String(chatId) !== String(ADMIN_CHAT_ID)) {
    console.warn(`[telegram] ignoring message from unauthorized chat ${chatId}`);
    return;
  }

  const text: string | undefined = message.text;
  if (!text) return;
  if (!text.startsWith('/')) return send(HELP);

  try {
    await handleCommand(text);
  } catch (err) {
    if (err instanceof CouponError) {
      await send(`${escapeHtml(err.message)}${err.detail ? `\n${escapeHtml(err.detail)}` : ''}`);
    } else {
      console.error('[telegram] command failed:', err);
      await send(`Something went wrong: ${escapeHtml(String(err))}`);
    }
  }
}

// =============================================================================
// POLL LOOP
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollLoop(): Promise<void> {
  console.log('[telegram] bot started, polling for updates');

  for (;;) {
    try {
      const res = await fetch(
        `${API('getUpdates')}?offset=${getOffset()}&timeout=${POLL_TIMEOUT_SECONDS}&allowed_updates=${encodeURIComponent('["message"]')}`
      );
      const body = await res.json() as any;

      if (!body.ok) {
        // 409 means another process is polling this token — the classic
        // dev-and-prod-sharing-a-token failure, worth naming explicitly.
        console.error(`[telegram] getUpdates failed: ${body.description}`);
        if (res.status === 409) {
          console.error('[telegram] another poller is using this bot token; use a separate dev bot');
        }
        await sleep(5000);
        continue;
      }

      for (const update of body.result ?? []) {
        // Advance the offset before handling, so a command that throws can't be
        // replayed in a loop on restart.
        setOffset(update.update_id + 1);
        await processUpdate(update);
      }
    } catch (err) {
      console.error('[telegram] poll error:', err);
      await sleep(5000);
    }
  }
}

export function startTelegramBot(): void {
  if (!TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN is not set - Telegram bot is disabled');
    return;
  }
  if (!ADMIN_CHAT_ID) {
    console.warn('TELEGRAM_ADMIN_CHAT_ID is not set - Telegram bot is disabled');
    return;
  }
  void pollLoop();
}
