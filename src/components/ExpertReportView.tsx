/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { AuditCase } from '../types';
import { PRIMARY_AUDIT_CASE } from '../data/mockData';
import { calculateRiskDistribution, ChartDatum } from '../utils/riskAnalytics';
import { analyzeEmojis } from '../utils/emojiIntelligence';

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
  const [chartMode, setChartMode] = useState<'donut' | 'bar'>('donut');
  const [activeRiskFilter, setActiveRiskFilter] = useState<string | null>(null);
  const [hoveredChartItem, setHoveredChartItem] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedExtracted, setCopiedExtracted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeVideoFrameIndex, setActiveVideoFrameIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const audioElementRef = React.useRef<HTMLAudioElement | null>(null);
  const videoPlayerRef = React.useRef<HTMLVideoElement | null>(null);

  const seekToTimestamp = (timestampStr: string) => {
    if (!timestampStr) return;
    const clean = timestampStr.replace(/[^0-9:]/g, '');
    const parts = clean.split(':').map((p) => parseFloat(p));
    let sec = 0;
    if (parts.length === 2) {
      sec = (parts[0] || 0) * 60 + (parts[1] || 0);
    } else if (parts.length === 3) {
      sec = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
    } else if (parts.length === 1) {
      sec = parts[0] || 0;
    }

    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = sec;
      videoPlayerRef.current.play().catch(() => {});
      videoPlayerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (audioElementRef.current) {
      audioElementRef.current.currentTime = sec;
      audioElementRef.current.play().catch(() => {});
      audioElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleCopyReport = () => {
    const findingsList =
      auditCase.mediaAnalysis?.findings && auditCase.mediaAnalysis.findings.length > 0
        ? auditCase.mediaAnalysis.findings
            .map(
              (f) =>
                `[${f.timestamp}] [${f.source}] ${f.category}\nЦитата/Описание: «${f.quote_or_description}»\nДостоверность: ${f.confidence} | Обоснование: ${f.reasoning}`
            )
            .join('\n\n')
        : auditCase.violations
            .map(
              (v, i) =>
                `${i + 1}. [${v.category === 'ethics' ? 'ЭТИКА' : 'ЗАКОН РК'}] ${v.title} (${v.code})\nЦитата: «${v.quote || '-'}»\nОбоснование: ${v.basis}\nШтраф/Регулятор: ${v.fineAmount || '-'} (${v.jurisdiction || '-'})\nРекомендация: ${v.recommendation || '-'}`
            )
            .join('\n\n');

    const reportText = [
      `═════════════════════════════════════════════════`,
      `ЭКСПЕРТНЫЙ ОТЧЁТ CHECK ACTIVITY KZ: ${auditCase.referenceNumber}`,
      `═════════════════════════════════════════════════`,
      `Объект: ${auditCase.title}`,
      `Дата и время: ${auditCase.timestamp}`,
      `Индекс риска: ${auditCase.riskScore}% (${auditCase.riskLevel})`,
      `Правовой комплаенс: ${auditCase.legalScore || 0}% | Интернет-этика: ${auditCase.ethicsScore || 0}%`,
      `Статус: ${auditCase.status}`,
      auditCase.mediaAnalysis?.language ? `Язык материала: ${auditCase.mediaAnalysis.language}` : '',
      auditCase.mediaAnalysis?.overall_risk ? `Общий уровень риска: ${auditCase.mediaAnalysis.overall_risk}` : '',
      `Резюме: ${auditCase.mediaAnalysis?.summary || auditCase.summary}`,
      ``,
      `ВЫЯВЛЕННЫЕ РИСКИ И НАРУШЕНИЯ:`,
      findingsList || 'Нарушений не выявлено. Материал соответствует нормам законодательства РК.',
      ``,
      auditCase.mediaAnalysis?.limitations ? `Ограничения анализа: ${auditCase.mediaAnalysis.limitations}` : '',
      `═════════════════════════════════════════════════`,
      `Результат предварительный, требуется проверка человеком.`,
      `═════════════════════════════════════════════════`,
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard?.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const isVideoCase =
    auditCase.sourceType === 'video' ||
    Boolean(auditCase.videoDataUrl) ||
    Boolean(auditCase.videoUrl) ||
    (Array.isArray(auditCase.videoFrames) && auditCase.videoFrames.length > 0);

  // Auto-cycle video frames if playback is enabled
  React.useEffect(() => {
    if (!isVideoPlaying || !auditCase.videoFrames || auditCase.videoFrames.length <= 1) return;
    const interval = setInterval(() => {
      setActiveVideoFrameIndex((prev) => (prev + 1) % auditCase.videoFrames!.length);
    }, 1200);
    return () => clearInterval(interval);
  }, [isVideoPlaying, auditCase.videoFrames]);

  const isAudioCase =
    auditCase.sourceType === 'audio' ||
    Boolean(auditCase.transcript && auditCase.transcript.length > 0) ||
    Boolean(auditCase.audioDataUrl);

  const togglePlayAudio = () => {
    if (!audioElementRef.current) return;
    if (isPlayingAudio) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioElementRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => setIsPlayingAudio(false));
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const riskAnalytics = calculateRiskDistribution(auditCase.violations);

  const legalViolations = auditCase.violations.filter((v) => v.category === 'legal');
  const ethicsViolations = auditCase.violations.filter((v) => v.category === 'ethics');

  const filteredByRisk = activeRiskFilter
    ? auditCase.violations.filter((v) => {
        const text = `${v.code} ${v.title} ${v.basis} ${v.quote || ''}`.toLowerCase();
        if (activeRiskFilter === 'cyberbullying') {
          return /73-4|131|434|115|кибербуллинг|буллинг|травл|оскорблен|унижен|маты|ненормативн|обсценн|хулиганств|токсичн|агресс|угроз/i.test(text);
        }
        if (activeRiskFilter === 'privacy') {
          return /79|94-v|персональн|пдн|номер телефон|сотов|иин|паспорт|удостоверен|утечк|слив|конфиденциальн/i.test(text);
        }
        if (activeRiskFilter === 'hidden_ad') {
          return /230-vii|230|455|маркировк|жарнама|реклам|скрытая реклама|спонсор|бин|инфлюенс|двуязычи|ст\. 21/i.test(text);
        }
        if (activeRiskFilter === 'casino') {
          return /445-1|казино|casino|1win|1xbet|слот|букмекер|ставк|рулетк|фриспин|азартн/i.test(text);
        }
        if (activeRiskFilter === 'dark_pattern') {
          return /dark pattern|манипуляц|fomo|дефицит|таймер|гарантир|обман|ложный|давлен/i.test(text);
        }
        return true;
      })
    : auditCase.violations;

  const displayedViolations =
    selectedFilter === 'all'
      ? filteredByRisk
      : selectedFilter === 'legal'
      ? filteredByRisk.filter((v) => v.category === 'legal')
      : filteredByRisk.filter((v) => v.category === 'ethics');

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDatum;
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs font-['Inter'] max-w-[270px] pointer-events-none z-50">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: data.color }}
            />
            <span className="font-bold font-['Plus_Jakarta_Sans'] text-slate-100">
              {data.name}
            </span>
          </div>
          <div className="font-['JetBrains_Mono'] text-[11px] text-slate-400 mb-2">
            {data.article}
          </div>
          <div className="flex items-center justify-between border-t border-slate-800 pt-1.5 text-[11px]">
            <span className="text-slate-400">Доля риска в кейсе:</span>
            <span className="font-bold text-amber-400 font-mono text-xs">{data.value}%</span>
          </div>
          {data.count > 0 && (
            <div className="flex items-center justify-between text-[11px] mt-1">
              <span className="text-slate-400">Зафиксировано пунктов:</span>
              <span className="font-semibold text-slate-200">{data.count} шт.</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const isClean = auditCase.violations.length === 0;
  const extractedContent = auditCase.extractedText || auditCase.rawText;
  const hasProfanityInExtracted =
    Boolean(extractedContent &&
    /блят|бля\b|ху[йияеё]|пизд|еб[аатьу]|ёб|сук[аи]|наху|муда|гондон|пидор|шешен|сиктир|көт/i.test(
      extractedContent
    ));

  const emojiReport =
    auditCase.emojiAnalysis ||
    analyzeEmojis(
      `${extractedContent || ''} ${auditCase.rawText || ''} ${auditCase.title || ''}`
    );

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
            onClick={handleCopyReport}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 sm:gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm shadow-xs transition-colors"
            title="Скопировать структурированный экспертный отчёт"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copiedReport ? 'check' : 'content_copy'}
            </span>
            <span>{copiedReport ? 'Отчёт скопирован!' : 'Скопировать отчёт'}</span>
          </button>

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

      {/* Recharts Analytics: Risk Distribution Breakdown (% Ratio) */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col gap-4">
        {/* Analytics Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="material-symbols-outlined text-sky-600 text-[20px]">
                pie_chart
              </span>
              <h2 className="font-['Plus_Jakarta_Sans'] text-sm sm:text-base font-bold text-slate-900">
                Диаграмма распределения выявленных рисков
              </h2>
              <span className="text-[10px] font-['JetBrains_Mono'] font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
                Recharts Analytics
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Процентное соотношение ключевых категорий: кибербуллинг, нарушение ПДн, скрытая реклама и недобросовестный маркетинг
            </p>
          </div>

          {/* Controls: Chart Mode Switcher & Filter Reset */}
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {activeRiskFilter && (
              <button
                type="button"
                onClick={() => setActiveRiskFilter(null)}
                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-1"
                title="Сбросить фильтр по риску"
              >
                <span className="material-symbols-outlined text-[14px]">filter_alt_off</span>
                <span>Сбросить выбор</span>
              </button>
            )}

            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setChartMode('donut')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  chartMode === 'donut'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Круговая диаграмма (Donut)"
              >
                <span className="material-symbols-outlined text-[15px]">donut_large</span>
                <span>Круговая</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('bar')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  chartMode === 'bar'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Гистограмма рисков"
              >
                <span className="material-symbols-outlined text-[15px]">bar_chart</span>
                <span>Гистограмма</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content: Chart + Category Breakdown Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Left Chart Viewport (5 cols) */}
          <div className="lg:col-span-5 relative flex flex-col items-center justify-center p-2 sm:p-3 bg-slate-50/70 rounded-xl border border-slate-200">
            <div className="w-full h-[240px] sm:h-[260px] relative">
              {chartMode === 'donut' ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Pie
                        data={riskAnalytics.activeChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={66}
                        outerRadius={96}
                        paddingAngle={riskAnalytics.activeChartData.length > 1 ? 3 : 0}
                        cornerRadius={5}
                        dataKey="value"
                        nameKey="name"
                        stroke="#ffffff"
                        strokeWidth={2}
                        animationDuration={800}
                        onMouseEnter={(_, index) => {
                          setHoveredChartItem(riskAnalytics.activeChartData[index]?.id || null);
                        }}
                        onMouseLeave={() => setHoveredChartItem(null)}
                        onClick={(entry: any) => {
                          const item = entry?.payload || entry;
                          if (item && item.id && item.id !== 'clean') {
                            const targetId = String(item.id);
                            setActiveRiskFilter((prev) => (prev === targetId ? null : targetId));
                          }
                        }}
                        cursor="pointer"
                      >
                        {riskAnalytics.activeChartData.map((entry) => (
                          <Cell
                            key={`cell-${entry.id}`}
                            fill={entry.color}
                            opacity={hoveredChartItem && hoveredChartItem !== entry.id ? 0.5 : 1}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered HUD Metric */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-slate-900 leading-none">
                      {isClean ? '0%' : `${auditCase.riskScore}%`}
                    </span>
                    <span className="text-[10px] font-['JetBrains_Mono'] font-semibold text-slate-500 uppercase mt-1">
                      {isClean ? 'Безопасно' : 'Индекс риска'}
                    </span>
                    <span className="text-[9px] text-slate-400 mt-0.5">
                      {isClean ? 'Нарушений нет' : `${auditCase.violations.length} замечаний`}
                    </span>
                  </div>
                </>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={riskAnalytics.activeChartData}
                    layout="vertical"
                    margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fontSize: 10, fill: '#64748B', fontFamily: 'JetBrains Mono' }}
                      axisLine={{ stroke: '#CBD5E1' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      tick={{ fontSize: 11, fill: '#1E293B', fontWeight: 600 }}
                      width={110}
                      axisLine={{ stroke: '#CBD5E1' }}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="value"
                      radius={[0, 6, 6, 0]}
                      animationDuration={800}
                      onClick={(entry: any) => {
                        const item = entry?.payload || entry;
                        if (item && item.id && item.id !== 'clean') {
                          const targetId = String(item.id);
                          setActiveRiskFilter((prev) => (prev === targetId ? null : targetId));
                        }
                      }}
                      cursor="pointer"
                    >
                      {riskAnalytics.activeChartData.map((entry) => (
                        <Cell
                          key={`bar-${entry.id}`}
                          fill={entry.color}
                          opacity={hoveredChartItem && hoveredChartItem !== entry.id ? 0.5 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="text-[11px] text-slate-500 text-center font-['JetBrains_Mono'] mt-1">
              {riskAnalytics.isClean
                ? '✓ 100% Соответствие законодательству РК и нормам сетевой этики'
                : 'Кликните на сектор диаграммы или карточку справа для быстрой фильтрации'}
            </div>
          </div>

          {/* Right Category Cards Ledger (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-2">
            {/* Dominant Risk Notification Pill if violations detected */}
            {riskAnalytics.dominantRisk && (
              <div className="px-3 py-2 rounded-lg bg-amber-50/80 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0">
                    priority_high
                  </span>
                  <span className="truncate">
                    Доминирующий риск:{' '}
                    <strong>{riskAnalytics.dominantRisk.name}</strong> ({riskAnalytics.dominantRisk.percentage}%)
                  </span>
                </div>
                <span className="font-['JetBrains_Mono'] text-[10px] text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-200 shrink-0">
                  {riskAnalytics.dominantRisk.article}
                </span>
              </div>
            )}

            {/* Grid of Core Categories: Кибербуллинг, Нарушение ПДн, Скрытая реклама + Казино & Dark Patterns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {riskAnalytics.coreCategories.map((cat) => {
                const isSelected = activeRiskFilter === cat.id;
                const isDetected = cat.count > 0;

                return (
                  <div
                    key={cat.id}
                    onClick={() => {
                      if (isDetected) {
                        setActiveRiskFilter((prev) => (prev === cat.id ? null : cat.id));
                      }
                    }}
                    onMouseEnter={() => setHoveredChartItem(cat.id)}
                    onMouseLeave={() => setHoveredChartItem(null)}
                    className={`p-2.5 sm:p-3 rounded-xl border transition-all select-none ${
                      isDetected ? 'cursor-pointer' : 'opacity-70 cursor-default'
                    } ${
                      isSelected
                        ? 'ring-2 ring-sky-500 shadow-sm bg-white'
                        : isDetected
                        ? 'bg-white hover:border-slate-300 hover:shadow-xs'
                        : 'bg-slate-50/60 border-slate-200'
                    }`}
                    style={{
                      borderColor: isSelected ? cat.color : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: cat.lightColor,
                            color: cat.color,
                          }}
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {cat.icon}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate leading-tight">
                            {cat.name}
                          </h4>
                          <div className="text-[10px] font-['JetBrains_Mono'] text-slate-500 truncate mt-0.5">
                            {cat.article}
                          </div>
                        </div>
                      </div>

                      {/* Percentage Badge */}
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-bold font-['JetBrains_Mono'] shrink-0"
                        style={{
                          backgroundColor: isDetected ? cat.lightColor : '#F1F5F9',
                          color: isDetected ? cat.color : '#64748B',
                        }}
                      >
                        {cat.percentage}%
                      </span>
                    </div>

                    {/* Visual Percentage Progress Bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>

                    {/* Footer count & interaction label */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 pt-1 border-t border-slate-100">
                      <span>
                        {isDetected
                          ? `${cat.count} замечаний (${cat.weight} вес)`
                          : 'Риск не выявлен'}
                      </span>
                      {isDetected ? (
                        <span
                          className="font-semibold font-mono"
                          style={{ color: cat.color }}
                        >
                          {isSelected ? '✓ Выбрано' : 'Фильтровать'}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-medium font-mono">
                          ✓ Чисто
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
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
            <div className="relative min-h-[280px] sm:min-h-[340px] max-h-[560px] bg-slate-100 flex flex-col justify-between p-3 sm:p-4 overflow-y-auto">
              {isVideoCase ? (
                <div className="w-full flex flex-col gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  {/* Video Header & Meta */}
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900 text-white">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                        className="w-9 h-9 rounded-lg bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95"
                        title={isVideoPlaying ? 'Остановить воспроизведение' : 'Автопросмотр кадров'}
                      >
                        <span className="material-symbols-outlined text-[22px]">
                          {isVideoPlaying ? 'pause' : 'play_arrow'}
                        </span>
                      </button>
                      <div className="min-w-0">
                        <div className="font-['Plus_Jakarta_Sans'] font-bold text-xs text-slate-100 truncate">
                          {auditCase.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mt-0.5">
                          <span className="text-sky-300 font-semibold">{auditCase.videoDuration || '00:15'}</span>
                          <span>•</span>
                          <span>{auditCase.videoFrames?.length || 4} ключевых кадров</span>
                          <span>•</span>
                          <span className="text-emerald-400">9:16 Reels / Shorts</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                        className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-colors flex items-center gap-1 ${
                          isVideoPlaying
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {isVideoPlaying ? 'sync' : 'slideshow'}
                        </span>
                        <span>{isVideoPlaying ? 'Цикл...' : 'По кадрам'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Keyframe Display or Real HTML5 Video Player */}
                  <div className="relative w-full flex items-center justify-center bg-slate-950 rounded-xl overflow-hidden min-h-[220px] max-h-[360px]">
                    {auditCase.videoDataUrl || auditCase.videoUrl ? (
                      <video
                        ref={videoPlayerRef}
                        src={auditCase.videoDataUrl || auditCase.videoUrl}
                        controls
                        playsInline
                        className="w-full h-full max-h-[350px] object-contain rounded-lg"
                      />
                    ) : auditCase.videoFrames && auditCase.videoFrames[activeVideoFrameIndex] ? (
                      <img
                        src={
                          typeof auditCase.videoFrames[activeVideoFrameIndex] === 'string'
                            ? (auditCase.videoFrames[activeVideoFrameIndex] as string)
                            : (auditCase.videoFrames[activeVideoFrameIndex] as any)?.frameDataUrl || auditCase.previewUrl
                        }
                        alt={`Кадр ${activeVideoFrameIndex + 1}`}
                        className="max-h-[300px] w-auto max-w-full object-contain rounded-lg"
                      />
                    ) : auditCase.previewUrl ? (
                      <img
                        src={auditCase.previewUrl}
                        alt={auditCase.title}
                        className="max-h-[300px] w-auto max-w-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="p-8 text-center text-slate-400 text-xs">Кадры видео загружены</div>
                    )}

                    {!auditCase.videoDataUrl && !auditCase.videoUrl && (
                      <>
                        {/* Frame Timecode badge */}
                        <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                          <span>00:0{(activeVideoFrameIndex * 3) + 1}.2</span>
                        </div>

                        {/* Frame Index badge */}
                        <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-xs text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">
                          {activeVideoFrameIndex + 1} / {auditCase.videoFrames?.length || 1}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Keyframe Filmstrip Carousel */}
                  {Array.isArray(auditCase.videoFrames) && auditCase.videoFrames.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase">
                        <span>Кинопленка ключевых кадров (Keyframe Filmstrip):</span>
                        <span>Кликните для перехода по времени</span>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                        {auditCase.videoFrames.map((frame, fIdx) => {
                          const frameSrc = typeof frame === 'string' ? frame : (frame as any)?.frameDataUrl;
                          const frameTime = `00:0${(fIdx * 3) + 1}.2`;
                          return (
                            <button
                              key={fIdx}
                              type="button"
                              onClick={() => {
                                setActiveVideoFrameIndex(fIdx);
                                setIsVideoPlaying(false);
                                if (videoPlayerRef.current) {
                                  videoPlayerRef.current.currentTime = (fIdx * 3) + 1;
                                }
                              }}
                              className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-all p-0.5 ${
                                activeVideoFrameIndex === fIdx
                                  ? 'border-sky-500 ring-2 ring-sky-200 scale-102 shadow-sm'
                                  : 'border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={frameSrc}
                                alt={`Кадр ${fIdx + 1}`}
                                className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded"
                              />
                              <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] text-white font-mono px-1 rounded">
                                {frameTime}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Video Forensic Metadata */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">Распознавание</span>
                      <span className="font-bold font-mono text-sky-700">Multi-Frame OCR</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">Формат</span>
                      <span className="font-bold text-slate-900">Reels / Shorts (9:16)</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">Статус анализа</span>
                      <span className={`font-bold ${auditCase.riskScore >= 60 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {auditCase.riskScore >= 70 ? 'Выявлены риски' : auditCase.riskScore >= 30 ? 'Предупреждение' : 'Безопасно'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : isAudioCase ? (
                <div className="w-full flex flex-col gap-3.5 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                  {/* Hidden audio element */}
                  <audio
                    ref={audioElementRef}
                    src={auditCase.audioDataUrl || undefined}
                    onEnded={() => setIsPlayingAudio(false)}
                  />

                  {/* Audio Header & Playback Controller */}
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 text-white shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={togglePlayAudio}
                        className="w-11 h-11 rounded-xl bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95"
                      >
                        <span className="material-symbols-outlined text-[28px]">
                          {isPlayingAudio ? 'pause' : 'play_arrow'}
                        </span>
                      </button>
                      <div className="min-w-0">
                        <div className="font-['Plus_Jakarta_Sans'] font-bold text-xs sm:text-sm text-slate-100 truncate">
                          {auditCase.title}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 mt-0.5">
                          <span>{auditCase.audioDuration || auditCase.metadata.duration || '00:28'}</span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">Аудиопоток зафиксирован</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800">
                        {auditCase.metadata.platform || 'Аудио-экспертиза KZ'}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Waveform Visualizer */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center gap-1 h-10">
                    {[12, 28, 45, 80, 95, 60, 35, 90, 100, 75, 48, 85, 30, 65, 90, 70, 42, 80, 68, 35, 52, 78, 40, 18, 55, 88, 92, 44, 25, 70].map((bar, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-200 ${
                          isPlayingAudio ? 'bg-sky-500 animate-pulse' : 'bg-slate-300'
                        }`}
                        style={{ height: `${bar}%` }}
                      />
                    ))}
                  </div>

                  {/* Acoustic Quality Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">Четкость речи</span>
                      <span className="font-bold font-mono text-slate-900">{auditCase.audioVoiceClarity || 98.4}%</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">Языки</span>
                      <span className="font-bold text-slate-900">RU / KZ</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block uppercase font-mono">Тональность</span>
                      <span className={`font-bold ${auditCase.riskScore >= 60 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {auditCase.riskScore >= 70 ? 'Агрессия/Токсично' : auditCase.riskScore >= 40 ? 'Повышенный риск' : 'Нейтральная'}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Transcript Timeline with Flagged Highlights */}
                  {Array.isArray(auditCase.transcript) && auditCase.transcript.length > 0 && (
                    <div className="mt-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 font-['JetBrains_Mono'] uppercase mb-2">
                        <span className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-sky-600">graphic_eq</span>
                          Стенограмма аудиозаписи (Таймкоды):
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {auditCase.transcript.length} фрагмент(а)
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                        {auditCase.transcript.map((line, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              if (line.flagged) {
                                const matchingV = auditCase.violations[0]?.id;
                                if (matchingV) setActiveBbox(matchingV);
                              }
                            }}
                            className={`p-2.5 rounded-lg border text-xs leading-relaxed transition-all cursor-pointer ${
                              line.flagged
                                ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-200 hover:bg-rose-100/60'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-['JetBrains_Mono'] font-bold text-[10px] text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded">
                                  {line.time}
                                </span>
                                <span className="font-semibold text-slate-800 text-[11px]">
                                  {line.speaker || 'Спикер'}
                                </span>
                              </div>
                              {line.flagged && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-rose-600 text-white">
                                  {line.article || 'НАРУШЕНИЕ'}
                                </span>
                              )}
                            </div>
                            <p className="text-slate-800 font-mono text-xs">
                              {line.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : auditCase.previewUrl ? (
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

            {/* Extracted Text (OCR / Web Scraper) */}
            {extractedContent && (
              <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-sky-600">document_scanner</span>
                    <span className="text-xs font-bold uppercase font-['JetBrains_Mono'] text-slate-800">
                      Извлеченный текст (OCR / Парсинг)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasProfanityInExtracted && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-red-100 text-red-800 border border-red-200">
                        ОБНАРУЖЕНЫ МАТЫ
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(extractedContent);
                        setCopiedExtracted(true);
                        setTimeout(() => setCopiedExtracted(false), 2000);
                      }}
                      className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {copiedExtracted ? 'done' : 'content_copy'}
                      </span>
                      <span>{copiedExtracted ? 'Скопировано' : 'Копировать'}</span>
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 font-['Inter'] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap select-text">
                  {extractedContent}
                </div>
              </div>
            )}

            {/* Detected Actions and Visual Context */}
            {auditCase.detectedActions && (
              <div className="p-3 sm:p-4 bg-sky-50/40 border-t border-slate-200">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="material-symbols-outlined text-[16px] text-sky-700">visibility</span>
                  <span className="text-xs font-bold uppercase font-['JetBrains_Mono'] text-sky-900">
                    Распознанные действия и контекст
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed font-['Inter']">
                  {auditCase.detectedActions}
                </p>
              </div>
            )}

            {/* Emoji Intelligence Card */}
            <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200">
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base">🎯</span>
                  <span className="text-xs font-bold uppercase font-['JetBrains_Mono'] text-slate-800 truncate">
                    Анализ эмодзи и скрытых символов (Emoji Intelligence)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {emojiReport.flaggedEmojis.length > 0 ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-red-100 text-red-800 border border-red-200">
                      РИСК: +{emojiReport.totalRiskPoints} БАЛЛОВ
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800 border border-emerald-200">
                      СИМВОЛЫ БЕЗОПАСНЫ
                    </span>
                  )}
                </div>
              </div>

              {/* Emoji Chips Ribbon */}
              {emojiReport.detectedEmojis.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-mono text-slate-500 mr-1">
                      Зафиксировано ({emojiReport.detectedEmojis.length}):
                    </span>
                    {emojiReport.detectedEmojis.map((emoji, idx) => {
                      const isFlagged = emojiReport.flaggedEmojis.some((f) => f.emoji === emoji);
                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center justify-center text-lg w-8 h-8 rounded-md transition-transform ${
                            isFlagged
                              ? 'bg-rose-100 ring-2 ring-rose-400 scale-105 shadow-xs'
                              : 'bg-white border border-slate-200'
                          }`}
                          title={isFlagged ? 'Выявлен скрытый триггер' : 'Нейтральный эмодзи'}
                        >
                          {emoji}
                        </span>
                      );
                    })}
                  </div>

                  {/* Flagged Explanations Ledger */}
                  {emojiReport.flaggedEmojis.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {emojiReport.flaggedEmojis.map((item, fIdx) => (
                        <div
                          key={fIdx}
                          className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                            item.riskLevel === 'critical'
                              ? 'bg-red-50/70 border-red-200 text-red-950'
                              : 'bg-amber-50/70 border-amber-200 text-amber-950'
                          }`}
                        >
                          <span className="text-2xl shrink-0 leading-none mt-0.5">{item.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 mb-0.5 flex-wrap">
                              <span className="font-bold font-['Plus_Jakarta_Sans'] text-slate-900 text-xs">
                                {item.label}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${
                                  item.category === 'gambling'
                                    ? 'bg-red-100 text-red-700'
                                    : item.category === 'profanity_insult'
                                    ? 'bg-purple-100 text-purple-700'
                                    : item.category === 'sexual'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {item.category === 'gambling'
                                  ? 'Казино / Слоты (ст. 445-1)'
                                  : item.category === 'profanity_insult'
                                  ? 'Мат / Буллинг (ст. 434)'
                                  : item.category === 'sexual'
                                  ? '18+ Контент (ст. 133-1)'
                                  : 'Dark Pattern / FOMO'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-700 leading-relaxed font-['Inter']">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                      ✓ Проверка символов завершена. Все обнаруженные эмодзи соответствуют нормам сетевого этикета и не содержат скрытых ссылок на азартные игры, ненормативную лексику или манипулятивные триггеры.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                  В анализируемом контенте эмодзи и пиктограммы не обнаружены.
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
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="font-['Plus_Jakarta_Sans'] text-base sm:text-lg font-bold text-slate-900">
                Выявленные замечания ({displayedViolations.length}{activeRiskFilter ? ` из ${auditCase.violations.length}` : ''})
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

            {/* Active Risk Category Filter Indicator */}
            {activeRiskFilter && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="material-symbols-outlined text-[16px] text-sky-700">filter_alt</span>
                  <span className="truncate">
                    Фильтр по диаграмме:{' '}
                    <strong>
                      {riskAnalytics.coreCategories.find((c) => c.id === activeRiskFilter)?.name ||
                        activeRiskFilter}
                    </strong>{' '}
                    ({displayedViolations.length} замечаний)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRiskFilter(null)}
                  className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 underline shrink-0 ml-2"
                >
                  Сбросить фильтр
                </button>
              </div>
            )}
          </div>

          {/* Media Analysis Result Card (JSON Schema Presentation) */}
          {auditCase.mediaAnalysis && (
            <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-sky-600">
                    query_stats
                  </span>
                  <span className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-slate-900">
                    Анализ аудио/видеоматериала (AI Check)
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    Язык: <strong className="text-slate-900 capitalize">{auditCase.mediaAnalysis.language}</strong>
                  </span>
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                      auditCase.mediaAnalysis.overall_risk === 'высокий'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : auditCase.mediaAnalysis.overall_risk === 'средний'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : auditCase.mediaAnalysis.overall_risk === 'низкий'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    Риск: {auditCase.mediaAnalysis.overall_risk.toUpperCase()}
                  </span>
                  {auditCase.mediaAnalysis.needs_human_review && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                      Верификация оператором
                    </span>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <strong className="text-slate-900">Сводка материала:</strong> {auditCase.mediaAnalysis.summary}
              </div>

              {/* Findings with Clickable Timestamps */}
              {Array.isArray(auditCase.mediaAnalysis.findings) && auditCase.mediaAnalysis.findings.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-mono font-semibold uppercase text-slate-500">
                    <span>Зафиксированные факты ({auditCase.mediaAnalysis.findings.length}):</span>
                    <span>Кликните на таймкод для перемотки</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {auditCase.mediaAnalysis.findings.map((f, fIdx) => (
                      <div
                        key={fIdx}
                        className="p-2.5 sm:p-3 rounded-lg border border-slate-200 hover:border-sky-300 bg-white transition-all flex flex-col gap-1.5 shadow-2xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => seekToTimestamp(f.timestamp)}
                              className="px-2 py-0.5 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[11px] font-mono font-bold flex items-center gap-1 transition-colors"
                              title="Перемотать плеер на этот таймкод"
                            >
                              <span className="material-symbols-outlined text-[13px]">play_arrow</span>
                              <span>{f.timestamp}</span>
                            </button>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                              {f.source}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                                f.confidence === 'высокая'
                                  ? 'text-rose-700 bg-rose-50'
                                  : 'text-amber-700 bg-amber-50'
                              }`}
                            >
                              {f.confidence} точность
                            </span>
                          </div>
                          <span className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-slate-900">
                            {f.category}
                          </span>
                        </div>

                        <div className="text-xs text-slate-800 bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                          «{f.quote_or_description}»
                        </div>

                        <div className="text-xs text-slate-600 leading-snug">
                          <strong className="text-slate-800">Обоснование:</strong> {f.reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
                  <span>Признаков нарушений в аудио- и видеоряде не обнаружено.</span>
                </div>
              )}

              {/* Limitations */}
              {auditCase.mediaAnalysis.limitations && (
                <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-start gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-slate-400 shrink-0 mt-0.5">
                    info
                  </span>
                  <span>
                    <strong>Ограничения AI:</strong> {auditCase.mediaAnalysis.limitations}
                  </span>
                </div>
              )}
            </div>
          )}

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

                    {v.quote && (
                      <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200 text-xs text-amber-950 font-['Inter'] flex items-start gap-2">
                        <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">
                          format_quote
                        </span>
                        <div className="min-w-0">
                          <div className="font-semibold text-amber-900 text-[10px] uppercase tracking-wide font-['JetBrains_Mono']">
                            Зафиксированная цитата / Доказательство:
                          </div>
                          <div className="font-medium text-slate-900 mt-0.5 italic break-words">
                            «{v.quote}»
                          </div>
                        </div>
                      </div>
                    )}

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

      {/* Mandatory Regulatory & Legal Bottom Notice */}
      <div className="w-full text-center pt-6 pb-2 border-t border-slate-200 mt-2">
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs sm:text-sm font-semibold shadow-xs">
          <span className="material-symbols-outlined text-[20px] text-amber-700 shrink-0">gavel</span>
          <span>Результат предварительный, требуется проверка человеком.</span>
        </div>
      </div>
    </div>
  );
};
