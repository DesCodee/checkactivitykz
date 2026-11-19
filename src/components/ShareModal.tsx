/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Send,
  MessageCircle,
  FileText,
  Download,
  Loader2,
} from 'lucide-react';
import type { AuditCase } from '../types';
import { useApp } from '../utils/i18n';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  getCompliancePenaltyDisplay,
  getLocalizedStatus,
  type BusinessEntityType,
} from '../utils/kzComplianceIntelligence';
import {
  canNativeSharePdfFile,
  downloadPdfBlob,
  generateStyledAuditPdf,
  type GeneratedPdfResult,
} from '../utils/pdfReportGenerator';

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  isReport?: boolean;
  auditCase?: AuditCase;
  entityTier?: BusinessEntityType;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: ShareData;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, data }) => {
  const { language } = useApp();
  const [pdfResult, setPdfResult] = useState<GeneratedPdfResult | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfDownloaded, setPdfDownloaded] = useState(false);
  const [pdfSharedMsg, setPdfSharedMsg] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  const auditCase = data?.auditCase;
  const entityTier = data?.entityTier || 'small';

  useEffect(() => {
    if (!isOpen || !auditCase) {
      setPdfResult(null);
      setPdfDownloaded(false);
      setPdfSharedMsg(null);
      return;
    }

    let cancelled = false;
    setIsGeneratingPdf(true);
    setPdfSharedMsg(null);

    generateStyledAuditPdf(auditCase, { entityTier, language })
      .then((res) => {
        if (!cancelled) {
          setPdfResult(res);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPdfResult(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGeneratingPdf(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, auditCase, entityTier, language]);

  if (!isOpen) return null;

  const currentUrl =
    data?.url || (typeof window !== 'undefined' ? window.location.href : 'https://checkactivity.kz');
  const shareTitle =
    data?.title ||
    (auditCase
      ? `${language === 'kz' ? 'Сараптамалық есеп' : 'Экспертный PDF-отчёт'} ${auditCase.referenceNumber}`
      : 'CheckActivity KZ — AI-аудит контента');

  const penaltyDisplay = auditCase
    ? getCompliancePenaltyDisplay(auditCase.violations, entityTier, language)
    : null;
  const localizedStatus = auditCase ? getLocalizedStatus(auditCase.status, language) : '';

  const fallbackSummaryText = auditCase
    ? language === 'kz'
      ? `CheckActivity KZ · ${auditCase.referenceNumber}\nНысан: ${auditCase.title}\nМәртебе: ${localizedStatus} (${auditCase.riskScore}/100)\nАйыппұл бағасы: ${penaltyDisplay?.headline || '0 ₸'}`
      : `CheckActivity KZ · ${auditCase.referenceNumber}\nОбъект: ${auditCase.title}\nСтатус: ${localizedStatus} (${auditCase.riskScore}/100)\nОценка штрафа: ${penaltyDisplay?.headline || '0 ₸'}`
    : language === 'kz'
    ? 'CheckActivity KZ — ҚР заңнамасына (ӘҚБтК, № 230-VII) сәйкестікті AI-аудит жүйесі.'
    : 'CheckActivity KZ — AI-система экспресс-аудита контента по законодательству РК (КоАП РК, № 230-VII).';

  const shareText = data?.text || fallbackSummaryText;

  const ensurePdf = async (): Promise<GeneratedPdfResult | null> => {
    if (pdfResult) return pdfResult;
    if (!auditCase) return null;
    setIsGeneratingPdf(true);
    try {
      const res = await generateStyledAuditPdf(auditCase, { entityTier, language });
      setPdfResult(res);
      return res;
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    const res = await ensurePdf();
    if (!res) return;
    downloadPdfBlob(res.blob, res.fileName);
    setPdfDownloaded(true);
    setPdfSharedMsg(
      language === 'kz'
        ? `Файл ${res.fileName} жүктелді — мессенджерге жіберуге дайын.`
        : `Файл ${res.fileName} скачан — можно сразу скинуть в мессенджер или почту.`
    );
    setTimeout(() => setPdfDownloaded(false), 2600);
  };

  const handleSharePdf = async () => {
    const res = await ensurePdf();
    if (!res) return;

    if (canNativeSharePdfFile(res.file)) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [res.file],
        });
        setPdfSharedMsg(
          language === 'kz' ? 'PDF-есеп сәтті жіберілді!' : 'PDF-отчёт успешно отправлен!'
        );
        return;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }

    // Fallback when desktop browser / iframe doesn't support native file share
    downloadPdfBlob(res.blob, res.fileName);
    setPdfDownloaded(true);
    setPdfSharedMsg(
      language === 'kz'
        ? 'Браузер файлды тікелей жіберуді шектеді — PDF-есеп жүктелді, енді кез келген чатқа тіркей аласыз.'
        : 'PDF-отчёт скачан на устройство — просто перетащите файл в Telegram, WhatsApp или почту.'
    );
    setTimeout(() => setPdfDownloaded(false), 3000);
  };

  const handleCopyText = async () => {
    const ok = await copyTextToClipboard(`${shareTitle}\n\n${shareText}`);
    if (ok) {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(`${shareTitle}\n\n${shareText}`)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareTitle}\n\n${shareText}`)}`;

  const fileSizeKb = pdfResult ? Math.max(1, Math.round(pdfResult.blob.size / 1024)) : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/55 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
              <FileText className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-zinc-950 dark:text-zinc-50">
                {language === 'kz' ? 'PDF-есеппен бөлісу' : 'Поделиться PDF-отчётом'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {language === 'kz'
                  ? 'Стильді A4 комплаенс-хаттаманы жіберу'
                  : 'Готовый стильный протокол формата A4'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" strokeWidth={1.6} />
          </button>
        </div>

        {/* Stylish PDF Report Card */}
        {auditCase && (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-3.5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-10 h-11 rounded-lg bg-zinc-900 dark:bg-zinc-800 text-white flex flex-col items-center justify-center shrink-0 font-['JetBrains_Mono'] text-[10px] font-bold border border-zinc-700">
                  <span>PDF</span>
                  <span className="text-[8px] text-rose-400">A4</span>
                </div>
                <div className="min-w-0">
                  <div className="font-['JetBrains_Mono'] text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {pdfResult?.fileName ||
                      `CheckActivity_KZ_${(auditCase.referenceNumber || 'REPORT').replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                    {auditCase.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] font-['JetBrains_Mono'] text-zinc-600 dark:text-zinc-400">
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        auditCase.status === 'ТРЕБУЕТ МЕР' || auditCase.status === 'БЛОКИРОВКА'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          : auditCase.status === 'ПРЕДУПРЕЖДЕНИЕ'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      }`}
                    >
                      {localizedStatus} · {auditCase.riskScore}/100
                    </span>
                    {isGeneratingPdf ? (
                      <span className="inline-flex items-center gap-1 text-zinc-500">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {language === 'kz' ? 'PDF дайындалуда...' : 'Сборка PDF...'}
                      </span>
                    ) : pdfResult ? (
                      <span>
                        {pdfResult.pageCount} {language === 'kz' ? 'бет' : 'стр.'} · {fileSizeKb} КБ
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Primary PDF Share + Download Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleSharePdf}
                disabled={isGeneratingPdf}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-['Plus_Jakarta_Sans'] text-xs font-semibold transition-colors disabled:opacity-60"
              >
                {isGeneratingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Share2 className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                )}
                <span>
                  {language === 'kz' ? 'PDF-ті жіберу' : 'Скинуть PDF-отчёт'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs font-medium transition-colors disabled:opacity-60"
              >
                {pdfDownloaded ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={2} />
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {language === 'kz' ? 'Жүктелді!' : 'Скачано!'}
                    </span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 shrink-0" strokeWidth={1.7} />
                    <span>{language === 'kz' ? 'PDF жүктеу' : 'Скачать PDF'}</span>
                  </>
                )}
              </button>
            </div>

            {pdfSharedMsg && (
              <div className="text-[11px] leading-snug text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg px-2.5 py-2">
                {pdfSharedMsg}
              </div>
            )}
          </div>
        )}

        {/* Quick Messengers + Copy Text Summary */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
            {language === 'kz'
              ? 'Сонымен қатар мәтіндік қысқаша мазмұнын жіберуге болады:'
              : 'Или отправить текстовую сводку в чат:'}
          </span>
          <div className="grid grid-cols-3 gap-2">
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#24A1DE]/10 hover:bg-[#24A1DE]/20 text-[#24A1DE] border border-[#24A1DE]/20 text-xs font-medium transition-colors"
            >
              <Send className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
              <span>Telegram</span>
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 text-xs font-medium transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.8} />
              <span>WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleCopyText}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {language === 'kz' ? 'Дайын' : 'Готово'}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>{language === 'kz' ? 'Мәтін' : 'Текст'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
