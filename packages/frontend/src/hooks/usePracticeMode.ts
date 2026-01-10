/**
 * Practice mode state management.
 * Handles practicing password recall with hints and error feedback.
 */

import { useState, useEffect, useCallback } from 'react';
import { getNextWords } from '../crypto-utils';
import type { GenerationConfig } from '../generation-config';

export interface UsePracticeModeResult {
  // State
  nextWords: string[];
  activeWordIndex: number;
  completedCount: number;
  correctWordIndex: number;
  errorWordIndex: number | null;
  isCompleted: boolean;
  
  // Actions
  selectWord: (word: string) => void;
  goToWord: (index: number) => void;
  goToPreviousWord: () => void;
  goToNextWord: () => void;
  reset: () => void;
}

export function usePracticeMode(
  config: GenerationConfig,
  targetPassword: string[],
  enabled: boolean = true,
): UsePracticeModeResult {
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [nextWords, setNextWords] = useState<string[]>([]);
  const [correctWordIndex, setCorrectWordIndex] = useState(-1);
  const [errorWordIndex, setErrorWordIndex] = useState<number | null>(null);

  const isCompleted = activeWordIndex >= targetPassword.length;

  // Load words for current position
  const loadWordsForIndex = useCallback((index: number) => {
    if (!enabled) return; // Skip expensive computation when not in practice mode
    
    if (index >= targetPassword.length) {
      setNextWords([]);
      setCorrectWordIndex(-1);
      return;
    }

    const prefix = targetPassword.slice(0, index);
    const words = getNextWords(prefix, config);
    setNextWords(words);

    // Find correct word index for highlighting
    const correctWord = targetPassword[index];
    setCorrectWordIndex(words.findIndex(w => w === correctWord));
  }, [targetPassword, config, enabled]);

  // Load words when active index changes (only when enabled)
  useEffect(() => {
    if (!enabled) return;
    loadWordsForIndex(activeWordIndex);
  }, [activeWordIndex, loadWordsForIndex, enabled]);

  // Reset when target password changes
  useEffect(() => {
    if (!enabled) return;
    setActiveWordIndex(0);
    setCompletedCount(0);
    setErrorWordIndex(null);
  }, [targetPassword, enabled]);

  const selectWord = useCallback((word: string) => {
    if (isCompleted) return;

    const expectedWord = targetPassword[activeWordIndex];

    if (word === expectedWord) {
      // Correct!
      setErrorWordIndex(null);
      setCompletedCount(activeWordIndex + 1);
      setActiveWordIndex(activeWordIndex + 1);
    } else {
      // Wrong - show error
      const wrongIndex = nextWords.findIndex(w => w === word);
      setErrorWordIndex(wrongIndex);
      setTimeout(() => setErrorWordIndex(null), 1500);
    }
  }, [isCompleted, targetPassword, activeWordIndex, nextWords]);

  const goToWord = useCallback((index: number) => {
    if (index < 0 || index >= targetPassword.length) return;
    setActiveWordIndex(index);
    setCompletedCount(Math.min(completedCount, index));
    setErrorWordIndex(null);
  }, [targetPassword.length, completedCount]);

  const goToPreviousWord = useCallback(() => {
    if (activeWordIndex > 0) {
      goToWord(activeWordIndex - 1);
    }
  }, [activeWordIndex, goToWord]);

  const goToNextWord = useCallback(() => {
    if (activeWordIndex < targetPassword.length) {
      setActiveWordIndex(activeWordIndex + 1);
      setErrorWordIndex(null);
    }
  }, [activeWordIndex, targetPassword.length]);

  const reset = useCallback(() => {
    setActiveWordIndex(0);
    setCompletedCount(0);
    setErrorWordIndex(null);
  }, []);

  return {
    nextWords,
    activeWordIndex,
    completedCount,
    correctWordIndex,
    errorWordIndex,
    isCompleted,
    selectWord,
    goToWord,
    goToPreviousWord,
    goToNextWord,
    reset,
  };
}

