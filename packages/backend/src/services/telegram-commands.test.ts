import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// See coupon-service.test.ts — DATA_DIR must be set before storage/db.ts loads.
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pg-cmd-test-'));
process.env.DATA_DIR = TEST_DATA_DIR;

let cmd: typeof import('./telegram-commands.js');
let svc: typeof import('./coupon-service.js');
let store: typeof import('../storage/db.js');

beforeAll(async () => {
  cmd = await import('./telegram-commands.js');
  svc = await import('./coupon-service.js');
  store = await import('../storage/db.js');
});

beforeEach(() => {
  store.db.exec('DELETE FROM tokens; DELETE FROM mint_limits; DELETE FROM coupons; DELETE FROM accounts;');
  svc.setGate('coupon', true);
  svc.setGate('redemption', true);
});

/** Every command goes through the same door the bot uses. */
const run = (line: string) => cmd.handleCommand(line);
const text = (line: string) => run(line).text;

function liveCoupon(code: string, credits = 1, max = 100, window: number | null = null) {
  const { coupon } = svc.addCoupon(code, credits);
  svc.addCap(coupon.id, max, window);
  return coupon;
}

// =============================================================================

describe('help and unknown commands', () => {
  it('answers /help and /start with the help text', () => {
    expect(text('/help')).toContain('Coupon management');
    expect(text('/start')).toContain('Coupon management');
  });

  it('answers non-commands with help rather than silence', () => {
    expect(text('hello there')).toContain('Coupon management');
  });

  it('names the unknown command and offers help', () => {
    const out = text('/frobnicate');
    expect(out).toContain('/frobnicate');
    expect(out).toContain('Coupon management');
  });

  it('strips the @BotName suffix Telegram adds in groups', () => {
    expect(text('/help@password_game_management_bot')).toContain('Coupon management');
  });

  it('never throws, whatever it is handed', () => {
    for (const line of ['/', '//', '/mint abc', '/limit rm', '/coupon add', '/stats bogus',
                        '/revoke', '/stop', '/resume', '/limit NOPE 5', '   /help   ']) {
      expect(() => run(line), line).not.toThrow();
      expect(typeof run(line).text, line).toBe('string');
    }
  });
});

describe('/mint', () => {
  it('mints one credit by default and returns a QR payload', () => {
    const out = run('/mint');
    expect(out.text).toContain('1 credit');
    expect(out.qrPayload).toMatch(/^[0-9A-Z]{5}(-[0-9A-Z]{5}){3}-[0-9A-Z]{6}$/);
    // The QR encodes exactly the token shown in the text.
    expect(out.text).toContain(out.qrPayload!);
  });

  it('accepts an explicit credit amount', () => {
    const out = run('/mint 25');
    expect(out.text).toContain('25 credits');
    expect(out.qrPayload).toBeTruthy();
  });

  it('rejects a non-numeric amount without minting', () => {
    const out = run('/mint banana');
    expect(out.text).toContain('Usage: /mint');
    expect(out.qrPayload).toBeUndefined();
    expect(svc.tokenStats(svc.parseStatsRange([])).minted).toBe(0);
  });

  it('rejects zero and negative amounts', () => {
    expect(text('/mint 0')).toContain('Usage: /mint');
    expect(text('/mint -5')).toContain('Usage: /mint');
    expect(svc.tokenStats(svc.parseStatsRange([])).minted).toBe(0);
  });

  it('works while the coupon gate is closed and caps are exhausted', () => {
    svc.addCap(null, 1, 3600);
    liveCoupon('DRAIN');
    svc.mintFromCoupon('DRAIN');
    svc.setGate('coupon', false);

    expect(run('/mint 3').qrPayload).toBeTruthy();
  });
});

