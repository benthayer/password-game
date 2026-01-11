/**
 * StreamingStats - Accumulates statistics incrementally as data flows through.
 * Enables all validation checks without loading entire file into memory.
 */

// =============================================================================
// COMPRESSION SIGNATURES
// =============================================================================

const COMPRESSION_SIGNATURES = [
  { name: 'gzip', magic: [0x1f, 0x8b] },
  { name: 'zlib', magic: [0x78, 0x9c] },
  { name: 'zlib-low', magic: [0x78, 0x01] },
  { name: 'zlib-high', magic: [0x78, 0xda] },
  { name: 'bzip2', magic: [0x42, 0x5a, 0x68] },
  { name: 'xz', magic: [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00] },
  { name: 'lz4', magic: [0x04, 0x22, 0x4d, 0x18] },
  { name: 'zstd', magic: [0x28, 0xb5, 0x2f, 0xfd] },
  { name: 'zip', magic: [0x50, 0x4b, 0x03, 0x04] },
];

// =============================================================================
// PATTERN RESULT
// =============================================================================

export interface PatternResult {
  pass: boolean;
  pattern?: string;
}

// =============================================================================
// STREAMING STATS CLASS
// =============================================================================

export class StreamingStats {
  // Byte frequency tracking (for entropy & chi-squared)
  private byteFrequencies = new Uint32Array(256);
  private totalBytes = 0;
  
  // Bit tracking (for monobit)
  private bitOnes = 0;
  
  // Run tracking (for runs test & longest run)
  private lastBit = -1;
  private runTransitions = 0;
  private currentRunLength = 0;
  private maxRunLength = 0;
  
  // Serial correlation tracking
  private correlationPrevByte = -1;
  private sumXY = 0;
  private sumX = 0;
  private sumY = 0;
  private sumX2 = 0;
  private sumY2 = 0;
  private pairCount = 0;
  
  // Pattern tracking
  private firstBytes: number[] = [];
  private patternPrevByte = -1;
  private allSameByte = true;
  private incrementing = true;
  private decrementing = true;
  private repeatingPattern: boolean[] = [true, true, true, true]; // 1-4 byte patterns
  
  // ==========================================================================
  // DATA ACCUMULATION
  // ==========================================================================
  
  push(byte: number): void {
    const idx = this.totalBytes;
    
    // Byte frequency
    this.byteFrequencies[byte]++;
    this.totalBytes++;
    
    // First bytes (for compression & pattern detection)
    if (this.firstBytes.length < 8) {
      this.firstBytes.push(byte);
    }
    
    // Bit counting for monobit
    let b = byte;
    while (b) {
      this.bitOnes += b & 1;
      b >>= 1;
    }
    
    // Bit run tracking
    for (let i = 7; i >= 0; i--) {
      const bit = (byte >> i) & 1;
      if (this.lastBit === -1) {
        this.lastBit = bit;
        this.currentRunLength = 1;
      } else if (bit === this.lastBit) {
        this.currentRunLength++;
        this.maxRunLength = Math.max(this.maxRunLength, this.currentRunLength);
      } else {
        this.runTransitions++;
        this.currentRunLength = 1;
        this.lastBit = bit;
      }
    }
    
    // Serial correlation
    if (this.correlationPrevByte !== -1) {
      const x = this.correlationPrevByte;
      const y = byte;
      this.sumXY += x * y;
      this.sumX += x;
      this.sumY += y;
      this.sumX2 += x * x;
      this.sumY2 += y * y;
      this.pairCount++;
    }
    this.correlationPrevByte = byte;
    
    // Pattern detection (only after first byte)
    if (idx > 0) {
      // All same byte check
      if (this.allSameByte && byte !== this.firstBytes[0]) {
        this.allSameByte = false;
      }
      
      // Incrementing check
      if (this.incrementing && byte !== (this.patternPrevByte + 1) % 256) {
        this.incrementing = false;
      }
      
      // Decrementing check
      if (this.decrementing && byte !== (this.patternPrevByte - 1 + 256) % 256) {
        this.decrementing = false;
      }
      
      // Repeating pattern check (1-4 bytes)
      for (let patternLen = 1; patternLen <= 4; patternLen++) {
        if (this.repeatingPattern[patternLen - 1] && this.firstBytes.length >= patternLen) {
          const expectedByte = this.firstBytes[idx % patternLen];
          if (byte !== expectedByte) {
            this.repeatingPattern[patternLen - 1] = false;
          }
        }
      }
    }
    this.patternPrevByte = byte;
  }
  
