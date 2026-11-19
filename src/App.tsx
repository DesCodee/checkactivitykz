/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HomeView } from './components/HomeView';
import { WelcomeView } from './components/WelcomeView';
import { ScannerView } from './components/ScannerView';
import { ExpertReportView } from './components/ExpertReportView';
import { ArchiveMonitoringView } from './components/ArchiveMonitoringView';
import { SandboxAndLawsView } from './components/SandboxAndLawsView';
import { PdfExportModal } from './components/PdfExportModal';
import { ShareModal, ShareData } from './components/ShareModal';
import { Footer } from './components/Footer';
import { AuditCase, ModalityType } from './types';
import { PRIMARY_AUDIT_CASE } from './data/mockData';
import { analyzeContentWithGemini } from './services/geminiService';
import {
  type BusinessEntityType,
  normalizeAuditCaseCompliance,
} from './utils/kzComplianceIntelligence';

type ViewType = 'home' | 'scanner' | 'report' | 'archive' | 'sandbox';

function stripHeavyMediaForStorage(auditCase: AuditCase): AuditCase {
  const {
    previewUrl: _previewUrl,
    audioDataUrl: _audioDataUrl,
    videoFrames: _videoFrames,
    videoDataUrl,
    ...rest
  } = auditCase as AuditCase & { mediaBase64?: unknown };
  delete (rest as Record<string, unknown>).mediaBase64;
  return {
    ...rest,
    ...(videoDataUrl && !videoDataUrl.startsWith('data:') && !videoDataUrl.startsWith('blob:')
      ? { videoDataUrl }
      : {}),
  };
}