describe('/coupon', () => {
  it('says so when there are none', () => {
    expect(text('/coupon')).toContain('No coupons');
    expect(text('/coupon list')).toContain('No coupons');
  });

  it('creates a coupon and states that it is inert', () => {
    const out = text('/coupon add SUMMER 5');
    expect(out).toContain('SUMMER');
    expect(out).toContain('5 credits');
    expect(out).toContain('inert');
    // And it really is unusable.
    expect(() => svc.mintFromCoupon('SUMMER')).toThrow();
  });

  it('defaults to 1 credit', () => {
    expect(text('/coupon add PLAIN')).toContain('1 credits');
  });

  it('normalizes the code to uppercase', () => {
    text('/coupon add lowercase 2');
    expect(svc.resolveLiveCoupon('LOWERCASE')).not.toBeNull();
    expect(text('/coupon list')).toContain('LOWERCASE');
  });

  it('reprices an existing live coupon and says tokens keep their value', () => {
    liveCoupon('REPRICE', 2);
    const out = text('/coupon add REPRICE 9');
    expect(out).toContain('repriced to 9');
    expect(out).toContain('keep their original value');
  });

  it('rejects a non-numeric credit value', () => {
    expect(text('/coupon add BAD notanumber')).toContain('is not a number');
  });

  it('requires a code for add and remove', () => {
    expect(text('/coupon add')).toContain('Usage: /coupon add');
    expect(text('/coupon remove')).toContain('Usage: /coupon remove');
  });

  it('marks inert vs live in the list', () => {
    svc.addCoupon('NOLIMIT', 1);
    liveCoupon('HASLIMIT', 1);
    const out = text('/coupon list');
    expect(out).toMatch(/NOLIMIT[^\n]*INERT/);
    expect(out).toMatch(/HASLIMIT[^\n]*live/);
  });

  it('shows a global-only coupon as such', () => {
    const c = svc.addCoupon('GLOBALONLY', 1).coupon;
    svc.setCouponGlobal(c.id);
    expect(text('/coupon list')).toMatch(/GLOBALONLY[^\n]*global limits only/);
  });

  it('retires a coupon and reports rules removed', () => {
    liveCoupon('DONE', 1);
    const out = text('/coupon remove DONE');
    expect(out).toContain('retired');
    expect(out).toContain('1 limit rule');
    expect(svc.resolveLiveCoupon('DONE')).toBeNull();
  });

  it('warns that outstanding tokens survive a retire', () => {
    liveCoupon('OUTSTANDING', 1);
    svc.mintFromCoupon('OUTSTANDING');
    const out = text('/coupon remove OUTSTANDING');
    expect(out).toContain('1 unredeemed token');
    expect(out).toContain('/revoke');
  });

  it('explains when the code does not exist', () => {
    expect(text('/coupon remove GHOST')).toContain('No live coupon');
  });

  it('clears all coupons', () => {
    liveCoupon('AA', 1);
    liveCoupon('BB', 1);
    expect(text('/coupon clear')).toContain('Retired 2');
    expect(text('/coupon list')).toContain('No coupons');
  });

  it('rejects codes outside the allowed charset', () => {
    expect(text('/coupon add A 1')).toContain('2-32 chars');
    expect(text('/coupon add ' + 'X'.repeat(33) + ' 1')).toContain('2-32 chars');
  });

  it('rejects an unknown subcommand', () => {
    expect(text('/coupon frobnicate')).toContain('Unknown: /coupon frobnicate');
  });
});

