import AcknowledgmentModal from './AcknowledgmentModal';
import type { GenerationConfig } from '../generation-config';

interface UploadConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  includeSalt: boolean;
  fullConfig?: GenerationConfig;
}

export default function UploadConfirmModal({ 
  isOpen, 
  onConfirm, 
  onCancel,
  includeSalt,
  fullConfig,
}: UploadConfirmModalProps) {
  return (
    <AcknowledgmentModal
      isOpen={isOpen}
      onConfirm={onConfirm}
      onClose={onCancel}
      includeSalt={includeSalt}
      title="Upload"
      confirmText="Upload"
      {...(fullConfig && { fullConfig })}
    />
  );
}
