/**
 * Wiring for the coupon admin bot: pull updates, authorize, hand the text to the
 * command layer, send the reply. Deliberately thin — the parsing lives in
 * telegram-commands.ts and the network in telegram-transport.ts, both of which
 * are tested independently.
 *
 * Only one process may poll a given bot token: a second poller silently steals
 * updates from the first. Run a separate BotFather bot for local development
 * rather than pointing dev and prod at the same token.
 */

import { db } from '../storage/db.js';
import { handleCommand, type CommandReply } from './telegram-commands.js';
import { createHttpTransport, type TelegramTransport, type TelegramUpdate } from './telegram-transport.js';

const POLL_TIMEOUT_SECONDS = 50;
const ERROR_BACKOFF_MS = 5000;

// =============================================================================
// OFFSET PERSISTENCE
// =============================================================================

export function getOffset(): number {
  const row = db.prepare(`SELECT value FROM bot_state WHERE key = 'telegram_offset'`).get() as any;
  return row ? Number(row.value) : 0;
}

export function setOffset(offset: number): void {
  db.prepare(`
    INSERT INTO bot_state (key, value) VALUES ('telegram_offset', ?)
    ON CONFLICT(key) DO UPDATE SET value = ?
  `).run(String(offset), String(offset));
}

// =============================================================================
// PUMP
// =============================================================================

export interface BotDeps {
  transport: TelegramTransport;
  adminChatId: string;
  getOffset(): number;
  setOffset(offset: number): void;
  handle(text: string): CommandReply;
  pollTimeoutSeconds?: number;
}

function textOf(update: TelegramUpdate): { chatId?: string; text?: string } {
  const message = update.message ?? update.edited_message;
  const chatId = message?.chat?.id;
  return {
    chatId: chatId === undefined ? undefined : String(chatId),
    text: message?.text,
  };
}

/**
 * One receive cycle. Returns what happened so tests can assert on it without
 * inspecting logs. Advances the offset before dispatching, so a command that
 * throws can't be replayed forever across restarts.
 */
export async function pumpOnce(deps: BotDeps): Promise<{
  ok: boolean;
  status: number;
  handled: number;
  ignored: number;
}> {
  const result = await deps.transport.fetchUpdates(
    deps.getOffset(),
    deps.pollTimeoutSeconds ?? POLL_TIMEOUT_SECONDS
  );

  if (!result.ok) {
    console.error(`[telegram] getUpdates failed: ${result.description}`);
    // 409 means another process is polling this token — the classic
    // dev-and-prod-sharing-a-token failure, worth naming explicitly.
    if (result.status === 409) {
      console.error('[telegram] another poller is using this bot token; use a separate dev bot');
    }
    return { ok: false, status: result.status, handled: 0, ignored: 0 };
  }

  let handled = 0;
  let ignored = 0;

  for (const update of result.updates) {
    deps.setOffset(update.update_id + 1);

    const { chatId, text } = textOf(update);
    if (chatId === undefined || text === undefined) {
      ignored++;
      continue;
    }
    if (chatId !== deps.adminChatId) {
      console.warn(`[telegram] ignoring message from unauthorized chat ${chatId}`);
      ignored++;
      continue;
    }

    try {
      const reply = deps.handle(text);
      if (reply.qrPayload) {
        const sent = await deps.transport.sendPhoto(reply.qrPayload, reply.text);
        // The token is unrecoverable once minted, so fall back to text rather
        // than losing it to a failed image upload.
        if (!sent) await deps.transport.sendMessage(`${reply.text}\n\n(QR image failed to send)`);
      } else {
        await deps.transport.sendMessage(reply.text);
      }
      handled++;
    } catch (err) {
      // A thrown handler must not stop the loop from draining the rest.
      console.error('[telegram] dispatch failed:', err);
      await deps.transport.sendMessage('Something went wrong handling that command.');
      handled++;
    }
  }

  return { ok: true, status: result.status, handled, ignored };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function pollLoop(deps: BotDeps): Promise<void> {
  console.log('[telegram] bot started, polling for updates');
  for (;;) {
    try {
      const result = await pumpOnce(deps);
      if (!result.ok) await sleep(ERROR_BACKOFF_MS);
    } catch (err) {
      console.error('[telegram] poll error:', err);
      await sleep(ERROR_BACKOFF_MS);
    }
  }
}

export function startTelegramBot(): void {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token) {
    console.warn('TELEGRAM_BOT_TOKEN is not set - Telegram bot is disabled');
    return;
  }
  if (!adminChatId) {
    console.warn('TELEGRAM_ADMIN_CHAT_ID is not set - Telegram bot is disabled');
    return;
  }

  void pollLoop({
    transport: createHttpTransport(token, adminChatId),
    adminChatId,
    getOffset,
    setOffset,
    handle: handleCommand,
  });
}
