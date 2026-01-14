import AcknowledgmentModal from './AcknowledgmentModal';

interface UploadConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  includeSalt: boolean;
}

export default function UploadConfirmModal({ 
  isOpen, 
  onConfirm, 
  onCancel,
  includeSalt,
}: UploadConfirmModalProps) {
  return (
    <AcknowledgmentModal
      isOpen={isOpen}
      onConfirm={onConfirm}
      onClose={onCancel}
      includeSalt={includeSalt}
      title="Confirm Upload"
      confirmText="Upload"
    />
  );
}
