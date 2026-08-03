import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// See coupon-service.test.ts — DATA_DIR must be set before storage/db.ts loads.
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-bot-test-'));
process.env.DATA_DIR = TEST_DATA_DIR;

let bot: typeof import('./telegram-bot.js');
let transportMod: typeof import('./telegram-transport.js');
let store: typeof import('../storage/db.js');

const ADMIN = '1119918660';
const STRANGER = '999000111';

beforeAll(async () => {
  bot = await import('./telegram-bot.js');
  transportMod = await import('./telegram-transport.js');
  store = await import('../storage/db.js');
});

beforeEach(() => {
  store.db.exec(`DELETE FROM bot_state;`);
});

// =============================================================================
// FAKES
// =============================================================================

interface Sent { kind: 'message' | 'photo'; text: string; qrPayload?: string }

function fakeTransport(pages: Array<Partial<import('./telegram-transport.js').FetchUpdatesResult>>) {
  const sent: Sent[] = [];
  let call = 0;
  const transport: import('./telegram-transport.js').TelegramTransport = {
    async fetchUpdates() {
      const page = pages[Math.min(call++, pages.length - 1)] ?? {};
      return { ok: true, status: 200, updates: [], ...page };
    },
    async sendMessage(text) { sent.push({ kind: 'message', text }); return true; },
    async sendPhoto(qrPayload, caption) { sent.push({ kind: 'photo', text: caption, qrPayload }); return true; },
  };
  return { transport, sent, calls: () => call };
}

function message(updateId: number, text: string, chatId: string = ADMIN) {
  return { update_id: updateId, message: { text, chat: { id: chatId } } };
}

function deps(
  transport: import('./telegram-transport.js').TelegramTransport,
  overrides: Partial<import('./telegram-bot.js').BotDeps> = {}
): import('./telegram-bot.js').BotDeps {
  return {
    transport,
    adminChatId: ADMIN,
    getOffset: bot.getOffset,
    setOffset: bot.setOffset,
    handle: (text: string) => ({ text: `handled:${text}` }),
    pollTimeoutSeconds: 0,
    ...overrides,
  };
}

// =============================================================================
// RECEIVE
// =============================================================================

describe('receive: dispatch', () => {
  it('hands the raw text to the handler and sends the reply', async () => {
    const f = fakeTransport([{ updates: [message(1, '/help')] }]);
    const result = await bot.pumpOnce(deps(f.transport));

    expect(result).toMatchObject({ ok: true, handled: 1, ignored: 0 });
    expect(f.sent).toEqual([{ kind: 'message', text: 'handled:/help' }]);
  });

  it('sends a photo when the reply carries a QR payload', async () => {
    const f = fakeTransport([{ updates: [message(1, '/mint')] }]);
    await bot.pumpOnce(deps(f.transport, {
      handle: () => ({ text: 'caption here', qrPayload: 'PG-TOKEN' }),
    }));

    expect(f.sent).toEqual([{ kind: 'photo', text: 'caption here', qrPayload: 'PG-TOKEN' }]);
  });

  it('falls back to text when the photo upload fails, so the token is not lost', async () => {
    const sent: Sent[] = [];
    const transport: import('./telegram-transport.js').TelegramTransport = {
      async fetchUpdates() { return { ok: true, status: 200, updates: [message(1, '/mint')] }; },
      async sendMessage(text) { sent.push({ kind: 'message', text }); return true; },
      async sendPhoto() { return false; },
    };

    await bot.pumpOnce(deps(transport, {
      handle: () => ({ text: 'token PG-ABC', qrPayload: 'PG-ABC' }),
    }));

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('token PG-ABC');
    expect(sent[0].text).toContain('QR image failed');
  });

  it('drains several updates in one cycle, in order', async () => {
    const f = fakeTransport([{ updates: [message(1, '/a'), message(2, '/b'), message(3, '/c')] }]);
    const result = await bot.pumpOnce(deps(f.transport));

    expect(result.handled).toBe(3);
    expect(f.sent.map(s => s.text)).toEqual(['handled:/a', 'handled:/b', 'handled:/c']);
  });
});

