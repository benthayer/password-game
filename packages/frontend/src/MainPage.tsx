import { useEffect, useState } from 'react';
import type { GenerationConfig } from './generation-config';
import GeneratePasswordModal from './GeneratePasswordModal';
import RecoveryModal from './RecoveryModal';
import PracticeModal from './PracticeModal';
import AboutModal from './AboutModal';
import PaymentResultModal, { type PaymentResult } from './PaymentResultModal';
import './MainPage.css';

interface MainPageProps {
  config: GenerationConfig;
  configImportedFromJson: boolean;
  setConfig: (config: GenerationConfig, importedFromJson?: boolean) => void;
  setSubpassword: (subpassword: string[]) => void;
}

export default function MainPage({
  config,
  configImportedFromJson,
  setConfig,
  setSubpassword,
}: MainPageProps) {
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [practiceModalOpen, setPracticeModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(() => {
    const value = new URLSearchParams(window.location.search).get('payment');
    return value === 'success' || value === 'cancelled' ? value : null;
  });

  useEffect(() => {
    // Strip the ?payment= param so a refresh doesn't re-show the modal
    if (paymentResult) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [paymentResult]);

  const handlePractice = () => {
    setPracticeModalOpen(true);
  };

  return (
    <div className="main-page">
      <div className="main-content">
        <h1>Main</h1>
        <div className="button-container">
          <button onClick={() => setGenerateModalOpen(true)} className="primary-button generate-button">
            Generate
          </button>
          <button onClick={() => setRecoveryModalOpen(true)} className="primary-button recover-button">
            Recover
          </button>
          <button onClick={handlePractice} className="primary-button practice-button">
            Practice
          </button>
          <button onClick={() => setAboutModalOpen(true)} className="primary-button about-button">
            About
          </button>
        </div>
      </div>
      <GeneratePasswordModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        config={config}
        setConfig={setConfig}
        setSubpassword={setSubpassword}
      />
      <RecoveryModal
        isOpen={recoveryModalOpen}
        onClose={() => setRecoveryModalOpen(false)}
        config={config}
        configImportedFromJson={configImportedFromJson}
        setConfig={setConfig}
        setSubpassword={setSubpassword}
      />
      <PracticeModal
        isOpen={practiceModalOpen}
        onClose={() => setPracticeModalOpen(false)}
      />
      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
      />
      <PaymentResultModal
        result={paymentResult}
        onClose={() => setPaymentResult(null)}
      />
    </div>
  );
}
