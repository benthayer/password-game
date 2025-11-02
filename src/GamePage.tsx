import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNextWords } from './crypto-utils';
import type { PasswordSource } from './App';
import { GRID_SIZE } from './game-config';
import PasswordProgressDisplay from './PasswordProgressDisplay';
import WordSelectionGrid from './WordSelectionGrid';
import './GamePage.css';
import './PracticePage.css';

interface GamePageProps {
  setPassword: (password: string) => void;
  setPasswordSource: (source: PasswordSource) => void;
}

export default function GamePage({ setPassword, setPasswordSource }: GamePageProps) {
  const navigate = useNavigate();
  const [subpassword, setSubpassword] = useState<string[]>([]);
  const [nextWords, setNextWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadNextWords([]);
  }, []);

  const loadNextWords = async (currentSubpassword: string[]) => {
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

  const handleWordSelect = async (word: string) => {
    const newSubpassword = [...subpassword, word];
    setSubpassword(newSubpassword);
    await loadNextWords(newSubpassword);
  };

  const handleDisplayPassword = () => {
    const fullPassword = subpassword.join(' ');
    setPassword(fullPassword);
    setPasswordSource('manual');
    navigate('/display');
  };

  const handleViewOnDisplayPage = () => {
    const fullPassword = subpassword.join(' ');
    setPassword(fullPassword);
    setPasswordSource('manual');
    navigate('/display');
  };

  return (
    <div className="game-page">
      <div className="game-content">
        <div className="game-header">
          <h1>Password Game</h1>
          <div className="header-buttons">
            <button onClick={() => navigate('/')} className="header-button">
              Return to Home
            </button>
            <button onClick={() => navigate('/practice')} className="header-button">
              Practice Password
            </button>
            {subpassword.length > 0 && (
              <button onClick={handleViewOnDisplayPage} className="header-button">
                View Password
              </button>
            )}
          </div>
        </div>

        <div className="current-password-section">
          <h2>Current Password</h2>
          <PasswordProgressDisplay
            words={subpassword}
            completedCount={subpassword.length}
            showFuture={false}
          />
          {subpassword.length > 0 && (
            <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
              {subpassword.length} {subpassword.length === 1 ? 'word' : 'words'} selected
            </p>
          )}
        </div>

        <div className="word-selection-section">
          <h2>Select Next Word</h2>
          <WordSelectionGrid
            words={nextWords}
            onWordClick={handleWordSelect}
            loading={loading}
          />
        </div>

        {subpassword.length > 0 && (
          <button onClick={handleDisplayPassword} className="display-password-button">
            Display Password
          </button>
        )}
      </div>
    </div>
  );
}

