import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNextWords } from './crypto-utils';
import type { PasswordSource } from './App';
import { GRID_SIZE } from './game-config';
import PasswordProgressDisplay from './PasswordProgressDisplay';
import WordSelectionGrid from './WordSelectionGrid';
import './GamePage.css';
import './PracticePage.css';

type Mode = 'game' | 'practice';

interface GamePageProps {
  setPassword: (password: string) => void;
  setPasswordSource: (source: PasswordSource) => void;
}

export default function GamePage({ setPassword, setPasswordSource }: GamePageProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('game');
  
  // Game mode state
  const [subpassword, setSubpassword] = useState<string[]>([]);
  const [nextWords, setNextWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Practice mode state
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [correctWordIndex, setCorrectWordIndex] = useState<number>(-1);
  const [completed, setCompleted] = useState(false);
  const [errorButtonIndex, setErrorButtonIndex] = useState<number | null>(null);

  // Game mode: load next words for building password
  const loadNextWordsGame = async (currentSubpassword: string[]) => {
    setLoading(true);
    try {
      const words = await getNextWords(currentSubpassword, GRID_SIZE);
      setNextWords(words);
    } catch (error) {
      console.error('Error loading next words:', error);
    } finally {
      setLoading(false);
    }
  };

  // Practice mode: load next words with correct word highlighting
  const loadNextWordsPractice = async (currentSelected: string[], targetWords: string[], showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const words = await getNextWords(currentSelected, GRID_SIZE);
      setNextWords(words);
      
      // Find which word in the options matches the next word in the password
      const nextWordIndex = currentSelected.length;
      if (nextWordIndex < targetWords.length) {
        const correctWord = targetWords[nextWordIndex];
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

  // Initialize game mode
  useEffect(() => {
    if (mode === 'game') {
      loadNextWordsGame([]);
    }
  }, [mode]);

  // Game mode: handle word selection
  const handleWordSelectGame = async (word: string) => {
    const newSubpassword = [...subpassword, word];
    setSubpassword(newSubpassword);
    await loadNextWordsGame(newSubpassword);
  };

  // Practice mode: handle word selection
  const handleWordSelectPractice = async (word: string) => {
    const nextWordIndex = selectedWords.length;
    const expectedWord = subpassword[nextWordIndex];
    
    if (word === expectedWord) {
      // Correct word selected - clear any error state
      setErrorButtonIndex(null);
      const newSelected = [...selectedWords, word];
      setSelectedWords(newSelected);
      
      if (newSelected.length === subpassword.length) {
        // All words have been selected
        setCompleted(true);
      } else {
        // Load next words for the next step without showing loading state
        await loadNextWordsPractice(newSelected, subpassword, false);
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

  // Switch to practice mode
  const handlePracticePassword = () => {
    if (subpassword.length === 0) {
      return;
    }
    // Initialize practice mode state
    setSelectedWords([]);
    setCompleted(false);
    setErrorButtonIndex(null);
    setMode('practice');
    loadNextWordsPractice([], subpassword, true);
  };

  // Reset practice
  const handleResetPractice = () => {
    setSelectedWords([]);
    setCompleted(false);
    setErrorButtonIndex(null);
    if (subpassword.length > 0) {
      loadNextWordsPractice([], subpassword, false);
    }
  };

  // Return to game mode
  const handleReturnToGame = () => {
    setMode('game');
    setSelectedWords([]);
    setCompleted(false);
    setErrorButtonIndex(null);
  };

  // Delete last word
  const handleDelete = async () => {
    if (subpassword.length === 0) return;
    
    const newSubpassword = subpassword.slice(0, -1);
    setSubpassword(newSubpassword);
    
    // If in practice mode, reset practice state
    if (mode === 'practice') {
      setSelectedWords([]);
      setCompleted(false);
      setErrorButtonIndex(null);
      setMode('game');
    }
    
    // Reload words for the new password state
    await loadNextWordsGame(newSubpassword);
  };

  // Reset all words and state
  const handleReset = () => {
    setSubpassword([]);
    setSelectedWords([]);
    setCompleted(false);
    setErrorButtonIndex(null);
    setMode('game');
    loadNextWordsGame([]);
  };

  // Practice completion screen
  if (mode === 'practice' && completed) {
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
                words={subpassword}
                completedCount={subpassword.length}
                showFuture={false}
              />
            </div>
          </div>
          <div className="header-buttons" style={{ marginTop: '26px', justifyContent: 'center' }}>
            <button onClick={() => navigate('/')} className="header-button">
              Return to Home
            </button>
            <button onClick={handleResetPractice} className="header-button">
              Practice Again
            </button>
            <button onClick={handleReturnToGame} className="header-button">
              Back to Game
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
          <h1>{mode === 'game' ? 'Password Game' : 'Practice Password'}</h1>
          <div className="header-buttons">
            <>
              <button 
                onClick={handleReset} 
                className="header-button reset-button"
                disabled={subpassword.length === 0}
                style={{ 
                  background: '#dc2626', 
                  color: 'white',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}
              >
                Reset
              </button>
              <button 
                onClick={handleDelete} 
                className="header-button delete-button"
                disabled={subpassword.length === 0}
                style={{ 
                  background: '#dc2626', 
                  color: 'white',
                  padding: '12px 24px',
                  fontSize: '1.5rem',
                  fontWeight: '500',
                  lineHeight: '1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: '10px',
                  paddingBottom: '14px'
                }}
                title="Delete last word"
              >
                ⌫
              </button>
            </>
            {mode === 'practice' && (
              <>
                <button onClick={handleResetPractice} className="header-button">
                  Reset Practice
                </button>
                <button onClick={handleReturnToGame} className="header-button">
                  Back to Game
                </button>
              </>
            )}
          </div>
        </div>

        <div className="current-password-section">
          <h2>{mode === 'game' ? 'Current Password' : 'Password Progress'}</h2>
          <PasswordProgressDisplay
            words={mode === 'game' ? subpassword : subpassword}
            completedCount={mode === 'game' ? subpassword.length : selectedWords.length}
            showFuture={mode === 'practice'}
          />
          {mode === 'game' && (
            <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
              {subpassword.length} {subpassword.length === 1 ? 'word' : 'words'} selected
            </p>
          )}
          {mode === 'practice' && (
            <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
              Word {selectedWords.length + 1} of {subpassword.length}
            </p>
          )}
        </div>

        <div className="word-selection-section">
          <h2>Select Next Word</h2>
          {mode === 'practice' ? (
            <WordSelectionGrid
              words={nextWords}
              onWordClick={handleWordSelectPractice}
              loading={loading}
              correctWordIndex={correctWordIndex}
              errorWordIndex={errorButtonIndex}
            />
          ) : (
            <WordSelectionGrid
              words={nextWords}
              onWordClick={handleWordSelectGame}
              loading={loading}
            />
          )}
        </div>

        {mode === 'game' && (
          <button 
            onClick={handlePracticePassword} 
            className="display-password-button"
            disabled={subpassword.length === 0}
          >
            Practice Password
          </button>
        )}
      </div>
    </div>
  );
}
