/**
 * Recovery mode controls.
 * Reset and delete buttons.
 */

interface RecoveryControlsProps {
  onReset: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

export default function RecoveryControls({
  onReset,
  onDelete,
  canDelete,
}: RecoveryControlsProps) {
  return (
    <div className="password-controls">
      <ResetButton onClick={onReset} disabled={!canDelete} />
      <DeleteButton onClick={onDelete} disabled={!canDelete} />
    </div>
  );
}

function ResetButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      className="header-button reset-button"
      disabled={disabled}
      style={{
        background: '#dc2626',
        color: 'white',
        padding: '10px 16px',
        fontSize: '1rem',
        fontWeight: '500',
      }}
    >
      Reset
    </button>
  );
}

function DeleteButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      className="header-button delete-button"
      disabled={disabled}
      style={{
        background: '#dc2626',
        color: 'white',
        padding: '10px 16px',
        fontSize: '1rem',
        fontWeight: '500',
      }}
      title="Delete last word"
    >
      ⌫
    </button>
  );
}

