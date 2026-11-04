/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { AuditCase, ModalityType } from '../types';
import { CURRENT_MRP_TENGE, MOCK_AUDIT_HISTORY } from '../data/mockData';

interface DashboardViewProps {
  userHistory?: AuditCase[];
  onOpenReport: (auditCase: AuditCase) => void;
  onNavigateToScanner: (preset?: { modality: ModalityType; urlOrText: string }) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userHistory = [],
  onOpenReport,
  onNavigateToScanner,
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'video' | 'audio' | 'screenshot' | 'url'>('all');

  // Combine user audits with historical cases
  const allCases = useMemo(() => {
    return [
      ...userHistory,
      ...MOCK_AUDIT_HISTORY.filter((m) => !userHistory.some((u) => u.id === m.id)),
    ];
  }, [userHistory]);

  // Filtered cases by selected content type
  const displayedCases = useMemo(() => {
    if (selectedTypeFilter === 'all') return allCases;
    return allCases.filter((c) => c.sourceType === selectedTypeFilter);
  }, [allCases, selectedTypeFilter]);

  // Aggregate stats across content types
  const stats = useMemo(() => {
    let totalAudits = allCases.length;
    let videoCount = allCases.filter((c) => c.sourceType === 'video').length;
    let audioCount = allCases.filter((c) => c.sourceType === 'audio').length;
    let screenshotCount = allCases.filter((c) => c.sourceType === 'screenshot').length;
    let urlCount = allCases.filter((c) => c.sourceType === 'url').length;

    let totalViolations = 0;
    let totalFineTenge = 0;
    let criticalCount = 0;
    let safeCount = 0;

    let videoViolations = 0;
    let audioViolations = 0;
    let screenshotViolations = 0;
    let urlViolations = 0;

    allCases.forEach((c) => {
      const vCount = c.violations.length;
      totalViolations += vCount;

      if (c.sourceType === 'video') videoViolations += vCount;
      else if (c.sourceType === 'audio') audioViolations += vCount;
      else if (c.sourceType === 'screenshot') screenshotViolations += vCount;
      else urlViolations += vCount;

      if (c.status === 'БЕЗОПАСНО' || vCount === 0) {
        safeCount++;
      } else if (c.status === 'ТРЕБУЕТ МЕР' || c.status === 'БЛОКИРОВКА') {
        criticalCount++;
      }

      // Estimate total prevented fine in KZT
      c.violations.forEach((v) => {
        if (v.code.includes('445-1')) {
          totalFineTenge += 1000 * CURRENT_MRP_TENGE; // до 1000 МРП за казино
        } else if (v.code.includes('455')) {
          totalFineTenge += 100 * CURRENT_MRP_TENGE; // 100 МРП за рекламу
        } else if (v.code.includes('434')) {
          totalFineTenge += 5 * CURRENT_MRP_TENGE; // 5 МРП за нецензурную брань
        } else if (v.code.includes('79')) {
          totalFineTenge += 50 * CURRENT_MRP_TENGE; // 50 МРП за ПДн
        } else {
          totalFineTenge += 20 * CURRENT_MRP_TENGE;
        }
      });
    });

    const complianceRate = totalAudits > 0 ? Math.round((safeCount / totalAudits) * 100) : 100;

    return {
      totalAudits,
      videoCount,
      audioCount,
      screenshotCount,
      urlCount,
      totalViolations,
      totalFineTenge,
      criticalCount,
      safeCount,
      complianceRate,
      videoViolations,
      audioViolations,
      screenshotViolations,
      urlViolations,
    };
  }, [allCases]);

