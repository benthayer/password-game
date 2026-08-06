/**
 * Compact string representation of a GenerationConfig.
 *
 * Format (v2):
 *   v2:<seed>:<rows>x<cols>:<algorithm>:<param>...:<salt>
 *
 * The number of hash params is fixed per algorithm, so the string is
 * unambiguous without any length prefix: read the algorithm, consume exactly
 * that many params, and whatever remains is the salt.
 *
 * Escaping: literal ':' is written '\:' and literal '\' is written '\\'.
 * Nothing else is escaped.
 *
 * v1 (the original JSON schema) carried two booleans, `useRecommendedHash`
 * and `includeSalt`. Neither is a derivation input:
 *   - `useRecommendedHash` was a UI affordance only.
 *   - `includeSalt` gated the salt (`effectiveSalt = includeSalt ? salt : ''`),
 *     which the empty string already expresses.
 * v2 drops both. v1 payloads still import (see config-json.ts).
 */

import type { GenerationConfig } from './generation-config';
import type { HashAlgorithmConfig, HashAlgorithm } from './hash-config';
export const CONFIG_STRING_VERSION = 2;

export class ConfigStringParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigStringParseError';
  }
}

// ============================================================
// Field escaping
// ============================================================

export function escapeField(value: string): string {
  let out = '';
  for (const ch of value) {
    if (ch === '\\') out += '\\\\';
    else if (ch === ':') out += '\\:';
    else out += ch;
  }
  return out;
}

/**
 * Split on unescaped colons, unescaping each field as we go.
 * A trailing lone backslash is a malformed escape.
 */
export function splitEscaped(input: string): string[] {
  const fields: string[] = [];
  let current = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '\\') {
      const next = input[i + 1];
      if (next === undefined) {
        throw new ConfigStringParseError('Malformed escape: string ends with a backslash');
      }
      if (next !== '\\' && next !== ':') {
        throw new ConfigStringParseError(`Invalid escape sequence "\\${next}"`);
      }
      current += next;
      i++;
    } else if (ch === ':') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ============================================================
// Per-algorithm parameter order (fixed arity)
// ============================================================

/**
 * The ordered parameter names for each algorithm. Arity is fixed per
 * algorithm, which is what makes the trailing salt unambiguous.
 */
const ALGORITHM_PARAMS = {
  argon2id: ['memoryCost', 'timeCost', 'parallelism'],
  scrypt: ['N', 'r', 'p'],
  bcrypt: ['cost'],
  pbkdf2: ['iterations', 'hash'],
  sha256: [],
} as const satisfies Record<HashAlgorithm, readonly string[]>;

const KNOWN_ALGORITHMS = Object.keys(ALGORITHM_PARAMS) as HashAlgorithm[];

// ============================================================
// Serialize
// ============================================================

function hashParamsToStrings(hash: HashAlgorithmConfig): string[] {
  switch (hash.algorithm) {
    case 'argon2id':
      return [String(hash.memoryCost), String(hash.timeCost), String(hash.parallelism)];
    case 'scrypt':
      return [String(hash.N), String(hash.r), String(hash.p)];
    case 'bcrypt':
      return [String(hash.cost)];
    case 'pbkdf2':
      return [String(hash.iterations), hash.hash];
    case 'sha256':
      return [];
  }
}

export function configToString(config: GenerationConfig): string {
  const effectiveSalt = config.includeSalt ? config.salt : '';
  const fields = [
    `v${CONFIG_STRING_VERSION}`,
    escapeField(config.seedPhrase),
    `${config.gridRows}x${config.gridCols}`,
    config.hashAlgorithm.algorithm,
    ...hashParamsToStrings(config.hashAlgorithm).map(escapeField),
    escapeField(effectiveSalt),
  ];
  return fields.join(':');
}

// ============================================================
// Parse
// ============================================================

function parsePositiveInt(raw: string, name: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new ConfigStringParseError(`${name} must be a non-negative integer, got "${raw}"`);
  }
  return Number(raw);
}

