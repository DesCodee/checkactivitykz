/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuditCase, MonitoringChannel } from '../types';
import { MOCK_AUDIT_HISTORY, MOCK_MONITORING_CHANNELS } from '../data/mockData';

interface ArchiveMonitoringViewProps {
  onSelectCase: (auditCase: AuditCase) => void;
  onOpenPdfModal: () => void;
}

export const ArchiveMonitoringView: React.FC<ArchiveMonitoringViewProps> = ({
  onSelectCase,
  onOpenPdfModal,
}) => {
  const [activeTab, setActiveTab] = useState<'journal' | 'active' | 'incidents' | 'rules'>('journal');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Channels state
  const [channels, setChannels] = useState<MonitoringChannel[]>(MOCK_MONITORING_CHANNELS);

  // New channel form state
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [newChannelInterval, setNewChannelInterval] = useState('Каждые 15 минут');
  const [newChannelStrictness, setNewChannelStrictness] = useState('Полный пакет (КоАП РК, Закон № 230-VII, АФМ)');

  // Filter history items
  const filteredHistory = MOCK_AUDIT_HISTORY.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sourceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.violations.some((v) => v.code.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'critical'
        ? item.status === 'ТРЕБУЕТ МЕР' || item.status === 'БЛОКИРОВКА'
        : statusFilter === 'warning'
        ? item.status === 'ПРЕДУПРЕЖДЕНИЕ'
        : item.status === 'БЕЗОПАСНО';

    const matchesType = typeFilter === 'all' ? true : item.sourceType === typeFilter;

    if (activeTab === 'incidents') {
      return matchesSearch && matchesStatus && matchesType && (item.status === 'ТРЕБУЕТ МЕР' || item.status === 'БЛОКИРОВКА');
    }

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredHistory.map((item) => item.id));
    } else {
      setSelectedIds([]);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleAddNewChannel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelUrl.trim()) return;

    const newChannel: MonitoringChannel = {
      id: 'mon-' + Date.now(),
      name: newChannelUrl.trim().replace('https://', '').replace('http://', ''),
      platform: newChannelUrl.includes('t.me')
        ? 'telegram'
        : newChannelUrl.includes('instagram')
        ? 'instagram'
        : newChannelUrl.includes('kaspi')
        ? 'marketplace'
        : 'web',
      platformLabel: 'Новый мониторинг // Казнет',
      handleOrUrl: newChannelUrl.trim(),
      subscribersOrVolume: 'Непрерывный парсер',
      frequency: newChannelInterval,
      lastScan: 'Только что',
      violations24h: 0,
      status: 'LIVE',
    };

    setChannels([newChannel, ...channels]);
    setNewChannelUrl('');
    setShowAddModal(false);
  };

  return (
    <div className="w-full flex flex-col pb-12">
      {/* HUD Header Banner */}
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-6 pb-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-[#222a3d] text-[#4cd7f6] uppercase tracking-wider font-bold border border-[#4cd7f6]/30">
                REGISTRY & TELEMETRY // CORE v4.2 [KZ]
              </span>
              <span className="inline-flex items-center gap-1.5 font-['JetBrains_Mono'] text-[11px] text-[#4edea3]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3] animate-pulse"></span>
                СИНХРОНИЗИРОВАНО (МКИ РК, АФМ & РЕЕСТР ОНЛАЙН-ПЛАТФОРМ)
              </span>
            </div>
            <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-4xl font-bold text-[#dae2fd] tracking-tight">
              Архив проверок и непрерывный мониторинг
            </h1>
            <p className="text-xs sm:text-sm text-[#bcc9cd] font-['Inter']">
              История аудитов, реестр инцидентов и автоматическое отслеживание каналов и ссылок в Казнете на появление
              правонарушений в режиме реального времени.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] text-xs sm:text-sm font-semibold border border-[#3d494c]/50 transition-colors shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px] text-[#4cd7f6]">add_link</span>
              <span>Новый мониторинг</span>
            </button>
            <button
              onClick={onOpenPdfModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#06b6d4] to-[#0566d9] hover:opacity-95 text-[#001f26] font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-bold shadow-md transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">verified_user</span>
              <span>Экспорт реестра (PDF/XLSX)</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-2">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* KPI 1 */}
          <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-4 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase tracking-wider font-semibold">
                Всего проверено в РК
              </span>
              <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">fact_check</span>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#dae2fd]">1 428</span>
                <span className="font-['JetBrains_Mono'] text-xs text-[#4edea3] flex items-center">
                  <span className="material-symbols-outlined text-[14px]">arrow_upward</span>+12%
                </span>
              </div>
              <span className="text-[11px] text-[#bcc9cd] font-['Inter']">за текущую отчетную неделю</span>
            </div>
            <div className="mt-3 w-full bg-[#222a3d] rounded-full h-1 overflow-hidden">
              <div className="bg-[#4cd7f6] h-full w-[78%] rounded-full"></div>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-4 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase tracking-wider font-semibold">
                Предотвращено инцидентов
              </span>
              <span className="material-symbols-outlined text-[#ff6b6b] text-[20px]">gavel</span>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#ff6b6b]">94</span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#ff6b6b] bg-[#ff6b6b]/20 px-1.5 py-0.5 rounded font-bold">
                  РИСК ШТРАФОВ: 32.8М ₸
                </span>
              </div>
              <span className="text-[11px] text-[#bcc9cd] font-['Inter']">критические несоответствия КоАП/УК РК</span>
            </div>
            <div className="mt-3 w-full bg-[#222a3d] rounded-full h-1 overflow-hidden">
              <div className="bg-[#ff6b6b] h-full w-[94%] rounded-full"></div>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-4 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase tracking-wider font-semibold">
                На мониторинге
              </span>
              <span className="material-symbols-outlined text-[#adc6ff] text-[20px]">sensors</span>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#dae2fd]">{channels.length}</span>
                <span className="font-['Plus_Jakarta_Sans'] text-xs text-[#bcc9cd]">каналов</span>
                <span className="font-['JetBrains_Mono'] text-xs text-[#869397]">/ 120 URL</span>
              </div>
              <span className="text-[11px] text-[#bcc9cd] font-['Inter']">интервал сканирования: 15 минут</span>
            </div>
            <div className="mt-3 w-full bg-[#222a3d] rounded-full h-1 overflow-hidden">
              <div className="bg-[#adc6ff] h-full w-[65%] rounded-full"></div>
            </div>
          </div>

          {/* KPI 4 */}
          <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-4 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="flex items-center justify-between">
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase tracking-wider font-semibold">
                Средний риск пула
              </span>
              <span className="material-symbols-outlined text-[#4edea3] text-[20px]">security</span>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-2">
                <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#4edea3]">14%</span>
                <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-[#1bbd85]/20 text-[#4edea3] uppercase font-bold">
                  Зеленая зона
                </span>
              </div>
              <span className="text-[11px] text-[#bcc9cd] font-['Inter']">98.6% соответствие нормам права РК</span>
            </div>
            <div className="mt-3 w-full bg-[#222a3d] rounded-full h-1 overflow-hidden">
              <div className="bg-[#4edea3] h-full w-[14%] rounded-full"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Panel Workspace */}
      <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Primary Audit History Registry (Left 8 Cols) */}
          <div className="xl:col-span-8 flex flex-col gap-4">
            {/* Navigation Tabs Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#131b2e] p-1 rounded-xl border border-[#3d494c]/40 shadow-sm">
              <div className="flex items-center gap-1 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('journal')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                    activeTab === 'journal'
                      ? 'bg-[#222a3d] text-[#4cd7f6] border border-[#4cd7f6]/30'
                      : 'text-[#bcc9cd] hover:text-[#dae2fd]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">receipt_long</span>
                  <span>Журнал аудитов</span>
                  <span className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.2 rounded bg-[#060e20] text-[#dae2fd]">
                    1 428
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('active')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                    activeTab === 'active'
                      ? 'bg-[#222a3d] text-[#4cd7f6] border border-[#4cd7f6]/30'
                      : 'text-[#bcc9cd] hover:text-[#dae2fd]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">radar</span>
                  <span>Активный мониторинг</span>
                  <span className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.2 rounded bg-[#060e20] text-[#869397]">
                    {channels.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('incidents')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                    activeTab === 'incidents'
                      ? 'bg-[#222a3d] text-[#ff6b6b] border border-[#ff6b6b]/30'
                      : 'text-[#bcc9cd] hover:text-[#dae2fd]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px] text-[#ff6b6b]">warning</span>
                  <span>Инциденты с высоким риском</span>
                  <span className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.2 rounded bg-[#ff6b6b]/20 text-[#ff6b6b]">
                    18
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('rules')}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors ${
                    activeTab === 'rules'
                      ? 'bg-[#222a3d] text-[#4cd7f6] border border-[#4cd7f6]/30'
                      : 'text-[#bcc9cd] hover:text-[#dae2fd]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">tune</span>
                  <span>Правила и триггеры РК</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 px-3 text-[#869397] font-['JetBrains_Mono'] text-[10px] font-semibold">
                <span>LIVE STREAM</span>
                <span className="w-2 h-2 rounded-full bg-[#4cd7f6] animate-ping"></span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-4 shadow-sm flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Search Input */}
                <div className="md:col-span-6 relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3 text-[#869397] text-[18px]">search</span>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по URL, имени файла, ID дела (#CHK-KZ...) или статье..."
                    className="w-full bg-[#171f33] pl-9 pr-3 py-2 rounded-lg text-xs sm:text-sm text-[#dae2fd] placeholder:text-[#869397] border border-[#3d494c]/40 focus:outline-none focus:border-[#4cd7f6]"
                  />
                </div>

                {/* Status Dropdown */}
                <div className="md:col-span-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-[#171f33] px-2.5 py-2 rounded-lg text-xs text-[#dae2fd] border border-[#3d494c]/40 focus:outline-none"
                  >
                    <option value="all">Статус: Все</option>
                    <option value="critical">🔴 Требует мер</option>
                    <option value="warning">🟡 Предупреждение</option>
                    <option value="safe">🟢 Безопасно</option>
                  </select>
                </div>

                {/* Type Dropdown */}
                <div className="md:col-span-2">
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full bg-[#171f33] px-2.5 py-2 rounded-lg text-xs text-[#dae2fd] border border-[#3d494c]/40 focus:outline-none"
                  >
                    <option value="all">Тип: Все</option>
                    <option value="url">Ссылка</option>
                    <option value="screenshot">Скриншот</option>
                    <option value="photo">Фото</option>
                    <option value="audio">Аудио</option>
                  </select>
                </div>

                {/* Date range */}
                <div className="md:col-span-2">
                  <button
                    onClick={() => alert('Фильтр по дате: отображаются последние 7 дней (Казахстан)')}
                    className="w-full bg-[#171f33] hover:bg-[#222a3d] px-2.5 py-2 rounded-lg text-xs text-[#bcc9cd] flex items-center justify-between border border-[#3d494c]/40"
                  >
                    <span className="truncate">Посл. 7 дней</span>
                    <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                  </button>
                </div>
              </div>

              {/* Active Filter Tags */}
              <div className="flex items-center justify-between pt-1 text-xs text-[#bcc9cd]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-['JetBrains_Mono'] text-[10px] uppercase text-[#869397]">Фильтры:</span>
                  <span className="px-2 py-0.5 rounded bg-[#171f33] text-[#dae2fd] font-['JetBrains_Mono'] text-[11px] flex items-center gap-1 border border-[#3d494c]/40">
                    Период: 18.10 — 24.10
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#171f33] text-[#dae2fd] font-['JetBrains_Mono'] text-[11px] flex items-center gap-1 border border-[#3d494c]/40">
                    Юрисдикция: Казахстан (РК)
                  </span>
                  {(searchQuery || statusFilter !== 'all' || typeFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setTypeFilter('all');
                      }}
                      className="text-[#4cd7f6] hover:underline font-['JetBrains_Mono'] text-[10px] uppercase"
                    >
                      Сбросить фильтры
                    </button>
                  )}
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredHistory.length && filteredHistory.length > 0}
                    onChange={handleSelectAll}
                    className="w-3.5 h-3.5 rounded bg-[#171f33] text-[#4cd7f6] focus:ring-0 border-[#3d494c]"
                  />
                  <span>Выбрать все ({filteredHistory.length})</span>
                </label>
              </div>
            </div>

            {/* Evidentiary Audit Registry Table */}
            <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 shadow-sm overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#060e20] text-[#869397] font-['JetBrains_Mono'] text-[10px] uppercase border-b border-[#3d494c]/40">
                      <th className="py-3 px-3 w-8 text-center"></th>
                      <th className="py-3 px-3">Дата / Дело</th>
                      <th className="py-3 px-3">Объект проверки</th>
                      <th className="py-3 px-3">Тип</th>
                      <th className="py-3 px-3 text-center">Риск-скор</th>
                      <th className="py-3 px-3">Правовые риски & Статьи РК</th>
                      <th className="py-3 px-3">Статус</th>
                      <th className="py-3 px-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222a3d] text-xs font-['Inter']">
                    {filteredHistory.map((item) => (
                      <tr key={item.id} className="hover:bg-[#171f33] transition-colors group">
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(item.id)}
                            onChange={() => toggleSelectRow(item.id)}
                            className="w-3.5 h-3.5 rounded bg-[#222a3d] text-[#4cd7f6] focus:ring-0 border-[#3d494c]"
                          />
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col">
                            <span className="font-['JetBrains_Mono'] text-[11px] text-[#dae2fd] font-medium">
                              {item.timestamp.split(',')[0]}
                            </span>
                            <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">
                              {item.referenceNumber}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 max-w-[190px]">
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[#869397] text-[16px]">
                              {item.sourceType === 'url' ? 'link' : item.sourceType === 'audio' ? 'mic' : 'image'}
                            </span>
                            <span className="font-['JetBrains_Mono'] text-[11px] text-[#dae2fd] truncate font-semibold">
                              {item.title}
                            </span>
                          </div>
                          <span className="font-['JetBrains_Mono'] text-[9px] text-[#869397] block truncate">
                            sha256: {item.sha256.slice(0, 14)}...
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd] font-['JetBrains_Mono'] text-[10px] uppercase">
                            {item.sourceType}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-center">
                          <div className="inline-flex flex-col items-center">
                            <span
                              className={`font-['JetBrains_Mono'] text-xs font-bold ${
                                item.riskScore > 70
                                  ? 'text-[#ff6b6b]'
                                  : item.riskScore > 40
                                  ? 'text-[#adc6ff]'
                                  : 'text-[#4edea3]'
                              }`}
                            >
                              {item.riskScore}%
                            </span>
                            <span className="font-['JetBrains_Mono'] text-[9px] text-[#869397] uppercase">
                              {item.riskLevel}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 max-w-[240px]">
                          {item.violations.length === 0 ? (
                            <span className="text-[#4edea3] flex items-center gap-1 text-[11px]">
                              <span className="material-symbols-outlined text-[15px]">check_circle</span>
                              Нарушений не выявлено
                            </span>
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[#ff6b6b] font-medium truncate text-[11px]">
                                {item.violations[0].code}
                              </span>
                              <span className="text-[#869397] text-[10px] truncate">
                                {item.violations[0].title}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-['JetBrains_Mono'] text-[9px] font-bold ${
                              item.status === 'ТРЕБУЕТ МЕР' || item.status === 'БЛОКИРОВКА'
                                ? 'bg-[#ff6b6b]/20 text-[#ff6b6b]'
                                : item.status === 'ПРЕДУПРЕЖДЕНИЕ'
                                ? 'bg-[#222a3d] text-[#adc6ff]'
                                : 'bg-[#1bbd85]/20 text-[#4edea3]'
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onSelectCase(item)}
                              className="p-1 rounded hover:bg-[#222a3d] text-[#4cd7f6] hover:text-white transition-colors"
                              title="Открыть экспертный отчет"
                            >
                              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                            </button>
                            <button
                              onClick={onOpenPdfModal}
                              className="p-1 rounded hover:bg-[#222a3d] text-[#869397] hover:text-[#dae2fd] transition-colors"
                              title="Скачать заключение PDF"
                            >
                              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              <div className="p-3.5 bg-[#060e20] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-[#3d494c]/30">
                <div className="flex items-center gap-2 text-[#bcc9cd]">
                  <span>
                    Отображено: <strong className="text-[#dae2fd]">1–{filteredHistory.length}</strong> из{' '}
                    <strong className="text-[#dae2fd]">1 428</strong> записей
                  </span>
                  <span className="text-[#3d494c]">|</span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="text-[#869397]">Показывать по:</span>
                    <select className="bg-[#171f33] px-2 py-0.5 rounded text-[#dae2fd] border border-[#3d494c]/30 focus:outline-none">
                      <option>5</option>
                      <option defaultValue="25">25</option>
                      <option>50</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1 font-['JetBrains_Mono'] text-xs">
                  <button className="px-2 py-1 rounded bg-[#171f33] text-[#869397] disabled:opacity-40" disabled>
                    <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                  </button>
                  <button className="px-2.5 py-0.5 rounded bg-[#4cd7f6] text-[#003640] font-bold">1</button>
                  <button className="px-2.5 py-0.5 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd]">2</button>
                  <button className="px-2.5 py-0.5 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd]">3</button>
                  <span className="px-1 text-[#869397]">...</span>
                  <button className="px-2.5 py-0.5 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd]">58</button>
                  <button className="px-2 py-1 rounded bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd]">
                    <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Cryptographic Seal Banner */}
            <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#171f33] flex items-center justify-center shrink-0 border border-[#4cd7f6]/30">
                  <span className="material-symbols-outlined text-[#4cd7f6] text-[24px]">verified</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-bold text-[#dae2fd]">
                    Хеш-реестр криптографически заверен (СТ РК ГОСТ 34.310-2004)
                  </span>
                  <span className="text-[11px] text-[#bcc9cd] font-['Inter']">
                    Все записи аудита автоматически фиксируются с таймштампом НУЦ РК для судов РК и МКИ РК.
                  </span>
                </div>
              </div>
              <button
                onClick={onOpenPdfModal}
                className="px-3.5 py-2 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] text-xs font-semibold shrink-0 flex items-center gap-1.5 border border-[#3d494c]/40 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Скачать выписку реестра
              </button>
            </div>
          </div>

          {/* Real-time Continuous Monitoring Dashboard (Right 4 Cols) */}
          <div className="xl:col-span-4 flex flex-col gap-4">
            {/* Header Widget */}
            <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-5 shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#4cd7f6] text-[22px]">satellite_alt</span>
                  <h2 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">
                    Автоматический мониторинг
                  </h2>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#1bbd85]/20 text-[#4edea3] font-['JetBrains_Mono'] text-[10px] font-bold uppercase">
                  {channels.length} АКТИВНО
                </span>
              </div>
              <p className="text-xs text-[#bcc9cd] font-['Inter']">
                Непрерывное фоновое сканирование медиаканалов Казахстана, сайтов и карточек маркетплейсов Kaspi по
                расписанию.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] font-['Plus_Jakarta_Sans'] text-xs font-bold border border-[#4cd7f6]/40 transition-all shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>+ Поставить источник на мониторинг</span>
              </button>
            </div>

            {/* Active Channels List */}
            <div className="flex flex-col gap-3">
              {channels.map((chan) => (
                <div
                  key={chan.id}
                  className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-4 shadow-sm flex flex-col gap-2 hover:border-[#4cd7f6]/40 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#222a3d] flex items-center justify-center text-[#dae2fd] font-['JetBrains_Mono'] text-xs font-bold shrink-0">
                        {chan.platform === 'telegram'
                          ? 'TG'
                          : chan.platform === 'instagram'
                          ? 'IG'
                          : chan.platform === 'marketplace'
                          ? 'KP'
                          : 'WB'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-[#dae2fd] truncate">
                          {chan.name}
                        </span>
                        <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] truncate">
                          {chan.platformLabel}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 font-['JetBrains_Mono'] text-[10px] font-bold ${
                        chan.status === 'ALERT' ? 'text-[#ff6b6b]' : 'text-[#4edea3]'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current"></span>
                      {chan.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-1.5 border-y border-[#222a3d] text-[11px] font-['JetBrains_Mono']">
                    <div className="flex flex-col">
                      <span className="text-[#869397] text-[9px] uppercase">Частота:</span>
                      <span className="text-[#dae2fd]">{chan.frequency}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[#869397] text-[9px] uppercase">Посл. скан:</span>
                      <span className="text-[#4cd7f6]">{chan.lastScan}</span>
                    </div>
                  </div>

                  {chan.alertNote ? (
                    <div className="text-[11px] text-[#ff6b6b] flex items-center gap-1 font-medium">
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span className="truncate">{chan.alertNote}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-xs text-[#bcc9cd]">
                      <span className="flex items-center gap-1 text-[#4edea3] text-[11px]">
                        <span className="material-symbols-outlined text-[16px]">check</span>
                        Нарушений за 24ч: 0
                      </span>
                      <div className="flex items-center gap-1 text-[#869397]">
                        <button className="p-1 rounded hover:bg-[#222a3d] hover:text-white" title="Пауза">
                          <span className="material-symbols-outlined text-[16px]">pause</span>
                        </button>
                        <button className="p-1 rounded hover:bg-[#222a3d] hover:text-white" title="Настройки">
                          <span className="material-symbols-outlined text-[16px]">settings</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sparkline & Daemon Telemetry */}
            <div className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-4 shadow-sm flex flex-col gap-2">
              <div className="flex items-center justify-between font-['JetBrains_Mono'] text-xs">
                <span className="text-[#869397] text-[10px] uppercase font-semibold">Интенсивность сканирования</span>
                <span className="text-[#4cd7f6] font-bold">48 запросов/мин</span>
              </div>
              <div className="w-full h-16 relative">
                <svg className="w-full h-full text-[#4cd7f6]" fill="none" preserveAspectRatio="none" viewBox="0 0 300 60">
                  <path
                    d="M0,45 Q20,35 40,48 T80,20 T120,40 T160,15 T200,30 T240,10 T280,25 L300,18"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                  ></path>
                  <path
                    d="M0,45 Q20,35 40,48 T80,20 T120,40 T160,15 T200,30 T240,10 T280,25 L300,18 L300,60 L0,60 Z"
                    fill="currentColor"
                    fillOpacity="0.08"
                  ></path>
                </svg>
              </div>
              <div className="flex items-center justify-between text-xs text-[#bcc9cd] pt-1">
                <span className="flex items-center gap-1 text-[#4edea3] text-[11px]">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  Отказоустойчивость 99.98%
                </span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">ASTANA_NODE_01</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Floating Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all animate-in fade-in slide-in-from-bottom-5">
          <div className="bg-[#222a3d] border border-[#4cd7f6]/50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 text-[#dae2fd] font-['Plus_Jakarta_Sans'] font-semibold">
              <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">check_box</span>
              <span>Выбрано записей: {selectedIds.length}</span>
            </div>
            <div className="h-5 w-px bg-[#3d494c]"></div>
            <div className="flex items-center gap-2">
              <button
                onClick={onOpenPdfModal}
                className="px-3 py-1.5 rounded-lg bg-[#171f33] hover:bg-[#2d3449] text-[#dae2fd] font-medium flex items-center gap-1 border border-[#3d494c]/40"
              >
                <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
                Сформировать пакет PDF
              </button>
              <button
                onClick={() => alert(`Дела (${selectedIds.length}) направлены штатному юристу на досудебную проверку`)}
                className="px-3 py-1.5 rounded-lg bg-[#171f33] hover:bg-[#2d3449] text-[#dae2fd] font-medium flex items-center gap-1 border border-[#3d494c]/40"
              >
                <span className="material-symbols-outlined text-[16px]">send</span>
                Отправить юристу
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="p-1 text-[#869397] hover:text-white"
                title="Снять выбор"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New URL to Continuous Monitor */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[#131b2e] border border-[#3d494c] p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-[#222a3d]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[24px]">add_moderator</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#dae2fd]">
                  Поставить источник на мониторинг (РК)
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-md text-[#869397] hover:text-[#dae2fd]"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <p className="text-xs text-[#bcc9cd] font-['Inter'] leading-relaxed">
              Система начнет непрерывный парсинг обновлений в Казнете, распознавание текстов, аудио и баннеров с генерацией
              алертов при рисках штрафов по Закону об онлайн-рекламе и КоАП РК.
            </p>

            <form onSubmit={handleAddNewChannel} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#dae2fd]">Ссылка на канал, профиль или веб-страницу</label>
                <input
                  required
                  value={newChannelUrl}
                  onChange={(e) => setNewChannelUrl(e.target.value)}
                  placeholder="https://t.me/brand_channel_kz или instagram.com/..."
                  className="w-full bg-[#171f33] px-3.5 py-2.5 rounded-lg text-xs text-[#dae2fd] placeholder:text-[#869397] border border-[#3d494c]/60 focus:outline-none focus:border-[#4cd7f6]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[#dae2fd]">Интервал проверки</label>
                  <select
                    value={newChannelInterval}
                    onChange={(e) => setNewChannelInterval(e.target.value)}
                    className="w-full bg-[#171f33] px-3 py-2 rounded-lg text-xs text-[#dae2fd] border border-[#3d494c]/60 focus:outline-none"
                  >
                    <option>Каждые 15 минут</option>
                    <option>Каждые 30 минут</option>
                    <option>Каждый час</option>
                    <option>Раз в сутки</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-[#dae2fd]">Строгость комплаенса</label>
                  <select
                    value={newChannelStrictness}
                    onChange={(e) => setNewChannelStrictness(e.target.value)}
                    className="w-full bg-[#171f33] px-3 py-2 rounded-lg text-xs text-[#dae2fd] border border-[#3d494c]/60 focus:outline-none"
                  >
                    <option>Полный пакет (КоАП РК, Закон № 230-VII, АФМ)</option>
                    <option>Только маркировка «Жарнама»</option>
                    <option>Защита бренда и репутации</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 pt-1">
                <label className="text-xs font-semibold text-[#dae2fd]">Каналы оперативных алертов</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex items-center gap-1.5 p-2 rounded bg-[#171f33] border border-[#3d494c]/30 text-xs text-[#dae2fd] cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-[#4cd7f6] focus:ring-0 bg-[#060e20]" />
                    <span>Telegram-бот</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-2 rounded bg-[#171f33] border border-[#3d494c]/30 text-xs text-[#dae2fd] cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-[#4cd7f6] focus:ring-0 bg-[#060e20]" />
                    <span>Email юриста</span>
                  </label>
                  <label className="flex items-center gap-1.5 p-2 rounded bg-[#171f33] border border-[#3d494c]/30 text-xs text-[#dae2fd] cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-[#4cd7f6] focus:ring-0 bg-[#060e20]" />
                    <span>Webhook API</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#222a3d]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg text-xs text-[#bcc9cd] hover:text-[#dae2fd]"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#06b6d4] to-[#0566d9] text-[#001f26] font-['Plus_Jakarta_Sans'] text-xs font-bold shadow-md hover:opacity-95"
                >
                  Запустить мониторинг
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
