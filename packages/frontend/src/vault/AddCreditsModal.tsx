import { useState, useEffect } from 'react';
import AcknowledgmentModal from './AcknowledgmentModal';
import type { GenerationConfig } from '../generation-config';
import { CloseConfirmModal } from '../shared';
import { redeemCoupon, type AuthKeys, type RedeemResult } from './vault-api';
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
  authKeys: AuthKeys;
  includeSalt: boolean;
  fullConfig?: GenerationConfig;
  skipAcknowledgment?: boolean;
}

type ModalStep = 'acknowledgment' | 'payment' | 'coupon';

export default function AddCreditsModal({ isOpen, onClose, address, authKeys, includeSalt, fullConfig, skipAcknowledgment = false }: AddCreditsModalProps) {
  const [step, setStep] = useState<ModalStep>('acknowledgment');
  const [credits, setCredits] = useState(5);
  const [loading, setLoading] = useState<'stripe' | 'crypto' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [couponToken, setCouponToken] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [redeemed, setRedeemed] = useState<RedeemResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(skipAcknowledgment ? 'payment' : 'acknowledgment');
      setCredits(5);
      setError(null);
      setShowCloseConfirm(false);
      setCouponToken('');
      setRedeeming(false);
      setRedeemed(null);
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

  const handleRedeemCoupon = async () => {
    if (!couponToken.trim()) return;

    setRedeeming(true);
    setError(null);
    try {
      setRedeemed(await redeemCoupon(authKeys, couponToken.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not redeem that token');
    } finally {
      setRedeeming(false);
    }
  };

  if (step === 'coupon') {
    return (
      <>
        <div className="vault-modal-overlay" onClick={handleCloseAttempt}>
          <div className="vault-modal add-credits-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-x" onClick={handleCloseAttempt} aria-label="Close">
              ×
            </button>
            <h2>Add credit with coupon</h2>

            {redeemed ? (
              <>
                <div className="credits-breakdown">
                  <div className="breakdown-item">
                    <span className="breakdown-label">Added</span>
                    <span className="breakdown-value">
                      {redeemed.credits} credit{redeemed.credits === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Storage now</span>
                    <span className="breakdown-value">
                      {redeemed.gbYearsRemaining.toFixed(2)} GB-years
                    </span>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-label">Download now</span>
                    <span className="breakdown-value">
                      {redeemed.egressGbRemaining.toFixed(1)} GB
                    </span>
                  </div>
                </div>
                <div className="payment-methods">
                  <button className="credits-pay" onClick={handleClose}>Done</button>
                </div>
              </>
            ) : (
              <>
                <div className="credits-input-section">
                  <label htmlFor="coupon-token-input">Token</label>
                  <input
                    id="coupon-token-input"
                    type="text"
                    value={couponToken}
                    onChange={(e) => setCouponToken(e.target.value)}
                    placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {error && <div className="credits-error">{error}</div>}

                <div className="payment-methods">
                  <button
                    className="credits-pay"
                    onClick={handleRedeemCoupon}
                    disabled={!couponToken.trim() || redeeming}
                  >
                    {redeeming ? 'Redeeming...' : 'Redeem'}
                  </button>
                  <button
                    className="credits-pay"
                    onClick={() => { setStep('payment'); setError(null); }}
                    disabled={redeeming}
                  >
                    Back
                  </button>
                </div>

                <p className="credits-note">
                  Don't have a token? Get one at <strong>/coupons</strong> with a coupon code.
                </p>
              </>
            )}
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
            <button
              className="credits-pay credits-pay-coupon"
              onClick={() => { setStep('coupon'); setError(null); }}
              disabled={!!loading}
            >
              Add credit with coupon
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
