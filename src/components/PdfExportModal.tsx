/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuditCase } from '../types';

interface PdfExportModalProps {
  auditCase: AuditCase;
  onClose: () => void;
}

export const PdfExportModal: React.FC<PdfExportModalProps> = ({ auditCase, onClose }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handlePrint = () => {
    setIsExporting(true);
    setTimeout(() => {
      window.print();
      setIsExporting(false);
    }, 300);
  };

  const legalViolations = auditCase.violations.filter((v) => v.category === 'legal');
  const ethicsViolations = auditCase.violations.filter((v) => v.category === 'ethics');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-3xl max-h-[92vh] rounded-xl bg-white border border-slate-200 p-4 sm:p-6 shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sky-600 text-[24px]">description</span>
            <h3 className="font-['Plus_Jakarta_Sans'] text-base sm:text-lg font-bold text-slate-900">
              Отчет аудита контента (PDF)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Printable Clean Commercial Report Sheet (Clean modern design, no state stamps) */}
        <div
          id="printable-protocol"
          className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 p-5 sm:p-8 rounded-xl border border-slate-200 font-['Inter'] text-xs leading-relaxed space-y-5"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-['Plus_Jakarta_Sans'] font-black text-xl text-slate-950 tracking-tight">
                  CHECK ACTIVITY
                </span>
                <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-mono text-[10px] font-bold">
                  CONTENT AUDIT // KZ
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-mono mt-1">
                Идентификатор отчета: {auditCase.referenceNumber}
              </p>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-600">
              <div>ДАТА: {auditCase.timestamp}</div>
              <div>ПЛАТФОРМА: {auditCase.metadata.platform || 'Online Media KZ'}</div>
            </div>
          </div>

          {/* Target Summary Cards */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Объект проверки:</span>
              <div className="text-slate-950 font-semibold truncate mt-0.5">{auditCase.title}</div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Файл / Ссылка:</span>
              <div className="text-slate-950 font-mono truncate mt-0.5">{auditCase.sourceName}</div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Индекс риска:</span>
              <div className="font-mono font-bold mt-0.5 text-red-600 text-sm">
                {auditCase.riskScore}/100 ({auditCase.riskLevel})
              </div>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Статус проверки:</span>
              <div className="font-mono font-bold mt-0.5 text-slate-800">
                {auditCase.status}
              </div>
            </div>
          </div>

          {/* Dual Score Summary */}
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="p-3 bg-sky-50/70 border border-sky-200 rounded-lg">
              <span className="font-bold uppercase font-mono text-sky-900 block mb-0.5">
                Правовой комплаенс РК
              </span>
              <div className="text-slate-700">
                Нарушений закона: <strong>{legalViolations.length}</strong> • Нормативная база: КоАП РК, Закон № 230-VII
              </div>
            </div>
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg">
              <span className="font-bold uppercase font-mono text-purple-900 block mb-0.5">
                Цифровая этика и культура
              </span>
              <div className="text-slate-700">
                Этических рисков: <strong>{ethicsViolations.length}</strong> • Нормы: Dark Patterns, Кибербуллинг, Hate Speech
              </div>
            </div>
          </div>

          {/* Issues and Violations List */}
          <div>
            <h2 className="text-xs font-bold text-slate-950 uppercase mb-2 font-mono">
              Обнаруженные замечания и риски ({auditCase.violations.length}):
            </h2>
            <div className="space-y-2.5">
              {auditCase.violations.length === 0 ? (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
                  Замечаний по законодательству РК и сетевой этике не выявлено.
                </div>
              ) : (
                auditCase.violations.map((v, i) => {
                  const isEthics = v.category === 'ethics';
                  return (
                    <div key={v.id} className="p-3 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-500">#{i + 1}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold font-mono ${
                              isEthics
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-sky-100 text-sky-800'
                            }`}
                          >
                            {isEthics ? 'ЭТИКА' : 'ЗАКОН'}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">{v.title}</span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            isEthics
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {v.code}
                        </span>
                      </div>
                      <p className="text-slate-700 text-[11px] mt-1.5 leading-relaxed">
                        {v.basis}
                      </p>
                      {v.recommendation && (
                        <div className="mt-1.5 text-[10.5px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                          <strong>Рекомендация:</strong> {v.recommendation}
                        </div>
                      )}
                      <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-600">
                        <span>
                          {isEthics ? 'Риск: ' : 'Штраф: '}
                          <strong className={isEthics ? 'text-purple-700' : 'text-red-700'}>
                            {v.fineAmount}
                          </strong>
                        </span>
                        <span>
                          {isEthics ? 'Стандарт: ' : 'Орган: '}
                          <strong>{v.jurisdiction}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="p-4 rounded-lg bg-sky-50 border border-sky-200 text-slate-800">
            <h3 className="font-bold text-xs uppercase text-sky-950 font-mono mb-1">
              Рекомендации эксперта по комплаенсу:
            </h3>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
              <li>Добавить обязательную отметку «Жарнамалық материал / Реклама» и указать реквизиты рекламодателя (ИИН/БИН).</li>
              <li>Продублировать текст рекламного оффера на государственном (казахском) языке согласно ст. 21 Закона о языках.</li>
              <li>Исключить манипулятивные обещания гарантированной сверхдоходности и таймеры искусственного FOMO.</li>
              <li>Соблюдать этику сетевого общения: исключить токсичную лексику, нападки на личности и скрытую рекламу.</li>
            </ul>
          </div>

          {/* Footer note */}
          <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Сформировано сервисом Check Activity AI // Казахстан</span>
            <span>Хеш проверки: {auditCase.sha256.slice(0, 24)}...</span>
          </div>
        </div>

        {/* Modal Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-200">
          <span className="font-['JetBrains_Mono'] text-[11px] text-slate-500">
            Коммерческий аудит контента • Соответствие нормам РК
          </span>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
              Закрыть
            </button>
            <button
              onClick={handlePrint}
              disabled={isExporting}
              className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-['Plus_Jakarta_Sans'] text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>{isExporting ? 'Подготовка...' : 'Печать / Сохранить в PDF'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
