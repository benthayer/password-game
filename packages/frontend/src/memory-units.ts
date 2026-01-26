/**
 * Memory unit conversions.
 * Internal representation is always KB.
 */

export type MemoryUnit = 'KB' | 'MB' | 'GB';

const KB_PER_MB = 1024;
const KB_PER_GB = 1024 * 1024;

export function kbToUnit(kb: number, unit: MemoryUnit): number {
  switch (unit) {
    case 'GB': return kb / KB_PER_GB;
    case 'MB': return kb / KB_PER_MB;
    case 'KB': return kb;
  }
}

export function unitToKb(value: number, unit: MemoryUnit): number {
  switch (unit) {
    case 'GB': return value * KB_PER_GB;
    case 'MB': return value * KB_PER_MB;
    case 'KB': return value;
  }
}

export function inferUnit(kb: number): MemoryUnit {
  if (kb >= KB_PER_GB) return 'GB';
  if (kb >= KB_PER_MB) return 'MB';
  return 'KB';
}

export function formatMemory(kb: number): string {
  const unit = inferUnit(kb);
  const value = kbToUnit(kb, unit);
  return `${value} ${unit}`;
}



