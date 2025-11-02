import { useState, useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { PracticeDisplayConfig } from './game-config';
import './PracticePage.css';

interface PasswordProgressDisplayProps {
  words: string[];
  completedCount: number;
  showFuture?: boolean;
  practiceConfig?: PracticeDisplayConfig;
  activeWordIndex?: number | undefined;
  onWordClick?: (index: number) => void;
}

export default function PasswordProgressDisplay({
  words,
  completedCount,
  showFuture = true,
  practiceConfig,
  activeWordIndex,
  onWordClick,
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

  const isGameMode = !practiceConfig;
  
  return (
    <div className={`password-progress-display ${words.length > 0 ? 'has-words' : ''} ${isGameMode ? 'game-mode' : ''}`} style={{ position: 'relative' }}>
      {showPlaceholder && (
        <div className={`placeholder-wrapper ${isFadingOut ? 'fade-out' : ''}`}>
          <span className="password-word future placeholder-text">
            Select a word to add it to your password
          </span>
        </div>
      )}
      <div className="password-words-container">
          {words.map((word, index) => {
            let shouldShow = true;
            
            // In practice mode with config, respect the config settings
            if (practiceConfig && activeWordIndex !== undefined) {
              // Apply display mode rules
              if (practiceConfig.displayMode === 'none') {
                shouldShow = false;
              } else if (practiceConfig.displayMode === 'previous') {
                // Only show words before the active word
                if (index >= activeWordIndex) {
                  shouldShow = false;
                }
              }
              // displayMode === 'all' shows all words, so shouldShow stays true
            } else if (practiceConfig && activeWordIndex === undefined) {
              // Practice completed - show all words regardless of display mode
              shouldShow = true;
            } else {
              // Game mode or practice mode without config
              if (index >= completedCount && !showFuture) {
                // In game mode, don't render future words
                shouldShow = false;
              }
            }
            
            let wordClass = 'password-word';
            
            // In practice mode with config, use activeWordIndex for current word determination
            if (practiceConfig && activeWordIndex !== undefined) {
              if (index < activeWordIndex) {
                wordClass += ' completed';
              } else if (index === activeWordIndex) {
                // Current word - apply 'current' class if highlighting is enabled
                if (practiceConfig.displayMode === 'all' && practiceConfig.highlightCurrentWord) {
                  wordClass += ' current';
                } else {
                  // Current word visible but not highlighted - show as future (gray/transparent)
                  wordClass += ' future';
                }
              } else {
                // Future words
                wordClass += ' future';
              }
            } else if (practiceConfig && activeWordIndex === undefined) {
              // Practice completed - all words should show as completed
              if (index < completedCount) {
                wordClass += ' completed';
              } else {
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
                }
              }
            }
            
            let style: CSSProperties = { visibility: shouldShow ? 'visible' : 'hidden' };
            
            // In practice mode, make words clickable
            const isClickable = practiceConfig && onWordClick && shouldShow;
            if (isClickable) {
              style.cursor = 'pointer';
              style.userSelect = 'none';
              wordClass += ' clickable';
            }
            
            // Always render the word but use visibility to hide it, preserving layout space
            return (
              <span 
                key={index} 
                className={wordClass}
                style={style}
                onClick={isClickable ? () => onWordClick(index) : undefined}
              >
                {word}
              </span>
            );
          })}
      </div>
    </div>
  );
}
