import { useState, useEffect } from 'react';
import AcknowledgmentModal from './AcknowledgmentModal';
import type { GenerationConfig } from '../generation-config';
import { CloseConfirmModal } from '../shared';
import './VaultModal.css';
import './AddCreditsModal.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Billing: $1 = 1 gigabyte-year + 50 GB egress
const GB_YEARS_PER_DOLLAR = 1;
const EGRESS_GB_PER_DOLLAR = 50;

interface AddCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  includeSalt: boolean;
  fullConfig?: GenerationConfig;
  skipAcknowledgment?: boolean;
}

type ModalStep = 'acknowledgment' | 'payment';

export default function AddCreditsModal({ isOpen, onClose, address, includeSalt, fullConfig, skipAcknowledgment = false }: AddCreditsModalProps) {
  const [step, setStep] = useState<ModalStep>('acknowledgment');
  const [credits, setCredits] = useState(5);
  const [loading, setLoading] = useState<'stripe' | 'crypto' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep(skipAcknowledgment ? 'payment' : 'acknowledgment');
      setCredits(5);
      setError(null);
      setShowCloseConfirm(false);
    }
  }, [isOpen, skipAcknowledgment]);

  const handleClose = () => {
    setStep('acknowledgment');
    setError(null);
    onClose();
  };

  const handleCloseAttempt = () => {
    setShowCloseConfirm(true);
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    handleClose();
  };

  const handleCancelClose = () => {
    setShowCloseConfirm(false);
  };

  if (!isOpen) return null;

  if (step === 'acknowledgment') {
    return (
      <AcknowledgmentModal
        isOpen={isOpen}
        onConfirm={() => setStep('payment')}
        onClose={handleClose}
        includeSalt={includeSalt}
        title="Add Credits"
        confirmText="Continue"
        {...(fullConfig && { fullConfig })}
      />
    );
  }

  const gbYears = credits * GB_YEARS_PER_DOLLAR;
  const egressGb = credits * EGRESS_GB_PER_DOLLAR;

  const handlePayWithStripe = async () => {
    if (credits < 1 || credits > 100) {
      setError('Credits must be between 1 and 100');
      return;
    }

    setLoading('stripe');
    setError(null);

    try {
      const response = await fetch(`${API_URL}/stripe/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          amountUsd: credits,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create payment');
      }

      const { checkoutUrl } = await response.json();
      
      // Open Stripe checkout in new tab
      window.open(checkoutUrl, '_blank');
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(null);
    }
  };

  const handlePayWithCrypto = async () => {
    if (credits < 1 || credits > 100) {
      setError('Credits must be between 1 and 100');
      return;
    }

    setLoading('crypto');
    setError(null);

    try {
      const response = await fetch(`${API_URL}/payments/create-charge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          amountUsd: credits,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create payment');
      }

      const { chargeUrl } = await response.json();
      
      // Open Coinbase Commerce checkout in new tab
      window.open(chargeUrl, '_blank');
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <div className="vault-modal-overlay" onClick={handleCloseAttempt}>
        <div className="vault-modal add-credits-modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close-x" onClick={handleCloseAttempt} aria-label="Close">
            ×
          </button>
          <h2>Add Credits</h2>

          <div className="credits-input-section">
            <label htmlFor="credits-input">Credits</label>
            <input
              id="credits-input"
              type="number"
              min={1}
              max={100}
              value={credits}
              onChange={(e) => setCredits(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            />
          </div>

          <div className="credits-breakdown">
            <div className="breakdown-item">
              <span className="breakdown-label">Storage</span>
              <span className="breakdown-value">{gbYears} GB-year{gbYears !== 1 ? 's' : ''}</span>
              <span className="breakdown-note">Files under 1 GB are billed as if they are 1 GB for the purposes of storage</span>
              <span className="breakdown-note breakdown-note-red">Your file will automatically be deleted when you run out of credits.</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-label">Download</span>
              <span className="breakdown-value">{egressGb} GB</span>
              <span className="breakdown-note breakdown-note-green">Your file will NOT be deleted if you run out of download. Just add more credits.</span>
            </div>
          </div>

          <div className="credits-total">
            <span className="total-label">Total</span>
            <span className="total-value">${credits}</span>
          </div>

          {error && <div className="credits-error">{error}</div>}

          <div className="payment-methods">
            <button 
              className="credits-pay credits-pay-stripe" 
              onClick={handlePayWithStripe} 
              disabled={!!loading}
            >
              {loading === 'stripe' ? 'Creating...' : 'Pay with Card'}
            </button>
            <button 
              className="credits-pay credits-pay-crypto" 
              onClick={handlePayWithCrypto} 
              disabled={!!loading}
            >
              {loading === 'crypto' ? 'Creating...' : 'Pay with Crypto'}
            </button>
          </div>

          <p className="credits-note">
            Payment opens in a new tab. Credits are added automatically after payment.
          </p>
        </div>
      </div>
      <CloseConfirmModal
        isOpen={showCloseConfirm}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </>
  );
}
