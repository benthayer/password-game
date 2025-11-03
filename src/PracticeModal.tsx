import './PracticeModal.css';

interface PracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PracticeModal({
  isOpen,
  onClose,
}: PracticeModalProps) {
  return (
    <>
      {isOpen && (
        <div className="practice-modal-overlay" onClick={onClose}>
          <div className="practice-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="practice-modal-header">
              <h2>Practice Mode</h2>
              <button className="practice-modal-close" onClick={onClose}>×</button>
            </div>
            <div className="practice-modal-body">
              <p>
                You can enter practice mode by first going through the steps to recover your password
                (even if you know it) and then clicking the practice mode button at the top.
              </p>
            </div>
            <div className="practice-modal-footer">
              <button onClick={onClose} className="practice-button practice-button-primary">
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
