import { useNavigate } from 'react-router-dom';
import type { PasswordSource } from './App';
import './PasswordDisplay.css';

interface PasswordDisplayProps {
  password: string;
  source: PasswordSource;
}

export default function PasswordDisplay({ password, source }: PasswordDisplayProps) {
  const navigate = useNavigate();

  const message =
    source === 'auto-generated'
      ? 'Your password has been automatically generated'
      : 'Here is your password';

  return (
    <div className="display-page">
      <div className="display-content">
        <h1>Your Password</h1>
        <p className="message">{message}</p>
        <div className="password-box">
          <p className="password-text">{password || 'No password set'}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
          <button onClick={() => navigate('/practice')} className="return-button">
            Practice Password
          </button>
          <button onClick={() => navigate('/')} className="return-button">
            Return to Main Page
          </button>
        </div>
      </div>
    </div>
  );
}