  // Dynamics time-series data for recharts AreaChart
  const dynamicsData = useMemo(() => {
    if (timeRange === '7d') {
      return [
        { period: 'Пн', video: 2, audio: 1, screenshot: 4, url: 3, total: 10 },
        { period: 'Вт', video: 3, audio: 2, screenshot: 3, url: 2, total: 10 },
        { period: 'Ср', video: 1, audio: 0, screenshot: 5, url: 4, total: 10 },
        { period: 'Чт', video: 4, audio: 3, screenshot: 6, url: 3, total: 16 },
        { period: 'Пт', video: 5, audio: 2, screenshot: 7, url: 5, total: 19 },
        { period: 'Сб', video: 6, audio: 4, screenshot: 5, url: 4, total: 19 },
        { period: 'Вс (Сегодня)', video: 4, audio: 2, screenshot: 6, url: 3, total: 15 },
      ];
    } else if (timeRange === '30d') {
      return [
        { period: 'Неделя 1', video: 12, audio: 8, screenshot: 24, url: 15, total: 59 },
        { period: 'Неделя 2', video: 18, audio: 11, screenshot: 32, url: 21, total: 82 },
        { period: 'Неделя 3', video: 25, audio: 14, screenshot: 29, url: 19, total: 87 },
        { period: 'Неделя 4 (Тек.)', video: 22, audio: 15, screenshot: 38, url: 24, total: 99 },
      ];
    } else {
      return [
        { period: 'Авг', video: 35, audio: 22, screenshot: 65, url: 48, total: 170 },
        { period: 'Сен', video: 52, audio: 34, screenshot: 88, url: 62, total: 236 },
        { period: 'Окт', video: 74, audio: 48, screenshot: 112, url: 79, total: 313 },
        { period: 'Ноя (Тек.)', video: 68, audio: 41, screenshot: 95, url: 71, total: 275 },
      ];
    }
  }, [timeRange]);

  // Breakdown of violations by legal category and content type (recharts BarChart)
  const categoryByContentTypeData = useMemo(() => {
    return [
      {
        category: 'Реклама без маркировки (№230-VII)',
        video: 18,
        audio: 4,
        screenshot: 24,
        url: 12,
      },
      {
        category: 'Казино и ставки (ст. 445-1)',
        video: 14,
        audio: 2,
        screenshot: 28,
        url: 16,
      },
      {
        category: 'Мат и буллинг (ст. 434, 73-4)',
        video: 9,
        audio: 15,
        screenshot: 18,
        url: 8,
      },
      {
        category: 'Dark Patterns & Этичность',
        video: 11,
        audio: 6,
        screenshot: 14,
        url: 10,
      },
      {
        category: 'Персональные данные (ст. 79)',
        video: 3,
        audio: 1,
        screenshot: 12,
        url: 4,
      },
    ];
  }, []);

  // Risk distribution for Donut/PieChart
  const riskDistributionData = useMemo(() => {
    return [
      { name: 'Критический (ст. 445-1, казино)', value: 38, color: '#ef4444' },
      { name: 'Высокий (Закон № 230-VII, реклама)', value: 32, color: '#f97316' },
      { name: 'Предупреждение (этика, сленг)', value: 20, color: '#eab308' },
      { name: 'Безопасно (соответствует)', value: 10, color: '#10b981' },
    ];
  }, []);

