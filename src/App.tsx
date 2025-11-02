import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MainPage from './MainPage';
import InteractionPage from './InteractionPage';
import { DEFAULT_CONFIG, type GenerationConfig } from './generation-config';

export type PasswordSource = 'auto-generated' | 'manual';

function AppRouter() {
  const [config, setConfig] = useState<GenerationConfig>(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('gameConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  // Save config to localStorage whenever it changes
  const updateConfig = (newConfig: GenerationConfig) => {
    setConfig(newConfig);
    localStorage.setItem('gameConfig', JSON.stringify(newConfig));
  };

  // Shared subpassword state between MainPage and InteractionPage
  const [subpassword, setSubpassword] = useState<string[]>(() => {
    const saved = localStorage.getItem('gameSubpassword');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Persist subpassword to localStorage whenever it changes
  useEffect(() => {
    if (subpassword.length > 0) {
      localStorage.setItem('gameSubpassword', JSON.stringify(subpassword));
    } else {
      localStorage.removeItem('gameSubpassword');
    }
  }, [subpassword]);

  // Shared selectedWords state for practice mode
  const [selectedWords, setSelectedWords] = useState<string[]>(() => {
    const saved = localStorage.getItem('gameSelectedWords');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });

  // Persist selectedWords to localStorage whenever it changes
  useEffect(() => {
    if (selectedWords.length > 0) {
      localStorage.setItem('gameSelectedWords', JSON.stringify(selectedWords));
    } else {
      localStorage.removeItem('gameSelectedWords');
    }
  }, [selectedWords]);

  // Shared activeWordIndex state for practice mode
  const [activeWordIndex, setActiveWordIndex] = useState<number>(() => {
    const saved = localStorage.getItem('gameActiveWordIndex');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Persist activeWordIndex to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('gameActiveWordIndex', activeWordIndex.toString());
  }, [activeWordIndex]);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <MainPage
              config={config}
              setConfig={updateConfig}
              subpassword={subpassword}
              setSubpassword={setSubpassword}
              setSelectedWords={setSelectedWords}
              setActiveWordIndex={setActiveWordIndex}
            />
          }
        />
        <Route
          path="/recovery"
          element={
            <InteractionPage
              config={config}
              setConfig={updateConfig}
              subpassword={subpassword}
              setSubpassword={setSubpassword}
              selectedWords={selectedWords}
              setSelectedWords={setSelectedWords}
              activeWordIndex={activeWordIndex}
              setActiveWordIndex={setActiveWordIndex}
            />
          }
        />
        <Route
          path="/practice"
          element={
            <InteractionPage
              config={config}
              setConfig={updateConfig}
              subpassword={subpassword}
              setSubpassword={setSubpassword}
              selectedWords={selectedWords}
              setSelectedWords={setSelectedWords}
              activeWordIndex={activeWordIndex}
              setActiveWordIndex={setActiveWordIndex}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

