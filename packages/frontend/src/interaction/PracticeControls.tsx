/**
 * Practice mode navigation controls.
 * Previous, next, and reset buttons.
 */

interface PracticeControlsProps {
  onReset: () => void;
  onPrevious: () => void;
  onNext: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

export default function PracticeControls({
  onReset,
  onPrevious,
  onNext,
  canGoPrevious,
  canGoNext,
}: PracticeControlsProps) {
  return (
    <div className="practice-controls">
      <NavigationButton onClick={onReset} disabled={!canGoPrevious} label="<<" />
      <NavigationButton onClick={onPrevious} disabled={!canGoPrevious} label="<" title="Previous word" />
      <NavigationButton onClick={onNext} disabled={!canGoNext} label=">" title="Next word" />
    </div>
  );
}

function NavigationButton({
  onClick,
  disabled,
  label,
  title,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="header-button navigation-button"
      disabled={disabled}
      title={title}
    >
      {label}
    </button>
  );
}