describe('receive: authorization', () => {
  it('ignores messages from any other chat', async () => {
    const f = fakeTransport([{ updates: [message(1, '/mint 1000', STRANGER)] }]);
    const result = await bot.pumpOnce(deps(f.transport));

    expect(result).toMatchObject({ handled: 0, ignored: 1 });
    expect(f.sent).toHaveLength(0);
  });

  it('still advances the offset past an unauthorized message', async () => {
    const f = fakeTransport([{ updates: [message(7, '/mint', STRANGER)] }]);
    await bot.pumpOnce(deps(f.transport));

    // Otherwise a stranger's message would be re-fetched forever.
    expect(bot.getOffset()).toBe(8);
  });

  it('compares chat ids across numeric and string forms', async () => {
    const f = fakeTransport([{ updates: [{ update_id: 1, message: { text: '/help', chat: { id: Number(ADMIN) } } }] }]);
    const result = await bot.pumpOnce(deps(f.transport));

    // Telegram sends chat.id as a number; the configured id is a string.
    expect(result.handled).toBe(1);
  });

  it('ignores updates with no message or no text', async () => {
    const f = fakeTransport([{ updates: [
      { update_id: 1 },
      { update_id: 2, message: { chat: { id: ADMIN } } },
    ] }]);
    const result = await bot.pumpOnce(deps(f.transport));

    expect(result).toMatchObject({ handled: 0, ignored: 2 });
  });

  it('handles edited messages too', async () => {
    const f = fakeTransport([{ updates: [
      { update_id: 1, edited_message: { text: '/help', chat: { id: ADMIN } } },
    ] }]);
    expect((await bot.pumpOnce(deps(f.transport))).handled).toBe(1);
  });
});

describe('receive: offset persistence', () => {
  it('starts at zero and advances past the highest update', async () => {
    expect(bot.getOffset()).toBe(0);
    const f = fakeTransport([{ updates: [message(41, '/help'), message(42, '/help')] }]);
    await bot.pumpOnce(deps(f.transport));
    expect(bot.getOffset()).toBe(43);
  });

  it('survives a restart, so commands are not replayed', async () => {
    const f = fakeTransport([{ updates: [message(100, '/help')] }]);
    await bot.pumpOnce(deps(f.transport));

    // Re-reading through a fresh call is what a restarted process does.
    expect(bot.getOffset()).toBe(101);
    const row = store.db.prepare(`SELECT value FROM bot_state WHERE key = 'telegram_offset'`).get() as any;
    expect(row.value).toBe('101');
  });

  it('passes the stored offset to fetchUpdates', async () => {
    bot.setOffset(555);
    const spy = vi.fn(async () => ({ ok: true, status: 200, updates: [] }));
    await bot.pumpOnce(deps({
      fetchUpdates: spy,
      sendMessage: async () => true,
      sendPhoto: async () => true,
    }));

    expect(spy).toHaveBeenCalledWith(555, 0);
  });

  it('advances the offset before dispatching, so a thrown handler cannot loop forever', async () => {
    const f = fakeTransport([{ updates: [message(9, '/boom')] }]);
    await bot.pumpOnce(deps(f.transport, {
      handle: () => { throw new Error('handler exploded'); },
    }));

    expect(bot.getOffset()).toBe(10);
  });
});

describe('receive: failure handling', () => {
  it('reports a failed getUpdates without advancing the offset', async () => {
    const f = fakeTransport([{ ok: false, status: 500, description: 'Internal Server Error' }]);
    const result = await bot.pumpOnce(deps(f.transport));

    expect(result).toMatchObject({ ok: false, status: 500, handled: 0 });
    expect(bot.getOffset()).toBe(0);
  });

  it('surfaces a 409 conflict, the dev-and-prod-sharing-a-token case', async () => {
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a: any[]) => { errors.push(a.join(' ')); });
    const f = fakeTransport([{ ok: false, status: 409, description: 'Conflict: terminated by other getUpdates' }]);

    const result = await bot.pumpOnce(deps(f.transport));
    spy.mockRestore();

    expect(result.ok).toBe(false);
    expect(errors.join('\n')).toMatch(/another poller/i);
  });

  it('replies with an apology when the handler throws, and keeps draining', async () => {
    const f = fakeTransport([{ updates: [message(1, '/boom'), message(2, '/fine')] }]);
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await bot.pumpOnce(deps(f.transport, {
      handle: (text: string) => {
        if (text === '/boom') throw new Error('nope');
        return { text: `handled:${text}` };
      },
    }));
    spy.mockRestore();

    expect(result.handled).toBe(2);
    expect(f.sent[0].text).toContain('Something went wrong');
    expect(f.sent[1].text).toBe('handled:/fine');
  });
});

