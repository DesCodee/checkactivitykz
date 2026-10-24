/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(18); // seconds
  const [activeBbox, setActiveBbox] = useState<string | null>('v-01');
  const [copiedLink, setCopiedLink] = useState(false);

  // Audio timer simulation
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlayingAudio) {
      interval = setInterval(() => {
        setAudioProgress((prev) => {
          if (prev >= 102) {
            setIsPlayingAudio(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlayingAudio]);

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const currentSector =
    audioProgress >= 14 && audioProgress <= 24
      ? 'ТЕКУЩИЙ СЕКТОР: СТ. 73-3 КоАП РК (КЛЕВЕТА)'
      : audioProgress >= 63 && audioProgress <= 70
      ? 'ТЕКУЩИЙ СЕКТОР: СТ. 73-4 КоАП РК (ОСКОРБЛЕНИЕ)'
      : 'ФОНОВЫЙ ТРЕК';

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-['JetBrains_Mono'] text-[11px] px-2.5 py-0.5 rounded-md bg-[#222a3d] text-[#4cd7f6] uppercase font-bold border border-[#4cd7f6]/30">
              AUDIT REF: {auditCase.referenceNumber}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#1bbd85]/20 text-[#4edea3] font-['JetBrains_Mono'] text-[11px] uppercase font-semibold border border-[#4edea3]/30">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
              AI AUDIT COMPLETE
            </span>
            <span className="font-['JetBrains_Mono'] text-xs text-[#bcc9cd] flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">schedule</span>
              {auditCase.timestamp}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-[#dae2fd] tracking-tight">
              Экспертный отчет аудита{' '}
              <span className="text-[#4cd7f6] font-['JetBrains_Mono']">{auditCase.referenceNumber}</span>
            </h1>
          </div>

          <p className="text-xs sm:text-sm text-[#bcc9cd] flex items-center gap-2 font-['Inter']">
            <span className="material-symbols-outlined text-[16px] text-[#4cd7f6]">policy</span>
            <span>
              Объект проверки: <strong className="text-[#dae2fd] font-medium">{auditCase.title}</strong>
            </span>
          </p>
        </div>

        {/* Action Cluster Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenPdfModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#06b6d4] to-[#0566d9] text-[#001f26] font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-bold hover:opacity-95 shadow-[0_0_16px_rgba(6,182,212,0.35)] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            <span>Скачать отчет (PDF)</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#131b2e] hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#dae2fd] border border-[#3d494c]/50 text-xs font-['Inter'] transition-colors"
            title="Скопировать ссылку на отчет"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            <span>{copiedLink ? 'Скопировано!' : 'Поделиться'}</span>
          </button>

          <button
            onClick={onRetest}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-[#131b2e] hover:bg-[#171f33] text-[#bcc9cd] hover:text-[#4cd7f6] border border-[#3d494c]/50 text-xs transition-colors"
            title="Перепроверить"
          >
            <span className="material-symbols-outlined text-[18px]">autorenew</span>
            <span>Перепроверить</span>
          </button>
        </div>
      </div>

      {/* 4 High-Impact Telemetry Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Metric 1: Risk Index Dial */}
        <div className="relative overflow-hidden rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-5 flex items-center justify-between shadow-xl">
          <div className="absolute -right-4 -top-4 w-28 h-28 bg-[#ff6b6b]/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="flex flex-col gap-1 z-10">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase tracking-wider font-semibold">
              Индекс риска
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-['Plus_Jakarta_Sans'] text-4xl font-bold text-[#ff6b6b]">{auditCase.riskScore}</span>
              <span className="font-['JetBrains_Mono'] text-xs text-[#869397]">/100</span>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-['Plus_Jakarta_Sans'] font-bold text-[#ff6b6b] mt-0.5">
              <span className="w-2 h-2 rounded-full bg-[#ff6b6b] animate-pulse"></span>
              {auditCase.riskLevel} риск
            </span>
            <span className="text-[11px] text-[#bcc9cd] font-['Inter']">Рекомендуется исправить</span>
          </div>

          {/* Radial Gauge SVG */}
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="30" fill="transparent" stroke="#222a3d" strokeWidth="6"></circle>
              <circle
                cx="36"
                cy="36"
                r="30"
                fill="transparent"
                stroke="#ff6b6b"
                strokeWidth="6"
                strokeDasharray="188.4"
                strokeDashoffset={188.4 - (188.4 * auditCase.riskScore) / 100}
                strokeLinecap="round"
              ></circle>
            </svg>
            <span className="material-symbols-outlined absolute text-[#ff6b6b] text-[24px]">warning</span>
          </div>
        </div>

        {/* Metric 2: Violations Count */}
        <div className="relative overflow-hidden rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase tracking-wider font-semibold">
              Статус замечаний
            </span>
            <span className="px-2 py-0.5 rounded bg-[#ff6b6b]/20 text-[#ff6b6b] font-['JetBrains_Mono'] text-xs font-bold">
              {auditCase.violations.length} пункта
            </span>
          </div>
          <div className="my-2 flex items-center gap-6">
            <div className="flex flex-col">
              <div className="font-['Plus_Jakarta_Sans'] text-3xl text-[#ff6b6b] font-bold leading-none">
                {auditCase.violations.filter((v) => v.severity === 'critical').length || 2}
              </div>
              <span className="text-xs text-[#bcc9cd] mt-1 font-['Inter']">Критических</span>
            </div>
            <div className="h-8 w-px bg-[#222a3d]"></div>
            <div className="flex flex-col">
              <div className="font-['Plus_Jakarta_Sans'] text-3xl text-[#adc6ff] font-bold leading-none">
                {auditCase.violations.filter((v) => v.severity !== 'critical').length || 1}
              </div>
              <span className="text-xs text-[#bcc9cd] mt-1 font-['Inter']">Предупреждения</span>
            </div>
          </div>
          <div className="w-full bg-[#222a3d] h-1.5 rounded-full overflow-hidden flex">
            <div className="bg-[#ff6b6b] h-full" style={{ width: '65%' }}></div>
            <div className="bg-[#adc6ff] h-full" style={{ width: '35%' }}></div>
          </div>
        </div>

        {/* Metric 3: Potential Fine Range in MRP & KZT */}
        <div className="relative overflow-hidden rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase tracking-wider font-semibold">
              Оценка штрафов
            </span>
            <span className="font-['JetBrains_Mono'] text-[11px] text-[#4cd7f6]">КоАП РК</span>
          </div>
          <div className="my-1">
            <div className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl text-[#dae2fd] font-bold tracking-tight">
              393 200 — 1 376 200 ₸
            </div>
            <p className="text-xs text-[#ff6b6b] mt-1 flex items-center gap-1 font-['JetBrains_Mono']">
              <span className="material-symbols-outlined text-[14px]">report_problem</span>
              Санкция по ст. 455 КоАП (100–350 МРП)
            </p>
          </div>
          <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">
            Регулятор: МКИ РК (Онлайн-реклама)
          </span>
        </div>

        {/* Metric 4: AI Model Verification Confidence */}
        <div className="relative overflow-hidden rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-5 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase tracking-wider font-semibold">
              Нейро-верификация
            </span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3] font-bold">KZ v4.2 PRO</span>
          </div>
          <div className="my-1 flex items-baseline gap-2">
            <div className="font-['Plus_Jakarta_Sans'] text-3xl text-[#4edea3] font-bold leading-none">98.6%</div>
            <span className="font-['JetBrains_Mono'] text-xs text-[#bcc9cd]">CONFIDENCE</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-[#222a3d] h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#4edea3] h-full rounded-full" style={{ width: '98.6%' }}></div>
            </div>
            <span className="material-symbols-outlined text-[#4edea3] text-[18px]">verified</span>
          </div>
        </div>
      </div>

      {/* Multi-Modal Evidence & Violations Dual Split Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual & Audio Viewport (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Image Evidence Viewport */}
          <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 shadow-xl overflow-hidden flex flex-col">
            {/* Top Bar */}
            <div className="px-4 py-2.5 bg-[#171f33] border-b border-[#3d494c]/30 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-['JetBrains_Mono'] text-xs">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">image_search</span>
                <span className="text-[#dae2fd] uppercase font-bold">АНАЛИЗ ИЗОБРАЖЕНИЯ #IMG-01</span>
                <span className="text-[#869397]">| {auditCase.metadata.resolution || '2400x1600 JPG'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-[#ff6b6b]/20 text-[#ff6b6b] font-bold">
                  2 ДЕТЕКЦИИ НА СЛОЕ
                </span>
                <button
                  onClick={() => alert('Отображение в полном разрешении с подсветкой областей')}
                  className="p-1 rounded hover:bg-[#222a3d] text-[#bcc9cd]"
                  title="Масштаб 1:1"
                >
                  <span className="material-symbols-outlined text-[16px]">fullscreen</span>
                </button>
              </div>
            </div>

            {/* Interactive Graphic Frame with HUD annotations */}
            <div className="relative w-full aspect-[16/10] bg-[#060e20] overflow-hidden flex items-center justify-center select-none">
              <div className="absolute inset-0 bg-gradient-to-br from-[#0c162d] via-[#101b33] to-[#080d1a] flex flex-col p-8 justify-between">
                <div className="flex items-center justify-between border-b border-[#3d494c]/30 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#4cd7f6]"></span>
                    <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm tracking-widest text-[#dae2fd]">
                      ASTANA INVEST CORP // КАЗАХСТАН
                    </span>
                  </div>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#4cd7f6] px-2 py-0.5 rounded bg-[#222a3d]">
                    SPONSORED PROMO
                  </span>
                </div>

                <div className="flex flex-col gap-2 max-w-md my-auto">
                  <span className="font-['JetBrains_Mono'] text-xs text-[#4edea3]">
                    ГАРАНТИРОВАННАЯ ДОХОДНОСТЬ ДО 45% В МЕСЯЦ
                  </span>
                  <h3 className="font-['Plus_Jakarta_Sans'] text-2xl font-black text-[#dae2fd] leading-tight">
                    Инвестиционный пул в Астане и Алматы: заходи сейчас!
                  </h3>
                  <p className="text-xs text-[#bcc9cd]">
                    Специальное предложение только для подписчиков канала. Официальный контракт.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-[#3d494c]/20 text-[11px] font-['JetBrains_Mono'] text-[#869397]">
                  <span>Отдел по работе с клиентами</span>
                  <span>Контакты менеджера: +7 (701) 420-**-**</span>
                </div>
              </div>

              {/* Grid coordinate overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#060e20]/80 via-transparent to-transparent pointer-events-none"></div>

              {/* Bounding Box 1: Missing "Жарнама" marking */}
              <div
                onClick={() => setActiveBbox('v-01')}
                className={`absolute top-4 right-4 sm:top-6 sm:right-6 w-56 sm:w-64 rounded-lg p-2 flex flex-col justify-between transition-all cursor-pointer ${
                  activeBbox === 'v-01'
                    ? 'bg-[#ff6b6b]/20 border-2 border-[#ff6b6b] shadow-[0_0_24px_rgba(255,107,107,0.4)] scale-105'
                    : 'bg-[#ff6b6b]/10 border border-[#ff6b6b]/60 hover:scale-102'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="px-1.5 py-0.5 rounded bg-[#ff6b6b] text-[#060e20] font-['JetBrains_Mono'] text-[9px] font-bold">
                    НЕСООТВЕТСТВИЕ: ст. 455 КоАП
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#ff6b6b] animate-ping"></span>
                </div>
                <div className="bg-[#060e20]/90 backdrop-blur-md p-2 rounded">
                  <div className="font-['JetBrains_Mono'] text-[11px] text-[#ff6b6b] font-bold">
                    НЕТ МАРКИРОВКИ «ЖАРНАМА»
                  </div>
                  <div className="text-[10px] text-[#bcc9cd] font-['Inter'] leading-tight mt-0.5">
                    Коммерческий оффер не содержит статус рекламы по Закону № 230-VII
                  </div>
                </div>
              </div>

              {/* Bounding Box 2: Contact Phone (PDn) */}
              <div
                onClick={() => setActiveBbox('v-03')}
                className={`absolute bottom-6 left-6 sm:bottom-8 sm:left-8 w-60 sm:w-72 rounded-lg p-2 flex flex-col justify-between transition-all cursor-pointer ${
                  activeBbox === 'v-03'
                    ? 'bg-[#0566d9]/25 border-2 border-[#4cd7f6] shadow-[0_0_20px_rgba(76,215,246,0.35)] scale-105'
                    : 'bg-[#0566d9]/15 border border-[#4cd7f6]/50 hover:scale-102'
                }`}
              >
                <div className="flex items-center justify-between pb-1">
                  <span className="px-1.5 py-0.5 rounded bg-[#0566d9] text-[#e6ecff] font-['JetBrains_Mono'] text-[9px] font-bold">
                    РИСК: ст. 79 КоАП РК
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[9px] text-[#dae2fd]">CONF: 94.2%</span>
                </div>
                <div className="bg-[#060e20]/90 backdrop-blur-md p-2 rounded">
                  <div className="font-['JetBrains_Mono'] text-[11px] text-[#4cd7f6] font-bold">
                    ОТКРЫТЫЙ НОМЕР ТЕЛЕФОНА
                  </div>
                  <div className="text-[10px] text-[#bcc9cd] font-['Inter'] leading-tight mt-0.5">
                    Телефон физического лица +7 (701) 420-**-** без согласия
                  </div>
                </div>
              </div>

              {/* Crosshair indicator HUD */}
              <div className="absolute top-3 left-3 font-['JetBrains_Mono'] text-[9px] text-[#869397] flex flex-col gap-0.5 pointer-events-none">
                <span>INSPECTOR: AI OCR LAYER</span>
                <span>SHA-256: 7f4a...9b12</span>
              </div>
            </div>

            {/* Sub-shelf footer */}
            <div className="px-4 py-2 bg-[#171f33] border-t border-[#3d494c]/30 flex items-center justify-between text-[#bcc9cd] font-['JetBrains_Mono'] text-xs">
              <span>Источник: Социальные медиа (Казахстан)</span>
              <span className="text-[#4edea3]">Текст и графика распознаны успешно</span>
            </div>
          </div>

          {/* Audio Waveform Player with Timeline Violations */}
          <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 shadow-xl overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 bg-[#171f33] border-b border-[#3d494c]/30 flex items-center justify-between">
              <div className="flex items-center gap-2 font-['JetBrains_Mono'] text-xs">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[18px]">graphic_eq</span>
                <span className="text-[#dae2fd] uppercase font-bold">АНАЛИЗ АУДИО #AUD-01</span>
                <span className="text-[#869397]">| podcast_promo_v2.wav (01:42)</span>
              </div>
              <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-[#ff6b6b]/20 text-[#ff6b6b] font-bold">
                2 ЗАМЕЧАНИЯ
              </span>
            </div>

            <div className="p-5 flex flex-col gap-4 bg-[#131b2e]">
              {/* Play Controls & Scrubber */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                    className="w-10 h-10 rounded-full bg-[#4cd7f6] flex items-center justify-center text-[#003640] hover:scale-105 shadow-[0_0_12px_rgba(76,215,246,0.5)] transition-all"
                  >
                    <span className="material-symbols-outlined text-[24px]">
                      {isPlayingAudio ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                  <div className="flex flex-col">
                    <span className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#dae2fd]">
                      {formatSeconds(audioProgress)} / 01:42
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#ff6b6b] font-semibold">
                      {currentSector}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-1 rounded bg-[#222a3d] text-[#dae2fd]">
                    1.0x
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-1 rounded bg-[#222a3d] text-[#4cd7f6] font-semibold">
                    WHISPER KAZAKH v3
                  </span>
                </div>
              </div>

              {/* Waveform Graphic Canvas */}
              <div className="relative w-full h-24 bg-[#060e20] rounded-lg p-2 flex items-end gap-1 overflow-hidden select-none border border-[#3d494c]/30">
                {/* Defamation Marker 1: [00:14 - 00:24] */}
                <div
                  onClick={() => setAudioProgress(16)}
                  className="absolute top-0 bottom-0 left-[14%] w-[10%] bg-[#ff6b6b]/20 border-x border-[#ff6b6b] flex flex-col justify-between p-1 z-10 cursor-pointer hover:bg-[#ff6b6b]/30"
                  title="Кликните для перехода к таймкоду спорного высказывания"
                >
                  <span className="font-['JetBrains_Mono'] text-[8px] text-[#ff6b6b] font-bold truncate">00:14-00:24</span>
                  <span className="font-['JetBrains_Mono'] text-[8px] text-white bg-[#ff6b6b] px-1 py-0.5 rounded truncate">
                    СПОРНОЕ
                  </span>
                </div>

                {/* Profanity Marker 2: [01:03 - 01:10] */}
                <div
                  onClick={() => setAudioProgress(65)}
                  className="absolute top-0 bottom-0 left-[62%] w-[8%] bg-[#0566d9]/25 border-x border-[#adc6ff] flex flex-col justify-between p-1 z-10 cursor-pointer hover:bg-[#0566d9]/35"
                  title="Кликните для перехода к таймкоду некорректной лексики"
                >
                  <span className="font-['JetBrains_Mono'] text-[8px] text-[#adc6ff] font-bold truncate">01:05</span>
                  <span className="font-['JetBrains_Mono'] text-[8px] text-[#dae2fd] bg-[#0566d9] px-1 py-0.5 rounded truncate">
                    РЕЗКАЯ ЛЕКСИКА
                  </span>
                </div>

                {/* Needle Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#4cd7f6] shadow-[0_0_8px_#4cd7f6] z-20 transition-all"
                  style={{ left: `${(audioProgress / 102) * 100}%` }}
                >
                  <div className="w-2.5 h-2.5 -ml-1 bg-[#4cd7f6] rounded-full"></div>
                </div>

                {/* Waveform SVG */}
                <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 400 60">
                  <path
                    d="M 0,30 Q 10,10 20,30 T 40,30 T 60,15 T 70,52 T 80,8 T 90,55 T 100,20 T 110,30 T 130,28 T 160,32 T 190,30 T 210,12 T 230,48 T 250,5 T 265,58 T 280,24 T 300,30 T 330,30 T 360,25 T 380,35 T 400,30"
                    fill="none"
                    stroke="#4cd7f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 0,30 Q 10,20 20,30 T 40,30 T 60,22 T 70,40 T 80,18 T 90,42 T 100,25 T 110,30 T 130,29 T 160,31 T 190,30 T 210,20 T 230,39 T 250,15 T 265,45 T 280,28 T 300,30 T 330,30 T 360,27 T 380,33 T 400,30"
                    fill="none"
                    stroke="#869397"
                    strokeOpacity="0.4"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

              {/* Synchronized AI Audio Transcript */}
              <div className="rounded-lg bg-[#060e20] p-4 flex flex-col gap-2 border border-[#3d494c]/30">
                <div className="flex items-center justify-between">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase">
                    Синхронная текстовая расшифровка (Whisper Kazakh & Russian)
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs text-[#4edea3]">100% точность таймкодов</span>
                </div>
                <div className="text-xs sm:text-sm text-[#dae2fd] leading-relaxed font-['Inter'] space-y-2">
                  <p>
                    <span className="text-[#869397] font-['JetBrains_Mono']">[00:04]</span> Сәлеметсіздер ме, құрметті
                    достар! В отличие от других компаний на рынке Казахстана, наши конкуренты{' '}
                    <mark className="bg-[#ff6b6b]/30 text-[#ff6b6b] px-1.5 py-0.5 rounded font-medium border border-[#ff6b6b]/50">
                      заведомо фальсифицируют государственные закупки и выводят средства через офшоры [00:14 - 00:22]
                    </mark>
                    , поэтому переходите по ссылке и выбирайте нас...
                  </p>
                  <p>
                    <span className="text-[#869397] font-['JetBrains_Mono']">[01:05]</span> А те, кто пишет жалобы в
                    госорганы —{' '}
                    <mark className="bg-[#0566d9]/30 text-[#adc6ff] px-1 rounded font-medium">
                      просто бездари и мошенники
                    </mark>
                    !
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Kazakhstan Legal Violations Ledger (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ff6b6b] text-[22px]">checklist</span>
              <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#dae2fd]">
                Список несоответствий и рисков
              </h2>
            </div>
            <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-[#222a3d] text-[#bcc9cd] uppercase font-semibold">
              КОМПЛАЕНС РК
            </span>
          </div>

          {/* Violation Card 1: Missing "Жарнама" marking */}
          <div
            onClick={() => setActiveBbox('v-01')}
            className={`rounded-xl bg-[#131b2e] p-5 flex flex-col gap-3 shadow-xl relative overflow-hidden border transition-all cursor-pointer ${
              activeBbox === 'v-01' ? 'border-[#ff6b6b] ring-1 ring-[#ff6b6b]' : 'border-[#3d494c]/40 hover:border-[#ff6b6b]/60'
            }`}
          >
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#ff6b6b]"></div>
            <div className="flex items-start justify-between gap-2 pl-2">
              <div className="flex flex-col">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#ff6b6b] uppercase font-bold tracking-wider">
                  КРИТИЧЕСКИЙ РИСК #01
                </span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-sm sm:text-base font-bold text-[#dae2fd] mt-0.5">
                  Отсутствие маркировки рекламы («Жарнама»)
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#ff6b6b]/20 text-[#ff6b6b] font-['JetBrains_Mono'] text-[11px] font-bold shrink-0">
                ст. 455 КоАП РК
              </span>
            </div>

            <div className="pl-2 flex flex-col gap-2.5">
              <div className="bg-[#060e20] p-3 rounded-lg flex flex-col gap-1 border border-[#3d494c]/30 text-xs">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase">
                  Фактическое основание по Закону № 230-VII:
                </span>
                <p className="text-[#bcc9cd] font-['Inter'] leading-relaxed">
                  В тексте публикации и на графическом макете зафиксирован прямой коммерческий оффер с ценовым предложением
                  без обязательного слова «Жарнама» и без идентификации заказчика (ИИН/БИН).
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-[#171f33] border border-[#3d494c]/30 flex flex-col">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">САНКЦИЯ ДЛЯ СУБЪЕКТА</span>
                  <span className="font-['JetBrains_Mono'] text-xs text-[#ff6b6b] font-bold mt-0.5">
                    100 — 350 МРП (до 1.37 млн ₸)
                  </span>
                </div>
                <div className="p-2 rounded bg-[#171f33] border border-[#3d494c]/30 flex flex-col">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">РЕГУЛЯТОР</span>
                  <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#dae2fd] font-semibold mt-0.5">
                    МКИ РК (Онлайн-реклама)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Violation Card 2: Defamation */}
          <div
            onClick={() => setActiveBbox('v-02')}
            className={`rounded-xl bg-[#131b2e] p-5 flex flex-col gap-3 shadow-xl relative overflow-hidden border transition-all cursor-pointer ${
              activeBbox === 'v-02' ? 'border-[#ff6b6b] ring-1 ring-[#ff6b6b]' : 'border-[#3d494c]/40 hover:border-[#ff6b6b]/60'
            }`}
          >
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#ff6b6b]"></div>
            <div className="flex items-start justify-between gap-2 pl-2">
              <div className="flex flex-col">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#ff6b6b] uppercase font-bold tracking-wider">
                  КРИТИЧЕСКИЙ РИСК #02
                </span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-sm sm:text-base font-bold text-[#dae2fd] mt-0.5">
                  Высказывание с признаками клеветы
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#ff6b6b]/20 text-[#ff6b6b] font-['JetBrains_Mono'] text-[11px] font-bold shrink-0">
                ст. 73-3 КоАП РК
              </span>
            </div>

            <div className="pl-2 flex flex-col gap-2.5">
              <div className="bg-[#060e20] p-3 rounded-lg flex flex-col gap-1 border border-[#3d494c]/30 text-xs">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase">
                  Лингвистический маркер (00:14 - 00:22):
                </span>
                <p className="text-[#ff6b6b] italic font-medium">
                  «...заведомо фальсифицируют государственные закупки и выводят средства через офшоры...»
                </p>
                <p className="text-[#bcc9cd] font-['Inter'] mt-1">
                  Утверждение о фактах совершения противоправных действий в адрес конкурентов в публичном пространстве.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-[#171f33] border border-[#3d494c]/30 flex flex-col">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">РИСК ПРЕТЕНЗИЙ</span>
                  <span className="font-['JetBrains_Mono'] text-xs text-[#ff6b6b] font-bold mt-0.5">
                    Штраф до 650 МРП (2.55 млн ₸)
                  </span>
                </div>
                <div className="p-2 rounded bg-[#171f33] border border-[#3d494c]/30 flex flex-col">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">РИСК БРЕНДА</span>
                  <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#dae2fd] font-semibold mt-0.5">
                    Репутационный ущерб
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Violation Card 3: Personal Data */}
          <div
            onClick={() => setActiveBbox('v-03')}
            className={`rounded-xl bg-[#131b2e] p-5 flex flex-col gap-3 shadow-xl relative overflow-hidden border transition-all cursor-pointer ${
              activeBbox === 'v-03' ? 'border-[#adc6ff] ring-1 ring-[#adc6ff]' : 'border-[#3d494c]/40 hover:border-[#adc6ff]/60'
            }`}
          >
            <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-[#0566d9]"></div>
            <div className="flex items-start justify-between gap-2 pl-2">
              <div className="flex flex-col">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#adc6ff] uppercase font-bold tracking-wider">
                  ПРЕДУПРЕЖДЕНИЕ #03
                </span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-sm sm:text-base font-bold text-[#dae2fd] mt-0.5">
                  Публикация персональных данных
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#adc6ff] font-['JetBrains_Mono'] text-[11px] font-bold shrink-0">
                ст. 79 КоАП РК
              </span>
            </div>

            <div className="pl-2 flex flex-col gap-2.5">
              <div className="bg-[#060e20] p-3 rounded-lg flex flex-col gap-1 border border-[#3d494c]/30 text-xs">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase">Фактическое основание:</span>
                <p className="text-[#bcc9cd] font-['Inter'] leading-relaxed">
                  На графическом макете размещен контактный сотовый номер физлица (+7 701 420-**-**) без предварительного
                  согласия на публичное размещение.
                </p>
              </div>

              <div className="flex items-center justify-between bg-[#171f33] p-2 rounded border border-[#3d494c]/30 text-xs">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">ПОТЕНЦИАЛЬНЫЙ ШТРАФ:</span>
                <span className="font-['JetBrains_Mono'] text-xs text-[#adc6ff] font-bold">
                  от 30 до 100 МРП (117 960 — 393 200 ₸)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Plan: Remediation Protocol */}
      <div className="w-full rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-6 flex flex-col gap-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#4cd7f6] text-[22px]">assignment_turned_in</span>
            <h2 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#dae2fd]">
              Рекомендации и план действий по устранению замечаний
            </h2>
          </div>
          <span className="font-['JetBrains_Mono'] text-xs text-[#4edea3] flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#4edea3]"></span>
            Готово для контент-отдела и маркетинга
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className="rounded-lg bg-[#171f33] border border-[#3d494c]/30 p-4 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#ff6b6b]/30 leading-none">01</span>
                <span className="px-2 py-0.5 rounded bg-[#ff6b6b]/20 text-[#ff6b6b] font-['JetBrains_Mono'] text-[10px] font-bold">
                  СРОЧНО
                </span>
              </div>
              <h4 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#dae2fd] mt-1">
                Приостановить публикацию
              </h4>
              <p className="text-xs text-[#bcc9cd] font-['Inter']">
                Временно скрыть рекламный пост в канале и аудиоролик до внесения необходимых правок.
              </p>
            </div>
            <button
              onClick={() => alert('Чек-лист для контент-менеджера скопирован!')}
              className="w-full py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-['Plus_Jakarta_Sans'] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">pause_circle</span>
              Инструкция для команды
            </button>
          </div>

          {/* Step 2 */}
          <div className="rounded-lg bg-[#171f33] border border-[#3d494c]/30 p-4 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#4cd7f6]/30 leading-none">02</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#4cd7f6] font-['JetBrains_Mono'] text-[10px] font-bold">
                  МАРКИРОВКА
                </span>
              </div>
              <h4 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#dae2fd] mt-1">
                Добавить плашку «Жарнама» и дубль
              </h4>
              <p className="text-xs text-[#bcc9cd] font-['Inter']">
                Добавить обязательную отметку «Жарнамалық материал / Реклама», указать БИН/ИИН рекламодателя и добавить
                текст на государственном (казахском) языке (ст. 21 Закона о языках).
              </p>
            </div>
            <button
              onClick={() => alert('Шаблон маркировки скопирован в буфер!')}
              className="w-full py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] font-['Plus_Jakarta_Sans'] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">qr_code</span>
              Сгенерировать плашку «Жарнама»
            </button>
          </div>

          {/* Step 3 */}
          <div className="rounded-lg bg-[#171f33] border border-[#3d494c]/30 p-4 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#4edea3]/30 leading-none">03</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#4edea3] font-['JetBrains_Mono'] text-[10px] font-bold">
                  МОНТАЖ
                </span>
              </div>
              <h4 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#dae2fd] mt-1">
                Вырезать таймкод 00:14–00:24
              </h4>
              <p className="text-xs text-[#bcc9cd] font-['Inter']">
                Удалить резкое высказывание относительно конкурентов и замазать личный номер телефона на визуале.
              </p>
            </div>
            <button
              onClick={() => alert('Запрос на автоматическую обрезку аудиофайла подготовлен!')}
              className="w-full py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-['Plus_Jakarta_Sans'] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">content_cut</span>
              Скорректировать мастер-файл
            </button>
          </div>
        </div>
      </div>

      {/* Verification Summary Card */}
      <div className="rounded-xl bg-[#060e20] border border-[#3d494c]/50 p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#171f33] flex items-center justify-center text-[#4cd7f6] shrink-0 border border-[#4cd7f6]/30 shadow-[0_0_16px_rgba(76,215,246,0.2)]">
            <span className="material-symbols-outlined text-[28px]">verified</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#dae2fd]">
                Отчет сгенерирован системой Check Activity AI
              </span>
              <span className="px-2 py-0.5 rounded bg-[#1bbd85]/20 text-[#4edea3] font-['JetBrains_Mono'] text-[10px] font-bold border border-[#4edea3]/30">
                AI VERIFIED
              </span>
            </div>
            <p className="font-['JetBrains_Mono'] text-xs text-[#869397] mt-0.5 truncate max-w-xl">
              SHA-256 HASH: {auditCase.sha256}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={onOpenPdfModal}
            className="px-4 py-2 rounded-lg bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd] font-['Plus_Jakarta_Sans'] text-xs font-semibold flex items-center gap-2 border border-[#3d494c]/50 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px] text-[#4cd7f6]">picture_as_pdf</span>
            Открыть PDF-версию
          </button>
        </div>
      </div>
    </div>
  );
};
