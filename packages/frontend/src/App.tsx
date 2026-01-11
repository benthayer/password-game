import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MainPage from './MainPage';
import InteractionPage from './InteractionPage';
import { DEFAULT_CONFIG, PERSIST_CONFIG, type GenerationConfig } from './generation-config';

function AppRouter() {
  const [config, setConfig] = useState<GenerationConfig>(() => {
    if (PERSIST_CONFIG) {
      const saved = localStorage.getItem('config');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Migrate old config format if needed
          return {
            ...DEFAULT_CONFIG,
            ...parsed,
          };
        } catch {
          return DEFAULT_CONFIG;
        }
      }
    }
    return DEFAULT_CONFIG;
  });

  useEffect(() => {
    if (PERSIST_CONFIG) {
      localStorage.setItem('config', JSON.stringify(config));
    }
  }, [config]);

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
            subpassword.length === 0 ? (
              <Navigate to="/recovery" replace />
            ) : (
              <InteractionPage
                config={config}
                setConfig={setConfig}
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