  // Language breakdown of audited media
  const languageData = useMemo(() => {
    return [
      { name: 'Русский язык', value: 48, color: '#0284c7' },
      { name: 'Казахский язык', value: 34, color: '#0d9488' },
      { name: 'Смешанный (Билингв)', value: 18, color: '#6366f1' },
    ];
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8 font-['Inter']">
      {/* Top Header & Tactical Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 text-[11px] font-['JetBrains_Mono'] font-bold uppercase tracking-wider">
              Аналитический центр комплаенса
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-['JetBrains_Mono']">
              1 МРП = {CURRENT_MRP_TENGE.toLocaleString()} ₸
            </span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1.5">
            Дашборд и динамика нарушений
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
            Комплексная статистика аудита онлайн-контента в Казахстане: анализ видеорядов, аудиодорожек, скриншотов и веб-страниц по Закону РК № 230-VII и статьям КоАП РК.
          </p>
        </div>

        {/* Time Period Filter & Scanner Trigger */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="inline-flex rounded-lg bg-slate-100 p-1 border border-slate-200 text-xs font-medium">
            <button
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                timeRange === '7d'
                  ? 'bg-white text-sky-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 дней
            </button>
            <button
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                timeRange === '30d'
                  ? 'bg-white text-sky-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 дней
            </button>
            <button
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                timeRange === 'all'
                  ? 'bg-white text-sky-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Все время
            </button>
          </div>

          <button
            onClick={() => onNavigateToScanner()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Новый аудит</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Highlights Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Audited */}
        <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-['JetBrains_Mono']">
              Проверено материалов
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">fact_check</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans']">
              {stats.totalAudits}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 font-['JetBrains_Mono']">
              <span>Видео: {stats.videoCount}</span>
              <span>•</span>
              <span>Аудио: {stats.audioCount}</span>
              <span>•</span>
              <span>Скрин: {stats.screenshotCount}</span>
            </div>
          </div>
        </div>

        {/* Violations Caught */}
        <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-['JetBrains_Mono']">
              Выявлено нарушений
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">warning</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-600 font-['Plus_Jakarta_Sans']">
              {stats.totalViolations}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-['JetBrains_Mono']">
              <span className="text-rose-600 font-medium">Критических: {stats.criticalCount}</span>
              <span>(ст. 445-1, 455 КоАП)</span>
            </div>
          </div>
        </div>

        {/* Prevented Fine Risk */}
        <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-['JetBrains_Mono']">
              Предотвращенный штраф
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-['Plus_Jakarta_Sans'] truncate">
              {stats.totalFineTenge.toLocaleString()} ₸
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-['JetBrains_Mono']">
              Эквивалент ~{Math.round(stats.totalFineTenge / CURRENT_MRP_TENGE).toLocaleString()} МРП
            </div>
          </div>
        </div>

        {/* Compliance Rate */}
        <div className="p-4 sm:p-5 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider font-['JetBrains_Mono']">
              Индекс соответствия
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-['Plus_Jakarta_Sans']">
              {stats.complianceRate}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-['JetBrains_Mono']">
              Чистые материалы: {stats.safeCount} из {stats.totalAudits}
            </div>
          </div>
        </div>
      </div>

      {/* Content Type Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 mr-1">Фильтр по типу контента:</span>
        {[
          { key: 'all', label: 'Все форматы', icon: 'apps', count: allCases.length },
          { key: 'video', label: 'Видео (Reels, TikTok, MP4)', icon: 'videocam', count: stats.videoCount },
          { key: 'audio', label: 'Аудио (Подкасты, Voice)', icon: 'mic', count: stats.audioCount },
          { key: 'screenshot', label: 'Скриншоты & OCR', icon: 'image', count: stats.screenshotCount },
          { key: 'url', label: 'Веб-ссылки & Текст', icon: 'link', count: stats.urlCount },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedTypeFilter(tab.key as any)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              selectedTypeFilter === tab.key
                ? 'bg-sky-600 border-sky-600 text-white shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-['JetBrains_Mono'] ${
                selectedTypeFilter === tab.key ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Primary Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Dynamics Area Chart (Span 2 cols) */}
        <div className="lg:col-span-2 p-4 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-base sm:text-lg text-slate-900">
                Динамика найденных нарушений по типам контента
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Количество инцидентов во времени с разбивкой по медиа: видеоряд, аудиодорожка, скриншоты OCR и ссылки
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-slate-50 border border-slate-200 text-[11px] font-['JetBrains_Mono'] text-slate-600 shrink-0 self-start sm:self-auto">
              Период: {timeRange === '7d' ? '7 дней' : timeRange === '30d' ? '30 дней' : 'Квартал'}
            </span>
          </div>

          <div className="w-full h-72 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVideo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorAudio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorScreenshot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="colorUrl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="period" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Area
                  type="monotone"
                  dataKey="video"
                  name="Видео (Reels/TikTok)"
                  stroke="#0284c7"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorVideo)"
                />
                <Area
                  type="monotone"
                  dataKey="screenshot"
                  name="Скриншоты (OCR)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorScreenshot)"
                />
                <Area
                  type="monotone"
                  dataKey="audio"
                  name="Аудиодорожки"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorAudio)"
                />
                <Area
                  type="monotone"
                  dataKey="url"
                  name="Веб-страницы"
                  stroke="#10b981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorUrl)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Distribution Donut / Language distribution */}
        <div className="p-4 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-base sm:text-lg text-slate-900">
              Структура правовых рисков
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Классификация по статьям КоАП РК и уровню опасности
            </p>
          </div>

          <div className="w-full h-56 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {riskDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Доля']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    borderColor: '#e2e8f0',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 text-xs">
            {riskDistributionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-700 truncate max-w-[200px]">{item.name}</span>
                </div>
                <span className="font-['JetBrains_Mono'] font-bold text-slate-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Row: Violation Categories by Content Type (BarChart) + Linguistic Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Horizontal Bar Chart: Violations across Media Types */}
        <div className="lg:col-span-2 p-4 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-base sm:text-lg text-slate-900">
                Категории нарушений в разрезе форматов контента
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Сравнение частоты правонарушений в видео, аудио, скриншотах и веб-публикациях
              </p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px]">bar_chart</span>
            </div>
          </div>

          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryByContentTypeData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#64748b" fontSize={11} />
                <YAxis
                  dataKey="category"
                  type="category"
                  stroke="#475569"
                  fontSize={11}
                  width={140}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    borderColor: '#e2e8f0',
                    fontSize: '11px',
                  }}
                />
                <Legend iconType="square" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="video" name="Видео" fill="#0284c7" radius={[0, 4, 4, 0]} />
                <Bar dataKey="audio" name="Аудио" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="screenshot" name="Скриншот" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                <Bar dataKey="url" name="Веб/Текст" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Linguistic & Modality Breakdown */}
        <div className="p-4 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-base sm:text-lg text-slate-900">
              Языковой состав медиаматериалов
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Транскрипция и OCR с распознаванием казахского и русского языков
            </p>
          </div>

          <div className="w-full h-52 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={languageData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {languageData.map((entry, index) => (
                    <Cell key={`lang-cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val}%`, 'Доля']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    borderColor: '#e2e8f0',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            {languageData.map((l) => (
              <div key={l.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                  <span className="text-slate-700">{l.name}</span>
                </div>
                <span className="font-['JetBrains_Mono'] font-bold text-slate-900">{l.value}%</span>
              </div>
            ))}
            <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-100 text-[11px] text-sky-800 leading-relaxed mt-2">
              <span className="font-semibold">Требование Закона РК «О языках»:</span> реклама в обязательном порядке должна дублироваться на казахском языке (соразмерным шрифтом).
            </div>
          </div>
        </div>
      </div>

      {/* Filtered Recent Cases Table */}
      <div className="p-4 sm:p-6 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-base sm:text-lg text-slate-900">
              Материалы в реестре комплаенса ({displayedCases.length})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Кликните на любой проверенный материал для открытия детального экспертного заключения с таймкодами
            </p>
          </div>
          <span className="text-xs text-slate-500 font-['JetBrains_Mono']">
            Отображаются: {selectedTypeFilter === 'all' ? 'Все' : selectedTypeFilter}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-['JetBrains_Mono'] text-[11px] uppercase">
                <th className="py-2.5 px-3">Формат</th>
                <th className="py-2.5 px-3">Наименование материала</th>
                <th className="py-2.5 px-3">Дата аудита</th>
                <th className="py-2.5 px-3">Статус & Риск</th>
                <th className="py-2.5 px-3">Нарушения</th>
                <th className="py-2.5 px-3 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedCases.map((item) => {
                const isSafe = item.status === 'БЕЗОПАСНО' || item.violations.length === 0;
                const isCritical = item.status === 'ТРЕБУЕТ МЕР' || item.status === 'БЛОКИРОВКА';

                return (
                  <tr
                    key={item.id}
                    onClick={() => onOpenReport(item)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-['JetBrains_Mono'] font-medium ${
                          item.sourceType === 'video'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : item.sourceType === 'audio'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : item.sourceType === 'screenshot'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[13px]">
                          {item.sourceType === 'video'
                            ? 'videocam'
                            : item.sourceType === 'audio'
                            ? 'mic'
                            : item.sourceType === 'screenshot'
                            ? 'image'
                            : 'link'}
                        </span>
                        {item.sourceType === 'video'
                          ? 'Видео'
                          : item.sourceType === 'audio'
                          ? 'Аудио'
                          : item.sourceType === 'screenshot'
                          ? 'Скриншот'
                          : 'Ссылка'}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">
                      <div className="truncate max-w-xs sm:max-w-md">{item.title}</div>
                      <div className="text-[11px] text-slate-500 font-['JetBrains_Mono']">
                        {item.referenceNumber}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-xs whitespace-nowrap font-['JetBrains_Mono']">
                      {item.timestamp}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                          isSafe
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCritical
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status} ({item.riskScore}%)
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">
                      {item.violations.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-slate-800">{item.violations.length} нарушение(-й)</span>
                          <span className="text-[11px] text-slate-500 truncate max-w-xs">
                            {item.violations.map((v) => v.code).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-emerald-600 font-medium">Нарушений не выявлено</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReport(item);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                      >
                        <span>Отчет</span>
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Statutory Disclaimer */}
      <div className="p-3.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-slate-500 text-[18px]">info</span>
          <span>
            Результат предварительный, требуется проверка человеком. Статистика формируется на основе AI-аудитов по законодательству Республики Казахстан.
          </span>
        </div>
        <span className="font-['JetBrains_Mono'] text-[11px] text-slate-500 hidden sm:inline whitespace-nowrap">
          КоАП РК • Закон № 230-VII
        </span>
      </div>
    </div>
  );
};
