import { useState } from 'react';
import type { GenerationConfig } from './generation-config';
import GeneratePasswordModal from './GeneratePasswordModal';
import RecoveryModal from './RecoveryModal';
import PracticeModal from './PracticeModal';
import './MainPage.css';

interface MainPageProps {
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
  setSubpassword: (subpassword: string[]) => void;
}

export default function MainPage({ 
  config, 
  setConfig, 
  setSubpassword,
}: MainPageProps) {
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);

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
    </div>
  );
}
