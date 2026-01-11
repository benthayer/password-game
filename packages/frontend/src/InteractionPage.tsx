/**
 * Interaction page.
 * Orchestrates recovery and practice modes.
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { GenerationConfig, PracticeDisplayConfig } from './generation-config';
import { DEFAULT_PRACTICE_DISPLAY_CONFIG, getHashConfig, getGridSize, calculateEntropyPerWord } from './generation-config';
import { SecurityEstimate } from './config-modal';
import { useRecoveryMode } from './hooks/useRecoveryMode';
import { usePracticeMode } from './hooks/usePracticeMode';
import {
  RecoveryControls,
  PracticeControls,
  ConfigButton,
  PracticeModeButton,
  RecoveryModeButton,
  MainPageButton,
  RecoveryWordCount,
  PracticeWordCount,
} from './interaction';
import PasswordProgressDisplay from './PasswordProgressDisplay';
import WordSelectionGrid from './WordSelectionGrid';
import ConfigModal from './ConfigModal';
import ConfigDisplay from './ConfigDisplay';
import PracticeConfigDisplay from './PracticeConfigDisplay';
import VaultCard from './vault/VaultCard';
import './InteractionPage.css';
import './PracticePage.css';

type Mode = 'recovery' | 'practice';

interface InteractionPageProps {
  config: GenerationConfig;
  setConfig: (config: GenerationConfig) => void;
  subpassword: string[];
  setSubpassword: (subpassword: string[]) => void;
}

export default function InteractionPage({
  config,
  setConfig,
  subpassword,
  setSubpassword,
}: InteractionPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const mode: Mode = location.pathname === '/practice' ? 'practice' : 'recovery';

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [practiceDisplayConfig, setPracticeDisplayConfig] = useState<PracticeDisplayConfig>(
    DEFAULT_PRACTICE_DISPLAY_CONFIG
  );

  // Mode-specific hooks
  const recovery = useRecoveryMode(config, subpassword, setSubpassword);
  const practice = usePracticeMode(config, subpassword, mode === 'practice');

  // Navigation handlers
  const goToMainPage = () => navigate('/');
  const goToPracticeMode = () => {
    practice.reset();
    navigate('/practice');
  };
  const goToRecoveryMode = () => navigate('/recovery');

  // Config save resets everything
  const handleConfigSave = (newConfig: GenerationConfig) => {
    setConfig(newConfig);
    setSubpassword([]);
    navigate('/recovery');
  };

  return (
    <div className="game-page">
      <div className="game-content">
        <PageHeader
          mode={mode}
          onConfigClick={() => setConfigModalOpen(true)}
          onPracticeModeClick={goToPracticeMode}
          onRecoveryModeClick={goToRecoveryMode}
          onMainPageClick={goToMainPage}
          canPractice={subpassword.length > 0}
        />

        <ConfigSection
          mode={mode}
          config={config}
          wordCount={subpassword.length}
          practiceDisplayConfig={practiceDisplayConfig}
          onPracticeConfigChange={setPracticeDisplayConfig}
        />

        <PasswordSection
          mode={mode}
          subpassword={subpassword}
          recovery={recovery}
          practice={practice}
          practiceDisplayConfig={practiceDisplayConfig}
        />

        <WordSelectionSection
          mode={mode}
          config={config}
          recovery={recovery}
          practice={practice}
          practiceDisplayConfig={practiceDisplayConfig}
        />

        <ConfigModal
          isOpen={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
          config={config}
          onSave={handleConfigSave}
          wordCount={subpassword.length || 8}
        />
      </div>
      <VaultCard password={subpassword} hashConfig={getHashConfig(config)} />
    </div>
  );
}

// ============================================================
// Section Components
// ============================================================

function PageHeader({
  mode,
  onConfigClick,
  onPracticeModeClick,
  onRecoveryModeClick,
  onMainPageClick,
  canPractice,
}: {
  mode: Mode;
  onConfigClick: () => void;
  onPracticeModeClick: () => void;
  onRecoveryModeClick: () => void;
  onMainPageClick: () => void;
  canPractice: boolean;
}) {
  return (
    <div className="game-header">
      <h1>{mode === 'recovery' ? 'Recover Password' : 'Practice Password'}</h1>
      <div className="header-buttons">
        {mode === 'recovery' && (
          <>
            <ConfigButton onClick={onConfigClick} />
            <PracticeModeButton onClick={onPracticeModeClick} disabled={!canPractice} />
          </>
        )}
        {mode === 'practice' && (
          <RecoveryModeButton onClick={onRecoveryModeClick} />
        )}
        <MainPageButton onClick={onMainPageClick} />
      </div>
    </div>
  );
}

function ConfigSection({
  mode,
  config,
  wordCount,
  practiceDisplayConfig,
  onPracticeConfigChange,
}: {
  mode: Mode;
  config: GenerationConfig;
  wordCount: number;
  practiceDisplayConfig: PracticeDisplayConfig;
  onPracticeConfigChange: (config: PracticeDisplayConfig) => void;
}) {
  if (mode === 'practice') {
    const gridSize = getGridSize(config);
    const entropyPerWord = calculateEntropyPerWord(config);
    
    return (
      <div className="practice-configs-container">
        <ConfigDisplay config={config} />
        <SecurityEstimate
          gridSize={gridSize}
          wordCount={wordCount}
          entropyPerWord={entropyPerWord}
          hashConfig={config.hashAlgorithm}
        />
        <PracticeConfigDisplay
          config={practiceDisplayConfig}
          onConfigChange={onPracticeConfigChange}
        />
      </div>
    );
  }
  return <ConfigDisplay config={config} />;
}

function PasswordSection({
  mode,
  subpassword,
  recovery,
  practice,
  practiceDisplayConfig,
}: {
  mode: Mode;
  subpassword: string[];
  recovery: ReturnType<typeof useRecoveryMode>;
  practice: ReturnType<typeof usePracticeMode>;
  practiceDisplayConfig: PracticeDisplayConfig;
}) {
  return (
    <div className="current-password-section">
      <div className="current-password-header">
        <h2>{mode === 'recovery' ? 'Recovered Password' : 'Password Progress'}</h2>
        {mode === 'recovery' && (
          <RecoveryControls
            onReset={recovery.reset}
            onDelete={recovery.deleteLastWord}
            canDelete={subpassword.length > 0}
          />
        )}
        {mode === 'practice' && (
          <PracticeControls
            onReset={practice.reset}
            onPrevious={practice.goToPreviousWord}
            onNext={practice.goToNextWord}
            canGoPrevious={practice.activeWordIndex > 0}
            canGoNext={practice.activeWordIndex < subpassword.length}
          />
        )}
      </div>

      {mode === 'practice' ? (
        <PasswordProgressDisplay
          words={subpassword}
          completedCount={practice.isCompleted ? subpassword.length : practice.completedCount}
          practiceConfig={practiceDisplayConfig}
          activeWordIndex={practice.isCompleted ? undefined : practice.activeWordIndex}
          onWordClick={practice.goToWord}
        />
      ) : (
        <PasswordProgressDisplay
          words={subpassword}
          completedCount={subpassword.length}
          showFuture={false}
        />
      )}

      {mode === 'recovery' && <RecoveryWordCount count={subpassword.length} />}
      {mode === 'practice' && (
        <PracticeWordCount
          current={practice.activeWordIndex}
          total={subpassword.length}
          isCompleted={practice.isCompleted}
        />
      )}
    </div>
  );
}

function WordSelectionSection({
  mode,
  config,
  recovery,
  practice,
  practiceDisplayConfig,
}: {
  mode: Mode;
  config: GenerationConfig;
  recovery: ReturnType<typeof useRecoveryMode>;
  practice: ReturnType<typeof usePracticeMode>;
  practiceDisplayConfig: PracticeDisplayConfig;
}) {
  return (
    <div className="word-selection-section">
      <h2>Select Next Word</h2>
      {mode === 'practice' ? (
        <WordSelectionGrid
          words={practice.isCompleted ? [] : practice.nextWords}
          onWordClick={practice.selectWord}
          {...(practice.isCompleted
            ? { showPlaceholder: true, placeholderText: '-' as const }
            : { correctWordIndex: practice.correctWordIndex, errorWordIndex: practice.errorWordIndex })}
          gridCols={config.gridCols}
          gridRows={config.gridRows}
          highlightCorrect={practiceDisplayConfig.hint}
        />
      ) : (
        <WordSelectionGrid
          words={recovery.nextWords}
          onWordClick={recovery.selectWord}
          gridCols={config.gridCols}
          gridRows={config.gridRows}
        />
      )}
    </div>
  );
}
