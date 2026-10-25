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
  const [copiedLink, setCopiedLink] = useState(false);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isClean = auditCase.violations.length === 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 font-['Inter']">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-['JetBrains_Mono'] text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              ОТЧЕТ: {auditCase.referenceNumber}
            </span>
            <span
              className={`font-['JetBrains_Mono'] text-xs font-semibold px-2 py-0.5 rounded border ${
                isClean
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {isClean ? 'НАРУШЕНИЙ НЕТ' : `НАРУШЕНИЙ: ${auditCase.violations.length}`}
            </span>
            <span className="font-['JetBrains_Mono'] text-xs text-slate-500">
              {auditCase.timestamp}
            </span>
          </div>

          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-1">
            Экспертное заключение аудита контента
          </h1>

          <div className="text-xs text-slate-600 truncate max-w-xl">
            Объект проверки: <strong className="text-slate-900 font-medium">{auditCase.title}</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenPdfModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs sm:text-sm shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Скачать отчет (PDF)</span>
          </button>

          <button
            type="button"
            onClick={onRetest}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Новая проверка</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-lg bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs shadow-xs transition-colors"
            title="Скопировать ссылку"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copiedLink ? 'done' : 'share'}
            </span>
          </button>
        </div>
      </div>

      {/* 3 High-Impact Telemetry Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Risk Score */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Индекс риска
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold font-['JetBrains_Mono'] ${
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
            <div className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-slate-900">
              {auditCase.riskScore}
              <span className="text-sm font-normal text-slate-400"> / 100</span>
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
                style={{ width: `${auditCase.riskScore}%` }}
              ></div>
            </div>
          </div>
          <span className="text-xs text-slate-500">
            {isClean ? 'Соответствует нормам законодательства РК' : 'Выявлены правовые несоответствия'}
          </span>
        </div>

        {/* Metric 2: Fines Estimate */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Оценка штрафа (КоАП РК)
            </span>
            <span className="text-xs text-slate-500 font-['JetBrains_Mono']">
              1 МРП = 3 932 ₸
            </span>
          </div>
          <div className="my-2">
            <div className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-slate-900">
              {isClean
                ? '0 ₸ (Штрафов нет)'
                : auditCase.violations[0]?.fineAmount || 'от 100 МРП (393 200 ₸)'}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {isClean ? 'Основания для штрафов отсутствуют' : 'По нормам ст. 455, 445-1, 79 КоАП РК'}
            </div>
          </div>
          <span className="text-xs text-slate-500 font-['JetBrains_Mono']">
            Регулятор: МКИ РК / АФМ
          </span>
        </div>

        {/* Metric 3: Violations count */}
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Статьи законодательства
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-['JetBrains_Mono']">
              КоАП & Закон № 230-VII
            </span>
          </div>
          <div className="my-2">
            <div className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-slate-900">
              {auditCase.violations.length}
              <span className="text-sm font-normal text-slate-400"> пунктов</span>
            </div>
            <div className="text-xs text-slate-600 mt-1">
              {auditCase.violations.filter((v) => v.severity === 'critical').length} критических •{' '}
              {auditCase.violations.filter((v) => v.severity !== 'critical').length} предупреждений
            </div>
          </div>
          <span className="text-xs text-slate-500">
            {isClean ? 'Контент чист' : 'Требуется устранение замечаний'}
          </span>
        </div>
      </div>

      {/* Main Inspection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual or Text Evidence Inspector (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="rounded-xl bg-white border border-slate-200 shadow-xs overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase font-['JetBrains_Mono'] text-slate-700">
                Объект проверки
              </span>
              <span className="text-xs text-slate-500 font-['JetBrains_Mono']">
                {auditCase.metadata.fileSize || 'RAW PAYLOAD'}
              </span>
            </div>

            {/* Content Viewport */}
            <div className="relative min-h-[320px] max-h-[460px] bg-slate-100 flex items-center justify-center p-4 overflow-hidden">
              {auditCase.previewUrl ? (
                <div className="relative max-h-full flex items-center justify-center">
                  <img
                    src={auditCase.previewUrl}
                    alt={auditCase.title}
                    className="max-h-[380px] w-auto max-w-full object-contain rounded-lg border border-slate-300 shadow-sm"
                  />
                  {/* Bounding Boxes on User Image */}
                  {auditCase.violations.map((v, i) => {
                    const top = v.bbox?.y ?? (i === 0 ? 12 : 55);
                    const left = v.bbox?.x ?? (i === 0 ? 48 : 10);
                    const isCritical = v.severity === 'critical';
                    const isSelected = activeBbox === v.id;
                    return (
                      <div
                        key={v.id || i}
                        onClick={() => setActiveBbox(v.id)}
                        style={{ top: `${top}%`, left: `${left}%` }}
                        className={`absolute max-w-[240px] rounded-lg p-2 transition-all cursor-pointer shadow-md ${
                          isSelected
                            ? 'bg-red-600 text-white ring-2 ring-red-400'
                            : 'bg-white/95 text-slate-900 border border-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-1 text-[10px] font-mono font-bold">
                          <span className={isSelected ? 'text-white' : isCritical ? 'text-red-700' : 'text-slate-700'}>
                            {v.code}
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
                <div className="w-full h-full p-4 flex flex-col justify-between bg-white rounded-lg border border-slate-200">
                  <div className="text-xs font-semibold text-slate-500 uppercase font-['JetBrains_Mono'] mb-2">
                    Текст анализируемого материала:
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 font-['Inter'] leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {auditCase.rawText}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-2 flex justify-between font-['JetBrains_Mono']">
                    <span>Символов: {auditCase.rawText.length}</span>
                    <span>Казнет-проверка завершена</span>
                  </div>
                </div>
              ) : (
                <div className="w-full p-6 text-center text-slate-500 text-xs">
                  Текстовые метаданные проверены. Замечаний не зафиксировано.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Kazakhstan Legal Violations Ledger (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-slate-900">
              Список правовых замечаний и рисков ({auditCase.violations.length})
            </h2>
            <span className="font-['JetBrains_Mono'] text-xs text-slate-500">
              Юрисдикция: РК
            </span>
          </div>

          {isClean ? (
            <div className="rounded-xl bg-white border border-emerald-200 p-6 flex flex-col items-center text-center gap-2 shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-1">
                <span className="material-symbols-outlined text-[28px]">verified</span>
              </div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base text-slate-900">
                Правонарушений не обнаружено
              </h3>
              <p className="text-xs text-slate-600 max-w-md leading-relaxed">
                Материал полностью соответствует законодательству Республики Казахстан: обязательная маркировка спонсорства присутствует, запрещенные категории рекламы (казино, слоты) не выявлены, персональные данные защищены.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {auditCase.violations.map((v, index) => {
                const isCritical = v.severity === 'critical';
                const isSelected = activeBbox === v.id;
                return (
                  <div
                    key={v.id || index}
                    onClick={() => setActiveBbox(v.id)}
                    className={`rounded-xl bg-white p-4.5 flex flex-col gap-2.5 border shadow-xs transition-all cursor-pointer ${
                      isSelected
                        ? isCritical
                          ? 'border-red-500 ring-2 ring-red-100'
                          : 'border-amber-500 ring-2 ring-amber-100'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span
                          className={`font-['JetBrains_Mono'] text-[10px] uppercase font-bold tracking-wider ${
                            isCritical ? 'text-red-600' : 'text-amber-600'
                          }`}
                        >
                          {isCritical ? 'КРИТИЧЕСКИЙ РИСК' : 'ПРЕДУПРЕЖДЕНИЕ'} #{index + 1}
                        </span>
                        <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900 mt-0.5">
                          {v.title}
                        </h3>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded font-['JetBrains_Mono'] text-xs font-semibold shrink-0 border ${
                          isCritical
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {v.code}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700 leading-relaxed">
                      <div className="font-semibold text-slate-900 mb-0.5">Основание по закону РК:</div>
                      <div>{v.basis}</div>
                    </div>

                    {v.recommendation && (
                      <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200 text-xs text-sky-900">
                        <span className="font-semibold">Как устранить:</span> {v.recommendation}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 font-['JetBrains_Mono']">
                      <div>
                        <span className="text-slate-400">Штраф: </span>
                        <strong className="text-red-700 font-medium">{v.fineAmount}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400">Регулятор: </span>
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
