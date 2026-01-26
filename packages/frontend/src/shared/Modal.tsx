/**
 * Shared modal components.
 * Consistent modal structure across the app.
 */

import React from 'react';

interface ModalOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function ModalOverlay({ onClose, children, className = '' }: ModalOverlayProps) {
  return (
    <div className={`${className}-overlay`} onClick={onClose}>
      <div className={`${className}-content`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  title: string;
  onClose: () => void;
  className?: string;
}

export function ModalHeader({ title, onClose, className = '' }: ModalHeaderProps) {
  return (
    <div className={`${className}-header`}>
      <h2>{title}</h2>
      <button className={`${className}-close`} onClick={onClose}>×</button>
    </div>
  );
}

interface ModalFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  cancelText?: string;
  confirmText?: string;
  className?: string;
}

export function ModalFooter({
  onCancel,
  onConfirm,
  cancelText = 'Cancel',
  confirmText = 'Confirm',
  className = '',
}: ModalFooterProps) {
  return (
    <div className={`${className}-footer`}>
      <button onClick={onCancel} className={`${className.replace('-modal', '')}-button cancel-button`}>
        {cancelText}
      </button>
      <button onClick={onConfirm} className={`${className.replace('-modal', '')}-button ${className.replace('-modal', '')}-button-primary`}>
        {confirmText}
      </button>
    </div>
  );
}



