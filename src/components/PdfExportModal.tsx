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
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060e20]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-3xl max-h-[92vh] rounded-2xl bg-[#131b2e] border border-[#3d494c] p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[24px]">picture_as_pdf</span>
            <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#dae2fd]">
              Электронный протокол осмотра интернет-страниц (Казахстан)
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-[#869397] hover:text-[#dae2fd]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Printable Document Sheet Preview */}
        <div
          id="printable-protocol"
          className="flex-1 overflow-y-auto bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-inner font-['Inter'] text-xs leading-relaxed space-y-4"
        >
          {/* Official Document Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-cyan-800">
                РЕСПУБЛИКА КАЗАХСТАН // ЦИФРОВОЙ КОМПЛАЕНС
              </div>
              <h1 className="text-base sm:text-lg font-black text-slate-950 font-['Plus_Jakarta_Sans']">
                ПРОТОКОЛ ЭКСПЕРТНОГО АУДИТА И ФИКСАЦИИ ДОКАЗАТЕЛЬСТВ
              </h1>
              <p className="text-[11px] text-slate-600 font-mono">
                Регистрационный номер дела: {auditCase.referenceNumber}
              </p>
            </div>
            <div className="text-right text-[10px] font-mono text-slate-700">
              <div>ДАТА: {auditCase.timestamp}</div>
              <div>СТАТУС: ЮРИДИЧЕСКИ ЗАВЕРЕНО</div>
              <div>ГОР. АСТАНА (РК)</div>
            </div>
          </div>

          {/* Forensic Scope */}
          <div className="bg-slate-100 p-3 rounded-lg border border-slate-300 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="font-bold text-slate-700">Объект исследования:</span>
              <div className="text-slate-900 font-medium truncate">{auditCase.title}</div>
            </div>
            <div>
              <span className="font-bold text-slate-700">Источник / Файл:</span>
              <div className="text-slate-900 font-mono truncate">{auditCase.sourceName}</div>
            </div>
            <div>
              <span className="font-bold text-slate-700">Хеш-сумма SHA-256:</span>
              <div className="text-slate-900 font-mono text-[9px] truncate">{auditCase.sha256}</div>
            </div>
            <div>
              <span className="font-bold text-slate-700">Индекс правового риска:</span>
              <div className="text-red-700 font-bold font-mono">
                {auditCase.riskScore}/100 ({auditCase.riskLevel})
              </div>
            </div>
          </div>

          {/* Violations Table */}
          <div>
            <h2 className="text-xs font-bold text-slate-950 uppercase mb-1.5 font-mono">
              1. ВЫЯВЛЕННЫЕ ПРАВОНАРУШЕНИЯ ЗАКОНОДАТЕЛЬСТВА РЕСПУБЛИКИ КАЗАХСТАН:
            </h2>
            <table className="w-full text-left border border-slate-300 text-[10px]">
              <thead className="bg-slate-200 text-slate-800 font-mono uppercase">
                <tr>
                  <th className="p-2 border border-slate-300 w-8">№</th>
                  <th className="p-2 border border-slate-300">Статья Кодекса / Закона РК</th>
                  <th className="p-2 border border-slate-300">Квалификация и факты</th>
                  <th className="p-2 border border-slate-300">Штрафные санкции</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {auditCase.violations.map((v, i) => (
                  <tr key={v.id} className="align-top">
                    <td className="p-2 border border-slate-300 font-mono font-bold">{i + 1}</td>
                    <td className="p-2 border border-slate-300 font-bold text-red-700 font-mono">{v.code}</td>
                    <td className="p-2 border border-slate-300">
                      <div className="font-bold text-slate-900">{v.title}</div>
                      <div className="text-slate-700 mt-0.5">{v.basis}</div>
                    </td>
                    <td className="p-2 border border-slate-300 font-mono font-semibold text-slate-900">{v.fineAmount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legal Normative references */}
          <div className="text-[10px] text-slate-600 space-y-1 border-t border-slate-200 pt-2 font-mono">
            <div>
              • Нормативное соответствие: Закон РК № 230-VII «Об онлайн-платформах и онлайн-рекламе», КоАП РК, Закон РК № 94-V.
            </div>
            <div>• Доказательная сила: ст. 68, 77 ГПК РК (письменные и вещественные доказательства в электронной форме).</div>
          </div>

          {/* Digital Signature Stamp */}
          <div className="border-2 border-emerald-700 rounded-lg p-3 bg-emerald-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded border border-emerald-700 flex items-center justify-center font-bold text-emerald-800 font-mono text-[10px] text-center leading-none">
                ЭЦП
                <br />
                НУЦ РК
              </div>
              <div className="text-[10px] font-mono text-emerald-950">
                <div className="font-bold">ДОКУМЕНТ ПОДПИСАН ЭЛЕКТРОННОЙ ЦИФРОВОЙ ПОДПИСЬЮ</div>
                <div>Сертификат: 34102004KZ-CHECK-ACTIVITY-SYSTEMS-00892</div>
                <div>Действителен: 2024-01-01 по 2027-01-01 | НУЦ РК (pki.gov.kz)</div>
              </div>
            </div>
            <div className="text-right text-[10px] font-mono text-emerald-800 font-bold">
              ВЫДАН ДЛЯ СУДОВ РК & МКИ РК
            </div>
          </div>
        </div>

        {/* Modal Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-[#222a3d]">
          <span className="font-['JetBrains_Mono'] text-xs text-[#869397]">
            Формат печати: A4 / Landscape & Portrait
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-[#bcc9cd] hover:text-[#dae2fd]"
            >
              Закрыть
            </button>
            <button
              onClick={handlePrint}
              disabled={isExporting}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#06b6d4] to-[#0566d9] text-[#001f26] font-['Plus_Jakarta_Sans'] text-xs font-bold flex items-center gap-1.5 shadow-md hover:opacity-95"
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
