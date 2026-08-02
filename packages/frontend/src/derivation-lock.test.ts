/**
 * Derivation-lock tests: pin the word-derivation algorithm with golden
 * vectors so it can NEVER change silently again.
 *
 * Context: on 2026-08-02, commit cbf37b3 added a UI flag (importedFromJson)
 * to GenerationConfig. hashConfig() hashes the whole config object, so the
 * flag leaked into the identity hash and every grid showed different words
 * for the same password. The invariant is that GenerationConfig contains
 * ONLY derivation inputs — nothing else may ever live on it. These tests
 * exist so that any change to the derivation — the config shape, config
 * hashing, word hashing, position derivation, corpus, or canonical
 * serialization — fails loudly.
 *
 * The golden vectors were generated from the algorithm as of commit 19bd1a0
 * (the last commit before the regression) via an independent
 * node:crypto implementation. DO NOT regenerate them from current code to
 * make a failing test pass: a failure here means existing users' passwords
 * no longer replay to the same words. If the hash changed, you fucked up;
 * fix the code, not the vectors.
 */

import { describe, it, expect } from 'vitest';
import CryptoJS from 'crypto-js';
import * as corpus from '../corpus.json';
import {
  hashConfig,
  getIdentityHash,
  getNextWordsFlat,
  canonicalStringify,
} from './crypto-utils';
import { DEFAULT_CONFIG, type GenerationConfig } from './generation-config';
import { DEFAULT_ARGON2ID_CONFIG } from './hash-config';

const DEFAULT_VECTOR_CONFIG: GenerationConfig = {
  seedPhrase: '',
  gridRows: 4,
  gridCols: 4,
  hashAlgorithm: DEFAULT_ARGON2ID_CONFIG,
  useRecommendedHash: true,
  includeSalt: false,
  salt: '',
};

const SALTED_VECTOR_CONFIG: GenerationConfig = {
  seedPhrase: 'correct horse',
  gridRows: 3,
  gridCols: 4,
  hashAlgorithm: DEFAULT_ARGON2ID_CONFIG,
  useRecommendedHash: false,
  includeSalt: true,
  salt: 'c2FsdHkgc2FsdA==',
};

describe('golden vectors (algorithm as of 19bd1a0)', () => {
  it('default config: config hash and identity hash are unchanged', () => {
    expect(hashConfig(DEFAULT_VECTOR_CONFIG)).toBe(
      '032ffbc76d93ee21a64e15b3eb7aa01b3966fa2f22b9fb067e828ce1aa4f0502'
    );
    expect(getIdentityHash(DEFAULT_VECTOR_CONFIG, [])).toBe(
      'b1a3536a930d463fc0e7e5c8129e5b7f8b0e24b5f99d38d2d9473a30033b9f34'
    );
  });

  it('default config: grids at depth 0, 1, 2 are unchanged', () => {
    expect(getNextWordsFlat([], DEFAULT_VECTOR_CONFIG)).toEqual([
      'gush', 'exorcism', 'wagon', 'amendment',
      'retold', 'douche', 'sermon', 'unisexual',
      'neurology', 'aerobics', 'designer', 'bright',
      'onscreen', 'unsaddle', 'emporium', 'clanking',
    ]);
    expect(getNextWordsFlat(['gush'], DEFAULT_VECTOR_CONFIG)).toEqual([
      'underrate', 'elitism', 'hurray', 'octopus',
      'closure', 'unsterile', 'thigh', 'reptilian',
      'anteater', 'unfrosted', 'refute', 'dreamy',
      'unpack', 'unscrew', 'sagging', 'rename',
    ]);
    expect(getNextWordsFlat(['gush', 'unsterile'], DEFAULT_VECTOR_CONFIG)).toEqual([
      'liqueur', 'squander', 'eternity', 'fancy',
      'womb', 'unvarying', 'skied', 'astute',
      'stumbling', 'bony', 'strum', 'revoke',
      'unsecured', 'sharply', 'poise', 'untie',
    ]);
  });

  it('seeded+salted 3x4 config: hashes and grids are unchanged', () => {
    expect(hashConfig(SALTED_VECTOR_CONFIG)).toBe(
      '42e5d28969f9255c2516046936ac0b723baaa465cb6533fafafaa5ef21b597a2'
    );
    expect(getIdentityHash(SALTED_VECTOR_CONFIG, [])).toBe(
      '51af9020c5d288762358c5a3e659a2c1d1de02e84373822f89ea2965f4b5a6a8'
    );
    expect(getNextWordsFlat([], SALTED_VECTOR_CONFIG)).toEqual([
      'mongrel', 'conical', 'rule', 'womanless',
      'carload', 'frosting', 'tighten', 'untoasted',
      'rebuff', 'florist', 'bats', 'flagman',
    ]);
    expect(getNextWordsFlat(['mongrel'], SALTED_VECTOR_CONFIG)).toEqual([
      'oversleep', 'wolf', 'lather', 'proxy',
      'unfailing', 'unreal', 'luckiness', 'praying',
      'hardened', 'taps', 'seldom', 'item',
    ]);
    expect(getNextWordsFlat(['mongrel', 'unreal'], SALTED_VECTOR_CONFIG)).toEqual([
      'kooky', 'average', 'schnapps', 'snub',
      'coerce', 'armoire', 'handful', 'statute',
      'calibrate', 'overstock', 'placidly', 'dumping',
    ]);
  });
});

