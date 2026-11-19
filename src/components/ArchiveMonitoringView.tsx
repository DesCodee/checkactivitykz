/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, ArrowRight, Check, FileText } from 'lucide-react';
import { AuditCase } from '../types';
import { MOCK_AUDIT_HISTORY } from '../data/mockData';
import { useApp } from '../utils/i18n';
import {
  getCompliancePenaltyDisplay,
  getLocalizedRiskLevel,
  isLegalViolation,
  normalizeAuditCaseCompliance,
  type BusinessEntityType,
} from '../utils/kzComplianceIntelligence';

interface ArchiveMonitoringViewProps {
  onSelectCase: (auditCase: AuditCase) => void;
  onOpenPdfModal: (auditCase: AuditCase, entityTier?: BusinessEntityType) => void;
  userHistory?: AuditCase[];
  entityTier?: BusinessEntityType;
  onEntityTierChange?: (tier: BusinessEntityType) => void;
}

export const ArchiveMonitoringView: React.FC<ArchiveMonitoringViewProps> = ({
  onSelectCase,
  onOpenPdfModal,
  userHistory = [],
  entityTier = 'small',
  onEntityTierChange,
}) => {
  const { t, language } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const allHistory = [
    ...userHistory.map(normalizeAuditCaseCompliance),
    ...MOCK_AUDIT_HISTORY.filter((m) => !userHistory.some((u) => u.id === m.id)).map(
      normalizeAuditCaseCompliance
    ),
  ];

  const filteredHistory = allHistory.filter((item) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (item.title || '').toLowerCase().includes(q) ||
      (item.referenceNumber || '').toLowerCase().includes(q) ||
      (item.sourceName || '').toLowerCase().includes(q) ||
      item.violations.some(
        (v) =>
          (v.code || '').toLowerCase().includes(q) ||
          (v.title || '').toLowerCase().includes(q)
      );

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'critical'
        ? item.status === 'ТРЕБУЕТ МЕР' || item.status === 'БЛОКИРОВКА'
        : statusFilter === 'warning'
        ? item.status === 'ПРЕДУПРЕЖДЕНИЕ'
        : item.status === 'БЕЗОПАСНО';

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 font-['Inter']">
      {/* Intro Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-semibold text-zinc-950 dark:text-zinc-50 tracking-tight">
            {t('archiveTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            {t('archiveSubtitle')}
          </p>
        </div>
        <span className="font-['JetBrains_Mono'] text-xs text-zinc-400 dark:text-zinc-500 tabular-nums">
          {filteredHistory.length} / {allHistory.length} {language === 'kz' ? 'жазба' : 'записей'}
        </span>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search
            className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2"
            strokeWidth={1.6}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'kz'
                ? 'Іс нөмірі (#CHK-KZ...), атауы немесе ӘҚБтК бабы бойынша іздеу...'
                : 'Поиск по номеру дела (#CHK-KZ...), названию или статье КоАП...'
            }
            className="w-full bg-zinc-50 dark:bg-zinc-950 pl-10 pr-4 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto">
          {onEntityTierChange && (
            <select
              aria-label={language === 'kz' ? 'Субъект санаты' : 'Категория субъекта'}
              value={entityTier}
              onChange={(e) => onEntityTierChange(e.target.value as BusinessEntityType)}
              className="flex-1 sm:flex-none bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 rounded-xl px-3 py-2 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            >
              <option value="individual">{language === 'kz' ? 'Жеке тұлға' : 'Физлицо'}</option>
              <option value="small">{language === 'kz' ? 'ШОБ / ЖК' : 'МБ / ИП'}</option>
              <option value="medium">{language === 'kz' ? 'Орта бизнес' : 'Средний'}</option>
              <option value="large">{language === 'kz' ? 'Ірі бизнес' : 'Крупный'}</option>
            </select>
          )}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 sm:flex-none sm:w-auto bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 rounded-xl px-3.5 py-2 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
          >
            <option value="all">
              {language === 'kz' ? 'Барлық мәртебелер' : 'Все статусы'} ({allHistory.length})
            </option>
            <option value="critical">
              {language === 'kz' ? 'Шаралар қажет / Бұзушылықтар' : 'Требует мер / Нарушения'}
            </option>
            <option value="warning">{language === 'kz' ? 'Ескертулер' : 'Предупреждения'}</option>
            <option value="safe">{language === 'kz' ? 'Қауіпсіз' : 'Безопасно'}</option>
          </select>
        </div>
      </div>

      {/* MOBILE VIEW (< sm): Minimalist Cards */}
      <div className="sm:hidden flex flex-col gap-3">
        {filteredHistory.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-center text-xs text-zinc-400">
            {language === 'kz' ? 'Жазбалар табылмады.' : 'Записей не найдено.'}
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isClean = item.violations.length === 0;
            const dotColor =
              item.riskScore >= 70
                ? 'bg-rose-500'
                : item.riskScore >= 30
                ? 'bg-amber-500'
                : 'bg-emerald-500';
            return (
              <div
                key={item.id}
                onClick={() => onSelectCase(item)}
                className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col gap-2.5 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-['JetBrains_Mono'] font-semibold text-xs text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {item.referenceNumber}
                    </span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-['JetBrains_Mono'] mt-0.5 tabular-nums">
                      {item.timestamp}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-[11px] font-['JetBrains_Mono'] font-medium text-zinc-700 dark:text-zinc-300 tabular-nums">
                    <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                    {item.riskScore}/100 · {getLocalizedRiskLevel(item.riskLevel, language)}
                  </span>
                </div>

                <div className="font-medium text-xs text-zinc-900 dark:text-zinc-100 line-clamp-2">
                  {item.title}
                </div>

                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] flex flex-col gap-1">
                  {isClean ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Check className="w-3.5 h-3.5" strokeWidth={1.8} />
                      {language === 'kz' ? '0 ₸ (Бұзушылықтар анықталмады)' : '0 ₸ (Нарушений не выявлено)'}
                    </span>
                  ) : (
                    <>
                      <span>
                        {item.violations
                          .map((v) =>
                            !isLegalViolation(v) ? 'Этика' : String(v.code || 'Закон РК').split('/')[0]
                          )
                          .join(' · ')}
                      </span>
                      <span className="text-[10.5px] font-semibold text-zinc-700 dark:text-zinc-300">
                        {getCompliancePenaltyDisplay(item.violations, entityTier, language).headline}
                      </span>
                    </>
                  )}
                </div>

                <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] text-zinc-400 font-['JetBrains_Mono'] tabular-nums">
                    {item.violations.length} {language === 'kz' ? 'ескерту' : 'замеч.'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPdfModal(item, entityTier);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-medium transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" strokeWidth={1.6} />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCase(item);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-medium transition-opacity hover:opacity-90"
                    >
                      <span>{language === 'kz' ? 'Толық есепті ашу' : 'Открыть полный отчёт'}</span>
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden sm:block bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-700 dark:text-zinc-300">
            <thead className="bg-zinc-50/70 dark:bg-zinc-950/60 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] border-b border-zinc-200/80 dark:border-zinc-800">
              <tr>
                <th className="px-5 py-3.5">{language === 'kz' ? 'Іс / Референс' : 'Дело / Референс'}</th>
                <th className="px-5 py-3.5">{language === 'kz' ? 'Күні мен уақыты' : 'Дата и время'}</th>
                <th className="px-5 py-3.5">{language === 'kz' ? 'Тексеру нысаны' : 'Объект проверки'}</th>
                <th className="px-5 py-3.5">{language === 'kz' ? 'Тәуекел индексі' : 'Индекс риска'}</th>
                <th className="px-5 py-3.5">{language === 'kz' ? 'Заң және Этика' : 'Закон и Этика'}</th>
                <th className="px-5 py-3.5 text-right">{t('colAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-zinc-400">
                    {language === 'kz' ? 'Жазбалар табылмады.' : 'Записей не найдено.'}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => {
                  const dotColor =
                    item.riskScore >= 70
                      ? 'bg-rose-500'
                      : item.riskScore >= 30
                      ? 'bg-amber-500'
                      : 'bg-emerald-500';
                  return (
                    <tr
                      key={item.id}
                      onClick={() => onSelectCase(item)}
                      className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 font-['JetBrains_Mono'] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums whitespace-nowrap">
                        {item.referenceNumber}
                      </td>
                      <td className="px-5 py-4 text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] whitespace-nowrap tabular-nums">
                        {item.timestamp}
                      </td>
                      <td className="px-5 py-4 font-medium text-zinc-900 dark:text-zinc-100 max-w-xs truncate">
                        {item.title}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 font-['JetBrains_Mono'] text-xs text-zinc-800 dark:text-zinc-200 tabular-nums">
                          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                          <span>{item.riskScore}/100</span>
                          <span className="text-zinc-400">·</span>
                          <span className="text-zinc-500 dark:text-zinc-400">{getLocalizedRiskLevel(item.riskLevel, language)}</span>
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] font-['JetBrains_Mono'] text-zinc-600 dark:text-zinc-400">
                          {item.violations.length === 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium font-['Inter']">
                              <Check className="w-3.5 h-3.5" strokeWidth={1.8} />
                              {language === 'kz' ? '0 ₸ (Бұзушылық жоқ)' : '0 ₸ (Нарушений нет)'}
                            </span>
                          ) : (
                            item.violations.map((v, idx) => {
                              const ethicsOnly = !isLegalViolation(v);
                              return (
                                <span key={v.id || idx} className="inline-flex items-center gap-1.5">
                                  {idx > 0 && <span className="text-zinc-300 dark:text-zinc-700">·</span>}
                                  <span
                                    className={
                                      ethicsOnly
                                        ? 'text-violet-600 dark:text-violet-400'
                                        : 'text-zinc-700 dark:text-zinc-300 font-medium'
                                    }
                                  >
                                    {ethicsOnly ? 'Этика' : String(v.code || 'Закон РК').split('/')[0]}
                                  </span>
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenPdfModal(item, entityTier);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors"
                            title={language === 'kz' ? 'PDF хаттамасы' : 'PDF-протокол'}
                          >
                            <FileText className="w-3.5 h-3.5" strokeWidth={1.6} />
                            <span>PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCase(item);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors"
                          >
                            <span>{language === 'kz' ? 'Толық есепті ашу' : 'Открыть полный отчёт'}</span>
                            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
