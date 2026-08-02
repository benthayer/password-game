import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { computeEntStats, verifyKeyRandomness } from './encryption-validation.js';

// Golden values produced by the real Fourmilab ent binary (`ent -t`) on these
// exact buffers. computeEntStats must reproduce them — if these drift, the
// ENT_THRESHOLDS calibration no longer applies.
describe('computeEntStats (port of Fourmilab ent)', () => {
  it('matches ent on all-zeros', () => {
    const stats = computeEntStats(Buffer.alloc(32));
    expect(stats.entropy).toBe(0);
    expect(stats.chiSquared).toBe(8160);
    expect(stats.mean).toBe(0);
    expect(stats.serialCorrelation).toBe(-100000); // ent's undefined sentinel
  });

  it('matches ent on ABAB pattern', () => {
    const stats = computeEntStats(Buffer.from(Array(16).fill([0x41, 0x42]).flat()));
    expect(stats.entropy).toBe(1);
    expect(stats.chiSquared).toBe(4064);
    expect(stats.mean).toBe(65.5);
    expect(stats.serialCorrelation).toBe(-1);
  });

  it('matches ent on sequential bytes', () => {
    const stats = computeEntStats(Buffer.from(Array.from({ length: 32 }, (_, i) => i)));
    expect(stats.entropy).toBe(5);
    expect(stats.chiSquared).toBe(224);
    expect(stats.mean).toBe(15.5);
    expect(stats.serialCorrelation).toBeCloseTo(0.818182, 5);
  });

  it('matches ent on 8-byte repeat', () => {
    const stats = computeEntStats(Buffer.from(Array(4).fill([0, 1, 2, 3, 4, 5, 6, 7]).flat()));
    expect(stats.entropy).toBe(3);
    expect(stats.chiSquared).toBe(992);
    expect(stats.mean).toBe(3.5);
    expect(stats.serialCorrelation).toBeCloseTo(0.333333, 5);
  });

  it('matches ent on a fixed random-looking key', () => {
    const stats = computeEntStats(createHash('sha256').update('test').digest());
    expect(stats.entropy).toBe(4.875);
    expect(stats.chiSquared).toBe(256);
    expect(stats.mean).toBe(116.625);
    expect(stats.serialCorrelation).toBeCloseTo(-0.091046, 5);
  });
});

describe('verifyKeyRandomness', () => {
  it('rejects keys shorter than 32 bytes', () => {
    const result = verifyKeyRandomness(Buffer.alloc(31, 0xaa));
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/at least 32 bytes/);
  });

  // The regression test from the intake: with the old subprocess approach the
  // validator failed open and this key was accepted.
  it('rejects 32 identical bytes (0x41)', () => {
    const result = verifyKeyRandomness(Buffer.alloc(32, 0x41));
    expect(result.valid).toBe(false);
    expect(result.patternDetected).toBe('low entropy');
  });

  it('rejects all zeros', () => {
    const result = verifyKeyRandomness(Buffer.alloc(32));
    expect(result.valid).toBe(false);
    expect(result.patternDetected).toBe('low entropy');
  });

  it('rejects ABAB pattern', () => {
    const result = verifyKeyRandomness(Buffer.from(Array(16).fill([0x41, 0x42]).flat()));
    expect(result.valid).toBe(false);
    expect(result.patternDetected).toBe('low entropy');
  });

  it('rejects sequential bytes via serial correlation', () => {
    const result = verifyKeyRandomness(Buffer.from(Array.from({ length: 32 }, (_, i) => i)));
    expect(result.valid).toBe(false);
    expect(result.patternDetected).toBe('serial correlation');
  });

  it('rejects 8-byte repeating pattern via chi-squared', () => {
    const result = verifyKeyRandomness(Buffer.from(Array(4).fill([0, 1, 2, 3, 4, 5, 6, 7]).flat()));
    expect(result.valid).toBe(false);
    expect(result.patternDetected).toBe('chi-squared anomaly');
  });

  it('rejects ASCII text', () => {
    const result = verifyKeyRandomness(Buffer.from('correct horse battery staple !!!', 'utf8'));
    expect(result.valid).toBe(false);
  });

  it('accepts fixed random-looking keys', () => {
    for (const seed of ['test', 'password-game', 'ent', 'fixed-seed-4']) {
      const key = createHash('sha256').update(seed).digest();
      const result = verifyKeyRandomness(key);
      expect(result.valid, `key from seed "${seed}"`).toBe(true);
      expect(result.looksRandom).toBe(true);
    }
  });
});
