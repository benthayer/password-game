/**
 * Header button components.
 * Consistent styling for page header actions.
 */

const HEADER_BUTTON_STYLE = {
  background: '#6366f1',
  color: 'white',
  padding: '12px 24px',
  fontSize: '1rem',
  fontWeight: '500' as const,
};

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
      style={HEADER_BUTTON_STYLE}
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

