import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNextWords } from './crypto-utils';
import type { PasswordSource } from './App';
import './GamePage.css';

interface GamePageProps {
  setPassword: (password: string) => void;
  setPasswordSource: (source: PasswordSource) => void;
}

export default function GamePage({ setPassword, setPasswordSource }: GamePageProps) {
  const navigate = useNavigate();
  const [subpassword, setSubpassword] = useState<string[]>([]);
  const [nextWords, setNextWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPasswordDisplay, setShowPasswordDisplay] = useState(false);

  useEffect(() => {
    loadNextWords([]);
  }, []);

  const loadNextWords = async (currentSubpassword: string[]) => {
    setLoading(true);
    try {
      const words = await getNextWords(currentSubpassword, 20);
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
    setShowPasswordDisplay(true);
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
          <div className="password-display">
            {currentPasswordText || <span className="empty-password">No words selected yet</span>}
          </div>
        </div>

        {showPasswordDisplay && currentPasswordText && (
          <div className="password-modal">
            <h2>Your Generated Password</h2>
            <div className="password-modal-content">
              <p className="modal-password">{currentPasswordText}</p>
            </div>
            <button onClick={() => setShowPasswordDisplay(false)} className="close-button">
              Close
            </button>
          </div>
        )}

        <div className="word-selection-section">
          <h2>Select Next Word</h2>
          {loading ? (
            <div className="loading">Loading options...</div>
          ) : (
            <div className="word-grid">
              {nextWords.map((word, index) => (
                <button
                  key={`${word}-${index}`}
                  onClick={() => handleWordSelect(word)}
                  className="word-button"
                >
                  {word}
                </button>
              ))}
            </div>
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

