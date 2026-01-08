import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getNextWords } from './crypto-utils';
import type { GenerationConfig, PracticeDisplayConfig } from './generation-config';
import { getGridSize, DEFAULT_PRACTICE_DISPLAY_CONFIG } from './generation-config';
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
  // Determine mode from URL path
  const mode: Mode = location.pathname === '/practice' ? 'practice' : 'recovery';
  const [configModalOpen, setConfigModalOpen] = useState(false);
  
  // State
  const [nextWords, setNextWords] = useState<string[]>([]);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(0);
  const [correctWordIndex, setCorrectWordIndex] = useState<number>(-1);
  const [errorButtonIndex, setErrorButtonIndex] = useState<number | null>(null);
  const [practiceDisplayConfig, setPracticeDisplayConfig] = useState<PracticeDisplayConfig>(DEFAULT_PRACTICE_DISPLAY_CONFIG);
  
  // Check if practice is completed (activeWordIndex is out of range)
  const isCompleted = activeWordIndex >= subpassword.length;

  // Recovery mode: load next words for building password
  const loadNextWordsRecovery = (currentSubpassword: string[]) => {
    setNextWords(getNextWords(currentSubpassword, config));
  };

  // Practice mode: load next words with correct word highlighting
  const loadNextWordsPractice = (targetWords: string[], wordIndex: number) => {
    try {
      // Use the full prefix up to (but not including) the active word index
      // This ensures we get the correct options for the active word
      const prefix = targetWords.slice(0, wordIndex);
      const words = getNextWords(prefix, config);
      setNextWords(words);
      
      // Find which word in the options matches the word at the active index
      if (wordIndex < targetWords.length) {
        const correctWord = targetWords[wordIndex];
        const index = words.findIndex(word => word === correctWord);
        setCorrectWordIndex(index);
      }
    } catch (error) {
      console.error('Error loading next words:', error);
    }
  };

  // Initialize game mode based on route and saved state
  useEffect(() => {
    if (mode === 'recovery') {
      if (subpassword.length > 0) {
        loadNextWordsRecovery(subpassword);
      } else {
        loadNextWordsRecovery([]);
      }
    } else if (mode === 'practice') {
      loadNextWordsPractice(subpassword, activeWordIndex);
    }
  }, [mode, config, subpassword, selectedWords, activeWordIndex]);


  // Recovery mode: handle word selection
  const handleWordSelectRecovery = (word: string) => {
    const newSubpassword = [...subpassword, word];
    setSubpassword(newSubpassword);
    loadNextWordsRecovery(newSubpassword);
  };

  // Practice mode: handle word selection
  const handleWordSelectPractice = (word: string) => {
    // Don't allow selection when completed (activeWordIndex out of range)
    if (isCompleted || activeWordIndex >= subpassword.length) {
      return;
    }
    
    const expectedWord = subpassword[activeWordIndex];
    
    if (word === expectedWord) {
      // Correct word selected - clear any error state
      setErrorButtonIndex(null);
      
      // Update selectedWords to include all words up to and including the active index
      const newSelected = subpassword.slice(0, activeWordIndex + 1);
      setSelectedWords(newSelected);
      
      // Move to next word (or beyond if at the end)
      const newActiveIndex = activeWordIndex + 1;
      setActiveWordIndex(newActiveIndex);
      
      // Only load next words if not completed
      if (newActiveIndex < subpassword.length) {
        loadNextWordsPractice(subpassword, newActiveIndex);
      }
    } else {
      // Wrong word selected - show error animation
      const wrongIndex = nextWords.findIndex(w => w === word);
      if (wrongIndex !== -1) {
        setErrorButtonIndex(wrongIndex);
        // Reset error state after animation
        setTimeout(() => {
          setErrorButtonIndex(null);
        }, 1500);
      }
    }
  };

  // Switch to practice mode
  const handlePracticePassword = () => {
    if (subpassword.length === 0) {
      return;
    }
    // Initialize practice mode state
    setSelectedWords([]);
    setActiveWordIndex(0);
    setErrorButtonIndex(null);
    // Navigate to practice mode
    navigate('/practice');
  };

  // Reset practice
  const handleResetPractice = () => {
    setSelectedWords([]);
    setActiveWordIndex(0);
    setErrorButtonIndex(null);
    if (subpassword.length > 0) {
      loadNextWordsPractice(subpassword, 0);
    }
  };

  // Return to recovery mode
  const handleReturnToRecovery = () => {
    setSelectedWords([]);
    setActiveWordIndex(0);
    setErrorButtonIndex(null);
    navigate('/recovery');
  };

  // Navigate to previous word in practice mode
  const handlePreviousWord = () => {
    if (activeWordIndex > 0) {
      const newActiveIndex = activeWordIndex - 1;
      setActiveWordIndex(newActiveIndex);
      // Truncate selectedWords to only include words up to the new active index
      // (don't include words that were selected beyond this point)
      const newSelected = selectedWords.slice(0, newActiveIndex);
      setSelectedWords(newSelected);
      setErrorButtonIndex(null);
      loadNextWordsPractice(subpassword, newActiveIndex);
    }
  };

  // Navigate to next word in practice mode
  const handleNextWord = () => {
    if (activeWordIndex < subpassword.length) {
      const newActiveIndex = activeWordIndex + 1;
      setActiveWordIndex(newActiveIndex);
      setErrorButtonIndex(null);
      // Only load next words if not completed
      if (newActiveIndex < subpassword.length) {
        loadNextWordsPractice(subpassword, newActiveIndex);
      }
    }
  };

  // Handle clicking on a word in practice mode to set it as active
  const handleWordClickInDisplay = (index: number) => {
    if (index < 0 || index >= subpassword.length) {
      return;
    }
    setActiveWordIndex(index);
    setErrorButtonIndex(null);
    // Truncate selectedWords to only include words up to (but not including) the clicked index
    // This allows the user to jump back to any word and start from there
    const newSelected = selectedWords.slice(0, index);
    setSelectedWords(newSelected);
    loadNextWordsPractice(subpassword, index);
  };

  // Delete last word
  const handleDelete = () => {
    if (subpassword.length === 0) return;
    
    const newSubpassword = subpassword.slice(0, -1);
    setSubpassword(newSubpassword);
    
    // If in practice mode, navigate to recovery mode
    if (mode === 'practice') {
      setSelectedWords([]);
      setErrorButtonIndex(null);
      navigate('/recovery');
    }
    
    // Reload words for the new password state
    loadNextWordsRecovery(newSubpassword);
  };

  // Reset all words and state
  const handleReset = () => {
    setSubpassword([]);
    setSelectedWords([]);
    setErrorButtonIndex(null);
    setActiveWordIndex(0);
    // Navigate to recovery mode
    navigate('/recovery');
    loadNextWordsRecovery([]);
  };

  // Handle config save - reset password progress when config changes
  const handleConfigSave = (newConfig: GenerationConfig) => {
    setConfig(newConfig);
    // Reset password progress
    setSubpassword([]);
    setSelectedWords([]);
    setActiveWordIndex(0);
    setErrorButtonIndex(null);
    // Navigate to recovery mode
    navigate('/recovery');
    // Reload words with new config
    loadNextWordsRecovery([]);
  };

  return (
    <div className="game-page">
      <div className="game-content">
        <div className="game-header">
          <h1>{mode === 'recovery' ? 'Recover Password' : 'Practice Password'}</h1>
          <div className="header-buttons">
            {mode === 'recovery' && (
              <button
                onClick={() => setConfigModalOpen(true)}
                className="header-button config-button"
                style={{
                  background: '#6366f1',
                  color: 'white',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  fontWeight: '500'
                }}
              >
                Edit Config
              </button>
            )}
            {mode === 'recovery' && (
              <>
                <button 
                  onClick={handlePracticePassword} 
                  className="header-button"
                  disabled={subpassword.length === 0}
                  style={{ 
                    background: '#6366f1', 
                    color: 'white',
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}
                >
                  Practice Mode
                </button>
              </>
            )}
            {mode === 'practice' && (
              <>
                <button onClick={handleReturnToRecovery} className="header-button"
                  style={{ 
                    background: '#6366f1', 
                    color: 'white',
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}>
                  Recovery Mode
                </button>
              </>
            )}
            <button
              onClick={() => navigate('/')}
              className="header-button main-page-button"
              style={{
                background: '#6366f1',
                color: 'white',
                padding: '12px 24px',
                fontSize: '1rem',
                fontWeight: '500'
              }}
            >
              Main Page
            </button>
          </div>
        </div>

        {mode === 'practice' ? (
          <div className="practice-configs-container">
            <ConfigDisplay config={config} numWords={subpassword.length} />
            <PracticeConfigDisplay
              config={practiceDisplayConfig}
              onConfigChange={setPracticeDisplayConfig}
            />
          </div>
        ) : (
          <ConfigDisplay config={config} numWords={subpassword.length} />
        )}

        <div className="current-password-section">
          <div className="current-password-header">
            <h2>{mode === 'recovery' ? 'Recovered Password' : 'Password Progress'}</h2>
            {mode === 'recovery' && (
              <div className="password-controls">
                <button 
                  onClick={handleReset} 
                  className="header-button reset-button"
                  disabled={subpassword.length === 0}
                  style={{ 
                    background: '#dc2626', 
                    color: 'white',
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}
                >
                  Reset
                </button>
                <button 
                  onClick={handleDelete} 
                  className="header-button delete-button"
                  disabled={subpassword.length === 0}
                  style={{ 
                    background: '#dc2626', 
                    color: 'white',
                    padding: '12px 24px',
                    fontSize: '1.5rem',
                    fontWeight: '500',
                    lineHeight: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingTop: '10px',
                    paddingBottom: '14px'
                  }}
                  title="Delete last word"
                >
                  ⌫
                </button>
              </div>
            )}
            {mode === 'practice' && (
              <div className="practice-controls">
                <button 
                  onClick={handleResetPractice} 
                  className="header-button navigation-button"
                  disabled={activeWordIndex === 0}
                >
                  &lt;&lt;
                </button>
                <button
                  onClick={handlePreviousWord}
                  className="header-button navigation-button"
                  disabled={activeWordIndex === 0}
                  title="Previous word"
                >
                  &lt;
                </button>
                <button
                  onClick={handleNextWord}
                  className="header-button navigation-button"
                  disabled={activeWordIndex >= subpassword.length}
                  title="Next word"
                >
                  &gt;
                </button>
              </div>
            )}
          </div>
          {mode === 'practice' ? (
            <PasswordProgressDisplay
              words={subpassword}
              completedCount={isCompleted ? subpassword.length : selectedWords.length}
              practiceConfig={practiceDisplayConfig}
              activeWordIndex={isCompleted ? undefined : activeWordIndex}
              onWordClick={handleWordClickInDisplay}
            />
          ) : (
            <PasswordProgressDisplay
              words={subpassword}
              completedCount={subpassword.length}
              showFuture={false}
            />
          )}
          {mode === 'recovery' && (
            <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
              {subpassword.length} {subpassword.length === 1 ? 'word' : 'words'} selected
            </p>
          )}
          {mode === 'practice' && (
            <p style={{ marginTop: '12px', color: '#6b7280', fontSize: '0.95rem' }}>
              {isCompleted ? (
                <>All {subpassword.length} words completed</>
              ) : (
                <>Word {activeWordIndex + 1} of {subpassword.length}</>
              )}
            </p>
          )}
        </div>

        <div className="word-selection-section">
          <h2>Select Next Word</h2>
          {mode === 'practice' ? (
            <WordSelectionGrid
              words={isCompleted ? [] : nextWords}
              onWordClick={handleWordSelectPractice}
              {...(isCompleted 
                ? { showPlaceholder: true, placeholderText: "-" as const }
                : { correctWordIndex, errorWordIndex: errorButtonIndex })}
              gridCols={config.gridCols}
              gridRows={config.gridRows}
              highlightCorrect={practiceDisplayConfig.hint}
            />
          ) : (
            <WordSelectionGrid
              words={nextWords}
              onWordClick={handleWordSelectRecovery}
              gridCols={config.gridCols}
              gridRows={config.gridRows}
            />
          )}
        </div>

        <ConfigModal
          isOpen={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
          config={config}
          onSave={handleConfigSave}
        />
      </div>
      <VaultCard password={subpassword} />
    </div>
  );
}
