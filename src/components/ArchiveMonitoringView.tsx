/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuditCase } from '../types';
import { MOCK_AUDIT_HISTORY } from '../data/mockData';

interface ArchiveMonitoringViewProps {
  onSelectCase: (auditCase: AuditCase) => void;
  onOpenPdfModal: () => void;
  userHistory?: AuditCase[];
}

export const ArchiveMonitoringView: React.FC<ArchiveMonitoringViewProps> = ({
  onSelectCase,
  userHistory = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // If user has audits, prioritize them; else use minimal sample audits for reference
  const allHistory = [
    ...userHistory,
    ...MOCK_AUDIT_HISTORY.filter((m) => !userHistory.some((u) => u.id === m.id)),
  ];

  const filteredHistory = allHistory.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.violations.some((v) =>
        v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.title.toLowerCase().includes(searchQuery.toLowerCase())
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
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 sm:gap-6 font-['Inter']">
      {/* Title */}
      <div className="border-b border-slate-200 pb-4 sm:pb-5">
        <h1 className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
          Журнал проведенных проверок
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-2xl leading-relaxed">
          Реестр завершенных AI-аудитов по нормам Закона РК об онлайн-платформах и рекламе (№ 230-VII), статьям КоАП РК и правилам интернет-этики.
        </p>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по номеру дела (#CHK-KZ...), названию или статье КоАП..."
            className="w-full bg-slate-50 pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full sm:w-auto bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-700 rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500"
          >
            <option value="all">Все статусы ({allHistory.length})</option>
            <option value="critical">Требует мер / Нарушения</option>
            <option value="warning">Предупреждения</option>
            <option value="safe">Безопасно</option>
          </select>
        </div>
      </div>

      {/* MOBILE VIEW (< sm): Responsive Cards */}
      <div className="sm:hidden flex flex-col gap-3">
        {filteredHistory.length === 0 ? (
          <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-400">
            Записей не найдено.
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isClean = item.violations.length === 0;
            return (
              <div
                key={item.id}
                onClick={() => onSelectCase(item)}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-2.5 cursor-pointer hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-['JetBrains_Mono'] font-bold text-xs text-slate-900">
                      {item.referenceNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {item.timestamp}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-['JetBrains_Mono'] border ${
                      item.riskScore >= 70
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : item.riskScore >= 30
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {item.riskScore}/100 • {item.riskLevel}
                  </span>
                </div>

                <div className="font-medium text-xs text-slate-900 line-clamp-2">
                  {item.title}
                </div>

                {/* Violations tags */}
                <div className="flex flex-wrap gap-1 pt-1">
                  {isClean ? (
                    <span className="text-emerald-700 text-[11px] font-medium">✓ Нарушений нет</span>
                  ) : (
                    item.violations.map((v) => (
                      <span
                        key={v.id}
                        className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${
                          v.category === 'ethics'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {v.category === 'ethics' ? 'Этика' : v.code.split('/')[0]}
                      </span>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {item.violations.length} замеч.
                  </span>
                  <span className="text-xs font-semibold text-sky-600 flex items-center gap-1">
                    Открыть отчет <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* TABLE VIEW (sm+): Desktop and Tablet Clean Grid */}
      <div className="hidden sm:block bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase font-['JetBrains_Mono'] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Дело / Референс</th>
                <th className="px-4 py-3">Дата и время</th>
                <th className="px-4 py-3">Объект проверки</th>
                <th className="px-4 py-3">Индекс риска</th>
                <th className="px-4 py-3">Закон и Этика</th>
                <th className="px-4 py-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-['Inter']">
                    Записей не найдено.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => onSelectCase(item)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3.5 font-['JetBrains_Mono'] font-bold text-slate-900">
                      {item.referenceNumber}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 font-['JetBrains_Mono'] whitespace-nowrap">
                      {item.timestamp}
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-900 max-w-xs truncate">
                      {item.title}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold font-['JetBrains_Mono'] ${
                          item.riskScore >= 70
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : item.riskScore >= 30
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {item.riskScore}/100 • {item.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {item.violations.length === 0 ? (
                          <span className="text-emerald-700 font-medium">✓ Без замечаний</span>
                        ) : (
                          item.violations.map((v) => (
                            <span
                              key={v.id}
                              className={`px-1.5 py-0.5 rounded border text-[10px] font-['JetBrains_Mono'] ${
                                v.category === 'ethics'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {v.category === 'ethics' ? 'Этика' : v.code.split('/')[0]}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCase(item);
                        }}
                        className="px-3 py-1 rounded bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-700 text-xs font-medium transition-colors"
                      >
                        Открыть отчет →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
