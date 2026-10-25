/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuditCase } from '../types';
import { PRIMARY_AUDIT_CASE } from '../data/mockData';

interface ExpertReportViewProps {
  auditCase?: AuditCase;
  onOpenPdfModal: () => void;
  onRetest: () => void;
}

export const ExpertReportView: React.FC<ExpertReportViewProps> = ({
  auditCase = PRIMARY_AUDIT_CASE,
  onOpenPdfModal,
  onRetest,
}) => {
  const [activeBbox, setActiveBbox] = useState<string | null>(
    auditCase.violations[0]?.id || null
  );
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'legal' | 'ethics'>('all');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const legalViolations = auditCase.violations.filter((v) => v.category === 'legal');
  const ethicsViolations = auditCase.violations.filter((v) => v.category === 'ethics');

  const displayedViolations =
    selectedFilter === 'all'
      ? auditCase.violations
      : selectedFilter === 'legal'
      ? legalViolations
      : ethicsViolations;

  const isClean = auditCase.violations.length === 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 sm:gap-6 font-['Inter']">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4 sm:pb-5">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              {auditCase.referenceNumber}
            </span>
            <span
              className={`font-['JetBrains_Mono'] text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded border ${
                isClean
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {isClean ? 'НАРУШЕНИЙ НЕТ' : `НАРУШЕНИЙ: ${auditCase.violations.length}`}
            </span>
            <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs text-slate-500">
              {auditCase.timestamp}
            </span>
          </div>

          <h1 className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            Экспертное заключение аудита контента
          </h1>

          <div className="text-xs text-slate-600 truncate max-w-xl">
            Объект проверки: <strong className="text-slate-900 font-medium">{auditCase.title}</strong>
          </div>
        </div>

        {/* Action Buttons (Responsive Wrapping) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenPdfModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs sm:text-sm shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Экспорт в PDF</span>
          </button>

          <button
            type="button"
            onClick={onRetest}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs sm:text-sm font-medium shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Новый аудит</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs shadow-xs transition-colors"
            title="Скопировать ссылку на отчет"
            aria-label="Поделиться"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copiedLink ? 'done' : 'share'}
            </span>
          </button>
        </div>
      </div>

      {/* Dual Telemetry Metric Cards: Overall Risk, Legal Compliance, Internet Ethics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Overall Risk Score */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Индекс риска
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-bold font-['JetBrains_Mono'] ${
                auditCase.riskScore >= 70
                  ? 'bg-red-50 text-red-700'
                  : auditCase.riskScore >= 30
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {auditCase.riskLevel}
            </span>
          </div>
          <div className="my-2">
            <div className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-slate-900">
              {auditCase.riskScore}
              <span className="text-xs sm:text-sm font-normal text-slate-400"> / 100</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  auditCase.riskScore >= 70
                    ? 'bg-red-500'
                    : auditCase.riskScore >= 30
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, auditCase.riskScore)}%` }}
              ></div>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 truncate">
            {isClean ? 'Материал чист' : auditCase.status}
          </span>
        </div>

        {/* Metric 2: Legal Compliance (Закон РК) */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider text-sky-700 font-semibold">
              Правовой комплаенс
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              КоАП РК
            </span>
          </div>
          <div className="my-2">
            <div className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-bold text-slate-900 truncate">
              {legalViolations.length === 0
                ? '0 ₸ (Чисто)'
                : legalViolations[0]?.fineAmount?.split('(')[0] || 'от 100 МРП'}
            </div>
            <div className="text-[11px] text-slate-600 mt-1">
              {legalViolations.length === 0
                ? 'Нормы закона соблюдены'
                : `${legalViolations.length} правовых несоответствий`}
            </div>
          </div>
          <span className="text-[11px] text-slate-500 font-mono truncate">
            Закон № 230-VII • 1 МРП = 3 932 ₸
          </span>
        </div>

        {/* Metric 3: Digital Ethics Score (Интернет-этика) */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider text-purple-700 font-semibold">
              Цифровая этика
            </span>
            <span className="text-[10px] text-purple-600 font-mono">
              Экосистема
            </span>
          </div>
          <div className="my-2">
            <div className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-slate-900">
              {auditCase.ethicsScore !== undefined ? auditCase.ethicsScore : (ethicsViolations.length * 35)}
              <span className="text-xs sm:text-sm font-normal text-slate-400"> / 100</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-purple-500"
                style={{
                  width: `${Math.min(100, auditCase.ethicsScore ?? ethicsViolations.length * 35)}%`,
                }}
              ></div>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 truncate">
            {ethicsViolations.length === 0
              ? 'Этика соблюдена'
              : `${ethicsViolations.length} этических риска`}
          </span>
        </div>

        {/* Metric 4: Violations Breakdown */}
        <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              Всего замечаний
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
              {auditCase.violations.length}
            </span>
          </div>
          <div className="my-2">
            <div className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-slate-900">
              {auditCase.violations.length}
              <span className="text-xs sm:text-sm font-normal text-slate-400"> пунктов</span>
            </div>
            <div className="text-[11px] text-slate-600 mt-1 flex items-center gap-2">
              <span className="text-sky-700 font-medium">⚖️ {legalViolations.length} закон</span>
              <span>•</span>
              <span className="text-purple-700 font-medium">🛡️ {ethicsViolations.length} этика</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-500 truncate">
            {auditCase.violations.filter((v) => v.severity === 'critical').length} критических пунктов
          </span>
        </div>
      </div>

      {/* Main Inspection Grid (Responsive 1-col on mobile, 2-col on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
        {/* Left Column: Visual or Text Evidence Inspector (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-3 sm:gap-4">
          <div className="rounded-xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase font-['JetBrains_Mono'] text-slate-700">
                Объект проверки
              </span>
              <span className="text-[11px] text-slate-500 font-['JetBrains_Mono']">
                {auditCase.metadata.fileSize || 'CONTENT PAYLOAD'}
              </span>
            </div>

            {/* Content Viewport */}
            <div className="relative min-h-[280px] sm:min-h-[340px] max-h-[500px] bg-slate-100 flex items-center justify-center p-3 sm:p-4 overflow-hidden">
              {auditCase.previewUrl ? (
                <div className="relative max-h-full flex items-center justify-center w-full">
                  <img
                    src={auditCase.previewUrl}
                    alt={auditCase.title}
                    className="max-h-[360px] sm:max-h-[420px] w-auto max-w-full object-contain rounded-lg border border-slate-300 shadow-sm"
                  />
                  {/* Interactive Bounding Boxes Overlay */}
                  {auditCase.violations.map((v, i) => {
                    const top = v.bbox?.y ?? (i === 0 ? 12 : 55);
                    const left = v.bbox?.x ?? (i === 0 ? 48 : 10);
                    const isEthics = v.category === 'ethics';
                    const isSelected = activeBbox === v.id;
                    return (
                      <div
                        key={v.id || i}
                        onClick={() => setActiveBbox(v.id)}
                        style={{ top: `${top}%`, left: `${left}%` }}
                        className={`absolute max-w-[200px] sm:max-w-[240px] rounded-lg p-2 transition-all cursor-pointer shadow-md select-none ${
                          isSelected
                            ? isEthics
                              ? 'bg-purple-600 text-white ring-2 ring-purple-400'
                              : 'bg-red-600 text-white ring-2 ring-red-400'
                            : 'bg-white/95 text-slate-900 border border-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-0.5 text-[10px] font-mono font-bold">
                          <span
                            className={
                              isSelected
                                ? 'text-white'
                                : isEthics
                                ? 'text-purple-700'
                                : 'text-red-700'
                            }
                          >
                            {isEthics ? 'ЭТИКА' : v.code.split('/')[0]}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold leading-tight line-clamp-1">
                          {v.title}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : auditCase.rawText ? (
                <div className="w-full h-full p-3 sm:p-4 flex flex-col justify-between bg-white rounded-lg border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500 uppercase font-['JetBrains_Mono'] mb-2">
                    Текст анализируемого материала:
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 font-['Inter'] leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {auditCase.rawText}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 flex justify-between font-['JetBrains_Mono']">
                    <span>Символов: {auditCase.rawText.length}</span>
                    <span>Аудит РК завершен</span>
                  </div>
                </div>
              ) : (
                <div className="w-full p-6 text-center text-slate-500 text-xs">
                  Контент проверен. Критических несоответствий не обнаружено.
                </div>
              )}
            </div>

            {/* Quick summary strip */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 text-xs text-slate-700 leading-relaxed">
              <div className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-sky-600">info</span>
                <span>Сводка проверки:</span>
              </div>
              <p className="text-slate-600 text-xs">{auditCase.summary}</p>
              {auditCase.ethicsSummary && (
                <p className="text-purple-900 text-xs mt-1.5 pt-1.5 border-t border-slate-100">
                  <strong>Этика:</strong> {auditCase.ethicsSummary}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Violations & Ethical Issues Ledger (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-3 sm:gap-4">
          {/* Header & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="font-['Plus_Jakarta_Sans'] text-base sm:text-lg font-bold text-slate-900">
              Выявленные замечания ({auditCase.violations.length})
            </h2>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setSelectedFilter('all')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  selectedFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Все ({auditCase.violations.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('legal')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  selectedFilter === 'legal'
                    ? 'bg-sky-600 text-white font-semibold'
                    : 'text-slate-600 hover:text-sky-700'
                }`}
              >
                Закон ({legalViolations.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedFilter('ethics')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  selectedFilter === 'ethics'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-slate-600 hover:text-purple-700'
                }`}
              >
                Этика ({ethicsViolations.length})
              </button>
            </div>
          </div>

          {/* List of issues */}
          {displayedViolations.length === 0 ? (
            <div className="rounded-xl bg-white border border-emerald-200 p-6 flex flex-col items-center text-center gap-2 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-1">
                <span className="material-symbols-outlined text-[28px]">verified</span>
              </div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-slate-900">
                Замечаний в данной категории не найдено
              </h3>
              <p className="text-xs text-slate-600 max-w-md leading-relaxed">
                В проверяемом материале не зафиксировано нарушений выбранной категории. Все нормы законодательства и правила цифровой этики соблюдены.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayedViolations.map((v, index) => {
                const isCritical = v.severity === 'critical';
                const isEthics = v.category === 'ethics';
                const isSelected = activeBbox === v.id;

                return (
                  <div
                    key={v.id || index}
                    onClick={() => setActiveBbox(v.id)}
                    className={`rounded-xl bg-white p-4 flex flex-col gap-2.5 border shadow-xs transition-all cursor-pointer ${
                      isSelected
                        ? isEthics
                          ? 'border-purple-500 ring-2 ring-purple-100'
                          : 'border-red-500 ring-2 ring-red-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`font-['JetBrains_Mono'] text-[10px] uppercase font-bold tracking-wider ${
                              isCritical ? 'text-red-600' : 'text-amber-600'
                            }`}
                          >
                            {isCritical ? 'КРИТИЧЕСКИЙ РИСК' : 'ПРЕДУПРЕЖДЕНИЕ'}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono ${
                              isEthics
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {isEthics ? 'ЭТИКА' : 'ЗАКОН РК'}
                          </span>
                        </div>
                        <h3 className="font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-bold text-slate-900 mt-0.5">
                          {v.title}
                        </h3>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded font-['JetBrains_Mono'] text-[11px] font-semibold shrink-0 border ${
                          isEthics
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : isCritical
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {v.code}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed">
                      <div className="font-semibold text-slate-900 mb-0.5">
                        {isEthics ? 'Суть этического риска:' : 'Основание по закону РК:'}
                      </div>
                      <div>{v.basis}</div>
                    </div>

                    {v.recommendation && (
                      <div
                        className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                          isEthics
                            ? 'bg-purple-50/50 border-purple-200 text-purple-950'
                            : 'bg-sky-50 border-sky-200 text-sky-950'
                        }`}
                      >
                        <span className="font-semibold">Как устранить:</span> {v.recommendation}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 font-['JetBrains_Mono']">
                      <div>
                        <span className="text-slate-400">
                          {isEthics ? 'Риск:' : 'Оценка штрафа:'}{' '}
                        </span>
                        <strong
                          className={
                            isEthics ? 'text-purple-700 font-medium' : 'text-red-700 font-medium'
                          }
                        >
                          {v.fineAmount}
                        </strong>
                      </div>
                      <div className="sm:text-right">
                        <span className="text-slate-400">
                          {isEthics ? 'Стандарт:' : 'Регулятор:'}{' '}
                        </span>
                        <strong className="text-slate-700 font-medium">{v.jurisdiction}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
