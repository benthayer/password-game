import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatePassword } from './crypto-utils';
import type { GenerationConfig } from './generation-config';
import { getGridSize } from './generation-config';
import GeneratePasswordModal from './GeneratePasswordModal';
import './MainPage.css';

interface MainPageProps {
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
}

export default function MainPage({ config, setConfig }: MainPageProps) {
  const navigate = useNavigate();
  const [generateModalOpen, setGenerateModalOpen] = useState(false);

  const handleGeneratePassword = async (numWords: number) => {
    const gridSize = getGridSize(config);
    const passwordWordd = await generatePassword(numWords, gridSize, config.seedPhrase);
    localStorage.setItem('gameSubpassword', JSON.stringify(passwordWordd));
    localStorage.setItem('gameSelectedWords', JSON.stringify([]));
    localStorage.setItem('gameActiveWordIndex', '0');

    navigate('/practice');
  };

  const handleRecover = () => {
    navigate('/recovery');
  };

  const handlePractice = () => {
    navigate('/practice');
  };

  return (
    <div className="main-page">
      <div className="main-content">
        <h1>Main</h1>
        <div className="button-container">
          <button onClick={() => setGenerateModalOpen(true)} className="primary-button generate-button">
            Generate
          </button>
          <button onClick={handleRecover} className="primary-button recover-button">
            Recover
          </button>
          <button onClick={handlePractice} className="primary-button practice-button">
            Practice
          </button>
        </div>
      </div>
      <GeneratePasswordModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        config={config}
        setConfig={setConfig}
        onGenerate={handleGeneratePassword}
      />
    </div>
  );
}

