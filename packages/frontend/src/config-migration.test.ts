/**
 * The safety-critical property of the v1 -> v2 migration.
 *
 * Dropping `includeSalt` is only lossless if a v1 config keeps deriving the
 * SAME key after import. v1 derivation did:
 *     effectiveSalt = includeSalt ? salt : ''
 * so v2 must reproduce that exact effective salt. If this test ever fails,
 * someone's stored data has become unrecoverable.
 */

import { describe, it, expect } from 'vitest';
import { parseConfigFromJsonText } from './config-json';
import { parseConfigString, configToString } from './config-string';
import { getHashConfig } from './generation-config';
import { createHashFunction } from './hash-function';

const v1Json = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    version: 1,
    seedPhrase: 'migration seed',
    gridRows: 4,
    gridCols: 4,
    hashAlgorithm: { algorithm: 'sha256' },
    useRecommendedHash: false,
    includeSalt: true,
    salt: 'the-salt',
    ...over,
  });

/** Derivation as v1 performed it, straight from the raw JSON fields. */
function v1EffectiveSalt(raw: Record<string, unknown>): string {
  return raw.includeSalt ? (raw.salt as string) : '';
}

describe('v1 -> v2 derivation equivalence', () => {
  for (const includeSalt of [true, false]) {
    it(`derives an identical hash when v1 includeSalt=${includeSalt}`, async () => {
      const text = v1Json({ includeSalt });
      const raw = JSON.parse(text);

      const migrated = parseConfigFromJsonText(text);
      const migratedHash = createHashFunction(getHashConfig(migrated));

      // Reconstruct v1 behaviour explicitly.
      const legacyHash = createHashFunction({
        algorithmConfig: { algorithm: 'sha256' },
        includeSalt: true,
        salt: v1EffectiveSalt(raw),
      });

      const probe = 'correct horse battery staple';
      expect(await migratedHash(probe)).toBe(await legacyHash(probe));
    });
  }

  it('survives the extra hop through the v2 string form', async () => {
    const migrated = parseConfigFromJsonText(v1Json({ includeSalt: true }));
    const viaString = parseConfigString(configToString(migrated));

    const a = createHashFunction(getHashConfig(migrated));
    const b = createHashFunction(getHashConfig(viaString));

    const probe = 'another probe';
    expect(await a(probe)).toBe(await b(probe));
  });

  it('an unsalted v1 config and an empty-salt v2 string agree', async () => {
    const migrated = parseConfigFromJsonText(v1Json({ includeSalt: false }));
    const fromString = parseConfigString('v2:migration seed:4x4:sha256:');

    const a = createHashFunction(getHashConfig(migrated));
    const b = createHashFunction(getHashConfig(fromString));

    const probe = 'third probe';
    expect(await a(probe)).toBe(await b(probe));
  });
});
