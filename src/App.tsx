/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomeView } from './components/HomeView';
import { ScannerView } from './components/ScannerView';
import { ExpertReportView } from './components/ExpertReportView';
import { ArchiveMonitoringView } from './components/ArchiveMonitoringView';
import { PdfExportModal } from './components/PdfExportModal';
import { AuditCase, ModalityType } from './types';
import { PRIMARY_AUDIT_CASE, MOCK_AUDIT_HISTORY } from './data/mockData';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'scanner' | 'report' | 'archive'>('home');
  const [currentAuditCase, setCurrentAuditCase] = useState<AuditCase>(PRIMARY_AUDIT_CASE);
  const [scannerPreset, setScannerPreset] = useState<{ modality: ModalityType; urlOrText: string } | undefined>(
    undefined
  );

  // PDF Export Modal State
  const [showPdfModal, setShowPdfModal] = useState(false);

  // Navigation handlers
  const handleNavigate = (view: 'home' | 'scanner' | 'report' | 'archive') => {
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartScannerFromHome = (preset?: { modality: ModalityType; urlOrText: string }) => {
    if (preset) {
      setScannerPreset(preset);
    }
    setCurrentView('scanner');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuditCompleted = (newCase: AuditCase) => {
    setCurrentAuditCase(newCase);
    setCurrentView('report');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCaseFromArchive = (selectedCase: AuditCase) => {
    setCurrentAuditCase(selectedCase);
    setCurrentView('report');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGlobalSearch = (query: string) => {
    const match = MOCK_AUDIT_HISTORY.find(
      (c) =>
        c.referenceNumber.toLowerCase().includes(query.toLowerCase()) ||
        c.title.toLowerCase().includes(query.toLowerCase())
    );
    if (match) {
      setCurrentAuditCase(match);
      setCurrentView('report');
    } else {
      setCurrentView('archive');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex flex-col font-['Inter'] selection:bg-[#06b6d4] selection:text-[#001f26]">
      {/* Tactical HUD Header */}
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        onSearchSelect={handleGlobalSearch}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-16">
        {currentView === 'home' && (
          <HomeView
            onStartScanner={handleStartScannerFromHome}
            onOpenReport={() => handleNavigate('report')}
          />
        )}

        {currentView === 'scanner' && (
          <ScannerView
            onRunAudit={handleAuditCompleted}
            presetData={scannerPreset}
          />
        )}

        {currentView === 'report' && (
          <ExpertReportView
            auditCase={currentAuditCase}
            onOpenPdfModal={() => setShowPdfModal(true)}
            onRetest={() => handleNavigate('scanner')}
          />
        )}

        {currentView === 'archive' && (
          <ArchiveMonitoringView
            onSelectCase={handleSelectCaseFromArchive}
            onOpenPdfModal={() => setShowPdfModal(true)}
          />
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Clean Commercial PDF Audit Report Modal (No state stamps) */}
      {showPdfModal && (
        <PdfExportModal
          auditCase={currentAuditCase}
          onClose={() => setShowPdfModal(false)}
        />
      )}
    </div>
  );
}