describe('/limit', () => {
  it('summarizes when there are no rules', () => {
    const out = text('/limit');
    expect(out).toContain('No global caps');
  });

  it('adds a global all-time cap', () => {
    const out = text('/limit 50');
    expect(out).toContain('50 per all-time');
    expect(svc.listLimits(null)).toHaveLength(1);
  });

  it('adds a global windowed cap', () => {
    expect(text('/limit 10 1h')).toContain('10 per 1h');
  });

  it('rejects an unreadable duration without adding a rule', () => {
    expect(text('/limit 10 fortnight')).toContain("Can't read");
    expect(svc.listLimits(null)).toHaveLength(0);
  });

  it('lists and reports status with live usage', () => {
    svc.addCap(null, 5, 3600);
    liveCoupon('USAGE', 1);
    svc.mintFromCoupon('USAGE');

    const out = text('/limit status');
    expect(out).toContain('GLOBAL');
    expect(out).toContain('1 used, 4 left');
  });

  it('shows an exhausted rule with a frees time', () => {
    svc.addCap(null, 1, 3600);
    liveCoupon('FULL', 1);
    svc.mintFromCoupon('FULL');

    const out = text('/limit status');
    expect(out).toContain('0 left');
    expect(out).toContain('exhausted, frees');
  });

  it('lists inert coupons in status', () => {
    svc.addCoupon('FORGOTTEN', 1);
    expect(text('/limit status')).toContain('INERT');
    expect(text('/limit status')).toContain('FORGOTTEN');
  });

  it('removes a global rule by id, with or without #', () => {
    const cap = svc.addCap(null, 5, null);
    expect(text(`/limit rm ${cap.id}`)).toContain(`Removed global limit #${cap.id}`);
    expect(svc.listLimits(null)).toHaveLength(0);

    const second = svc.addCap(null, 5, null);
    expect(text(`/limit rm #${second.id}`)).toContain('Removed global limit');
  });

  it('requires an id for rm and rejects a non-numeric one', () => {
    expect(text('/limit rm')).toContain('Usage: /limit rm ID');
    expect(text('/limit rm abc')).toContain('is not an id');
  });

  it('explains a missing rule id', () => {
    expect(text('/limit rm 999')).toContain('No limit #999');
  });

  it('scopes a cap to a coupon', () => {
    const c = svc.addCoupon('SCOPED', 1).coupon;
    const out = text('/limit SCOPED 3 1h');
    expect(out).toContain('SCOPED cap');
    expect(out).toContain('3 per 1h');
    expect(svc.listLimits(c.id)).toHaveLength(1);
  });

  it('points a coupon at the global caps and warns when none exist', () => {
    svc.addCoupon('INHERIT', 1);
    const out = text('/limit INHERIT global');
    expect(out).toContain('global caps only');
    expect(out).toContain('Warning');
    expect(out).toContain('uncapped');
  });

  it('does not warn about global mode when a global cap exists', () => {
    svc.addCap(null, 10, 3600);
    svc.addCoupon('INHERIT2', 1);
    const out = text('/limit INHERIT2 global');
    expect(out).not.toContain('Warning');
  });

  it('reports how many own rules switching to global removed', () => {
    const c = svc.addCoupon('SWITCH', 1).coupon;
    svc.addCap(c.id, 1, null);
    svc.addCap(c.id, 2, 3600);
    expect(text('/limit SWITCH global')).toContain('2 own rule(s) removed');
  });

  it('warns when removing a coupon rule leaves it unmintable', () => {
    const c = svc.addCoupon('LAST', 1).coupon;
    const cap = svc.addCap(c.id, 5, null);
    const out = text(`/limit LAST rm ${cap.id}`);
    expect(out).toContain('no rules left and can no longer be minted');
  });

  it('refuses to remove a rule belonging to another scope', () => {
    const globalCap = svc.addCap(null, 5, null);
    const c = svc.addCoupon('OTHER', 1).coupon;
    svc.addCap(c.id, 5, null);

    expect(text(`/limit OTHER rm ${globalCap.id}`)).toContain('belongs to the global scope');
    expect(svc.listLimits(null)).toHaveLength(1);
  });

  it('scoped status shows the coupon and the global rules binding it', () => {
    svc.addCap(null, 9, 3600);
    liveCoupon('BOTH', 1, 4, 3600);
    const out = text('/limit BOTH status');
    expect(out).toContain('GLOBAL');
    expect(out).toContain('COUPON BOTH');
  });

  it('explains an unknown coupon', () => {
    expect(text('/limit GHOST 5')).toContain('No live coupon "GHOST"');
  });

  it('rejects an unknown scoped subcommand', () => {
    svc.addCoupon('SUB', 1);
    expect(text('/limit SUB wat')).toContain('Unknown: /limit SUB wat');
  });

  it('accepts /limits as an alias', () => {
    expect(text('/limits')).toContain('global');
  });
});

describe('/revoke', () => {
  it('requires a selector', () => {
    expect(text('/revoke')).toContain('Usage: /revoke');
  });

  it('revokes by id', () => {
    liveCoupon('R1', 1);
    const minted = svc.mintFromCoupon('R1');
    expect(text(`/revoke ${minted.tokenId}`)).toContain('Revoked 1 token');
  });

  it('revokes by token value', () => {
    liveCoupon('R2', 1);
    const minted = svc.mintFromCoupon('R2');
    expect(text(`/revoke ${minted.token}`)).toContain('Revoked 1 token');
  });

  it('revokes everything active', () => {
    liveCoupon('R3', 1);
    svc.mintFromCoupon('R3');
    svc.mintFromCoupon('R3');
    expect(text('/revoke all')).toContain('Revoked 2 token');
  });

  it('revokes by duration', () => {
    liveCoupon('R4', 1);
    svc.mintFromCoupon('R4');
    const out = text('/revoke 1h');
    expect(out).toContain('Revoked 1 token');
    expect(out).toContain('last 1h');
  });

  it('reports nothing to do rather than pretending', () => {
    expect(text('/revoke 12345')).toContain('Nothing to revoke');
  });

  it('states that redeemed tokens are untouched', () => {
    liveCoupon('R5', 1);
    svc.mintFromCoupon('R5');
    expect(text('/revoke all')).toContain('Already-redeemed tokens were not touched');
  });
});

