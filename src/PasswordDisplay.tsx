import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PasswordSource } from './App';
import './GamePage.css';
import './PracticePage.css';

interface PasswordDisplayProps {
  password: string;
  source: PasswordSource;
}

export default function PasswordDisplay({ password, source }: PasswordDisplayProps) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!password || password.trim() === '') {
      navigate('/');
    }
  }, [password, navigate]);

  const message =
    source === 'auto-generated'
      ? 'Your password has been automatically generated'
      : 'Here is your password';

  return (
    <div className="game-page">
      <div className="game-content">
        <div className="game-header">
          <h1>Your Password</h1>
          <div className="header-buttons">
            <button onClick={() => navigate('/practice')} className="header-button">
              Practice Password
            </button>
            <button onClick={() => navigate('/')} className="header-button">
              Return to Main Page
            </button>
          </div>
        </div>

        <div className="current-password-section">
          <h2>Password Progress</h2>
          <div className="password-progress-display">
            {password ? password.split(/\s+/).filter(word => word.length > 0).map((word, index) => (
              <span key={index} className="password-word completed">
                {word}
              </span>
            )) : (
              <span className="password-word future">No password set</span>
            )}
          </div>
          {password && (
            <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
              All {password.split(/\s+/).filter(word => word.length > 0).length} words
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

