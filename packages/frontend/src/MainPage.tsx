import { useState } from 'react';
import type { GenerationConfig } from './generation-config';
import { calculateEntropyPerWord, ALGORITHM_META } from './generation-config';
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
        <h1>Password Game</h1>
        
        <MainConfigDisplay config={config} />
        
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

// ============================================================
// Config Display for Main Page
// ============================================================

function MainConfigDisplay({ config }: { config: GenerationConfig }) {
  const entropyPerWord = calculateEntropyPerWord(config);
  const gridSize = config.gridRows * config.gridCols;
  const algorithmMeta = ALGORITHM_META[config.hashAlgorithm.algorithm];
  const hasSeedPhrase = config.seedPhrase.trim().length > 0;
  
  return (
    <div className="main-config-display">
      <ConfigItem 
        label="Seed Phrase" 
        value={hasSeedPhrase ? `"${config.seedPhrase}"` : '(not set)'}
        warning={!hasSeedPhrase}
      />
      <ConfigItem 
        label="Grid" 
        value={`${config.gridRows} × ${config.gridCols} = ${gridSize} options`}
        detail={`${entropyPerWord.toFixed(2)} bits/word`}
      />
      <ConfigItem 
        label="Hash" 
        value={algorithmMeta.name}
      />
      <SaltStatusItem enabled={config.includeSalt} />
    </div>
  );
}

function ConfigItem({ 
  label, 
  value, 
  detail,
  warning = false,
}: { 
  label: string; 
  value: string;
  detail?: string;
  warning?: boolean;
}) {
  return (
    <div className={`main-config-item ${warning ? 'main-config-warning' : ''}`}>
      <span className="main-config-label">{label}</span>
      <span className="main-config-value">
        {value}
        {detail && <span className="main-config-detail">{detail}</span>}
      </span>
    </div>
  );
}

function SaltStatusItem({ enabled }: { enabled: boolean }) {
  return (
    <div className={`main-config-item ${enabled ? '' : 'main-config-warning'}`}>
      <span className="main-config-label">Salt</span>
      <span className={`main-config-salt-status ${enabled ? 'salt-enabled' : 'salt-disabled'}`}>
        <span className="salt-icon">{enabled ? '✓' : '⚠'}</span>
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
}
