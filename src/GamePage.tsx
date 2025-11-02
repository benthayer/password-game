import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getNextWords, generatePassword } from './crypto-utils';
import type { PasswordSource } from './App';
import type { GameConfig, PracticeDisplayConfig } from './game-config';
import { getGridSize, DEFAULT_PRACTICE_DISPLAY_CONFIG } from './game-config';
import PasswordProgressDisplay from './PasswordProgressDisplay';
import WordSelectionGrid from './WordSelectionGrid';
import ConfigModal from './ConfigModal';
import ConfigDisplay from './ConfigDisplay';
import PracticeConfigDisplay from './PracticeConfigDisplay';
import GeneratePasswordModal from './GeneratePasswordModal';
import './GamePage.css';
import './PracticePage.css';

type Mode = 'game' | 'practice';

interface GamePageProps {
  password?: string;
  setPassword: (password: string) => void;
  setPasswordSource: (source: PasswordSource) => void;
  config: GameConfig;
  setConfig: (config: GameConfig) => void;
}

export default function GamePage({ password, setPassword, setPasswordSource, config, setConfig }: GamePageProps) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('game');
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  
  // Game mode state
  const [subpassword, setSubpassword] = useState<string[]>([]);
  const [nextWords, setNextWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Practice mode state
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(0);
  const [correctWordIndex, setCorrectWordIndex] = useState<number>(-1);
  const [errorButtonIndex, setErrorButtonIndex] = useState<number | null>(null);
  const [practiceDisplayConfig, setPracticeDisplayConfig] = useState<PracticeDisplayConfig>(DEFAULT_PRACTICE_DISPLAY_CONFIG);
  
  // Check if practice is completed (activeWordIndex is out of range)
  const isCompleted = activeWordIndex >= subpassword.length;

  const gridSize = getGridSize(config);

  // Game mode: load next words for building password
  const loadNextWordsGame = async (currentSubpassword: string[]) => {
    setLoading(true);
    try {
      const words = await getNextWords(currentSubpassword, gridSize, config.seedPhrase);
      setNextWords(words);
    } catch (error) {
      console.error('Error loading next words:', error);
    } finally {
      setLoading(false);
    }
  };

  // Practice mode: load next words with correct word highlighting
  const loadNextWordsPractice = async (currentSelected: string[], targetWords: string[], wordIndex: number, showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    try {
      // Use the full prefix up to (but not including) the active word index
      // This ensures we get the correct options for the active word
      const prefix = targetWords.slice(0, wordIndex);
      const words = await getNextWords(prefix, gridSize, config.seedPhrase);
      setNextWords(words);
      
      // Find which word in the options matches the word at the active index
      if (wordIndex < targetWords.length) {
        const correctWord = targetWords[wordIndex];
        const index = words.findIndex(word => word === correctWord);
        setCorrectWordIndex(index);
      }
    } catch (error) {
      console.error('Error loading next words:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Initialize game mode
  useEffect(() => {
    if (mode === 'game') {
      loadNextWordsGame([]);
    }
  }, [mode, config]);

  // Auto-initialize practice mode if password is provided
  useEffect(() => {
    if (password && password.trim() !== '' && subpassword.length === 0) {
      const passwordWords = password.split(' ');
      setSubpassword(passwordWords);
      // Initialize practice mode state
      setSelectedWords([]);
      setActiveWordIndex(0);
      setErrorButtonIndex(null);
      setMode('practice');
      loadNextWordsPractice([], passwordWords, 0, true);
    }
  }, [password]);

  // Game mode: handle word selection
  const handleWordSelectGame = async (word: string) => {
    const newSubpassword = [...subpassword, word];
    setSubpassword(newSubpassword);
    await loadNextWordsGame(newSubpassword);
  };

  // Practice mode: handle word selection
  const handleWordSelectPractice = async (word: string) => {
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
        await loadNextWordsPractice(newSelected, subpassword, newActiveIndex, false);
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

  // Generate password and switch to practice mode
  const handleGeneratePassword = async (numWords: number) => {
    setLoading(true);
    try {
      // Generate a password with the specified number of words
      const passwordString = await generatePassword(numWords, gridSize, config.seedPhrase);
      const passwordWords = passwordString.split(' ');
      
      // Set the password in the game state
      setSubpassword(passwordWords);
      
      // Set the password in the app state
      setPassword(passwordString);
      setPasswordSource('auto-generated');
      
      // Initialize practice mode state
      setSelectedWords([]);
      setActiveWordIndex(0);
      setErrorButtonIndex(null);
      setPracticeDisplayConfig(DEFAULT_PRACTICE_DISPLAY_CONFIG);
      setMode('practice');
      
      // Load words for practice mode
      await loadNextWordsPractice([], passwordWords, 0, false);
    } catch (error) {
      console.error('Error generating password:', error);
    } finally {
      setLoading(false);
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
    setMode('practice');
    loadNextWordsPractice([], subpassword, 0, true);
  };

  // Reset practice
  const handleResetPractice = () => {
    setSelectedWords([]);
    setActiveWordIndex(0);
    setErrorButtonIndex(null);
    if (subpassword.length > 0) {
      loadNextWordsPractice([], subpassword, 0, false);
    }
  };

  // Return to game mode
  const handleReturnToGame = () => {
    setMode('game');
    setSelectedWords([]);
    setActiveWordIndex(0);
    setErrorButtonIndex(null);
  };

  // Navigate to previous word in practice mode
  const handlePreviousWord = async () => {
    if (activeWordIndex > 0) {
      const newActiveIndex = activeWordIndex - 1;
      setActiveWordIndex(newActiveIndex);
      // Truncate selectedWords to only include words up to the new active index
      // (don't include words that were selected beyond this point)
      const newSelected = selectedWords.slice(0, newActiveIndex);
      setSelectedWords(newSelected);
      setErrorButtonIndex(null);
      await loadNextWordsPractice(newSelected, subpassword, newActiveIndex, false);
    }
  };

  // Navigate to next word in practice mode
  const handleNextWord = async () => {
    if (activeWordIndex < subpassword.length) {
      const newActiveIndex = activeWordIndex + 1;
      setActiveWordIndex(newActiveIndex);
      setErrorButtonIndex(null);
      // Only load next words if not completed
      if (newActiveIndex < subpassword.length) {
        await loadNextWordsPractice(selectedWords, subpassword, newActiveIndex, false);
      }
    }
  };

  // Handle clicking on a word in practice mode to set it as active
  const handleWordClickInDisplay = async (index: number) => {
    if (index < 0 || index >= subpassword.length) {
      return;
    }
    setActiveWordIndex(index);
    setErrorButtonIndex(null);
    // Truncate selectedWords to only include words up to (but not including) the clicked index
    // This allows the user to jump back to any word and start from there
    const newSelected = selectedWords.slice(0, index);
    setSelectedWords(newSelected);
    await loadNextWordsPractice(newSelected, subpassword, index, false);
  };

  // Delete last word
  const handleDelete = async () => {
    if (subpassword.length === 0) return;
    
    const newSubpassword = subpassword.slice(0, -1);
    setSubpassword(newSubpassword);
    
    // If in practice mode, reset practice state
    if (mode === 'practice') {
      setSelectedWords([]);
      setErrorButtonIndex(null);
      setMode('game');
    }
    
    // Reload words for the new password state
    await loadNextWordsGame(newSubpassword);
  };

  // Reset all words and state
  const handleReset = () => {
    setSubpassword([]);
    setSelectedWords([]);
    setErrorButtonIndex(null);
    setMode('game');
    loadNextWordsGame([]);
  };

  return (
    <div className="game-page">
      <div className="game-content">
        <div className="game-header">
          <h1>{mode === 'game' ? 'Password Game' : 'Practice Password'}</h1>
          <div className="header-buttons">
            {mode === 'game' && (
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
                Config
              </button>
            )}
            {mode === 'game' && (
              <>
                <button 
                  onClick={() => setGenerateModalOpen(true)} 
                  className="header-button"
                  disabled={loading}
                  style={{ 
                    background: '#10b981', 
                    color: 'white',
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: '500'
                  }}
                >
                  Generate Password
                </button>
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
                  Practice Password
                </button>
              </>
            )}
            {mode === 'practice' && (
              <>
                <button onClick={handleReturnToGame} className="header-button">
                  Back to Game
                </button>
              </>
            )}
          </div>
        </div>

        {mode === 'practice' ? (
          <div className="practice-configs-container">
            <ConfigDisplay config={config} />
            <PracticeConfigDisplay
              config={practiceDisplayConfig}
              onConfigChange={setPracticeDisplayConfig}
            />
          </div>
        ) : (
          <ConfigDisplay config={config} />
        )}

        <div className="current-password-section">
          <div className="current-password-header">
            <h2>{mode === 'game' ? 'Current Password' : 'Password Progress'}</h2>
            {mode === 'game' && (
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
          {mode === 'game' && (
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
              loading={loading}
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
              onWordClick={handleWordSelectGame}
              loading={loading}
              gridCols={config.gridCols}
              gridRows={config.gridRows}
            />
          )}
        </div>

        <ConfigModal
          isOpen={configModalOpen}
          onClose={() => setConfigModalOpen(false)}
          config={config}
          onSave={setConfig}
        />
        <GeneratePasswordModal
          isOpen={generateModalOpen}
          onClose={() => setGenerateModalOpen(false)}
          config={config}
          onGenerate={handleGeneratePassword}
        />
      </div>
    </div>
  );
}
