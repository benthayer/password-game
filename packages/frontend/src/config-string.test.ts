import { describe, it, expect } from 'vitest';
import {
  configToString,
  parseConfigString,
  escapeField,
  splitEscaped,
  ConfigStringParseError,
  CONFIG_STRING_VERSION,
} from './config-string';
import type { GenerationConfig } from './generation-config';
import { DEFAULT_CONFIG } from './generation-config';

const base = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
});

describe('escaping', () => {
  it('escapes colons and backslashes and nothing else', () => {
    expect(escapeField('a:b')).toBe('a\\:b');
    expect(escapeField('a\\b')).toBe('a\\\\b');
    expect(escapeField('a\nb\tc"d')).toBe('a\nb\tc"d');
  });

  it('round-trips nasty values through split', () => {
    for (const v of ['', ':', '\\', '::', '\\:', ':\\', 'a:b\\c:', '\\\\\\', 'plain']) {
      expect(splitEscaped(escapeField(v))).toEqual([v]);
    }
  });

  it('splits only on unescaped colons', () => {
    expect(splitEscaped('a:b:c')).toEqual(['a', 'b', 'c']);
    expect(splitEscaped('a\\:b:c')).toEqual(['a:b', 'c']);
    expect(splitEscaped('a\\\\:b')).toEqual(['a\\', 'b']);
    expect(splitEscaped('')).toEqual(['']);
    expect(splitEscaped(':')).toEqual(['', '']);
  });

  it('rejects malformed escapes', () => {
    expect(() => splitEscaped('abc\\')).toThrow(ConfigStringParseError);
    expect(() => splitEscaped('a\\nb')).toThrow(ConfigStringParseError);
  });
});

describe('serialize', () => {
  it('produces the documented shape', () => {
    const s = configToString(
      base({
        seedPhrase: 'hello',
        gridRows: 4,
        gridCols: 4,
        hashAlgorithm: { algorithm: 'argon2id', memoryCost: 65536, timeCost: 3, parallelism: 1 },
        includeSalt: true,
        salt: 'abc',
      })
    );
    expect(s).toBe('v2:hello:4x4:argon2id:65536:3:1:abc');
  });

  it('keeps empty seed and empty salt as empty fields', () => {
    const s = configToString(
      base({ seedPhrase: '', hashAlgorithm: { algorithm: 'sha256' }, includeSalt: false, salt: '' })
    );
    expect(s).toBe('v2::4x4:sha256:');
  });

  it('drops the salt when includeSalt was false', () => {
    const s = configToString(base({ hashAlgorithm: { algorithm: 'sha256' }, includeSalt: false, salt: 'ignored' }));
    expect(s).toBe('v2::4x4:sha256:');
  });

  it('emits non-square grids as rowsxcols', () => {
    const s = configToString(base({ gridRows: 3, gridCols: 5, hashAlgorithm: { algorithm: 'sha256' } }));
    expect(s).toContain(':3x5:');
  });
});

describe('round trip', () => {
  const algos: GenerationConfig['hashAlgorithm'][] = [
    { algorithm: 'argon2id', memoryCost: 65536, timeCost: 3, parallelism: 1 },
    { algorithm: 'scrypt', N: 1048576, r: 8, p: 1 },
    { algorithm: 'bcrypt', cost: 12 },
    { algorithm: 'pbkdf2', iterations: 600000, hash: 'sha512' },
    { algorithm: 'sha256' },
  ];

  for (const hashAlgorithm of algos) {
    it(`round-trips ${hashAlgorithm.algorithm}`, () => {
      const cfg = base({ seedPhrase: 'a seed', hashAlgorithm, includeSalt: true, salt: 'NaCl' });
      const parsed = parseConfigString(configToString(cfg));
      expect(parsed.hashAlgorithm).toEqual(hashAlgorithm);
      expect(parsed.seedPhrase).toBe('a seed');
      expect(parsed.salt).toBe('NaCl');
    });
  }

  it('round-trips colons in the seed phrase', () => {
    const cfg = base({ seedPhrase: 'to:be:or:not', hashAlgorithm: { algorithm: 'sha256' }, includeSalt: true, salt: 'x' });
    expect(parseConfigString(configToString(cfg)).seedPhrase).toBe('to:be:or:not');
  });

  it('round-trips colons and backslashes in the salt', () => {
    const salt = 'a:b\\c:\\';
    const cfg = base({ seedPhrase: '', hashAlgorithm: { algorithm: 'sha256' }, includeSalt: true, salt });
    expect(parseConfigString(configToString(cfg)).salt).toBe(salt);
  });

  it('a salt that looks like a whole config does not break parsing', () => {
    const salt = 'v2:evil:4x4:sha256:';
    const cfg = base({ seedPhrase: 's', hashAlgorithm: { algorithm: 'sha256' }, includeSalt: true, salt });
    const parsed = parseConfigString(configToString(cfg));
    expect(parsed.salt).toBe(salt);
    expect(parsed.seedPhrase).toBe('s');
  });
});

describe('parse validation', () => {
  it('accepts surrounding whitespace', () => {
    expect(parseConfigString('  v2:s:4x4:sha256:salt  ').seedPhrase).toBe('s');
  });

  it('infers includeSalt from emptiness', () => {
    expect(parseConfigString('v2:s:4x4:sha256:').includeSalt).toBe(false);
    expect(parseConfigString('v2:s:4x4:sha256:pepper').includeSalt).toBe(true);
  });

  it('rejects empty input', () => {
    expect(() => parseConfigString('   ')).toThrow(ConfigStringParseError);
  });

  it('rejects a missing/!bad version prefix', () => {
    expect(() => parseConfigString('s:4x4:sha256:')).toThrow(/must start with a version/);
    expect(() => parseConfigString('2:s:4x4:sha256:')).toThrow(/must start with a version/);
  });

  it('rejects a future version', () => {
    expect(() => parseConfigString('v99:s:4x4:sha256:')).toThrow(/newer than this app supports/);
  });

  it('rejects an unknown algorithm', () => {
    expect(() => parseConfigString('v2:s:4x4:md5:')).toThrow(/Unknown hash algorithm/);
  });

  it('rejects a bad grid', () => {
    expect(() => parseConfigString('v2:s:4-4:sha256:')).toThrow(/Grid must look like/);
    expect(() => parseConfigString('v2:s:1x4:sha256:')).toThrow(/between 2 and 10/);
    expect(() => parseConfigString('v2:s:4x11:sha256:')).toThrow(/between 2 and 10/);
  });

  it('rejects wrong param counts', () => {
    expect(() => parseConfigString('v2:s:4x4:argon2id:65536:3')).toThrow(/needs 3 parameters/);
    // a trailing empty field is consumed as the 3rd param, leaving no salt field
    expect(() => parseConfigString('v2:s:4x4:argon2id:65536:3:')).toThrow(/exactly one salt field/);
    expect(() => parseConfigString('v2:s:4x4:argon2id:65536:3:1:2:salt')).toThrow(/exactly one salt field/);
  });

  it('rejects non-numeric params', () => {
    expect(() => parseConfigString('v2:s:4x4:bcrypt:twelve:')).toThrow(/must be a non-negative integer/);
  });

  it('rejects a bad pbkdf2 hash', () => {
    expect(() => parseConfigString('v2:s:4x4:pbkdf2:600000:sha1:')).toThrow(/must be "sha256" or "sha512"/);
  });

  it('reports the version constant it writes', () => {
    expect(CONFIG_STRING_VERSION).toBe(2);
    expect(configToString(base()).startsWith('v2:')).toBe(true);
  });
});
