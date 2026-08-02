/**
 * Modal shown after returning from Stripe checkout.
 */

import './PaymentResultModal.css';

export type PaymentResult = 'success' | 'cancelled';

interface PaymentResultModalProps {
  result: PaymentResult | null;
  onClose: () => void;
}

export default function PaymentResultModal({ result, onClose }: PaymentResultModalProps) {
  if (!result) return null;

  const success = result === 'success';

  return (
    <div className="payment-result-overlay" onClick={onClose}>
      <div className="payment-result-modal" onClick={(e) => e.stopPropagation()}>
        <div className={`payment-result-icon ${success ? 'success' : 'cancelled'}`}>
          {success ? '✓' : '✕'}
        </div>
        <h2>{success ? 'Payment Successful' : 'Payment Cancelled'}</h2>
        <p>
          {success
            ? 'Please return to your original page to continue. You may close this page.'
            : 'No charge was made. You may close this page.'}
        </p>
        <button className="payment-result-button" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
