import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNextWords } from './crypto-utils';
import './GamePage.css';
import './PracticePage.css';

interface PracticePageProps {
  password: string;
}

export default function PracticePage({ password }: PracticePageProps) {
  const navigate = useNavigate();
  const [passwordWords, setPasswordWords] = useState<string[]>([]);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [nextWords, setNextWords] = useState<string[]>([]);
  const [correctWordIndex, setCorrectWordIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [errorButtonIndex, setErrorButtonIndex] = useState<number | null>(null);

  const loadNextWords = async (currentSelected: string[], targetWords?: string[], showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const words = await getNextWords(currentSelected, 20);
      setNextWords(words);
      
      // Find which word in the options matches the next word in the password
      const nextWordIndex = currentSelected.length;
      const wordsToCheck = targetWords || passwordWords;
      if (nextWordIndex < wordsToCheck.length) {
        const correctWord = wordsToCheck[nextWordIndex];
        const index = words.findIndex(word => word === correctWord);
        setCorrectWordIndex(index);
      }
    } catch (error) {
      console.error('Error loading next words:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (password) {
      const words = password.trim().split(/\s+/).filter(word => word.length > 0);
      setPasswordWords(words);
      if (words.length > 0) {
        loadNextWords([], words, true); // Show loading on initial load only
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password]);

  const handleWordSelect = async (word: string) => {
    const nextWordIndex = selectedWords.length;
    const expectedWord = passwordWords[nextWordIndex];
    
    if (word === expectedWord) {
      // Correct word selected - clear any error state
      setErrorButtonIndex(null);
      const newSelected = [...selectedWords, word];
      setSelectedWords(newSelected);
      
      if (newSelected.length === passwordWords.length) {
        // All words have been selected
        setCompleted(true);
      } else {
        // Load next words for the next step without showing loading state
        await loadNextWords(newSelected, passwordWords, false);
      }
    } else {
      // Wrong word selected - show error animation
      const wrongIndex = nextWords.findIndex(w => w === word);
      if (wrongIndex !== -1) {
        setErrorButtonIndex(wrongIndex);
        // Reset error state after animation
        setTimeout(() => {
          setErrorButtonIndex(null);
        }, 1500);
      }
    }
  };

  const handleReset = () => {
    setSelectedWords([]);
    setCompleted(false);
    setErrorButtonIndex(null);
    if (passwordWords.length > 0) {
      loadNextWords([], passwordWords, false);
    }
  };

  const currentProgressText = selectedWords.join(' ');

  if (!password || passwordWords.length === 0) {
    return (
      <div className="game-page">
        <div className="game-content">
          <div className="game-header">
            <h1>Practice Password</h1>
            <button onClick={() => navigate('/')} className="header-button">
              Return to Home
            </button>
          </div>
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <p>No password available to practice.</p>
            <p>Please generate a password first.</p>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="game-page">
        <div className="game-content">
          <div className="game-header">
            <h1>Practice Password</h1>
            <div className="header-buttons">
              <button onClick={() => navigate('/')} className="header-button">
                Return to Home
              </button>
              <button onClick={handleReset} className="header-button">
                Practice Again
              </button>
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h2 style={{ color: '#10b981', marginBottom: '20px', fontSize: '2rem' }}>✓ Practice Complete!</h2>
            <p style={{ color: '#6b7280', fontSize: '1.2rem', marginBottom: '32px' }}>
              You've successfully practiced all words in your password.
            </p>
            <div className="password-progress-display" style={{ textAlign: 'left', maxWidth: '800px', margin: '0 auto' }}>
              {passwordWords.map((word, index) => (
                <span key={index} className="password-word completed">
                  {word}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="game-page">
      <div className="game-content">
        <div className="game-header">
          <h1>Practice Password</h1>
          <div className="header-buttons">
            <button onClick={() => navigate('/')} className="header-button">
              Return to Home
            </button>
            <button onClick={handleReset} className="header-button">
              Reset Practice
            </button>
          </div>
        </div>

        <div className="current-password-section">
          <h2>Password Progress</h2>
          <div className="password-progress-display">
            {passwordWords.map((word, index) => {
              let wordClass = 'password-word';
              if (index < selectedWords.length) {
                wordClass += ' completed';
              } else if (index === selectedWords.length) {
                wordClass += ' current';
              } else {
                wordClass += ' future';
              }
              return (
                <span key={index} className={wordClass}>
                  {word}
                </span>
              );
            })}
          </div>
          <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
            Word {selectedWords.length + 1} of {passwordWords.length}
          </p>
        </div>

        <div className="word-selection-section">
          <h2>Select Next Word</h2>
          <p style={{ marginBottom: '20px', color: '#6b7280', fontSize: '0.95rem' }}>
            Click the highlighted word to continue
          </p>
          <div className="word-grid" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {nextWords.map((word, index) => {
              const isCorrect = index === correctWordIndex;
              const isError = errorButtonIndex === index;
              let buttonClasses = 'word-button';
              if (isError) {
                buttonClasses += ' error';
                if (isCorrect) {
                  buttonClasses += ' correct-word';
                }
              }
              return (
                <button
                  key={`${word}-${index}`}
                  onClick={() => !loading && handleWordSelect(word)}
                  disabled={loading}
                  className={buttonClasses}
                  style={{
                    background: isCorrect && !isError ? '#10b981' : undefined,
                    border: isCorrect && !isError ? '3px solid #059669' : 'none',
                    boxShadow: isCorrect && !isError ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none',
                    transform: isCorrect && !isError ? 'scale(1.05)' : undefined,
                    fontWeight: isCorrect ? 'bold' : 'normal',
                    cursor: loading ? 'wait' : 'pointer',
                  }}
                >
                  {word}
                </button>
              );
            })}
          </div>
          {loading && nextWords.length === 0 && (
            <div className="loading">Loading options...</div>
          )}
        </div>
      </div>
    </div>
  );
}

