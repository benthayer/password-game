/**
 * Unified config import/export.
 *
 * There are two representations of a config:
 *   1. String  - "v2:seed:4x4:argon2id:65536:3:1:salt" (preferred; easy to
 *      copy, paste, text to yourself, or write down)
 *   2. File    - password-game-config.json (v2 schema)
 *
 * Import auto-detects which one it was handed, so a user can paste either.
 */

import type { GenerationConfig } from './generation-config';
import {
  configToString,
  parseConfigString,
  ConfigStringParseError,
} from './config-string';
import {
  configToJsonText,
  parseConfigFromJsonText,
  ConfigParseError,
  downloadConfigAsJson,
} from './config-json';

export { configToString, configToJsonText, downloadConfigAsJson };
export type ConfigFormat = 'string' | 'json';

export class ConfigImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigImportError';
  }
}

/** Cheap sniff: JSON configs start with '{', string configs with 'v<n>:'. */
export function detectFormat(text: string): ConfigFormat {
  return text.trim().startsWith('{') ? 'json' : 'string';
}

/**
 * Parse a pasted config in either representation.
 * Errors are surfaced with the message from whichever parser was selected,
 * so the user gets a specific complaint rather than a generic one.
 */
export function parseConfigText(text: string): GenerationConfig {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ConfigImportError('Paste a configuration string or upload a file');
  }

  try {
    return detectFormat(trimmed)=== 'json'
      ? parseConfigFromJsonText(trimmed)
      : parseConfigString(trimmed);
  } catch (err) {
    if (err instanceof ConfigStringParseError || err instanceof ConfigParseError) {
      throw new ConfigImportError(err.message);
    }
    throw new ConfigImportError('Could not read that configuration');
  }
}

/** Read an uploaded file (either representation) into a config. */
export async function parseConfigFile(file: File): Promise<GenerationConfig> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new ConfigImportError('Could not read that file');
  }
  return parseConfigText(text);
}

/** Copy text to the clipboard, falling back for non-secure contexts. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
