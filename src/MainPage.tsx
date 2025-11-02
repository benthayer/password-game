import { useNavigate } from 'react-router-dom';
import { generatePassword } from './crypto-utils';
import type { PasswordSource } from './App';
import { GRID_SIZE } from './game-config';
import './MainPage.css';

interface MainPageProps {
  setPassword: (password: string) => void;
  setPasswordSource: (source: PasswordSource) => void;
}

export default function MainPage({ setPassword, setPasswordSource }: MainPageProps) {
  const navigate = useNavigate();

  const handleGeneratePassword = async () => {
    const password = await generatePassword(18, GRID_SIZE);
    setPassword(password);
    setPasswordSource('auto-generated');
    navigate('/display');
  };

  const handlePlayGame = () => {
    navigate('/game');
  };

  return (
    <div className="main-page">
      <div className="main-content">
        <h1>Word Game Safe</h1>
        <p className="subtitle">Generate secure passwords through word selection</p>
        <div className="button-container">
          <button onClick={handleGeneratePassword} className="primary-button">
            Generate Password
          </button>
          <button onClick={handlePlayGame} className="primary-button">
            Play Game
          </button>
        </div>
      </div>
    </div>
  );
}

