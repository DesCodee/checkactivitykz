/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { FileText, X, Printer } from 'lucide-react';
import { AuditCase } from '../types';
import { calculateRiskDistribution } from '../utils/riskAnalytics';
import {
  getCompliancePenaltyDisplay,
  isEthicsViolation,
  isLegalViolation,
  MRP_2026_KZT,
  normalizeAuditCaseCompliance,
  type BusinessEntityType,
} from '../utils/kzComplianceIntelligence';
import { useApp } from '../utils/i18n';

interface PdfExportModalProps {
  auditCase: AuditCase;
  initialEntityTier?: BusinessEntityType;
  onClose: () => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  auditCase: rawAuditCase,
  initialEntityTier = 'small',
  onClose,
}) => {
  const { t, language } = useApp();
  const [isExporting, setIsExporting] = useState(false);
  const [entityTier, setEntityTier] = useState<BusinessEntityType>(initialEntityTier);

  React.useEffect(() => {
    setEntityTier(initialEntityTier);
  }, [initialEntityTier]);

  const auditCase = React.useMemo(
    () => normalizeAuditCaseCompliance(rawAuditCase),
    [rawAuditCase]
  );

  const handlePrint = () => {
    setIsExporting(true);
    setTimeout(() => {
      window.print();
      setIsExporting(false);
    }, 300);
  };

  const riskAnalytics = calculateRiskDistribution(auditCase.violations);
  const legalViolations = auditCase.violations.filter((v) => isLegalViolation(v));
  const ethicsViolations = auditCase.violations.filter((v) => isEthicsViolation(v));
  const penaltyDisplay = getCompliancePenaltyDisplay(auditCase.violations, entityTier, language);

  const dynamicRecommendations = React.useMemo(() => {
    const items: string[] = [];
    for (const v of auditCase.violations) {
      if (v.recommendation && !items.includes(v.recommendation)) {
        items.push(v.recommendation);
      }
    }
    if (items.length === 0) {
      items.push(
        language === 'kz'
          ? 'Материал ҚР қолданыстағы заңнамасына және желілік этика нормаларына сәйкес келеді. Түзету қажет емес.'
          : 'Материал соответствует действующему законодательству РК и стандартам цифровой этики. Дополнительные правки не требуются.'
      );
    }
    return items.slice(0, 6);
  }, [auditCase.violations, language]);

  const statusBadgeClass =
    auditCase.status === 'ТРЕБУЕТ МЕР' || auditCase.status === 'БЛОКИРОВКА'
      ? 'bg-rose-700 text-white border-rose-800'
      : auditCase.status === 'ПРЕДУПРЕЖДЕНИЕ'
      ? 'bg-amber-400 text-zinc-950 border-amber-600'
      : 'bg-emerald-700 text-white border-emerald-800';

  const verdictStripClass =
    auditCase.status === 'ТРЕБУЕТ МЕР' || auditCase.status === 'БЛОКИРОВКА'
      ? 'bg-rose-50 border-rose-700 text-zinc-950'
      : auditCase.status === 'ПРЕДУПРЕЖДЕНИЕ'
      ? 'bg-amber-50 border-amber-600 text-zinc-950'
      : 'bg-emerald-50 border-emerald-700 text-zinc-950';

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[92vh] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-2xl flex flex-col gap-4 text-zinc-900 dark:text-zinc-100"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-zinc-800 dark:text-zinc-200" strokeWidth={1.7} />
            <h3 className="font-['Plus_Jakarta_Sans'] text-base sm:text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              {t('pdfReportTitle')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.7} />
          </button>
        </div>

        {/* Printable High-Contrast Legal Report Sheet */}
        <div
          id="printable-protocol"
          className="flex-1 overflow-y-auto bg-white text-zinc-950 p-5 sm:p-8 rounded-xl border-2 border-zinc-300 font-['Inter'] text-xs leading-relaxed space-y-5"
        >
          {/* Document Header */}
          <div className="flex items-start justify-between border-b-2 border-zinc-950 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-['Plus_Jakarta_Sans'] font-extrabold text-lg text-zinc-950 tracking-tight">
                  CHECK ACTIVITY
                </span>
                <span className="text-zinc-400">·</span>
                <span className="font-['JetBrains_Mono'] text-[11px] font-bold text-zinc-800">
                  OFFICIAL COMPLIANCE PROTOCOL KZ
                </span>
              </div>
              <p className="text-[11px] text-zinc-700 font-['JetBrains_Mono'] font-semibold mt-1 tabular-nums">
                ID: {auditCase.referenceNumber} · 1 МРП = {MRP_2026_KZT.toLocaleString('ru-RU')} ₸
              </p>
            </div>
            <div className="text-right text-[11px] font-['JetBrains_Mono'] text-zinc-800 tabular-nums">
              <div className="font-semibold">{auditCase.timestamp}</div>
              <div className="text-zinc-600 mt-0.5">{auditCase.metadata.platform || 'Online Media KZ'}</div>
            </div>
          </div>

          {/* High-Contrast Verdict & Financial Risk Summary Strip */}
          <div className={`p-4 rounded-xl border-2 border-l-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${verdictStripClass}`}>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded font-['JetBrains_Mono'] text-[11px] font-bold border ${statusBadgeClass}`}>
                  {auditCase.status}
                </span>
                <span className="font-['JetBrains_Mono'] font-extrabold text-sm text-zinc-950 tabular-nums">
                  {language === 'kz' ? 'ТӘУЕКЕЛ ИНДЕКСІ:' : 'ИНДЕКС РИСКА:'} {auditCase.riskScore} / 100 ({auditCase.riskLevel})
                </span>
              </div>
              <p className="text-[11px] font-medium text-zinc-900 leading-snug">
                {auditCase.summary || penaltyDisplay.subline}
              </p>
            </div>
            <div className="shrink-0 bg-white px-3.5 py-2 rounded-lg border-2 border-zinc-900 sm:text-right">
              <div className="text-[9px] font-['JetBrains_Mono'] uppercase font-bold text-zinc-600">
                {language === 'kz' ? 'Есептік айыппұл' : 'Расчётный штраф РК'}
              </div>
              <div
                className={`font-['Plus_Jakarta_Sans'] font-extrabold tabular-nums ${
                  penaltyDisplay.mode === 'legal_fine'
                    ? 'text-sm sm:text-base text-rose-700'
                    : penaltyDisplay.mode === 'ethics_only'
                    ? 'text-xs text-amber-800'
                    : 'text-xs text-emerald-700'
                }`}
              >
                {penaltyDisplay.headline}
              </div>
              <div className="text-[10px] font-['JetBrains_Mono'] font-semibold text-zinc-800">
                {penaltyDisplay.mrpRangeText}
              </div>
            </div>
          </div>

          {/* Target Summary Cards */}
          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-300 grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px]">
            <div>
              <span className="text-[10px] font-bold text-zinc-600 font-['JetBrains_Mono'] uppercase block">
                Объект проверки
              </span>
              <div className="text-zinc-950 font-bold truncate mt-1">{auditCase.title}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-600 font-['JetBrains_Mono'] uppercase block">
                Файл / Ссылка
              </span>
              <div className="text-zinc-950 font-['JetBrains_Mono'] font-medium truncate mt-1">
                {auditCase.sourceName}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-600 font-['JetBrains_Mono'] uppercase block">
                Индекс риска
              </span>
              <div className="font-['JetBrains_Mono'] font-bold mt-1 text-zinc-950 text-sm tabular-nums">
                {auditCase.riskScore} / 100 ({auditCase.riskLevel})
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-zinc-600 font-['JetBrains_Mono'] uppercase block">
                Статус проверки
              </span>
              <div className="font-['JetBrains_Mono'] font-extrabold mt-1 text-zinc-950">
                {auditCase.status}
              </div>
            </div>
          </div>

          {/* Dual Score Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div className="p-3.5 bg-white border-2 border-zinc-300 rounded-xl">
              <span className="font-bold text-zinc-950 block mb-1">
                Правовой комплаенс РК (КоАП / УК / № 230-VII)
              </span>
              <div className="text-zinc-900 font-medium tabular-nums">
                {penaltyDisplay.mode === 'legal_fine' ? (
                  <>
                    Нарушений закона: <strong className="text-rose-700 font-bold">{legalViolations.length}</strong> · Санкция:{' '}
                    <strong className="text-rose-700 font-bold">{penaltyDisplay.kztRangeText}</strong> ({penaltyDisplay.mrpRangeText})
                  </>
                ) : penaltyDisplay.mode === 'ethics_only' ? (
                  <strong className="text-amber-800">{penaltyDisplay.headline}</strong>
                ) : (
                  <strong className="text-emerald-700">{penaltyDisplay.headline}</strong>
                )}
              </div>
            </div>
            <div className="p-3.5 bg-white border-2 border-zinc-300 rounded-xl">
              <span className="font-bold text-zinc-950 block mb-1">
                Цифровая этика и культура коммуникации
              </span>
              <div className="text-zinc-900 font-medium tabular-nums">
                Этических рисков: <strong className="text-zinc-950 font-bold">{ethicsViolations.length}</strong> · Индекс этики:{' '}
                <strong className="text-zinc-950 font-bold">{auditCase.ethicsScore ?? 0} / 100</strong>
              </div>
            </div>
          </div>

          {/* Risk Distribution Breakdown */}
          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-300">
            <div className="text-[11px] font-bold text-zinc-900 mb-3 flex items-center justify-between">
              <span>Распределение рисков (% соотношение)</span>
              <span className="text-zinc-700 font-['JetBrains_Mono'] font-semibold">100%</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {riskAnalytics.coreCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="p-2.5 rounded-lg border border-zinc-300 bg-white flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-zinc-950 truncate">{cat.name}</div>
                    <div className="text-[10px] text-zinc-600 font-['JetBrains_Mono'] truncate">{cat.article}</div>
                  </div>
                  <span
                    className="font-['JetBrains_Mono'] font-bold text-xs shrink-0 tabular-nums"
                    style={{ color: cat.count > 0 ? cat.color : '#52525b' }}
                  >
                    {cat.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Issues and Violations List */}
          <div>
            <h2 className="text-xs font-bold text-zinc-950 uppercase tracking-wide mb-2.5">
              Обнаруженные замечания и риски ({auditCase.violations.length})
            </h2>
            <div className="space-y-2.5">
              {auditCase.violations.length === 0 ? (
                <div className="p-3.5 rounded-xl border-2 border-emerald-600 bg-emerald-50 text-emerald-900 font-semibold">
                  0 ₸ (Нарушений не выявлено). Замечаний по законодательству РК и сетевой этике не зафиксировано.
                </div>
              ) : (
                auditCase.violations.map((v, i) => {
                  const isEthicsOnly = !isLegalViolation(v);
                  const cardPenalty = getCompliancePenaltyDisplay([v], entityTier, language);
                  const cardFineText =
                    cardPenalty.mode === 'legal_fine'
                      ? `${cardPenalty.mrpRangeText} (${cardPenalty.kztRangeText})`
                      : cardPenalty.headline;
                  return (
                    <div key={v.id} className="p-3.5 rounded-xl border-2 border-zinc-300 bg-white break-inside-avoid">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-200 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-['JetBrains_Mono'] font-bold text-zinc-700 tabular-nums">
                            #{i + 1}
                          </span>
                          <span className="font-bold text-zinc-950 text-xs">{v.title}</span>
                          <span className="text-zinc-400">·</span>
                          <span
                            className={`text-[10px] font-['JetBrains_Mono'] font-bold ${
                              isEthicsOnly ? 'text-violet-700' : 'text-rose-700'
                            }`}
                          >
                            {isEthicsOnly ? 'Этика' : 'Закон РК'}
                          </span>
                        </div>
                        <span className="font-['JetBrains_Mono'] text-[11px] font-bold text-zinc-900 shrink-0">
                          {v.code}
                        </span>
                      </div>
                      <p className="text-zinc-900 text-[11px] mt-2 leading-relaxed">{v.basis}</p>
                      {v.recommendation && (
                        <div className="mt-2 text-[11px] text-zinc-900 bg-zinc-100 p-2.5 rounded-lg border border-zinc-200">
                          <strong className="text-zinc-950">Рекомендация:</strong> {v.recommendation}
                        </div>
                      )}
                      <div className="mt-2.5 pt-2 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-['JetBrains_Mono'] text-zinc-700">
                        <span>
                          {isEthicsOnly ? 'Риск: ' : 'Штраф: '}
                          <strong className={isEthicsOnly ? 'text-amber-800' : 'text-rose-700'}>
                            {cardFineText}
                          </strong>
                        </span>
                        <span>
                          {isEthicsOnly ? 'Стандарт: ' : 'Орган: '}
                          <strong className="text-zinc-950">{v.jurisdiction}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="p-4 rounded-xl bg-zinc-50 border-2 border-zinc-300 text-zinc-900 break-inside-avoid">
            <h3 className="font-bold text-xs text-zinc-950 uppercase tracking-wide mb-2">
              Рекомендации эксперта по комплаенсу
            </h3>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-zinc-900">
              {dynamicRecommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>

          {/* Footer note */}
          <div className="border-t-2 border-zinc-300 pt-3 flex items-center justify-between text-[10px] font-['JetBrains_Mono'] font-semibold text-zinc-700">
            <span>Check Activity KZ · Результат предварительный</span>
            <span className="tabular-nums">SHA-256: {auditCase.sha256.slice(0, 24)}...</span>
          </div>
        </div>

        {/* Modal Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-zinc-200/80 dark:border-zinc-800">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-['JetBrains_Mono'] text-[10px] text-zinc-500 dark:text-zinc-400 uppercase mr-1">
              {language === 'kz' ? 'Субъект:' : 'Субъект:'}
            </span>
            {(
              [
                { id: 'individual', label: 'Физлицо' },
                { id: 'small', label: 'МБ / ИП' },
                { id: 'medium', label: 'Средний' },
                { id: 'large', label: 'Крупный' },
              ] as const
            ).map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => setEntityTier(tier.id)}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                  entityTier === tier.id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'
                }`}
              >
                {tier.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {t('closeBtn')}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isExporting}
              className="px-5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-['Plus_Jakarta_Sans'] text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <Printer className="w-4 h-4" strokeWidth={1.6} />
              <span>
                {isExporting
                  ? language === 'kz'
                    ? 'Дайындалуда...'
                    : 'Подготовка...'
                  : t('pdfPrintBtn')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
