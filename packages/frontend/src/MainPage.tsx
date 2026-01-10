import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GenerationConfig } from './generation-config';
import type { FullHashConfig } from './hash-config';
import GeneratePasswordModal from './GeneratePasswordModal';
import RecoveryModal from './RecoveryModal';
import PracticeModal from './PracticeModal';
import HashConfigModal from './HashConfigModal';
import { getGridSize } from './generation-config';
import './MainPage.css';

interface MainPageProps {
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
  hashConfig: FullHashConfig;
  setHashConfig: (config: FullHashConfig) => void;
  setSubpassword: (subpassword: string[]) => void;
}

export default function MainPage({ 
  config, 
  setConfig, 
  hashConfig,
  setHashConfig,
  setSubpassword,
}: MainPageProps) {
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);
  const [hashConfigModalOpen, setHashConfigModalOpen] = useState(false);

  const handlePractice = () => {
    setPracticeModalOpen(true);
  };

  return (
    <div className="main-page">
      <div className="main-content">
        <h1>Main</h1>
        <div className="button-container">
          <button onClick={() => setGenerateModalOpen(true)} className="primary-button generate-button">
            Generate
          </button>
          <button onClick={() => setRecoveryModalOpen(true)} className="primary-button recover-button">
            Recover
          </button>
          <button onClick={handlePractice} className="primary-button practice-button">
            Practice
          </button>
          <button onClick={() => setHashConfigModalOpen(true)} className="primary-button hash-config-button">
            Hash Config
          </button>
        </div>
      </div>
      <GeneratePasswordModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        config={config}
        setConfig={setConfig}
        setSubpassword={setSubpassword}
      />
      <RecoveryModal
        isOpen={recoveryModalOpen}
        onClose={() => setRecoveryModalOpen(false)}
        config={config}
        setConfig={setConfig}
        setSubpassword={setSubpassword}
      />
      <PracticeModal
        isOpen={practiceModalOpen}
        onClose={() => setPracticeModalOpen(false)}
      />
      <HashConfigModal
        isOpen={hashConfigModalOpen}
        onClose={() => setHashConfigModalOpen(false)}
        config={hashConfig}
        onSave={setHashConfig}
        gridSize={getGridSize(config)}
        wordCount={8} // Default estimate for cost calculation
      />
    </div>
  );
}