export default function App() {
  const [showWelcome, setShowWelcome] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      if (search.includes('view=') || search.includes('scanner') || hash.includes('scanner')) {
        return false;
      }
      return sessionStorage.getItem('checkactivity_entered') !== 'true';
    } catch {
      return true;
    }
  });
  const [currentView, setCurrentView] = useState<ViewType>('home');
  const [currentAuditCase, setCurrentAuditCase] = useState<AuditCase>(() =>
    normalizeAuditCaseCompliance(PRIMARY_AUDIT_CASE)
  );
  const [selectedPdfCase, setSelectedPdfCase] = useState<AuditCase | null>(null);
  const [selectedPdfEntityTier, setSelectedPdfEntityTier] = useState<BusinessEntityType>('small');
  const [entityTier, setEntityTier] = useState<BusinessEntityType>('small');
  const [userHistory, setUserHistory] = useState<AuditCase[]>([]);
  const [scannerPreset, setScannerPreset] = useState<{ modality: ModalityType; urlOrText: string } | undefined>(undefined);
  const [shareData, setShareData] = useState<ShareData | undefined>(undefined);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleOpenShare = (data?: ShareData) => {
    setShareData({
      isReport: true,
      auditCase: data?.auditCase || currentAuditCase,
      entityTier: data?.entityTier || entityTier,
      ...data,
    });
    setIsShareModalOpen(true);
  };

  // Load actual user history from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem('checkactivity_user_audits');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hadHeavyMedia = parsed.some(
            (item) =>
              item &&
              typeof item === 'object' &&
              ('previewUrl' in item ||
                'audioDataUrl' in item ||
                'videoFrames' in item ||
                'mediaBase64' in item ||
                (typeof item.videoDataUrl === 'string' &&
                  (item.videoDataUrl.startsWith('data:') || item.videoDataUrl.startsWith('blob:'))))
          );
          const sanitized = parsed
            .filter((item): item is AuditCase => Boolean(item && typeof item === 'object'))
            .slice(0, 25)
            .map((item) => stripHeavyMediaForStorage(normalizeAuditCaseCompliance(item)));
          setUserHistory(sanitized);
          if (hadHeavyMedia) {
            try {
              localStorage.setItem('checkactivity_user_audits', JSON.stringify(sanitized));
            } catch {
              // ignore
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSaveToHistory = (newCase: AuditCase) => {
    const sanitizedCase = stripHeavyMediaForStorage(newCase);
    setUserHistory((prev) => {
      const updated = [sanitizedCase, ...prev.filter((c) => c.id !== sanitizedCase.id)]
        .slice(0, 25)
        .map(stripHeavyMediaForStorage);
      for (let limit = updated.length; limit >= 1; limit--) {
        try {
          localStorage.setItem('checkactivity_user_audits', JSON.stringify(updated.slice(0, limit)));
          break;
        } catch {
          // Retry with fewer entries if storage quota is tight
        }
      }
      return updated;
    });
  };

  const handleRunAudit = (newCase: AuditCase) => {
    const normalized = normalizeAuditCaseCompliance(newCase);
    setCurrentAuditCase(normalized);
    handleSaveToHistory(normalized);
    setCurrentView('report');
  };

  const handleReauditFixedText = async (fixedText: string) => {
    const newCase = await analyzeContentWithGemini({
      modality: 'text',
      text: fixedText,
      fileName: 'safe_rewrite_verified.txt',
    });
    handleRunAudit(newCase);
  };

  const handleSelectCase = (selectedCase: AuditCase) => {
    setCurrentAuditCase(normalizeAuditCaseCompliance(selectedCase));
    setCurrentView('report');
  };

  const handleStartScannerWithPreset = (preset?: { modality: ModalityType; urlOrText: string }) => {
    setScannerPreset(preset);
    setCurrentView('scanner');
  };

  const handleSearchSelect = (query: string) => {
    // Route quick search queries into the Text scanner
    setScannerPreset({ modality: 'text', urlOrText: query });
    setCurrentView('scanner');
  };

  if (showWelcome) {
    return (
      <WelcomeView
        onEnter={(targetView = 'home') => {
          setCurrentView(targetView);
          setShowWelcome(false);
          try {
            sessionStorage.setItem('checkactivity_entered', 'true');
          } catch {
            // ignore
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex font-['Inter'] selection:bg-zinc-200 selection:text-zinc-950 dark:selection:bg-zinc-800 dark:selection:text-zinc-100 transition-colors duration-200">
      {/* Main Content Wrapper shifted right on desktop for the 240px sidebar */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-60 pb-16 md:pb-0">
        {/* Sidebar + Workspace Top Header + Mobile Bottom Nav */}
        <Header
          currentView={currentView}
          onNavigate={(view) => setCurrentView(view)}
          onSearchSelect={handleSearchSelect}
          onOpenShare={() => handleOpenShare()}
        />

        {/* Main Content Area */}
        <main className="flex-1 w-full">
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
              entityTier={entityTier}
              onEntityTierChange={setEntityTier}
              onOpenPdfModal={(tier) => {
                const resolvedTier = tier || entityTier;
                setSelectedPdfEntityTier(resolvedTier);
                setSelectedPdfCase(currentAuditCase);
              }}
              onRetest={() => {
                setScannerPreset(undefined);
                setCurrentView('scanner');
              }}
              onReauditFixedText={handleReauditFixedText}
              onOpenShare={handleOpenShare}
            />
          )}

          {currentView === 'sandbox' && (
            <SandboxAndLawsView
              onOpenReportForCase={handleRunAudit}
              entityTier={entityTier}
              onEntityTierChange={setEntityTier}
            />
          )}

          {currentView === 'archive' && (
            <ArchiveMonitoringView
              onSelectCase={handleSelectCase}
              entityTier={entityTier}
              onEntityTierChange={setEntityTier}
              onOpenPdfModal={(auditCase, tier) => {
                setSelectedPdfEntityTier(tier || entityTier);
                setSelectedPdfCase(normalizeAuditCaseCompliance(auditCase));
              }}
              userHistory={userHistory}
            />
          )}
        </main>

        {/* Minimalist Footer */}
        <Footer />
      </div>

      {/* Clean Commercial PDF Export Modal */}
      {selectedPdfCase && (
        <PdfExportModal
          auditCase={selectedPdfCase}
          initialEntityTier={selectedPdfEntityTier}
          onClose={() => setSelectedPdfCase(null)}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        data={shareData}
      />
    </div>
  );
}
