import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNextWords } from './crypto-utils';
import { GRID_SIZE } from './game-config';
import PasswordProgressDisplay from './PasswordProgressDisplay';
import WordSelectionGrid from './WordSelectionGrid';
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
      const words = await getNextWords(currentSelected, GRID_SIZE);
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
    if (!password) {
      navigate('/');
      return;
    }
    const words = password.trim().split(/\s+/).filter(word => word.length > 0);
    setPasswordWords(words);
    if (words.length === 0) {
      navigate('/');
      return;
    }
    loadNextWords([], words, true); // Show loading on initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, navigate]);

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

  if (completed) {
    return (
      <div className="game-page">
        <div className="game-content">
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ marginBottom: '40px' }}>Practice Password</h1>
            <h2 style={{ color: '#10b981', marginBottom: '20px', fontSize: '2rem' }}>✓ Practice Complete!</h2>
            <p style={{ color: '#6b7280', fontSize: '1.2rem', marginBottom: '32px' }}>
              You've successfully practiced all words in your password.
            </p>
            <div style={{ textAlign: 'center', margin: '0 auto', marginBottom: '0', display: 'inline-block' }}>
              <PasswordProgressDisplay
                words={passwordWords}
                completedCount={passwordWords.length}
                showFuture={false}
              />
            </div>
          </div>
          <div className="header-buttons" style={{ marginTop: '26px', justifyContent: 'center' }}>
            <button onClick={() => navigate('/')} className="header-button">
              Return to Home
            </button>
            <button onClick={handleReset} className="header-button">
              Practice Again
            </button>
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
          <PasswordProgressDisplay
            words={passwordWords}
            completedCount={selectedWords.length}
            showFuture={true}
          />
          <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
            Word {selectedWords.length + 1} of {passwordWords.length}
          </p>
        </div>

        <div className="word-selection-section">
          <h2>Select Next Word</h2>
          <p style={{ marginBottom: '20px', color: '#6b7280', fontSize: '0.95rem' }}>
            Click the highlighted word to continue
          </p>
          <WordSelectionGrid
            words={nextWords}
            onWordClick={handleWordSelect}
            loading={loading}
            correctWordIndex={correctWordIndex}
            errorWordIndex={errorButtonIndex}
          />
        </div>
      </div>
    </div>
  );
}

