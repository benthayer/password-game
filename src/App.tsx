import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import MainPage from './MainPage';
import GamePage from './GamePage';
import { DEFAULT_CONFIG, type GameConfig } from './game-config';

export type PasswordSource = 'auto-generated' | 'manual';

function AppRouter() {
  const [password, setPassword] = useState<string>('');
  const [passwordSource, setPasswordSource] = useState<PasswordSource>('manual');
  const [config, setConfig] = useState<GameConfig>(() => {
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
  const updateConfig = (newConfig: GameConfig) => {
    setConfig(newConfig);
    localStorage.setItem('gameConfig', JSON.stringify(newConfig));
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <GamePage
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

