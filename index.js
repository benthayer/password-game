import * as crypto from 'crypto';
import * as corpus from './corpus.json';
const wordList = corpus.words;
/**
 * Secure hash function using SHA-256
 * @param {string} string - The string to hash
 * @returns {string} - The hexadecimal hash of the input string
 */
export function hash(string) {
    return crypto.createHash('sha256')
        .update(string, 'utf8')
        .digest('hex');
}
export function hashModN(hash, n) {
    const hashBigInt = BigInt('0x' + hash);
    return Number(hashBigInt % BigInt(n));
}
export function getWordFromHash(hash) {
    const index = hashModN(hash, wordList.length);
    return wordList[index];
}
export function hashSubpassword(subpassword) {
    const hash = crypto.createHash('sha256');
    for (const word of subpassword) {
        hash.update(word, 'utf8');
    }
    return hash.digest('hex');
}
export function getNextWords(subpassword, numOptions) {
    const baseHash = hashSubpassword(subpassword);
    let tempHash = baseHash;
    const words = [];
    for (let i = 0; i < numOptions; i++) {
        words.push(getWordFromHash(tempHash));
        tempHash = hash(tempHash);
    }
    return words;
}
export function selectRandomNextWord(subpassword, numOptions) {
    const nextWords = getNextWords(subpassword, numOptions);
    const nextWord = nextWords[Math.floor(Math.random() * nextWords.length)];
    return [...subpassword, nextWord];
}
export function generatePassword(numWords, numOptions) {
    let subpassword = [];
    for (let i = 0; i < numWords; i++) {
        subpassword = selectRandomNextWord(subpassword, numOptions);
    }
    return subpassword.join(' ');
}
//# sourceMappingURL=index.js.map