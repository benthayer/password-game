import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePassword } from './crypto-utils';
import type { PasswordSource } from './App';
import type { GameConfig } from './game-config';
import { getGridSize } from './game-config';
import GeneratePasswordModal from './GeneratePasswordModal';
import './MainPage.css';

interface MainPageProps {
  setPassword: (password: string) => void;
  setPasswordSource: (source: PasswordSource) => void;
  config: GameConfig;
  setConfig: (config: GameConfig) => void;
}

export default function MainPage({ setPassword, setPasswordSource, config }: MainPageProps) {
  const navigate = useNavigate();
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

  const handleGeneratePassword = async (numWords: number) => {
    const gridSize = getGridSize(config);
    const password = await generatePassword(numWords, gridSize, config.seedPhrase);
    setPassword(password);
    setPasswordSource('auto-generated');
    navigate('/');
  };

  const handlePlayGame = () => {
    navigate('/');
  };

  return (
    <div className="main-page">
      <div className="main-content">
        <h1>Password Game</h1>
        <p className="subtitle">Generate secure passwords through word selection</p>
        <div className="button-container">
          <button onClick={() => setGenerateModalOpen(true)} className="primary-button">
            Generate Password
          </button>
          <button onClick={handlePlayGame} className="primary-button">
            Play Game
          </button>
        </div>
      </div>
      <GeneratePasswordModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        config={config}
        onGenerate={handleGeneratePassword}
      />
    </div>
  );
}