function parseGrid(raw: string): { gridRows: number; gridCols: number } {
  const match = /^(\d+)x(\d+)$/.exec(raw);
  if (!match) {
    throw new ConfigStringParseError(`Grid must look like "4x4", got "${raw}"`);
  }
  const gridRows = Number(match[1]);
  const gridCols = Number(match[2]);
  if (gridRows < 2 || gridRows > 10) {
    throw new ConfigStringParseError(`Grid rows must be between 2 and 10, got ${gridRows}`);
  }
  if (gridCols < 2 || gridCols > 10) {
    throw new ConfigStringParseError(`Grid columns must be between 2 and 10, got ${gridCols}`);
  }
  return { gridRows, gridCols };
}

function buildHashConfig(algorithm: HashAlgorithm, params: string[]): HashAlgorithmConfig {
  switch (algorithm) {
    case 'argon2id':
      return {
        algorithm: 'argon2id',
        memoryCost: parsePositiveInt(params[0]!, 'memoryCost'),
        timeCost: parsePositiveInt(params[1]!, 'timeCost'),
        parallelism: parsePositiveInt(params[2]!, 'parallelism'),
      };
    case 'scrypt':
      return {
        algorithm: 'scrypt',
        N: parsePositiveInt(params[0]!, 'N'),
        r: parsePositiveInt(params[1]!, 'r'),
        p: parsePositiveInt(params[2]!, 'p'),
      };
    case 'bcrypt':
      return { algorithm: 'bcrypt', cost: parsePositiveInt(params[0]!, 'cost') };
    case 'pbkdf2': {
      const hash = params[1]!;
      if (hash !== 'sha256' && hash !== 'sha512') {
        throw new ConfigStringParseError(`pbkdf2 hash must be "sha256" or "sha512", got "${hash}"`);
      }
      return {
        algorithm: 'pbkdf2',
        iterations: parsePositiveInt(params[0]!, 'iterations'),
        hash,
      };
    }
    case 'sha256':
      return { algorithm: 'sha256' };
  }
}

export function parseConfigString(input: string): GenerationConfig {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new ConfigStringParseError('Configuration string is empty');
  }

  const fields = splitEscaped(trimmed);

  const versionField = fields[0]!;
  const versionMatch = /^v(\d+)$/.exec(versionField);
  if (!versionMatch) {
    throw new ConfigStringParseError(
      `Configuration string must start with a version like "v${CONFIG_STRING_VERSION}:", got "${versionField}"`
    );
  }
  const version = Number(versionMatch[1]);
  if (version > CONFIG_STRING_VERSION) {
    throw new ConfigStringParseError(
      `Configuration version v${version} is newer than this app supports (v${CONFIG_STRING_VERSION})`
    );
  }
  if (version < CONFIG_STRING_VERSION) {
    throw new ConfigStringParseError(
      `Configuration version v${version} is not a recognized string format`
    );
  }

  // v2: seed, grid, algorithm, ...params, salt
  if (fields.length < 5) {
    throw new ConfigStringParseError('Configuration string is missing required fields');
  }

  const seedPhrase = fields[1]!;
  const { gridRows, gridCols } = parseGrid(fields[2]!);

  const algorithmField = fields[3]!;
  if (!KNOWN_ALGORITHMS.includes(algorithmField as HashAlgorithm)) {
    throw new ConfigStringParseError(`Unknown hash algorithm "${algorithmField}"`);
  }
  const algorithm = algorithmField as HashAlgorithm;

  const arity = ALGORITHM_PARAMS[algorithm].length;
  const params = fields.slice(4, 4 + arity);
  if (params.length < arity) {
    throw new ConfigStringParseError(
      `${algorithm} needs ${arity} parameter${arity === 1 ? '' : 's'}, found ${params.length}`
    );
  }

  const rest = fields.slice(4 + arity);
  if (rest.length !== 1) {
    throw new ConfigStringParseError(
      `Expected exactly one salt field after the ${algorithm} parameters, found ${rest.length}. ` +
        'If your salt contains a colon it must be escaped as "\\:".'
    );
  }
  const salt = rest[0]!;

  return {
    seedPhrase,
    gridRows,
    gridCols,
    hashAlgorithm: buildHashConfig(algorithm, params),
    // v2 has no booleans. A non-empty salt means "use it"; empty means none.
    useRecommendedHash: false,
    includeSalt: salt !== '',
    salt,
  };
}

