import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MainPage from './MainPage';
import InteractionPage from './InteractionPage';
import { DEFAULT_CONFIG, type GenerationConfig } from './generation-config';

export type PasswordSource = 'auto-generated' | 'manual';

function AppRouter() {
  const [password, setPassword] = useState<string>(() => {
    const saved = localStorage.getItem('gamePassword');
    return saved || '';
  });
  const [passwordSource, setPasswordSource] = useState<PasswordSource>(() => {
    const saved = localStorage.getItem('gamePasswordSource');
    return (saved as PasswordSource) || 'manual';
  });
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

  // Save password to localStorage whenever it changes
  useEffect(() => {
    if (password) {
      localStorage.setItem('gamePassword', password);
    } else {
      localStorage.removeItem('gamePassword');
    }
  }, [password]);

  // Save passwordSource to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('gamePasswordSource', passwordSource);
  }, [passwordSource]);

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
            <MainPage
              setPassword={setPassword}
              setPasswordSource={setPasswordSource}
              config={config}
              setConfig={updateConfig}
            />
          }
        />
        <Route
          path="/recovery"
          element={
            <InteractionPage
              password={password}
              setPassword={(pwd: string) => {
                setPassword(pwd);
                if (pwd) {
                  localStorage.setItem('gamePassword', pwd);
                } else {
                  localStorage.removeItem('gamePassword');
                }
              }}
              setPasswordSource={(source: PasswordSource) => {
                setPasswordSource(source);
                localStorage.setItem('gamePasswordSource', source);
              }}
              config={config}
              setConfig={updateConfig}
            />
          }
        />
        <Route
          path="/practice"
          element={
            <InteractionPage
              password={password}
              setPassword={(pwd: string) => {
                setPassword(pwd);
                if (pwd) {
                  localStorage.setItem('gamePassword', pwd);
                } else {
                  localStorage.removeItem('gamePassword');
                }
              }}
              setPasswordSource={(source: PasswordSource) => {
                setPasswordSource(source);
                localStorage.setItem('gamePasswordSource', source);
              }}
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

