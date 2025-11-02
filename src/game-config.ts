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
  display: boolean;
  displayCurrentWord: boolean;
  highlightCurrentWord: boolean;
  displayFutureWords: boolean;
}

export const DEFAULT_PRACTICE_DISPLAY_CONFIG: PracticeDisplayConfig = {
  display: true,
  displayCurrentWord: true,
  highlightCurrentWord: true,
  displayFutureWords: true,
};

// Legacy exports for backwards compatibility
export const GRID_COLUMNS = DEFAULT_CONFIG.gridCols;
export const GRID_ROWS = DEFAULT_CONFIG.gridRows;
export const GRID_SIZE = getGridSize(DEFAULT_CONFIG);

