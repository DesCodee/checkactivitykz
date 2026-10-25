/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { ScannerView } from './components/ScannerView';
import { ExpertReportView } from './components/ExpertReportView';
import { ArchiveMonitoringView } from './components/ArchiveMonitoringView';
import { PdfExportModal } from './components/PdfExportModal';
import { Footer } from './components/Footer';
import { AuditCase, ModalityType } from './types';
import { PRIMARY_AUDIT_CASE } from './data/mockData';

type ViewType = 'home' | 'scanner' | 'report' | 'archive';

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [currentAuditCase, setCurrentAuditCase] = useState<AuditCase>(PRIMARY_AUDIT_CASE);
  const [selectedPdfCase, setSelectedPdfCase] = useState<AuditCase | null>(null);
  const [userHistory, setUserHistory] = useState<AuditCase[]>([]);
  const [scannerPreset, setScannerPreset] = useState<{ modality: ModalityType; urlOrText: string } | undefined>(undefined);

  // Load actual user history from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem('checkactivity_user_audits');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setUserHistory(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveToHistory = (newCase: AuditCase) => {
    setUserHistory((prev) => {
      const updated = [newCase, ...prev.filter((c) => c.id !== newCase.id)].slice(0, 25);
      try {
        localStorage.setItem('checkactivity_user_audits', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleRunAudit = (newCase: AuditCase) => {
    setCurrentAuditCase(newCase);
    handleSaveToHistory(newCase);
    setCurrentView('report');
  };

  const handleSelectCase = (selectedCase: AuditCase) => {
    setCurrentAuditCase(selectedCase);
    setCurrentView('report');
  };

  const handleStartScannerWithPreset = (preset?: { modality: ModalityType; urlOrText: string }) => {
    setScannerPreset(preset);
    setCurrentView('scanner');
  };

  const handleSearchSelect = (query: string) => {
    // If it's a known preset or law article, route to scanner with query
    setScannerPreset({ modality: 'url', urlOrText: query });
    setCurrentView('scanner');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-['Inter'] selection:bg-sky-100 selection:text-sky-900">
      {/* Tactical HUD Header */}
      <Header
        currentView={currentView}
        onNavigate={(view) => setCurrentView(view)}
        onSearchSelect={handleSearchSelect}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full pt-16 pb-16 md:pb-0">
        {currentView === 'home' && (
          <HomeView
            onStartScanner={handleStartScannerWithPreset}
            onOpenReport={() => setCurrentView('report')}
            onRunAudit={handleRunAudit}
          />
        )}

        {currentView === 'scanner' && (
          <ScannerView
            onRunAudit={handleRunAudit}
            presetData={scannerPreset}
          />
        )}

        {currentView === 'report' && (
          <ExpertReportView
            auditCase={currentAuditCase}
            onOpenPdfModal={() => setSelectedPdfCase(currentAuditCase)}
            onRetest={() => {
              setScannerPreset(undefined);
              setCurrentView('scanner');
            }}
          />
        )}

        {currentView === 'archive' && (
          <ArchiveMonitoringView
            onSelectCase={handleSelectCase}
            onOpenPdfModal={() => setSelectedPdfCase(currentAuditCase)}
            userHistory={userHistory}
          />
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Clean Commercial PDF Export Modal (Without State Seals/Court Stamps) */}
      {selectedPdfCase && (
        <PdfExportModal
          auditCase={selectedPdfCase}
          onClose={() => setSelectedPdfCase(null)}
        />
      )}
    </div>
  );
}
