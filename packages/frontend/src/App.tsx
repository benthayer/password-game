import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MainPage from './MainPage';
import InteractionPage from './InteractionPage';
import { DEFAULT_CONFIG, type GenerationConfig } from './generation-config';
import { DEFAULT_FULL_HASH_CONFIG, type FullHashConfig } from './hash-config';

function AppRouter() {
  const [config, setConfig] = useState<GenerationConfig>(() => {
    const saved = localStorage.getItem('config');
    if (saved) {
      return JSON.parse(saved);
    }
    return DEFAULT_CONFIG;
  });

  const [hashConfig, setHashConfig] = useState<FullHashConfig>(() => {
    const saved = localStorage.getItem('hashConfig');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return DEFAULT_FULL_HASH_CONFIG;
      }
    }
    return DEFAULT_FULL_HASH_CONFIG;
  });

  useEffect(() => {
    localStorage.setItem('config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('hashConfig', JSON.stringify(hashConfig));
  }, [hashConfig]);

  // Shared subpassword state between MainPage and InteractionPage
  const [subpassword, setSubpassword] = useState<string[]>([]);
  return (
    <>
    <meta name="viewport" content="width=650, initial-scale=1.0">
    </meta>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <MainPage
              config={config}
              setConfig={setConfig}
              hashConfig={hashConfig}
              setHashConfig={setHashConfig}
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
              hashConfig={hashConfig}
              setHashConfig={setHashConfig}
              subpassword={subpassword}
              setSubpassword={setSubpassword}
            />
          }
        />
        <Route
          path="/practice"
          element={
            subpassword.length === 0 ? (
              <Navigate to="/recovery" replace />
            ) : (
              <InteractionPage
                config={config}
                setConfig={setConfig}
                hashConfig={hashConfig}
                setHashConfig={setHashConfig}
                subpassword={subpassword}
                setSubpassword={setSubpassword}
              />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </>
  );
}

export default AppRouter;
