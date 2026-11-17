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
import {
  Plus,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  ShieldCheck,
  Video,
  Mic,
  Image as ImageIcon,
  Link2,
  ArrowRight,
  Info,
} from 'lucide-react';
import { AuditCase, ModalityType } from '../types';
import { CURRENT_MRP_TENGE, MOCK_AUDIT_HISTORY } from '../data/mockData';
import { useApp } from '../utils/i18n';

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
  const { t, language, theme } = useApp();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'video' | 'audio' | 'screenshot' | 'url'>('all');

  const allCases = useMemo(() => {
    return [
      ...userHistory,
      ...MOCK_AUDIT_HISTORY.filter((m) => !userHistory.some((u) => u.id === m.id)),
    ];
  }, [userHistory]);

  const displayedCases = useMemo(() => {
    if (selectedTypeFilter === 'all') return allCases;
    return allCases.filter((c) => c.sourceType === selectedTypeFilter);
  }, [allCases, selectedTypeFilter]);

  const stats = useMemo(() => {
    const totalAudits = allCases.length;
    const videoCount = allCases.filter((c) => c.sourceType === 'video').length;
    const audioCount = allCases.filter((c) => c.sourceType === 'audio').length;
    const screenshotCount = allCases.filter((c) => c.sourceType === 'screenshot').length;
    const urlCount = allCases.filter((c) => c.sourceType === 'url').length;

    let totalViolations = 0;
    let totalFineTenge = 0;
    let criticalCount = 0;
    let safeCount = 0;

    allCases.forEach((c) => {
      const vCount = c.violations.length;
      totalViolations += vCount;

      if (c.status === 'БЕЗОПАСНО' || vCount === 0) {
        safeCount++;
      } else if (c.status === 'ТРЕБУЕТ МЕР' || c.status === 'БЛОКИРОВКА') {
        criticalCount++;
      }

      c.violations.forEach((v) => {
        if (v.code.includes('445-1')) {
          totalFineTenge += 1000 * CURRENT_MRP_TENGE;
        } else if (v.code.includes('455')) {
          totalFineTenge += 100 * CURRENT_MRP_TENGE;
        } else if (v.code.includes('434')) {
          totalFineTenge += 5 * CURRENT_MRP_TENGE;
        } else if (v.code.includes('79')) {
          totalFineTenge += 50 * CURRENT_MRP_TENGE;
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
    };
  }, [allCases]);

  const dynamicsData = useMemo(() => {
    if (timeRange === '7d') {
      return [
        { period: 'Пн', video: 2, audio: 1, screenshot: 4, url: 3, total: 10 },
        { period: 'Вт', video: 3, audio: 2, screenshot: 3, url: 2, total: 10 },
        { period: 'Ср', video: 1, audio: 0, screenshot: 5, url: 4, total: 10 },
        { period: 'Чт', video: 4, audio: 3, screenshot: 6, url: 3, total: 16 },
        { period: 'Пт', video: 5, audio: 2, screenshot: 7, url: 5, total: 19 },
        { period: 'Сб', video: 6, audio: 4, screenshot: 5, url: 4, total: 19 },
        { period: 'Вс', video: 4, audio: 2, screenshot: 6, url: 3, total: 15 },
      ];
    } else if (timeRange === '30d') {
      return [
        { period: 'Нед 1', video: 12, audio: 8, screenshot: 24, url: 15, total: 59 },
        { period: 'Нед 2', video: 18, audio: 11, screenshot: 32, url: 21, total: 82 },
        { period: 'Нед 3', video: 25, audio: 14, screenshot: 29, url: 19, total: 87 },
        { period: 'Нед 4', video: 22, audio: 15, screenshot: 38, url: 24, total: 99 },
      ];
    } else {
      return [
        { period: 'Авг', video: 35, audio: 22, screenshot: 65, url: 48, total: 170 },
        { period: 'Сен', video: 52, audio: 34, screenshot: 88, url: 62, total: 236 },
        { period: 'Окт', video: 74, audio: 48, screenshot: 112, url: 79, total: 313 },
        { period: 'Ноя', video: 68, audio: 41, screenshot: 95, url: 71, total: 275 },
      ];
    }
  }, [timeRange]);

  const categoryByContentTypeData = useMemo(() => {
    return [
      { category: 'Реклама (№230-VII)', video: 18, audio: 4, screenshot: 24, url: 12 },
      { category: 'Казино (ст. 445-1)', video: 14, audio: 2, screenshot: 28, url: 16 },
      { category: 'Мат / Буллинг (ст. 434)', video: 9, audio: 15, screenshot: 18, url: 8 },
      { category: 'Dark Patterns & Этика', video: 11, audio: 6, screenshot: 14, url: 10 },
      { category: 'Перс. данные (ст. 79)', video: 3, audio: 1, screenshot: 12, url: 4 },
    ];
  }, []);

  const riskDistributionData = useMemo(() => {
    return [
      { name: 'Критический (ст. 445-1, казино)', value: 38, color: '#f43f5e' },
      { name: 'Высокий (Закон № 230-VII)', value: 32, color: '#f59e0b' },
      { name: 'Предупреждение (этика)', value: 20, color: '#7c3aed' },
      { name: 'Безопасно (соответствует)', value: 10, color: '#10b981' },
    ];
  }, []);

  const languageData = useMemo(() => {
    return [
      { name: 'Русский язык', value: 48, color: '#18181b' },
      { name: 'Казахский язык', value: 34, color: '#71717a' },
      { name: 'Смешанный (Билингв)', value: 18, color: '#d4d4d8' },
    ];
  }, []);

  const isDark = theme === 'dark';

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 font-['Inter']">
      {/* Top Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400">
            <span>{t('complianceCenter')}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">1 МРП = {CURRENT_MRP_TENGE.toLocaleString()} ₸</span>
          </div>
          <h2 className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-semibold text-zinc-950 dark:text-zinc-50 tracking-tight mt-1">
            {t('dashboardTitle')}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            {t('dashboardSubtitle')}
          </p>
        </div>

        {/* Time Period Filter & New Audit CTA */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="inline-flex rounded-xl bg-zinc-100 dark:bg-zinc-900 p-1 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                timeRange === '7d'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {language === 'kz' ? '7 күн' : '7 дней'}
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                timeRange === '30d'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {language === 'kz' ? '30 күн' : '30 дней'}
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                timeRange === 'all'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {language === 'kz' ? 'Барлық уақыт' : 'Все время'}
            </button>
          </div>

          <button
            type="button"
            onClick={() => onNavigateToScanner()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" strokeWidth={1.8} />
            <span>{t('newAuditBtn')}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards (Clean EthicOS Style) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Audited */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">{t('auditedMaterials')}</span>
            <CheckCircle2 className="w-4 h-4 text-zinc-400" strokeWidth={1.5} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50 font-['Plus_Jakarta_Sans'] tabular-nums tracking-tight">
              {stats.totalAudits}
            </div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 font-['JetBrains_Mono'] tabular-nums">
              {language === 'kz' ? 'Бейне' : 'Видео'} {stats.videoCount} ·{' '}
              {language === 'kz' ? 'Аудио' : 'Аудио'} {stats.audioCount} ·{' '}
              {language === 'kz' ? 'Скрин' : 'Скрин'} {stats.screenshotCount}
            </div>
          </div>
        </div>

        {/* Violations Caught */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">{t('detectedViolations')}</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" strokeWidth={1.5} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50 font-['Plus_Jakarta_Sans'] tabular-nums tracking-tight">
              {stats.totalViolations}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span className="tabular-nums">
                {t('criticalViolations')}: {stats.criticalCount}
              </span>
            </div>
          </div>
        </div>

        {/* Prevented Fine Risk */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">{t('preventedFineRisk')}</span>
            <Wallet className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
          </div>
          <div className="mt-4">
            <div className="text-2xl sm:text-3xl font-semibold text-zinc-950 dark:text-zinc-50 font-['Plus_Jakarta_Sans'] truncate tabular-nums tracking-tight">
              {stats.totalFineTenge.toLocaleString()} ₸
            </div>
            <div className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 font-['JetBrains_Mono'] tabular-nums">
              ~{Math.round(stats.totalFineTenge / CURRENT_MRP_TENGE).toLocaleString()} МРП
            </div>
          </div>
        </div>

        {/* Compliance Rate */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">{t('complianceIndex')}</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
          </div>
          <div className="mt-4">
            <div className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50 font-['Plus_Jakarta_Sans'] tabular-nums tracking-tight">
              {stats.complianceRate}%
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="tabular-nums">
                {t('cleanMaterials')}: {stats.safeCount} / {stats.totalAudits}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content Type Segmented Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'all', label: t('allFormats'), icon: null, count: allCases.length },
          { key: 'video', label: t('videoFormat'), icon: Video, count: stats.videoCount },
          { key: 'audio', label: t('audioFormat'), icon: Mic, count: stats.audioCount },
          { key: 'screenshot', label: t('screenshotFormat'), icon: ImageIcon, count: stats.screenshotCount },
          { key: 'url', label: t('urlFormat'), icon: Link2, count: stats.urlCount },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = selectedTypeFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setSelectedTypeFilter(tab.key as any)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors whitespace-nowrap ${
                active
                  ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />}
              <span>{tab.label}</span>
              <span
                className={`font-['JetBrains_Mono'] text-[11px] tabular-nums ${
                  active ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Primary Charts Section (Minimalist EthicOS Lines) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Dynamics Area Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-zinc-950 dark:text-zinc-50">
                {t('dynamicsTitle')}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {language === 'kz'
                  ? 'Медиа бөлінісіндегі оқиғалар динамикасы'
                  : 'Динамика инцидентов по форматам контента'}
              </p>
            </div>
            <span className="font-['JetBrains_Mono'] text-[11px] text-zinc-400 dark:text-zinc-500">
              {timeRange === '7d'
                ? language === 'kz'
                  ? '7 күн'
                  : '7 дней'
                : timeRange === '30d'
                ? language === 'kz'
                  ? '30 күн'
                  : '30 дней'
                : language === 'kz'
                ? 'Тоқсан'
                : 'Квартал'}
            </span>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dynamicsData} margin={{ top: 10, right: 10, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotalMono" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isDark ? '#e4e4e7' : '#71717a'} stopOpacity={0.14} />
                    <stop offset="95%" stopColor={isDark ? '#e4e4e7' : '#71717a'} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#27272a' : '#f4f4f5'} />
                <XAxis
                  dataKey="period"
                  stroke={isDark ? '#71717a' : '#a1a1aa'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke={isDark ? '#71717a' : '#a1a1aa'}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#18181b' : '#ffffff',
                    borderRadius: '12px',
                    borderColor: isDark ? '#27272a' : '#e4e4e7',
                    color: isDark ? '#f4f4f5' : '#18181b',
                    fontSize: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name={language === 'kz' ? 'Барлығы' : 'Всего проверено'}
                  stroke={isDark ? '#f4f4f5' : '#18181b'}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTotalMono)"
                />
                <Area
                  type="monotone"
                  dataKey="video"
                  name={language === 'kz' ? 'Бейне' : 'Видео'}
                  stroke="#71717a"
                  strokeWidth={1.5}
                  fillOpacity={0}
                />
                <Area
                  type="monotone"
                  dataKey="screenshot"
                  name={language === 'kz' ? 'Скриншот' : 'Скриншоты'}
                  stroke="#a1a1aa"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={0}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Structure Card (Styled like Frameworks card in screenshot) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-zinc-950 dark:text-zinc-50">
              {t('riskStructureTitle')}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {language === 'kz' ? 'ҚР ӘҚБтК санаттары бойынша' : 'Распределение по категориям РК'}
            </p>
          </div>

          <div className="w-full h-48 my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={74}
                  paddingAngle={3}
                  dataKey="value"
                  stroke={isDark ? '#18181b' : '#ffffff'}
                  strokeWidth={2}
                >
                  {riskDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val}%`, language === 'kz' ? 'Үлесі' : 'Доля']}
                  contentStyle={{
                    backgroundColor: isDark ? '#18181b' : '#ffffff',
                    borderRadius: '10px',
                    borderColor: isDark ? '#27272a' : '#e4e4e7',
                    color: isDark ? '#f4f4f5' : '#18181b',
                    fontSize: '11px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {riskDistributionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between py-2">
                <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[195px]">
                  {item.name}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-['JetBrains_Mono'] font-medium text-zinc-900 dark:text-zinc-100 tabular-nums">
                    {item.value}%
                  </span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secondary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Horizontal Bar Chart */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col">
          <div className="mb-4">
            <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-zinc-950 dark:text-zinc-50">
              {t('formatBreakdownTitle')}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {language === 'kz'
                ? 'Бейне, аудио, скриншоттар мен сілтемелердегі бұзушылық жиілігі'
                : 'Сравнение частоты нарушений по форматам материалов'}
            </p>
          </div>

          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryByContentTypeData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#27272a' : '#f4f4f5'} />
                <XAxis
                  type="number"
                  stroke={isDark ? '#71717a' : '#a1a1aa'}
                  fontSize={11}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  dataKey="category"
                  type="category"
                  stroke={isDark ? '#d4d4d8' : '#3f3f46'}
                  fontSize={11}
                  width={135}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#18181b' : '#ffffff',
                    borderRadius: '10px',
                    borderColor: isDark ? '#27272a' : '#e4e4e7',
                    color: isDark ? '#f4f4f5' : '#18181b',
                    fontSize: '11px',
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="video" name={language === 'kz' ? 'Бейне' : 'Видео'} fill={isDark ? '#f4f4f5' : '#18181b'} radius={[0, 4, 4, 0]} />
                <Bar dataKey="screenshot" name={language === 'kz' ? 'Скриншот' : 'Скриншот'} fill="#71717a" radius={[0, 4, 4, 0]} />
                <Bar dataKey="audio" name={language === 'kz' ? 'Аудио' : 'Аудио'} fill="#a1a1aa" radius={[0, 4, 4, 0]} />
                <Bar dataKey="url" name={language === 'kz' ? 'Веб/Мәтін' : 'Веб/Текст'} fill="#d4d4d8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Language Breakdown Card (Styled like Bias & Fairness bars in screenshot) */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-zinc-950 dark:text-zinc-50">
              {t('languageCompositionTitle')}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {language === 'kz'
                ? 'Қазақ және орыс тілдерінің үлесі'
                : 'Распознавание казахского и русского языков'}
            </p>
          </div>

          <div className="flex flex-col gap-5 my-6">
            {languageData.map((l) => (
              <div key={l.name} className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-800 dark:text-zinc-200 font-medium">{l.name}</span>
                  <span className="font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400 tabular-nums">
                    {l.value}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-500"
                    style={{ width: `${l.value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
            <span className="font-medium text-zinc-900 dark:text-zinc-200">
              {language === 'kz' ? 'ҚР «Тіл туралы» Заңы:' : 'Закон РК «О языках»:'}
            </span>{' '}
            {language === 'kz'
              ? 'жарнама мемлекеттік тілде (теңбе-тең қаріппен) берілуі тиіс.'
              : 'реклама должна дублироваться на казахском языке соразмерным шрифтом.'}
          </div>
        </div>
      </div>

      {/* Registry Table */}
      <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base text-zinc-950 dark:text-zinc-50">
              {t('registryMaterials')} ({displayedCases.length})
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t('clickToOpenReport')}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 font-['JetBrains_Mono'] text-[11px]">
                <th className="py-3 px-3">{t('colFormat')}</th>
                <th className="py-3 px-3">{t('colTitle')}</th>
                <th className="py-3 px-3">{t('colDate')}</th>
                <th className="py-3 px-3">{t('colStatus')}</th>
                <th className="py-3 px-3">{t('colViolations')}</th>
                <th className="py-3 px-3 text-right">{t('colAction')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {displayedCases.map((item) => {
                const isSafe = item.status === 'БЕЗОПАСНО' || item.violations.length === 0;
                const isCritical = item.status === 'ТРЕБУЕТ МЕР' || item.status === 'БЛОКИРОВКА';
                const dotColor = isSafe ? 'bg-emerald-500' : isCritical ? 'bg-rose-500' : 'bg-amber-500';

                return (
                  <tr
                    key={item.id}
                    onClick={() => onOpenReport(item)}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-3 font-['JetBrains_Mono'] text-[11px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {item.sourceType === 'video'
                        ? language === 'kz'
                          ? 'Бейне'
                          : 'Видео'
                        : item.sourceType === 'audio'
                        ? language === 'kz'
                          ? 'Аудио'
                          : 'Аудио'
                        : item.sourceType === 'screenshot'
                        ? language === 'kz'
                          ? 'Скриншот'
                          : 'Скриншот'
                        : language === 'kz'
                        ? 'Сілтеме'
                        : 'Ссылка'}
                    </td>
                    <td className="py-3.5 px-3 font-medium text-zinc-900 dark:text-zinc-100">
                      <div className="truncate max-w-xs sm:max-w-md">{item.title}</div>
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-['JetBrains_Mono'] tabular-nums">
                        {item.referenceNumber}
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap font-['JetBrains_Mono'] tabular-nums">
                      {item.timestamp}
                    </td>
                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2 text-xs text-zinc-800 dark:text-zinc-200 tabular-nums">
                        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                        <span>{item.status}</span>
                        <span className="text-zinc-400 font-['JetBrains_Mono']">({item.riskScore}%)</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-3 text-xs text-zinc-600 dark:text-zinc-400">
                      {item.violations.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-zinc-800 dark:text-zinc-200 tabular-nums">
                            {item.violations.length} {language === 'kz' ? 'бұзушылық' : 'нарушение(-й)'}
                          </span>
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-xs font-['JetBrains_Mono']">
                            {item.violations.map((v) => v.code).join(', ')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {t('noViolationsDetected')}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReport(item);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-900 hover:text-white dark:hover:bg-zinc-100 dark:hover:text-zinc-900 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors"
                      >
                        <span>{t('openReportAction')}</span>
                        <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
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
      <div className="p-3.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-zinc-400 shrink-0" strokeWidth={1.5} />
          <span>
            {language === 'kz'
              ? 'Алдын ала нәтиже, адамның тексеруі қажет. Статистика ҚР заңнамасына сәйкес қалыптастырылады.'
              : 'Результат предварительный, требуется проверка человеком. Статистика формируется по нормам РК.'}
          </span>
        </div>
        <span className="font-['JetBrains_Mono'] text-[11px] text-zinc-400 hidden sm:inline whitespace-nowrap">
          КоАП РК · Закон № 230-VII
        </span>
      </div>
    </div>
  );
};
