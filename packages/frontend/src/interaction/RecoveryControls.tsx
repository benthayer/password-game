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
      title="Delete last word"
    >
      ⌫
    </button>
  );
}

