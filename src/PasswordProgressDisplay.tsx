import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import './PracticePage.css';

interface PasswordProgressDisplayProps {
  words: string[];
  completedCount: number;
  showFuture?: boolean;
}

export default function PasswordProgressDisplay({
  words,
  completedCount,
  showFuture = true,
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
            let wordClass = 'password-word';
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
