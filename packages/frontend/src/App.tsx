import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import MainPage from './MainPage';
import InteractionPage from './InteractionPage';
import CouponPage from './CouponPage';
import GitHubLink from './GitHubLink';
import { DEFAULT_CONFIG, PERSIST_CONFIG, type GenerationConfig } from './generation-config';

function AppRouter() {
  const [config, setConfigState] = useState<GenerationConfig>(() => {
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

  // UI metadata about where the config came from — deliberately NOT part of
  // GenerationConfig, which must contain only derivation inputs.
  const [configImportedFromJson, setConfigImportedFromJson] = useState(false);

  const setConfig = (newConfig: GenerationConfig, importedFromJson: boolean = false) => {
    setConfigState(newConfig);
    setConfigImportedFromJson(importedFromJson);
  };

  useEffect(() => {
    if (PERSIST_CONFIG) {
      localStorage.setItem('config', JSON.stringify(config));
    }
  }, [config]);

  // Shared subpassword state between MainPage and InteractionPage
  const [subpassword, setSubpassword] = useState<string[]>([]);
  
  return (
    <>
    <GitHubLink />
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <MainPage
              config={config}
              configImportedFromJson={configImportedFromJson}
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
              configImportedFromJson={configImportedFromJson}
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
                configImportedFromJson={configImportedFromJson}
                setConfig={setConfig}
                subpassword={subpassword}
                setSubpassword={setSubpassword}
              />
            )
          }
        />
        <Route path="/coupons" element={<CouponPage />} />
        <Route path="/coupon" element={<Navigate to="/coupons" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
    </>
  );
}

export default AppRouter;
