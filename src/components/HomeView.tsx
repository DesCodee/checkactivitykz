/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuditCase, ModalityType } from '../types';
import { ScannerView } from './ScannerView';

interface HomeViewProps {
  onStartScanner: (preset?: { modality: ModalityType; urlOrText: string }) => void;
  onOpenReport: () => void;
  onRunAudit?: (auditCase: AuditCase) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onRunAudit }) => {
  return (
    <ScannerView
      onRunAudit={(auditedCase) => {
        if (onRunAudit) {
          onRunAudit(auditedCase);
        }
      }}
    />
  );
};
