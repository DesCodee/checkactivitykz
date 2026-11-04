/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { MonitoringChannel, MonitoredPost, AuditCase } from '../types';
import { MOCK_MONITORING_CHANNELS } from '../data/mockData';
import { scanAccount } from '../services/geminiService';

interface AccountMonitoringViewProps {
  onOpenReportForCase: (auditCase: AuditCase) => void;
  onNavigateToScanner: () => void;
}

export const AccountMonitoringView: React.FC<AccountMonitoringViewProps> = ({
  onOpenReportForCase,
  onNavigateToScanner,
}) => {
  const [channels, setChannels] = useState<MonitoringChannel[]>(() => {
    try {
      const saved = localStorage.getItem('checkactivity_monitored_accounts_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return MOCK_MONITORING_CHANNELS;
  });

  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [scanningChannelId, setScanningChannelId] = useState<string | null>(null);
  const [isBatchScanning, setIsBatchScanning] = useState(false);
  const [selectedDossierChannel, setSelectedDossierChannel] = useState<MonitoringChannel | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [quickUrlInput, setQuickUrlInput] = useState('');
  const [quickStepActive, setQuickStepActive] = useState<number | null>(null);

  // New account form state
  const [newHandle, setNewHandle] = useState('');
  const [newName, setNewName] = useState('');
  const [newPlatform, setNewPlatform] = useState<'telegram' | 'instagram' | 'tiktok' | 'youtube' | 'web'>('instagram');
  const [newCategory, setNewCategory] = useState('Инфлюенсер / Блогер');
  const [newFrequency, setNewFrequency] = useState('Каждый час');

  // Save to localStorage whenever channels change
  useEffect(() => {
    try {
      localStorage.setItem('checkactivity_monitored_accounts_v3', JSON.stringify(channels));
    } catch {
      // ignore
    }
  }, [channels]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleQuickAddUrl = () => {
    if (!quickUrlInput.trim()) {
      showToast('Пожалуйста, введите ссылку на профиль или пост.');
      return;
    }
    const input = quickUrlInput.trim();
    const lower = input.toLowerCase();
    const platform = lower.includes('t.me') || lower.includes('telegram')
      ? 'telegram'
      : lower.includes('tiktok')
      ? 'tiktok'
      : lower.includes('youtube') || lower.includes('youtu.be')
      ? 'youtube'
      : 'instagram';

    setQuickStepActive(1);
    setTimeout(() => setQuickStepActive(2), 400);
    setTimeout(() => setQuickStepActive(3), 800);
    setTimeout(() => setQuickStepActive(4), 1200);
    setTimeout(() => {
      setQuickStepActive(5);
      const isCasino = lower.includes('capper') || lower.includes('1win') || lower.includes('bet') || lower.includes('slot');
      const isPromo = lower.includes('zheka') || lower.includes('promo') || lower.includes('sale');
      const youtubeUrl = platform === 'youtube' && /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(input);
      const youtubeHandleMatch = input.match(/^(https?:\/\/)?(www\.)?youtube\.com\/(@[^/?#]+)/i);
      const handleClean = youtubeUrl
        ? youtubeHandleMatch?.[3] || input
        : input.replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com|t\.me)\//i, '@').split('/')[0] || input;

      const newChan: MonitoringChannel = {
        id: `mon-${Date.now()}`,
        name: youtubeUrl && !youtubeHandleMatch ? 'YouTube ссылка' : handleClean.replace('@', ''),
        platform,
        platformLabel: platform === 'instagram' ? 'Instagram KZ' : platform === 'telegram' ? 'Telegram KZ' : platform === 'youtube' ? 'YouTube KZ' : 'TikTok KZ',
        handleOrUrl: handleClean.startsWith('@') || youtubeUrl ? handleClean : '@' + handleClean,
        subscribersOrVolume: 'Отслеживаемый аккаунт',
        frequency: 'Каждые 30 минут',
        lastScan: 'Только что',
        violations24h: isCasino ? 2 : isPromo ? 1 : 0,
        status: isCasino || isPromo ? 'ALERT' : 'LIVE',
        alertNote: isCasino
          ? 'Обнаружены признаки рекламы нелицензированных онлайн-казино (ст. 445-1 КоАП РК)'
          : isPromo
          ? 'Публикация без обязательной маркировки рекламы (Закон № 230-VII)'
          : undefined,
        riskScore: isCasino ? 88 : isPromo ? 62 : 12,
        category: isCasino ? 'Подозрительный / Гемблинг' : 'Инфлюенсер / Блогер',
        recentPosts: [
          {
            id: `post-q-${Date.now()}`,
            date: 'Только что',
            type: 'story',
            content: `Мониторинг зафиксировал свежую публикацию профиля ${handleClean}.`,
            hasViolation: isCasino || isPromo,
            violationTitle: isCasino ? 'Реклама азартных игр (ст. 445-1 КоАП РК)' : isPromo ? 'Скрытая реклама без «Жарнама»' : undefined,
            lawCode: isCasino ? 'ст. 445-1 КоАП РК' : isPromo ? 'ст. 455 КоАП РК' : undefined,
            fineRisk: isCasino ? 'до 1 000 МРП' : isPromo ? 'до 60 МРП' : undefined,
            severity: isCasino ? 'critical' : isPromo ? 'warning' : 'info',
          },
        ],
      };

      setChannels((prev) => [newChan, ...prev]);
      setQuickUrlInput('');
      setQuickStepActive(null);
      showToast(`Аккаунт ${newChan.handleOrUrl} успешно включен в круглосуточный 24/7 список мониторинга!`);
    }, 1700);
  };

  // Run instant AI scan on single account
  const handleScanSingleAccount = async (channel: MonitoringChannel) => {
    setScanningChannelId(channel.id);
    try {
      const result = await scanAccount(channel);
      setChannels((prev) =>
        prev.map((c) => {
          if (c.id === channel.id) {
            return {
              ...c,
              lastScan: 'Только что',
              violations24h: result.violations24h,
              riskScore: result.riskScore,
              status: result.status,
              alertNote: result.alertNote,
              recentPosts: result.recentPosts || c.recentPosts,
            };
          }
          return c;
        })
      );

      if (selectedDossierChannel && selectedDossierChannel.id === channel.id) {
        setSelectedDossierChannel((prev) =>
          prev
            ? {
                ...prev,
                lastScan: 'Только что',
                violations24h: result.violations24h,
                riskScore: result.riskScore,
                status: result.status,
                alertNote: result.alertNote,
                recentPosts: result.recentPosts || prev.recentPosts,
              }
            : null
        );
      }

      showToast(
        result.violations24h > 0
          ? `Сканирование ${channel.handleOrUrl} завершено: обнаружено ${result.violations24h} замечание(й)!`
          : `Сканирование ${channel.handleOrUrl} завершено: нарушений не обнаружено (Безопасно).`
      );
    } catch {
      showToast(`Ошибка проверки аккаунта ${channel.handleOrUrl}.`);
    } finally {
      setScanningChannelId(null);
    }
  };

  // Run full cycle across all channels
  const handleBatchScanAll = async () => {
    setIsBatchScanning(true);
    showToast('Запущен цикл параллельного экспресс-аудита всех аккаунтов...');
    for (const channel of channels) {
      if (channel.status !== 'PAUSED') {
        try {
          const result = await scanAccount(channel);
          setChannels((prev) =>
            prev.map((c) =>
              c.id === channel.id
                ? {
                    ...c,
                    lastScan: 'Только что',
                    violations24h: result.violations24h,
                    riskScore: result.riskScore,
                    status: result.status,
                    alertNote: result.alertNote,
                    recentPosts: result.recentPosts || c.recentPosts,
                  }
                : c
            )
          );
        } catch {
          // ignore
        }
      }
    }
    setIsBatchScanning(false);
    showToast('Цикл мониторинга успешно завершен. Реестр обновлен!');
  };

  const handleTogglePause = (channelId: string) => {
    setChannels((prev) =>
      prev.map((c) => {
        if (c.id === channelId) {
          const nextStatus: 'ALERT' | 'LIVE' | 'PAUSED' = c.status === 'PAUSED' ? (c.violations24h > 0 ? 'ALERT' : 'LIVE') : 'PAUSED';
          return { ...c, status: nextStatus };
        }
        return c;
      })
    );
  };

  const handleDeleteChannel = (channelId: string) => {
    setChannels((prev) => prev.filter((c) => c.id !== channelId));
    if (selectedDossierChannel?.id === channelId) setSelectedDossierChannel(null);
    showToast('Аккаунт удален из мониторинга.');
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHandle.trim()) return;

    let cleanHandle = newHandle.trim();
    if (!cleanHandle.startsWith('@') && !cleanHandle.startsWith('http')) {
      cleanHandle = '@' + cleanHandle;
    }

    const platformLabels: Record<string, string> = {
      instagram: 'Instagram',
      telegram: 'Telegram KZ',
      tiktok: 'TikTok KZ',
      youtube: 'YouTube',
      web: 'Веб-ресурс',
    };

    const newChannel: MonitoringChannel = {
      id: `mon-${Date.now()}`,
      name: newName.trim() || cleanHandle,
      platform: newPlatform,
      platformLabel: platformLabels[newPlatform] || 'Онлайн',
      handleOrUrl: cleanHandle,
      subscribersOrVolume: 'Сбор данных...',
      frequency: newFrequency,
      lastScan: 'Ожидает проверки',
      violations24h: 0,
      status: 'LIVE',
      riskScore: 5,
      category: newCategory,
      recentPosts: [
        {
          id: `post-${Date.now()}`,
          date: 'Только что подключен',
          type: 'post',
          content: `Аккаунт ${cleanHandle} успешно добавлен в систему мониторинга законодательства РК (Закон № 230-VII, ст. 455, 445-1 КоАП).`,
          hasViolation: false,
        },
      ],
    };

    setChannels((prev) => [newChannel, ...prev]);
    setShowAddModal(false);
    setNewHandle('');
    setNewName('');
    showToast(`Аккаунт ${cleanHandle} успешно добавлен на мониторинг!`);

    // Trigger instant initial scan
    setTimeout(() => {
      handleScanSingleAccount(newChannel);
    }, 600);
  };

  // Convert monitored incident to full audit case for ExpertReportView
  const handleOpenCaseFromPost = (channel: MonitoringChannel, post: MonitoredPost) => {
    const isCritical = post.severity === 'critical';
    const auditCase: AuditCase = {
      id: `audit-${Date.now()}`,
      referenceNumber: `#CHK-KZ-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }) + ' (Астана)',
      sourceType: 'url',
      title: `${channel.name} (${post.type.toUpperCase()} от ${post.date})`,
      sourceName: channel.handleOrUrl,
      sha256: Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('') + '...d82a',
      riskScore: isCritical ? 85 : 55,
      legalScore: isCritical ? 90 : 50,
      ethicsScore: isCritical ? 80 : 45,
      riskLevel: isCritical ? 'Критический' : 'Высокий',
      status: 'ТРЕБУЕТ МЕР',
      summary: `Зафиксировано нарушение норм законодательства РК в аккаунте ${channel.handleOrUrl}: ${post.violationTitle || 'Несоблюдение требований к онлайн-контенту'}.`,
      ethicsSummary: 'Контент содержит элементы токсичной коммуникации, скрытого промотирования или нарушений цифровой этики.',
      extractedText: post.content,
      detectedActions: `Автоматический мониторинг аккаунта ${channel.platformLabel} (${channel.handleOrUrl}).`,
      violations: [
        {
          id: 'v-mon-1',
          category: 'legal',
          code: post.lawCode || 'ст. 455 КоАП РК / Закон № 230-VII',
          title: post.violationTitle || 'Правонарушение в онлайн-платформе',
          severity: post.severity || 'critical',
          quote: post.content.slice(0, 100),
          basis: `В публикации аккаунта ${channel.handleOrUrl} обнаружены признаки нарушения: ${post.violationTitle}. Согласно законодательству РК требуется устранение нарушения.`,
          fineAmount: post.fineRisk || 'до 200 МРП (786 400 ₸)',
          jurisdiction: channel.platform === 'telegram' ? 'МКИ РК / АФМ РК' : 'МКИ РК',
          recommendation: 'Устранить публикацию либо нанести обязательную маркировку «Жарнама» и данные рекламодателя БИН.',
        },
      ],
      metadata: {
        fileSize: 'Lenta API Post',
        engineConfidence: 99.2,
        platform: `Check Activity Monitor KZ • ${channel.platformLabel}`,
      },
    };

    onOpenReportForCase(auditCase);
  };

  // Filter channels
  const filteredChannels = channels.filter((c) => {
    const matchesPlatform = platformFilter === 'all' ? true : platformFilter === 'alert' ? c.status === 'ALERT' : c.platform === platformFilter;
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.handleOrUrl.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.category && c.category.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesPlatform && matchesSearch;
  });

  // Summary KPI metrics
  const totalChannels = channels.length;
  const alertCount = channels.filter((c) => c.status === 'ALERT').length;
  const totalViolations24h = channels.reduce((acc, c) => acc + (c.violations24h || 0), 0);
  const avgCompliance =
    totalChannels > 0
      ? Math.round(
          channels.reduce((acc, c) => acc + (100 - (c.riskScore || 0)), 0) / totalChannels
        )
      : 100;

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 font-['Inter']">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 flex items-center gap-3 animate-fade-in text-xs sm:text-sm max-w-md">
          <span className="material-symbols-outlined text-sky-400 text-[20px]">info</span>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-auto text-slate-400 hover:text-white">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[20px]">hub</span>
            </div>
            <h1 className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              Мониторинг аккаунтов и каналов
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-3xl leading-relaxed">
            Постоянный автоматизированный надзор за инфлюенсерами, пабликами и коммерческими страницами Казахстана (Закон № 230-VII об онлайн-платформах и рекламе, ст. 455, 445-1, 434 КоАП РК).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={handleBatchScanAll}
            disabled={isBatchScanning}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-xs text-xs sm:text-sm font-medium transition-all disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] text-sky-600 ${isBatchScanning ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>{isBatchScanning ? 'Сканирование...' : 'Сканировать все'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-xs text-xs sm:text-sm font-semibold transition-all hover:shadow"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>+ Добавить аккаунт</span>
          </button>
        </div>
      </div>

      {/* 24/7 Monitoring Process & Hero Banner from User Reference Screenshot */}
      <div className="bg-gradient-to-r from-sky-50 via-white to-slate-50 border border-sky-200/80 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col gap-4 sm:gap-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] font-['JetBrains_Mono'] uppercase tracking-wider font-bold text-sky-700 bg-sky-100 px-2.5 py-1 rounded-md border border-sky-200">
            КЛЮЧЕВАЯ ФУНКЦИЯ
          </span>
          <span className="text-xs text-slate-500 font-medium font-['JetBrains_Mono']">
            Интеграция: Instagram • Telegram • TikTok • YouTube
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <h2 className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            24/7 Мониторинг подозрительных аккаунтов
          </h2>
          <p className="text-xs text-slate-600">
            Система в автоматическом режиме осуществляет постоянный сбор постов, сторис и комментариев с последующим анализом правовых и этических аномалий.
          </p>
        </div>

        {/* 5-Step Process Visualizer Bar matching User Screenshot */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5">
          {[
            { step: 'ШАГ 1', title: 'Ввод ссылки', desc: 'Профиль или публикация' },
            { step: 'ШАГ 2', title: 'Включение в 24/7 список', desc: 'Авто-постановка на учет' },
            { step: 'ШАГ 3', title: 'Сбор постов и сторис', desc: 'Периодический парсинг' },
            { step: 'ШАГ 4', title: 'ИИ-анализ аномалий', desc: 'Сверка с КоАП и этикой' },
            { step: 'ШАГ 5', title: 'Уведомление и статус', desc: 'Протокол комплаенса' },
          ].map((item, idx) => {
            const isStepActive = quickStepActive === idx + 1;
            return (
              <div
                key={item.step}
                className={`bg-white border rounded-xl p-3 shadow-xs flex flex-col relative transition-all ${
                  isStepActive
                    ? 'border-sky-500 ring-2 ring-sky-200 bg-sky-50/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                      isStepActive
                        ? 'bg-sky-600 text-white border-sky-600 animate-pulse'
                        : 'bg-sky-50 text-sky-700 border-sky-200'
                    }`}
                  >
                    {item.step}
                  </span>
                  {idx < 4 && (
                    <span className="hidden sm:inline material-symbols-outlined text-slate-400 text-[14px]">
                      chevron_right
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-slate-900 mt-0.5">{item.title}</span>
                <span className="text-[10px] text-slate-500 mt-0.5">{item.desc}</span>
              </div>
            );
          })}
        </div>

        {/* Quick Link Enrollment Bar matching Step 1 & Step 2 */}
        <div className="flex flex-col sm:flex-row items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
          <div className="relative flex-1 w-full">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[18px]">
              link
            </span>
            <input
              type="text"
              value={quickUrlInput}
              onChange={(e) => setQuickUrlInput(e.target.value)}
              placeholder="Вставьте ссылку на аккаунт или публикацию: https://instagram.com/kris_p_almaty или @zheka_fatbelly..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-transparent border-0 focus:outline-none text-slate-900 placeholder:text-slate-400 font-['Inter']"
            />
          </div>
          <button
            onClick={handleQuickAddUrl}
            disabled={quickStepActive !== null}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-xs disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              {quickStepActive ? 'hourglass_top' : 'add_task'}
            </span>
            {quickStepActive ? `Выполняется шаг ${quickStepActive}...` : 'Добавить в 24/7 список'}
          </button>
        </div>

        {/* Anomalies Under Control and Statuses from User Screenshot */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2 font-['Plus_Jakarta_Sans']">
              <span className="material-symbols-outlined text-sky-600 text-[18px]">verified_user</span>
              Аномалии под контролем:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-700">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                <span>Всплески активности</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                <span>Спам и ботофермы</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                <span className="font-semibold text-rose-700">Реклама казино</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                <span>Язык вражды</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                <span>Утечки персданных</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                <span>Скрытые манипуляции</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5 mb-2 font-['Plus_Jakarta_Sans']">
              <span className="material-symbols-outlined text-emerald-600 text-[18px]">assignment_turned_in</span>
              Статусы комплаенс-контроля:
            </span>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                ✔ Безопасно
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                ⚠ Предупреждение
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                ! Требует внимания
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-['JetBrains_Mono']">
              Сверка по нормам КоАП РК, Закона № 230-VII и кодекса цифровой этики.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Аккаунтов на контроле</span>
            <span className="material-symbols-outlined text-[18px] text-sky-600">visibility</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-slate-900">
              {totalChannels}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              LIVE
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Instagram, Telegram, TikTok, YouTube</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Инцидентов за 24 ч</span>
            <span className="material-symbols-outlined text-[18px] text-rose-500">warning</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-rose-600">
              {totalViolations24h}
            </span>
            <span className="text-[10px] text-rose-700 font-semibold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
              Зафиксировано
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Скрытая реклама, ставки, маты</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Каналов с ALERT</span>
            <span className="material-symbols-outlined text-[18px] text-amber-500">notifications_active</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-amber-600">
              {alertCount}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">из {totalChannels}</span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Требуют правового реагирования</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Индекс соответствия РК</span>
            <span className="material-symbols-outlined text-[18px] text-emerald-600">verified</span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-emerald-600">
              {avgCompliance}%
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              Норма
            </span>
          </div>
          <span className="text-[11px] text-slate-500 mt-1">Общий комплаенс-рейтинг</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по никнейму (@...), названию или категории..."
            className="w-full bg-slate-50 pl-10 pr-4 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none"
          />
        </div>

        {/* Platform Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'Все' },
            { id: 'instagram', label: 'Instagram' },
            { id: 'telegram', label: 'Telegram' },
            { id: 'tiktok', label: 'TikTok' },
            { id: 'youtube', label: 'YouTube' },
            { id: 'alert', label: '🚨 ALERT' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPlatformFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                platformFilter === tab.id
                  ? 'bg-sky-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredChannels.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 text-sm">
            Аккаунтов по выбранному фильтру не найдено. Нажмите «+ Добавить аккаунт», чтобы подключить новый канал.
          </div>
        ) : (
          filteredChannels.map((channel) => {
            const isAlert = channel.status === 'ALERT';
            const isPaused = channel.status === 'PAUSED';
            const isScanning = scanningChannelId === channel.id;
            const risk = channel.riskScore || 10;

            const platformBadgeColors: Record<string, string> = {
              instagram: 'bg-gradient-to-r from-pink-500 to-rose-500 text-white',
              telegram: 'bg-sky-500 text-white',
              tiktok: 'bg-slate-900 text-white',
              youtube: 'bg-red-600 text-white',
              web: 'bg-slate-700 text-white',
            };

            return (
              <div
                key={channel.id}
                className={`bg-white rounded-xl border transition-all flex flex-col justify-between p-4 shadow-xs hover:shadow-md ${
                  isAlert
                    ? 'border-rose-300 ring-1 ring-rose-100'
                    : isPaused
                    ? 'border-slate-200 opacity-75'
                    : 'border-slate-200'
                }`}
              >
                {/* Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${platformBadgeColors[channel.platform] || 'bg-slate-800 text-white'}`}>
                        {channel.platform === 'instagram' ? 'IG' : channel.platform === 'telegram' ? 'TG' : channel.platform === 'tiktok' ? 'TT' : 'YT'}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-['Plus_Jakarta_Sans'] font-bold text-sm text-slate-900 leading-tight">
                          {channel.name}
                        </span>
                        <span className="text-xs text-sky-600 font-mono mt-0.5">
                          {channel.handleOrUrl}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAlert ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          ALERT ({channel.violations24h})
                        </span>
                      ) : isPaused ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          ПАУЗА
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category & Audience */}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2.5">
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium">
                      {channel.category || 'Медиа'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {channel.subscribersOrVolume}
                    </span>
                  </div>

                  {/* Risk Score Meter */}
                  <div className="mt-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-600 font-medium">Индекс риска:</span>
                      <span
                        className={`font-mono font-bold text-xs ${
                          risk >= 70 ? 'text-rose-600' : risk >= 40 ? 'text-amber-600' : 'text-emerald-600'
                        }`}
                      >
                        {risk}/100 ({risk >= 70 ? 'Критический' : risk >= 40 ? 'Средний' : 'Низкий'})
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          risk >= 70 ? 'bg-rose-500' : risk >= 40 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${risk}%` }}
                      />
                    </div>
                  </div>

                  {/* Alert Note or Recent Violation */}
                  {channel.alertNote && (
                    <div className="mt-2.5 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-start gap-1.5 leading-snug">
                      <span className="material-symbols-outlined text-[14px] text-rose-600 shrink-0 mt-0.5">error</span>
                      <span>{channel.alertNote}</span>
                    </div>
                  )}

                  {/* Last Scan & Frequency */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span>Интервал: {channel.frequency}</span>
                    <span>Скан: {channel.lastScan}</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                  <button
                    onClick={() => handleScanSingleAccount(channel)}
                    disabled={isScanning}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold border border-sky-200 transition-colors disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-[16px] ${isScanning ? 'animate-spin' : ''}`}>
                      {isScanning ? 'refresh' : 'radar'}
                    </span>
                    <span>{isScanning ? 'Сканирование...' : 'Скан'}</span>
                  </button>

                  <button
                    onClick={() => setSelectedDossierChannel(channel)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">folder_open</span>
                    <span>Досье</span>
                  </button>

                  <button
                    onClick={() => handleTogglePause(channel.id)}
                    title={isPaused ? 'Возобновить мониторинг' : 'Поставить на паузу'}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {isPaused ? 'play_arrow' : 'pause'}
                    </span>
                  </button>

                  <button
                    onClick={() => handleDeleteChannel(channel.id)}
                    title="Удалить из мониторинга"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Live Stream of Monitored Incidents Across All Channels */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5 mt-2">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-600 text-[20px]">notifications_active</span>
            <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-base sm:text-lg text-slate-900">
              Лента зафиксированных инцидентов и публикаций
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono">Автоматическая фиксация правонарушений РК</span>
        </div>

        <div className="flex flex-col gap-3">
          {channels
            .flatMap((ch) =>
              (ch.recentPosts || [])
                .filter((p) => p.hasViolation)
                .map((p) => ({ ...p, channel: ch }))
            )
            .slice(0, 5)
            .map((item) => (
              <div
                key={item.id}
                className="p-3 sm:p-4 rounded-xl border border-rose-200 bg-rose-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-rose-50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    {item.channel.platform === 'instagram' ? 'IG' : item.channel.platform === 'telegram' ? 'TG' : 'TT'}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs sm:text-sm text-slate-900">{item.channel.name}</span>
                      <span className="text-xs text-sky-600 font-mono">{item.channel.handleOrUrl}</span>
                      <span className="text-[10px] text-slate-400 font-mono">• {item.date}</span>
                    </div>
                    <p className="text-xs text-slate-700 mt-1 leading-relaxed bg-white/70 p-2 rounded border border-rose-100 font-mono">
                      "{item.content}"
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                        {item.violationTitle}
                      </span>
                      {item.lawCode && (
                        <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {item.lawCode}
                        </span>
                      )}
                      {item.fineRisk && (
                        <span className="text-rose-600 font-semibold font-mono">
                          Штраф: {item.fineRisk}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => handleOpenCaseFromPost(item.channel, item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">assessment</span>
                    <span>Открыть экспертный отчет</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Account Dossier Modal */}
      {selectedDossierChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
                  {selectedDossierChannel.platform === 'instagram' ? 'IG' : selectedDossierChannel.platform === 'telegram' ? 'TG' : 'TT'}
                </div>
                <div>
                  <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base sm:text-lg text-slate-900">
                    Досье: {selectedDossierChannel.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                    <span className="text-sky-600 font-bold">{selectedDossierChannel.handleOrUrl}</span>
                    <span>• {selectedDossierChannel.platformLabel}</span>
                    <span>• {selectedDossierChannel.subscribersOrVolume}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDossierChannel(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-4">
              {/* Compliance Rating Meter */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-medium">Статус комплаенса в РК:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xl font-bold font-['Plus_Jakarta_Sans'] ${selectedDossierChannel.status === 'ALERT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {selectedDossierChannel.status === 'ALERT' ? 'ТРЕБУЕТ УСТРАНЕНИЯ' : 'ПОЛНОЕ СООТВЕТСТВИЕ'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-600 mt-0.5 block">
                    Последняя проверка: {selectedDossierChannel.lastScan}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500 uppercase font-medium">Индекс риска</span>
                  <div className="text-2xl font-bold font-mono text-slate-900 mt-0.5">
                    {selectedDossierChannel.riskScore || 10}/100
                  </div>
                </div>
              </div>

              {/* Monitored Posts Feed */}
              <div>
                <h4 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-sky-600">history_edu</span>
                  <span>Последние публикации и проверки в аккаунте:</span>
                </h4>

                <div className="flex flex-col gap-3">
                  {(selectedDossierChannel.recentPosts || []).map((post) => (
                    <div
                      key={post.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        post.hasViolation ? 'bg-rose-50/50 border-rose-200' : 'bg-slate-50/60 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-slate-700 capitalize">
                          {post.type} • {post.date}
                        </span>
                        {post.hasViolation ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                            НАРУШЕНИЕ
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            В НОРМЕ
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-800 leading-relaxed font-mono bg-white p-2.5 rounded border border-slate-200">
                        {post.content}
                      </p>

                      {post.hasViolation && (
                        <div className="mt-2.5 pt-2 border-t border-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="text-xs text-rose-700">
                            <span className="font-bold">{post.violationTitle}</span>
                            <span className="ml-1 text-slate-500 font-mono">({post.lawCode})</span>
                          </div>
                          <button
                            onClick={() => handleOpenCaseFromPost(selectedDossierChannel, post)}
                            className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors shrink-0"
                          >
                            Сформировать отчет
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => handleScanSingleAccount(selectedDossierChannel)}
                disabled={scanningChannelId === selectedDossierChannel.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                <span className={`material-symbols-outlined text-[16px] ${scanningChannelId === selectedDossierChannel.id ? 'animate-spin' : ''}`}>
                  refresh
                </span>
                <span>{scanningChannelId === selectedDossierChannel.id ? 'Сканирование...' : 'Запустить повторный скан'}</span>
              </button>

              <button
                onClick={() => setSelectedDossierChannel(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Monitored Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-sky-600 text-[22px]">add_moderator</span>
                <h3 className="font-['Plus_Jakarta_Sans'] font-bold text-base sm:text-lg text-slate-900">
                  Добавить аккаунт на мониторинг
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-4 sm:p-6 flex flex-col gap-4">
              {/* Platform selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  Платформа:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'instagram', label: 'Instagram' },
                    { id: 'telegram', label: 'Telegram' },
                    { id: 'tiktok', label: 'TikTok' },
                    { id: 'youtube', label: 'YouTube' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setNewPlatform(p.id as any)}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        newPlatform === p.id
                          ? 'bg-sky-50 text-sky-700 border-sky-400 ring-2 ring-sky-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Handle / URL */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  Никнейм или ссылка (@username / t.me/...):
                </label>
                <input
                  type="text"
                  required
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="@almaty_blogger_kz или t.me/channel"
                  className="w-full bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                  Название страницы / Бренд (необязательно):
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Блогер Аружан / Магазин техники"
                  className="w-full bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              {/* Category & Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Категория:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Инфлюенсер / Блогер">Инфлюенсер / Блогер</option>
                    <option value="Новостной паблик">Новостной паблик</option>
                    <option value="Онлайн-магазин">Онлайн-магазин</option>
                    <option value="Эксперт / Курсы">Эксперт / Курсы</option>
                    <option value="Развлечения">Развлекательный</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
                    Частота аудита:
                  </label>
                  <select
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 text-xs text-slate-800 rounded-lg px-3 py-2.5 focus:outline-none focus:border-sky-500"
                  >
                    <option value="Каждые 15 минут">Каждые 15 минут</option>
                    <option value="Каждый час">Каждый час</option>
                    <option value="Каждые 6 часов">Каждые 6 часов</option>
                    <option value="1 раз в сутки">1 раз в сутки</option>
                  </select>
                </div>
              </div>

              {/* Legal compliance notice */}
              <div className="p-3 bg-sky-50/60 rounded-xl border border-sky-200 text-[11px] text-sky-900 flex items-start gap-2">
                <span className="material-symbols-outlined text-[16px] text-sky-600 shrink-0 mt-0.5">verified_user</span>
                <span>
                  Система начнет непрерывный аудит по Закону РК «Об онлайн-платформах и онлайн-рекламе» (№ 230-VII), запрету рекламы казино (ст. 445-1 КоАП) и нормам цифровой этики.
                </span>
              </div>

              {/* Form buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Подключить мониторинг
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