  pushBuffer(buffer: Buffer | Uint8Array): void {
    for (const byte of buffer) {
      this.push(byte);
    }
  }
  
  // ==========================================================================
  // METRIC CALCULATIONS
  // ==========================================================================
  
  getTotalBytes(): number {
    return this.totalBytes;
  }
  
  getEntropy(): number {
    if (this.totalBytes === 0) return 0;
    
    let entropy = 0;
    for (let i = 0; i < 256; i++) {
      const count = this.byteFrequencies[i];
      if (count > 0) {
        const probability = count / this.totalBytes;
        entropy -= probability * Math.log2(probability);
      }
    }
    return entropy;
  }
  
  getChiSquared(): number {
    if (this.totalBytes < 256) return 1;
    
    const expected = this.totalBytes / 256;
    let chiSquared = 0;
    for (let i = 0; i < 256; i++) {
      const diff = this.byteFrequencies[i] - expected;
      chiSquared += (diff * diff) / expected;
    }
    
    const normalized = Math.max(0, 1 - (chiSquared - 255) / 500);
    return normalized;
  }
  
  getMonobit(): number {
    const totalBits = this.totalBytes * 8;
    if (totalBits === 0) return 1;
    
    const expected = totalBits / 2;
    const deviation = Math.abs(this.bitOnes - expected);
    const expectedDeviation = Math.sqrt(totalBits) / 2;
    const normalized = Math.max(0, 1 - (deviation / (3 * expectedDeviation)));
    return normalized;
  }
  
  getRuns(): number {
    if (this.totalBytes < 4) return 1;
    
    const totalBits = this.totalBytes * 8;
    const runs = this.runTransitions + 1;
    const expectedRuns = totalBits / 2 + 1;
    const variance = (totalBits - 1) / 4;
    const stdDev = Math.sqrt(variance);
    const deviation = Math.abs(runs - expectedRuns);
    const normalized = Math.max(0, 1 - (deviation / (3 * stdDev)));
    return normalized;
  }
  
  getCorrelation(): number {
    if (this.pairCount < 10) return 1;
    
    const numerator = this.pairCount * this.sumXY - this.sumX * this.sumY;
    const denominator = Math.sqrt(
      (this.pairCount * this.sumX2 - this.sumX * this.sumX) * 
      (this.pairCount * this.sumY2 - this.sumY * this.sumY)
    );
    
    if (denominator === 0) return 1;
    
    const correlation = Math.abs(numerator / denominator);
    return Math.max(0, 1 - correlation * 3);
  }
  
  getLongestRun(): number {
    if (this.totalBytes < 4) return 1;
    
    const totalBits = this.totalBytes * 8;
    const expectedLongestRun = Math.log2(totalBits);
    const threshold = expectedLongestRun * 2.5;
    
    if (this.maxRunLength > threshold) {
      return Math.max(0, 1 - (this.maxRunLength - threshold) / threshold);
    }
    return 1;
  }
  
  getCompressionSignature(): string | null {
    for (const sig of COMPRESSION_SIGNATURES) {
      if (this.firstBytes.length >= sig.magic.length) {
        const matches = sig.magic.every((byte, i) => this.firstBytes[i] === byte);
        if (matches) return sig.name;
      }
    }
    return null;
  }
  
  getPatternResult(): PatternResult {
    if (this.totalBytes < 8) return { pass: true };
    
    if (this.allSameByte) {
      return { pass: false, pattern: `all-same-byte-0x${this.firstBytes[0].toString(16)}` };
    }
    
    if (this.incrementing) {
      return { pass: false, pattern: 'incrementing' };
    }
    if (this.decrementing) {
      return { pass: false, pattern: 'decrementing' };
    }
    
    for (let patternLen = 1; patternLen <= 4; patternLen++) {
      if (this.totalBytes >= patternLen * 3 && this.repeatingPattern[patternLen - 1]) {
        return { pass: false, pattern: `repeating-${patternLen}-bytes` };
      }
    }
    
    return { pass: true };
  }
  
  getFirstBytes(): number[] {
    return [...this.firstBytes];
  }
}
