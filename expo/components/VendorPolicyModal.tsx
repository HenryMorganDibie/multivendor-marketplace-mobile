import React from 'react';
import LaektivaModal from './LaektivaModal';

interface VendorPolicyModalProps {
  visible: boolean;
  onClose: () => void;
  policy: string;
  vendorName: string;
}

export function VendorPolicyModal({
  visible,
  onClose,
  policy,
  vendorName,
}: VendorPolicyModalProps) {
  return (
    <LaektivaModal
      visible={visible}
      title="Vendor Business Policy"
      message={policy || 'No policy available.'}
      primaryButton={{
        label: 'Close',
        onPress: onClose,
      }}
      onRequestClose={onClose}
    />
  );
}