describe('GenerationConfig shape lock', () => {
  // hashConfig hashes the WHOLE config object, so GenerationConfig may only
  // ever contain derivation inputs. Adding any field (even optional UI
  // metadata) changes every derived word for every existing password.
  //
  // Compile-time lock: adding or removing a GenerationConfig field makes
  // this assignment a type error (caught by `tsc` in the build).
  type DerivationFields =
    | 'seedPhrase'
    | 'gridRows'
    | 'gridCols'
    | 'hashAlgorithm'
    | 'useRecommendedHash'
    | 'includeSalt'
    | 'salt';
  type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
  const configHasExactlyTheDerivationFields: Exact<keyof GenerationConfig, DerivationFields> = true;

  it('GenerationConfig has exactly the seven derivation fields', () => {
    expect(configHasExactlyTheDerivationFields).toBe(true);
    expect(Object.keys(DEFAULT_CONFIG).sort()).toEqual([
      'gridCols', 'gridRows', 'hashAlgorithm', 'includeSalt',
      'salt', 'seedPhrase', 'useRecommendedHash',
    ]);
  });

  it('every derivation field DOES change the hash', () => {
    for (const change of [
      { seedPhrase: 'x' },
      { gridRows: 5 },
      { gridCols: 5 },
      { useRecommendedHash: false },
      { includeSalt: true },
      { salt: 'abc' },
      { hashAlgorithm: { ...DEFAULT_ARGON2ID_CONFIG, timeCost: 4 } },
    ]) {
      const changed = { ...DEFAULT_VECTOR_CONFIG, ...change } as GenerationConfig;
      expect(hashConfig(changed)).not.toBe(hashConfig(DEFAULT_VECTOR_CONFIG));
    }
  });
});

describe('primitive locks', () => {
  it('canonicalStringify output is pinned', () => {
    expect(canonicalStringify(SALTED_VECTOR_CONFIG)).toBe(
      '{"gridCols":4,"gridRows":3,"hashAlgorithm":{"algorithm":"argon2id","memoryCost":65536,"parallelism":1,"timeCost":3},"includeSalt":true,"salt":"c2FsdHkgc2FsdA==","seedPhrase":"correct horse","useRecommendedHash":false}'
    );
  });

  it('corpus word list is pinned (count + checksum)', () => {
    const words: string[] = corpus.words;
    expect(words.length).toBe(7776);
    expect(CryptoJS.SHA256(words.join('\n')).toString()).toBe(
      'abae49761b88f3f1ba31ef944bea1f61b795a3cd7e1cfb7d276ed45bf77967ba'
    );
  });
});
