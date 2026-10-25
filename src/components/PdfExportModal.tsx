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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[92vh] rounded-xl bg-white border border-slate-200 p-6 shadow-2xl flex flex-col gap-4">
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
          className="flex-1 overflow-y-auto bg-slate-50 text-slate-900 p-6 sm:p-8 rounded-xl border border-slate-200 font-['Inter'] text-xs leading-relaxed space-y-5"
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

          {/* Issues and Violations List */}
          <div>
            <h2 className="text-xs font-bold text-slate-950 uppercase mb-2 font-mono">
              Обнаруженные несоответствия и риски ({auditCase.violations.length}):
            </h2>
            <div className="space-y-2.5">
              {auditCase.violations.length === 0 ? (
                <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800">
                  Нарушений законодательства Республики Казахстан не выявлено.
                </div>
              ) : (
                auditCase.violations.map((v, i) => (
                  <div key={v.id} className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-500">#{i + 1}</span>
                        <span className="font-bold text-slate-900 text-xs">{v.title}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-mono text-[10px] font-bold">
                        {v.code}
                      </span>
                    </div>
                    <p className="text-slate-700 text-[11px] mt-1.5 leading-relaxed">
                      {v.basis}
                    </p>
                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-600">
                      <span>Потенциальный штраф: <strong className="text-red-700">{v.fineAmount}</strong></span>
                      <span>Контролирующий орган: <strong>{v.jurisdiction}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div className="p-4 rounded-lg bg-sky-50 border border-sky-200 text-slate-800">
            <h3 className="font-bold text-xs uppercase text-sky-950 font-mono mb-1">
              Рекомендации по устранению рисков:
            </h3>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-700">
              <li>Добавить обязательную отметку «Жарнамалық материал / Реклама» и указать реквизиты рекламодателя (ИИН/БИН).</li>
              <li>Продублировать текст рекламного оффера на государственном (казахском) языке согласно ст. 21 Закона о языках.</li>
              <li>Исключить ссылки на нелицензированные азартные игры и онлайн-казино (ст. 445-1 КоАП РК).</li>
              <li>Скрыть личные контакты и телефонные номера физических лиц без их письменного согласия на обработку данных.</li>
            </ul>
          </div>

          {/* Footer note */}
          <div className="border-t border-slate-200 pt-3 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span>Сформировано сервисом Check Activity AI // Казахстан</span>
            <span>Хеш проверки: {auditCase.sha256.slice(0, 24)}...</span>
          </div>
        </div>

        {/* Modal Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <span className="font-['JetBrains_Mono'] text-xs text-slate-500">
            Чистый коммерческий PDF без государственных печатей
          </span>
          <div className="flex items-center gap-2">
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