// =============================================================================
// SEND
// =============================================================================

describe('send: HTTP transport', () => {
  const TOKEN = 'test-token';
  const CHAT = '424242';

  function stubFetch(response: any, status = 200) {
    const calls: Array<{ url: string; init?: any }> = [];
    const stub = vi.fn(async (url: any, init?: any) => {
      calls.push({ url: String(url), init });
      return { status, json: async () => response } as any;
    });
    vi.stubGlobal('fetch', stub);
    return calls;
  }

  it('sends text as HTML with the configured chat id', async () => {
    const calls = stubFetch({ ok: true });
    const t = transportMod.createHttpTransport(TOKEN, CHAT);

    expect(await t.sendMessage('<b>hi</b>')).toBe(true);
    expect(calls[0].url).toContain(`/bot${TOKEN}/sendMessage`);
    const body = JSON.parse(calls[0].init.body);
    expect(body).toMatchObject({ chat_id: CHAT, text: '<b>hi</b>', parse_mode: 'HTML' });
    vi.unstubAllGlobals();
  });

  it('truncates text to the Telegram limit instead of erroring', async () => {
    const calls = stubFetch({ ok: true });
    const t = transportMod.createHttpTransport(TOKEN, CHAT);

    await t.sendMessage('x'.repeat(9000));
    expect(JSON.parse(calls[0].init.body).text.length).toBe(4096);
    vi.unstubAllGlobals();
  });

  it('reports failure when Telegram says not ok', async () => {
    stubFetch({ ok: false, description: 'chat not found' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = transportMod.createHttpTransport(TOKEN, CHAT);

    expect(await t.sendMessage('hi')).toBe(false);
    spy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('reports failure rather than throwing when the network dies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const t = transportMod.createHttpTransport(TOKEN, CHAT);

    expect(await t.sendMessage('hi')).toBe(false);
    spy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('uploads the QR as multipart with a png part and the caption', async () => {
    const calls = stubFetch({ ok: true });
    const t = transportMod.createHttpTransport(TOKEN, CHAT);

    expect(await t.sendPhoto('PG-ABCDE', 'a caption')).toBe(true);

    const form = calls[0].init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('chat_id')).toBe(CHAT);
    expect(form.get('caption')).toBe('a caption');
    const photo = form.get('photo') as File;
    expect(photo).toBeInstanceOf(Blob);
    expect(photo.type).toBe('image/png');
    // A real PNG, not an empty part.
    expect(photo.size).toBeGreaterThan(100);
    vi.unstubAllGlobals();
  });

  it('truncates an over-long caption', async () => {
    const calls = stubFetch({ ok: true });
    const t = transportMod.createHttpTransport(TOKEN, CHAT);

    await t.sendPhoto('PG-ABCDE', 'y'.repeat(3000));
    expect((calls[0].init.body as FormData).get('caption')!.toString().length).toBe(1024);
    vi.unstubAllGlobals();
  });

  it('requests updates with the stored offset and a long-poll timeout', async () => {
    const calls = stubFetch({ ok: true, result: [message(5, '/help')] });
    const t = transportMod.createHttpTransport(TOKEN, CHAT);

    const res = await t.fetchUpdates(77, 50);
    expect(calls[0].url).toContain('offset=77');
    expect(calls[0].url).toContain('timeout=50');
    expect(res.updates).toHaveLength(1);
    expect(res.ok).toBe(true);
    vi.unstubAllGlobals();
  });

  it('passes the HTTP status through so 409 can be detected', async () => {
    stubFetch({ ok: false, description: 'Conflict' }, 409);
    const t = transportMod.createHttpTransport(TOKEN, CHAT);

    const res = await t.fetchUpdates(0, 0);
    expect(res).toMatchObject({ ok: false, status: 409 });
    vi.unstubAllGlobals();
  });
});
