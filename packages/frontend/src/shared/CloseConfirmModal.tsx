/**
 * Confirmation modal shown when user tries to close a modal with unsaved input.
 * Sits on top of the parent modal.
 */

import './CloseConfirmModal.css';

interface CloseConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  message?: string;
}

export default function CloseConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  message = "Are you sure you want to close? Any changes will be lost.",
}: CloseConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="close-confirm-overlay">
      <div className="close-confirm-modal">
        <p>{message}</p>
        <div className="close-confirm-buttons">
          <button className="close-confirm-cancel" onClick={onCancel}>
            Go Back
          </button>
          <button className="close-confirm-yes" onClick={onConfirm}>
            Yes, Close
          </button>
        </div>
      </div>
    </div>
  );
}

