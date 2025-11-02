import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import type { PracticeDisplayConfig } from './game-config';
import './PracticePage.css';

interface PasswordProgressDisplayProps {
  words: string[];
  completedCount: number;
  showFuture?: boolean;
  practiceConfig?: PracticeDisplayConfig;
  activeWordIndex?: number;
}

export default function PasswordProgressDisplay({
  words,
  completedCount,
  showFuture = true,
  practiceConfig,
  activeWordIndex,
}: PasswordProgressDisplayProps) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(words.length === 0);
  const prevWordsLengthRef = useRef(words.length);

  // Handle reset case synchronously to prevent flicker
  useLayoutEffect(() => {
    if (prevWordsLengthRef.current > 0 && words.length === 0) {
      // Reset case: immediately show placeholder without fade-out class
      setIsFadingOut(false);
      setShowPlaceholder(true);
    }
    prevWordsLengthRef.current = words.length;
  }, [words.length]);

  useEffect(() => {
    if (words.length > 0 && showPlaceholder) {
      // Start fade-out animation
      setIsFadingOut(true);
      // Remove after animation completes (300ms)
      const timer = setTimeout(() => {
        setShowPlaceholder(false);
      }, 300);
      return () => clearTimeout(timer);
    } else if (words.length === 0 && !showPlaceholder) {
      // Initial state when words is empty
      setIsFadingOut(false);
      setShowPlaceholder(true);
    }
  }, [words.length, showPlaceholder]);

  return (
    <div className={`password-progress-display ${words.length > 0 ? 'has-words' : ''}`} style={{ position: 'relative' }}>
      {showPlaceholder && (
        <div className={`placeholder-wrapper ${isFadingOut ? 'fade-out' : ''}`}>
          <span className="password-word future placeholder-text">
            Select a word to add it to your password
          </span>
        </div>
      )}
      {words.length > 0 && (
        <div className="password-words-container">
          {words.map((word, index) => {
            // In practice mode with config, respect the config settings
            if (practiceConfig && activeWordIndex !== undefined) {
              // If display is off, hide all words
              if (!practiceConfig.display) {
                return null;
              }
              
              // Check if we should display current word (requires both display and displayCurrentWord)
              if (index === activeWordIndex && !practiceConfig.displayCurrentWord) {
                return null;
              }
              
              // Check if we should display future words (requires displayCurrentWord and displayFutureWords)
              if (index > activeWordIndex && !(practiceConfig.displayCurrentWord && practiceConfig.displayFutureWords)) {
                return null;
              }
            }
            
            let wordClass = 'password-word';
            
            // In practice mode with config, use activeWordIndex for current word determination
            if (practiceConfig && activeWordIndex !== undefined) {
              if (index < activeWordIndex) {
                wordClass += ' completed';
              } else if (index === activeWordIndex) {
                // Current word - always show as current (highlighting affects grid, not display)
                wordClass += ' current';
              } else {
                // Future words
                wordClass += ' future';
              }
            } else {
              // Game mode or practice mode without config
              if (index < completedCount) {
                wordClass += ' completed';
              } else if (index === completedCount) {
                wordClass += ' current';
              } else {
                if (showFuture) {
                  wordClass += ' future';
                } else {
                  // In game mode, don't render future words
                  return null;
                }
              }
            }
            return (
              <span key={index} className={wordClass}>
                {word}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