describe('/stop and /resume', () => {
  it('shows usage and current state without a target', () => {
    const out = text('/stop');
    expect(out).toContain('Usage: /stop');
    expect(out).toContain('coupon minting: OPEN');
    expect(out).toContain('redemption: OPEN');
  });

  it('closes and reopens the coupon gate', () => {
    expect(text('/stop coupon')).toContain('coupon minting: CLOSED');
    expect(svc.isGateOpen('coupon')).toBe(false);
    expect(text('/resume coupon')).toContain('coupon minting: OPEN');
    expect(svc.isGateOpen('coupon')).toBe(true);
  });

  it('closes redemption independently of minting', () => {
    text('/stop redemption');
    expect(svc.isGateOpen('redemption')).toBe(false);
    expect(svc.isGateOpen('coupon')).toBe(true);
  });

  it('rejects an unknown gate name', () => {
    expect(text('/stop everything')).toContain('Usage: /stop');
    expect(svc.isGateOpen('coupon')).toBe(true);
  });
});

describe('/stats', () => {
  it('reports all three buckets with no arguments', () => {
    const out = text('/stats');
    expect(out).toContain('TOKENS');
    expect(out).toContain('ACCOUNTS');
    expect(out).toContain('all time');
  });

  it('reports a single bucket when named', () => {
    const out = text('/stats tokens');
    expect(out).toContain('TOKENS');
    expect(out).not.toContain('ACCOUNTS');
  });

  it('splits web and admin mints', () => {
    liveCoupon('SPLIT', 1);
    svc.mintFromCoupon('SPLIT');
    run('/mint 1');

    const out = text('/stats tokens');
    expect(out).toContain('minted    2');
    expect(out).toContain('web 1, admin 1');
  });

  it('shows redeemed counts and credits granted', async () => {
    liveCoupon('GRANT', 7);
    const minted = svc.mintFromCoupon('GRANT');
    await svc.redeemToken(minted.token, 'a'.repeat(64));

    const out = text('/stats tokens');
    expect(out).toContain('redeemed  1');
    expect(out).toContain('credits granted  7');
  });

  it('lists coupons keyed on id so a reused code is not merged', () => {
    liveCoupon('TWICE', 1);
    svc.mintFromCoupon('TWICE');
    svc.retireCoupon('TWICE');
    liveCoupon('TWICE', 1);

    const out = text('/stats coupons');
    expect(out.match(/TWICE/g)!.length).toBe(2);
    expect(out).toContain('(retired)');
  });

  it('accepts a duration range', () => {
    expect(text('/stats tokens 5m')).toContain('last 5m');
  });

  it('accepts the spec example: a clock time and a duration', () => {
    const out = text('/stats tokens 1:34pm 5m');
    expect(out).toContain('13:34');
    expect(out).toContain('→');
  });

  it('accepts a date and time as one bound', () => {
    expect(text('/stats tokens 2026-08-01 1:34pm')).toContain('01 Aug 2026');
  });

  it('explains an unreadable range instead of throwing', () => {
    const out = text('/stats tokens whenever');
    expect(out).toContain("Can't read");
    expect(out).toContain('duration');
  });

  it('rejects more than two bounds', () => {
    expect(text('/stats tokens 5m 2h 7d')).toContain('at most two bounds');
  });

  it('treats an unknown first word as part of the range, not a bucket', () => {
    // "/stats 5m" has no bucket, so all three sections appear.
    const out = text('/stats 5m');
    expect(out).toContain('TOKENS');
    expect(out).toContain('ACCOUNTS');
    expect(out).toContain('last 5m');
  });
});

describe('HTML safety', () => {
  it('escapes angle brackets in echoed user input', () => {
    const out = text('/coupon remove <script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;');
  });

  it('escapes ampersands', () => {
    expect(cmd.escapeHtml('a & b')).toBe('a &amp; b');
  });

  // Codes are constrained to [0-9A-Z_-] at creation, so no stored code can carry
  // markup into a <pre> block. Assert that gate holds rather than testing an
  // escape path nothing can reach.
  it('cannot store a code containing markup', () => {
    expect(() => svc.addCoupon('A<B', 1)).toThrow(/2-32 chars/);
    expect(text('/coupon add <script> 1')).toContain('2-32 chars');
    expect(svc.listLiveCoupons()).toHaveLength(0);
  });
});
