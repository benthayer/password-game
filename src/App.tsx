import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MainPage from './MainPage';
import InteractionPage from './InteractionPage';
import { DEFAULT_CONFIG, type GenerationConfig } from './generation-config';

function AppRouter() {
  const [config, setConfig] = useState<GenerationConfig>(() => {
    const saved = localStorage.getItem('config');
    if (saved) {
      return JSON.parse(saved);
    }
    return DEFAULT_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('config', JSON.stringify(config));
  }, [config]);

  // Shared subpassword state between MainPage and InteractionPage
  const [subpassword, setSubpassword] = useState<string[]>([]);
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <MainPage
              config={config}
              setConfig={setConfig}
              setSubpassword={setSubpassword}
            />
          }
        />
        <Route
          path="/recovery"
          element={
            <InteractionPage
              config={config}
              setConfig={setConfig}
              subpassword={subpassword}
              setSubpassword={setSubpassword}
            />
          }
        />
        <Route
          path="/practice"
          element={
            <InteractionPage
              config={config}
              setConfig={setConfig}
              subpassword={subpassword}
              setSubpassword={setSubpassword}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRouter;

