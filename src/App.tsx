import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import MainPage from './MainPage';
import InteractionPage from './InteractionPage';
import { DEFAULT_CONFIG, type GenerationConfig } from './generation-config';

export type PasswordSource = 'auto-generated' | 'manual';

function AppRouter() {
  const [password, setPassword] = useState<string>('');
  const [passwordSource, setPasswordSource] = useState<PasswordSource>('manual');
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

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <InteractionPage
              password={password}
              setPassword={setPassword}
              setPasswordSource={setPasswordSource}
              config={config}
              setConfig={updateConfig}
            />
          }
        />
        <Route
          path="/main"
          element={
            <MainPage
              setPassword={setPassword}
              setPasswordSource={setPasswordSource}
              config={config}
              setConfig={updateConfig}
            />
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

