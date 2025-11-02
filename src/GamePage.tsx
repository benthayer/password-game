import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNextWords } from './crypto-utils';
import type { PasswordSource } from './App';
import { GRID_SIZE } from './game-config';
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

  const currentPasswordText = subpassword.join(' ');

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
          <div className="password-progress-display">
            {currentPasswordText ? (
              currentPasswordText.split(/\s+/).filter(word => word.length > 0).map((word, index) => (
                <span key={index} className="password-word completed">
                  {word}
                </span>
              ))
            ) : (
              <span className="password-word future">No words selected yet</span>
            )}
          </div>
          {currentPasswordText && (
            <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
              {subpassword.length} {subpassword.length === 1 ? 'word' : 'words'} selected
            </p>
          )}
        </div>

        <div className="word-selection-section">
          <h2>Select Next Word</h2>
          <div className="word-grid" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
            {nextWords.map((word, index) => (
              <button
                key={`${word}-${index}`}
                onClick={() => !loading && handleWordSelect(word)}
                disabled={loading}
                className="word-button"
                style={{
                  cursor: loading ? 'wait' : 'pointer',
                }}
              >
                {word}
              </button>
            ))}
          </div>
          {loading && nextWords.length === 0 && (
            <div className="loading">Loading options...</div>
          )}
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

