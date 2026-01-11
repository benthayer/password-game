/**
 * Secondary encryption for server-side validation.
 * 
 * The server needs to verify that uploaded data is actually encrypted
 * (not plaintext). To do this without having the user's primary key:
 * 
 * 1. Client encrypts data with primary key (password-derived)
 * 2. Client generates a random secondary key
 * 3. Client encrypts again with secondary key (outer layer)
 * 4. Client sends doubly-encrypted data + secondary key to server
 * 5. Server decrypts outer layer with secondary key
 * 6. Server verifies inner layer still looks encrypted (high entropy, uniform distribution)
 * 7. Server stores inner layer (single-encrypted with primary key)
 * 
 * This proves the data is encrypted without the server ever seeing plaintext
 * or knowing the primary encryption key.
 */

/**
 * Generate a cryptographically random 32-byte key.
 */
export function generateSecondaryKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Convert bytes to hex string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encrypt data with AES-256-CBC using a random IV.
 * Format: IV (16 bytes) + ciphertext
 */
export async function encryptWithSecondaryKey(
  data: Uint8Array
): Promise<{ keyHex: string; encrypted: Uint8Array }> {
  const key = generateSecondaryKey();
  const iv = crypto.getRandomValues(new Uint8Array(16));
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-CBC' },
    false,
    ['encrypt']
  );
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    data
  );
  
  // Prepend IV to ciphertext
  const encrypted = new Uint8Array(iv.length + ciphertext.byteLength);
  encrypted.set(iv, 0);
  encrypted.set(new Uint8Array(ciphertext), iv.length);
  
  return {
    keyHex: bytesToHex(key),
    encrypted,
  };
}

