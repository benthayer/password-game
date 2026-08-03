/**
 * Telegram HTTP transport: the two network-facing halves of the bot, receive and
 * send, behind an interface so the poll loop can be driven by a fake in tests.
 *
 * Nothing here knows what a command means.
 */

import QRCode from 'qrcode';

export interface TelegramUpdate {
  update_id: number;
  message?: { text?: string; chat?: { id: number | string } };
  edited_message?: { text?: string; chat?: { id: number | string } };
}

export interface FetchUpdatesResult {
  ok: boolean;
  status: number;
  description?: string;
  updates: TelegramUpdate[];
}

export interface TelegramTransport {
  fetchUpdates(offset: number, timeoutSeconds: number): Promise<FetchUpdatesResult>;
  sendMessage(text: string): Promise<boolean>;
  /** Sends `qrPayload` rendered as a QR image, with `caption` beneath it. */
  sendPhoto(qrPayload: string, caption: string): Promise<boolean>;
}

const TELEGRAM_MAX_TEXT = 4096;
const TELEGRAM_MAX_CAPTION = 1024;

export function createHttpTransport(token: string, chatId: string): TelegramTransport {
  const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;

  return {
    async fetchUpdates(offset, timeoutSeconds) {
      const url = `${api('getUpdates')}?offset=${offset}&timeout=${timeoutSeconds}`
        + `&allowed_updates=${encodeURIComponent('["message"]')}`;
      const res = await fetch(url);
      const body = await res.json() as any;
      return {
        ok: !!body.ok,
        status: res.status,
        description: body.description,
        updates: body.result ?? [],
      };
    },

    async sendMessage(text) {
      try {
        const res = await fetch(api('sendMessage'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text.slice(0, TELEGRAM_MAX_TEXT),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
        });
        const body = await res.json() as any;
        if (!body.ok) console.error('[telegram] sendMessage failed:', body.description);
        return !!body.ok;
      } catch (err) {
        console.error('[telegram] sendMessage threw:', err);
        return false;
      }
    },

    async sendPhoto(qrPayload, caption) {
      try {
        const png = await QRCode.toBuffer(qrPayload, { type: 'png', width: 512, margin: 2 });
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('caption', caption.slice(0, TELEGRAM_MAX_CAPTION));
        form.append('parse_mode', 'HTML');
        form.append('photo', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'token.png');

        const res = await fetch(api('sendPhoto'), { method: 'POST', body: form });
        const body = await res.json() as any;
        if (!body.ok) console.error('[telegram] sendPhoto failed:', body.description);
        return !!body.ok;
      } catch (err) {
        console.error('[telegram] sendPhoto threw:', err);
        return false;
      }
    },
  };
}
