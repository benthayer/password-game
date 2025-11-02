import corpus from '../corpus.json';

const wordList: string[] = corpus.words;

/**
 * Secure hash function using SHA-256 (Web Crypto API)
 * @param {string} string - The string to hash
 * @returns {Promise<string>} - The hexadecimal hash of the input string
 */
export async function hash(string: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(string);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function hashModN(hash: string, n: number): number {
  const hashBigInt = BigInt('0x' + hash);
  return Number(hashBigInt % BigInt(n));
}

export function getWordFromHash(hash: string): string {
  const index = hashModN(hash, wordList.length);
  return wordList[index] as string;
}

export async function hashSubpassword(subpassword: string[], seedPhrase: string = ''): Promise<string> {
  const encoder = new TextEncoder();
  let combined = seedPhrase;
  for (const word of subpassword) {
    combined += `:${word}`;
  }
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getNextWords(subpassword: string[], numOptions: number, seedPhrase: string = ''): Promise<string[]> {
  const baseHash = await hashSubpassword(subpassword, seedPhrase);
  let tempHash = baseHash;
  const words: string[] = [];
  for (let i = 0; i < numOptions; i++) {
    words.push(getWordFromHash(tempHash));
    tempHash = await hash(tempHash);
  }
  return words;
}

export async function selectRandomNextWord(subpassword: string[], numOptions: number, seedPhrase: string = ''): Promise<string[]> {
  const nextWords = await getNextWords(subpassword, numOptions, seedPhrase);
  const nextWord = nextWords[Math.floor(Math.random() * nextWords.length)] as string;
  return [...subpassword, nextWord];
}

export async function generatePassword(numWords: number, numOptions: number, seedPhrase: string = ''): Promise<string> {
  let subpassword: string[] = [];
  for (let i = 0; i < numWords; i++) {
    subpassword = await selectRandomNextWord(subpassword, numOptions, seedPhrase);
  }
  return subpassword.join(' ');
}

