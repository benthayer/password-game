/**
 * Centralized configuration for the word game grid
 */
export interface GameConfig {
  seedPhrase: string;
  gridRows: number;
  gridCols: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  seedPhrase: '',
  gridRows: 3,
  gridCols: 4,
};

export function getGridSize(config: GameConfig): number {
  return config.gridRows * config.gridCols;
}

export function calculateEntropyPerWord(config: GameConfig): number {
  const numOptions = getGridSize(config);
  return Math.log2(numOptions);
}

export function calculateWordsFor80Bits(config: GameConfig): number {
  const entropyPerWord = calculateEntropyPerWord(config);
  return 80 / entropyPerWord;
}

/**
 * Configuration for practice mode display options
 */
export interface PracticeDisplayConfig {
  displayMode: 'none' | 'previous' | 'all';
  highlightCurrentWord: boolean; // Highlight current word in the display
  hint: boolean; // Highlight correct word in the selector
}

export const DEFAULT_PRACTICE_DISPLAY_CONFIG: PracticeDisplayConfig = {
  displayMode: 'all',
  highlightCurrentWord: false,
  hint: true,
};

// Legacy exports for backwards compatibility
export const GRID_COLUMNS = DEFAULT_CONFIG.gridCols;
export const GRID_ROWS = DEFAULT_CONFIG.gridRows;
export const GRID_SIZE = getGridSize(DEFAULT_CONFIG);

