/**
 * Secure hash function using SHA-256
 * @param {string} string - The string to hash
 * @returns {string} - The hexadecimal hash of the input string
 */
export declare function hash(string: string): string;
export declare function hashModN(hash: string, n: number): number;
export declare function getWordFromHash(hash: string): string;
export declare function hashSubpassword(subpassword: string[]): string;
export declare function getNextWords(subpassword: string[], numOptions: number): string[];
export declare function selectRandomNextWord(subpassword: string[], numOptions: number): string[];
export declare function generatePassword(numWords: number, numOptions: number): string;
//# sourceMappingURL=index.d.ts.map