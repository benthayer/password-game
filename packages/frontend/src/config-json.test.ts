import { describe, it, expect } from 'vitest';
import {
  configToJson,
  configToJsonText,
  parseConfigFromJsonText,
  ConfigParseError,
  CONFIG_VERSION,
} from './config-json';
import { parseConfigText } from './config-transfer';
import { DEFAULT_CONFIG } from './generation-config';
import type { GenerationConfig } from './generation-config';

const base = (over: Partial<GenerationConfig> = {}): GenerationConfig => ({ ...DEFAULT_CONFIG, ...over });

describe('v2 json', () => {
  it('writes version 2 and no booleans', () => {
    const json = configToJson(base({ includeSalt: true, salt: "x" })) as unknown as Record<string, unknown>;
    expect(json.version).toBe(2);
    expect(CONFIG_VERSION).toBe(2);
    expect('useRecommendedHash' in json).toBe(false);
    expect('includeSalt' in json).toBe(false);
  });

  it('blanks the salt when includeSalt was false', () => {
    const json = configToJson(base({ includeSalt: false, salt: 'ignored' }));
    expect(json.salt).toBe('');
  });

  it('round-trips', () => {
    const cfg = base({ seedPhrase: 'json seed', gridRows: 3, gridCols: 6, includeSalt: true, salt: 'sel' });
    const back = parseConfigFromJsonText(configToJsonText(cfg));
    expect(back.seedPhrase).toBe('json seed');
    expect(back.gridRows).toBe(3);
    expect(back.gridCols).toBe(6);
    expect(back.salt).toBe('sel');
    expect(back.includeSalt).toBe(true);
  });
});

describe('v1 backwards compatibility', () => {
  const v1 = (over: Record<string, unknown> = {}) =>
    JSON.stringify({
      version: 1,
      seedPhrase: 'old seed',
      gridRows: 4,
      gridCols: 4,
      hashAlgorithm: { algorithm: 'argon2id', memoryCost: 65536, timeCost: 3, parallelism: 1 },
      useRecommendedHash: true,
      includeSalt: true,
      salt: 'oldsalt',
      ...over,
    });

  it('still imports a v1 file', () => {
    const cfg = parseConfigFromJsonText(v1());
    expect(cfg.seedPhrase).toBe('old seed');
    expect(cfg.salt).toBe('oldsalt');
    expect(cfg.hashAlgorithm).toEqual({
      algorithm: 'argon2id', memoryCost: 65536, timeCost: 3, parallelism: 1,
    });
  });

  it('honours v1 includeSalt:false so keys still derive identically', () => {
    // v1 derivation did effectiveSalt = includeSalt ? salt : ''
    const cfg = parseConfigFromJsonText(v1({ includeSalt: false, salt: 'wasIgnored' }));
    expect(cfg.salt).toBe('');
    expect(cfg.includeSalt).toBe(false);
  });

  it('discards useRecommendedHash without complaint', () => {
    expect(parseConfigFromJsonText(v1({ useRecommendedHash: true })).useRecommendedHash).toBe(false);
  });

  it('rejects a version from the future', () => {
    expect(() => parseConfigFromJsonText(v1({ version: 99 }))).toThrow(ConfigParseError);
  });
});

describe('unified import auto-detection', () => {
  it('accepts a pasted v2 string', () => {
    expect(parseConfigText('v2:s:4x4:sha256:pep').seedPhrase).toBe('s');
  });

  it('accepts pasted v2 json', () => {
    const text = configToJsonText(base({ seedPhrase: 'pasted', includeSalt: true, salt: 'q' }));
    expect(parseConfigText(text).seedPhrase).toBe('pasted');
  });

  it('accepts pasted v1 json', () => {
    const text = JSON.stringify({
      version: 1, seedPhrase: 'v1 paste', gridRows: 4, gridCols: 4,
      hashAlgorithm: { algorithm: 'sha256' }, useRecommendedHash: false,
      includeSalt: false, salt: 'nope',
    });
    const cfg = parseConfigText(text);
    expect(cfg.seedPhrase).toBe('v1 paste');
    expect(cfg.salt).toBe('');
  });

  it('complains about empty input', () => {
    expect(() => parseConfigText('   ')).toThrow(/Paste a configuration/);
  });
});
