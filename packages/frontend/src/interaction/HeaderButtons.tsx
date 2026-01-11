/**
 * Header button components.
 * Consistent styling for page header actions.
 */

interface HeaderButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

export function HeaderButton({ onClick, disabled, children }: HeaderButtonProps) {
  return (
    <button
      onClick={onClick}
      className="header-button"
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function ConfigButton({ onClick }: { onClick: () => void }) {
  return <HeaderButton onClick={onClick}>Config</HeaderButton>;
}

export function PracticeModeButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return <HeaderButton onClick={onClick} disabled={disabled}>Practice Mode</HeaderButton>;
}

export function RecoveryModeButton({ onClick }: { onClick: () => void }) {
  return <HeaderButton onClick={onClick}>Recovery Mode</HeaderButton>;
}

export function MainPageButton({ onClick }: { onClick: () => void }) {
  return <HeaderButton onClick={onClick}>Main Page</HeaderButton>;
}

