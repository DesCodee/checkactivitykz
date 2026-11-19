/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileCheck2,
  FolderOpen,
  History,
  Info,
  Link2,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldPlus,
  Trash2,
  X,
} from 'lucide-react';
import { MonitoringChannel, MonitoredPost, AuditCase } from '../types';
import { MOCK_MONITORING_CHANNELS } from '../data/mockData';
import { scanAccount } from '../services/geminiService';
import { computeSha256FromText } from '../utils/cryptoHash';
import { useApp } from '../utils/i18n';

interface AccountMonitoringViewProps {
  onOpenReportForCase: (auditCase: AuditCase) => void;
  onNavigateToScanner: () => void;
}

export const AccountMonitoringView: React.FC<AccountMonitoringViewProps> = ({
  onOpenReportForCase,
}) => {
  const { t, language } = useApp();
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
      : lower.includes('youtube')
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
      const handleClean = input.replace(/^https?:\/\/(www\.)?(instagram\.com|tiktok\.com|t\.me)\//i, '@').split('/')[0] || input;

      const newChan: MonitoringChannel = {
        id: `mon-${Date.now()}`,
        name: handleClean.replace('@', ''),
        platform,
        platformLabel: platform === 'instagram' ? 'Instagram KZ' : platform === 'telegram' ? 'Telegram KZ' : 'TikTok KZ',
        handleOrUrl: handleClean.startsWith('@') ? handleClean : '@' + handleClean,
        subscribersOrVolume: 'Отслеживаемый аккаунт',
        frequency: 'Каждые 30 минут',
        lastScan: 'Только что',
        violations24h: isCasino ? 2 : isPromo ? 1 : 0,
        status: isCasino || isPromo ? 'ALERT' : 'LIVE',
        alertNote: isCasino
          ? 'Обнаружены признаки рекламы онлайн-казино (ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона «О рекламе»)'
          : isPromo
          ? 'Скрытая реклама без обязательной маркировки (ч. 2 ст. 455 КоАП РК / Приказ МКИ № 59-НҚ)'
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
            violationTitle: isCasino
              ? 'Реклама онлайн-казино и азартных игр (ч. 1 ст. 455 КоАП РК)'
              : isPromo
              ? 'Скрытая реклама без «Жарнама» (ч. 2 ст. 455 КоАП РК)'
              : undefined,
            lawCode: isCasino
              ? 'ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»'
              : isPromo
              ? 'ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ'
              : undefined,
            fineRisk: isCasino ? '60–450 МРП' : isPromo ? '35–400 МРП' : undefined,
            severity: isCasino || isPromo ? 'critical' : 'info',
          },
        ],
      };

      setChannels((prev) => [newChan, ...prev]);
      setQuickUrlInput('');
      setQuickStepActive(null);
      showToast(`Аккаунт ${newChan.handleOrUrl} добавлен в 24/7 мониторинг — выполняется live-проверка...`);
      setTimeout(() => {
        handleScanSingleAccount(newChan);
      }, 250);
    }, 900);
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
              name: result.channelTitle || c.name,
              lastScan: result.lastScan || 'Только что',
              isLiveScraped: result.isLiveScraped,
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
                name: result.channelTitle || prev.name,
                lastScan: result.lastScan || 'Только что',
                isLiveScraped: result.isLiveScraped,
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
                    name: result.channelTitle || c.name,
                    lastScan: result.lastScan || 'Только что',
                    isLiveScraped: result.isLiveScraped,
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
          content: `Аккаунт ${cleanHandle} успешно добавлен в систему мониторинга законодательства РК (ч. 1–3 ст. 455 КоАП РК, Закон № 230-VII, Приказ МКИ № 59-НҚ).`,
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
  const handleOpenCaseFromPost = async (channel: MonitoringChannel, post: MonitoredPost) => {
    const isCritical = post.severity === 'critical';
    const computedSha256 = await computeSha256FromText(
      `${channel.handleOrUrl}|${post.id}|${post.content}`
    );
    const auditCase: AuditCase = {
      id: `audit-${Date.now()}`,
      referenceNumber: `#CHK-KZ-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }) + ' (Астана)',
      sourceType: 'url',
      title: `${channel.name} (${post.type.toUpperCase()} от ${post.date})`,
      sourceName: channel.handleOrUrl,
      sha256: computedSha256,
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
          code: post.lawCode || 'ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ',
          title: post.violationTitle || 'Правонарушение в онлайн-платформе',
          severity: post.severity || 'critical',
          quote: post.content.slice(0, 100),
          basis: `В публикации аккаунта ${channel.handleOrUrl} обнаружены признаки нарушения: ${post.violationTitle}. Согласно законодательству РК требуется устранение нарушения.`,
          fineAmount: post.fineRisk || '100 МРП (432 500 ₸) — до 400 МРП (1 730 000 ₸)',
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
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 font-['Inter']">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-3 rounded-xl shadow-lg border border-zinc-800 dark:border-zinc-200 flex items-center gap-3 animate-fade-in text-xs sm:text-sm max-w-md">
          <Info className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" strokeWidth={1.6} />
          <span className="leading-snug">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-auto text-zinc-400 hover:text-white dark:text-zinc-500 dark:hover:text-zinc-900 transition-colors"
            aria-label="Закрыть уведомление"
          >
            <X className="w-4 h-4" strokeWidth={1.6} />
          </button>
        </div>
      )}

      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {language === 'kz' ? '24/7 Тікелей бақылау' : 'Мониторинг 24/7'}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="font-['JetBrains_Mono'] text-[11px]">IG · TG · TT · YT</span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {t('monitoringHeroTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            {t('monitoringHeroDesc')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            onClick={handleBatchScanAll}
            disabled={isBatchScanning}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800 shadow-xs text-xs sm:text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-zinc-500 dark:text-zinc-400 ${isBatchScanning ? 'animate-spin' : ''}`} strokeWidth={1.6} />
            <span>{isBatchScanning ? (language === 'kz' ? 'Сканерлеуде...' : 'Сканирование...') : t('scanAllBtn')}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 shadow-xs text-xs sm:text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            <span>{t('addAccountBtn')}</span>
          </button>
        </div>
      </div>

      {/* 24/7 Monitoring Process & Quick Enrollment */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-['JetBrains_Mono'] text-[11px] uppercase tracking-wider font-medium text-zinc-500 dark:text-zinc-400">
                {language === 'kz' ? 'АВТОМАТТЫ ПАЙПЛАЙН' : 'АВТОМАТИЧЕСКИЙ ПАЙПЛАЙН'}
              </span>
            </div>
            <h2 className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mt-0.5">
              {language === 'kz' ? 'Күдікті аккаунттардың 24/7 мониторингі' : '24/7 Мониторинг подозрительных аккаунтов'}
            </h2>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono']">
            Instagram · Telegram · TikTok · YouTube
          </span>
        </div>

        {/* 5-Step Process Visualizer Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {[
            {
              step: language === 'kz' ? '01' : '01',
              title: language === 'kz' ? 'Сілтеме енгізу' : 'Ввод ссылки',
              desc: language === 'kz' ? 'Профиль немесе жарияланым' : 'Профиль или публикация',
            },
            {
              step: '02',
              title: language === 'kz' ? '24/7 тізімге қосу' : 'Включение в 24/7',
              desc: language === 'kz' ? 'Автоматты есепке қою' : 'Автопостановка на учет',
            },
            {
              step: '03',
              title: language === 'kz' ? 'Жазбаларды жинау' : 'Сбор контента',
              desc: language === 'kz' ? 'Мезгілдік парсинг' : 'Периодический парсинг',
            },
            {
              step: '04',
              title: language === 'kz' ? 'AI-аномалия талдауы' : 'Анализ аномалий',
              desc: language === 'kz' ? 'ӘҚБтК және этика' : 'КоАП РК и этика',
            },
            {
              step: '05',
              title: language === 'kz' ? 'Статус және хаттама' : 'Статус и протокол',
              desc: language === 'kz' ? 'Комплаенс хаттамасы' : 'Отчет комплаенса',
            },
          ].map((item, idx) => {
            const isStepActive = quickStepActive === idx + 1;
            return (
              <div
                key={item.step}
                className={`rounded-xl border p-3 flex flex-col justify-between transition-colors ${
                  isStepActive
                    ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800/70'
                    : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-[11px] font-['JetBrains_Mono'] font-medium px-1.5 py-0.5 rounded border tabular-nums ${
                      isStepActive
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                        : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200/80 dark:border-zinc-800'
                    }`}
                  >
                    {item.step}
                  </span>
                  {idx < 4 && (
                    <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700" strokeWidth={1.6} />
                  )}
                </div>
                <div>
                  <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 block">{item.title}</span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 block">{item.desc}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Link Enrollment Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2 bg-zinc-50 dark:bg-zinc-950 p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
          <div className="relative flex-1 w-full">
            <Link2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" strokeWidth={1.6} />
            <input
              type="text"
              value={quickUrlInput}
              onChange={(e) => setQuickUrlInput(e.target.value)}
              placeholder={
                language === 'kz'
                  ? 'Аккаунт немесе жазба сілтемесін қойыңыз: https://instagram.com/kris_p_almaty немесе @zheka_fatbelly...'
                  : 'Вставьте ссылку на аккаунт или публикацию: https://instagram.com/kris_p_almaty или @zheka_fatbelly...'
              }
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-transparent border-0 focus:outline-none text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
            />
          </div>
          <button
            onClick={handleQuickAddUrl}
            disabled={quickStepActive !== null}
            className="w-full sm:w-auto px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
          >
            {quickStepActive ? (
              <Clock className="w-3.5 h-3.5 animate-spin" strokeWidth={1.6} />
            ) : (
              <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
            )}
            <span>
              {quickStepActive
                ? (language === 'kz' ? `${quickStepActive}-қадам орындалуда...` : `Шаг ${quickStepActive}...`)
                : (language === 'kz' ? '24/7 тізіміне қосу' : 'Добавить в 24/7')}
            </span>
          </button>
        </div>

        {/* Anomalies & Statuses Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-50/70 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between">
            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-zinc-500 dark:text-zinc-400" strokeWidth={1.6} />
              {language === 'kz' ? 'Бақылаудағы аномалиялар' : 'Аномалии под контролем'}
            </span>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-zinc-700 dark:text-zinc-300">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                <span>{language === 'kz' ? 'Белсенділік артуы' : 'Всплески активности'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                <span>{language === 'kz' ? 'Спам және боттар' : 'Спам и ботофермы'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{language === 'kz' ? 'Казино жарнамасы' : 'Реклама казино'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>{language === 'kz' ? 'Өшпенділік тілі' : 'Язык вражды'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>{language === 'kz' ? 'Деректер ағуы' : 'Утечки персданных'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>{language === 'kz' ? 'Жасырын манипуляция' : 'Скрытые манипуляции'}</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-50/70 dark:bg-zinc-950/60 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 flex flex-col justify-between">
            <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2 mb-3">
              <FileCheck2 className="w-4 h-4 text-zinc-500 dark:text-zinc-400" strokeWidth={1.6} />
              {language === 'kz' ? 'Комплаенс мәртебелері' : 'Статусы комплаенс-контроля'}
            </span>
            <div className="divide-y divide-zinc-200/70 dark:divide-zinc-800 text-xs">
              <div className="flex items-center justify-between py-1.5 first:pt-0">
                <span className="text-zinc-700 dark:text-zinc-300">{language === 'kz' ? 'Заң № 230-VII / Этика' : 'Закон № 230-VII / Этика'}</span>
                <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-medium">
                  {language === 'kz' ? 'Қауіпсіз' : 'Безопасно'}
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-zinc-700 dark:text-zinc-300">{language === 'kz' ? 'Жарнама белгісі жоқ' : 'Отсутствие «Жарнама»'}</span>
                <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-medium">
                  {language === 'kz' ? 'Ескерту' : 'Предупреждение'}
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5 last:pb-0">
                <span className="text-zinc-700 dark:text-zinc-300">{language === 'kz' ? 'Тыйым салынған контент' : 'Запрещенный контент'}</span>
                <span className="inline-flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-medium">
                  {language === 'kz' ? 'Назар аудару' : 'Требует внимания'}
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">{t('accountsUnderControl')}</span>
            <Activity className="w-4 h-4 text-zinc-400" strokeWidth={1.6} />
          </div>
          <div className="mt-3 flex items-baseline gap-2.5">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums tracking-tight">
              {totalChannels}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              LIVE
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">Instagram, Telegram, TikTok, YouTube</span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">{t('incidents24h')}</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" strokeWidth={1.6} />
          </div>
          <div className="mt-3 flex items-baseline gap-2.5">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums tracking-tight">
              {totalViolations24h}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              {language === 'kz' ? 'Тіркелді' : 'Зафиксировано'}
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
            {language === 'kz' ? 'Жасырын жарнама, бәс, балағат' : 'Скрытая реклама, ставки, лексика'}
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">{t('alertChannels')}</span>
            <Bell className="w-4 h-4 text-amber-500" strokeWidth={1.6} />
          </div>
          <div className="mt-3 flex items-baseline gap-2.5">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums tracking-tight">
              {alertCount}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] tabular-nums">
              / {totalChannels}
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
            {language === 'kz' ? 'Құқықтық әрекет етуді талап етеді' : 'Требуют правового реагирования'}
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-4 sm:p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400">
            <span className="text-xs font-medium">{t('rkComplianceNorm')}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" strokeWidth={1.6} />
          </div>
          <div className="mt-3 flex items-baseline gap-2.5">
            <span className="font-['Plus_Jakarta_Sans'] text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums tracking-tight">
              {avgCompliance}%
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {language === 'kz' ? 'Қалыпты' : 'Норма'}
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
            {language === 'kz' ? 'Жалпы комплаенс рейтингі' : 'Общий комплаенс-рейтинг'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" strokeWidth={1.6} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'kz'
                ? 'Никнейм (@...), атауы немесе санаты бойынша іздеу...'
                : 'Поиск по никнейму (@...), названию или категории...'
            }
            className="w-full bg-zinc-50 dark:bg-zinc-950 pl-9 pr-4 py-2 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-200/80 dark:border-zinc-800 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: language === 'kz' ? 'Барлығы' : 'Все' },
            { id: 'instagram', label: 'Instagram' },
            { id: 'telegram', label: 'Telegram' },
            { id: 'tiktok', label: 'TikTok' },
            { id: 'youtube', label: 'YouTube' },
            { id: 'alert', label: 'ALERT' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPlatformFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                platformFilter === tab.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
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
          <div className="col-span-full bg-white dark:bg-zinc-900 p-8 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-center text-zinc-500 dark:text-zinc-400 text-sm">
            {language === 'kz'
              ? 'Таңдалған сүзгі бойынша аккаунттар табылмады. Жаңа арнаны қосу үшін «+ Аккаунт қосу» батырмасын басыңыз.'
              : 'Аккаунтов по выбранному фильтру не найдено. Нажмите «Добавить аккаунт», чтобы подключить новый канал.'}
          </div>
        ) : (
          filteredChannels.map((channel) => {
            const isAlert = channel.status === 'ALERT';
            const isPaused = channel.status === 'PAUSED';
            const isScanning = scanningChannelId === channel.id;
            const risk = channel.riskScore || 10;

            return (
              <div
                key={channel.id}
                className={`bg-white dark:bg-zinc-900 rounded-2xl border transition-all flex flex-col justify-between p-4 sm:p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 ${
                  isAlert
                    ? 'border-rose-300/90 dark:border-rose-900/70'
                    : isPaused
                    ? 'border-zinc-200/80 dark:border-zinc-800 opacity-75'
                    : 'border-zinc-200/80 dark:border-zinc-800'
                }`}
              >
                {/* Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-['JetBrains_Mono'] font-semibold text-xs shrink-0">
                        {channel.platform === 'instagram' ? 'IG' : channel.platform === 'telegram' ? 'TG' : channel.platform === 'tiktok' ? 'TT' : 'YT'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-zinc-900 dark:text-zinc-100 leading-tight truncate">
                          {channel.name}
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] mt-0.5 truncate">
                          {channel.handleOrUrl}
                        </span>
                      </div>
                    </div>

                    {/* Status Indicator */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAlert ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900 tabular-nums whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                          ALERT ({channel.violations24h})
                        </span>
                      ) : isPaused ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                          {language === 'kz' ? 'ҮЗІЛІС' : 'ПАУЗА'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900 whitespace-nowrap">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Category & Audience */}
                  <div className="mt-3.5 flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px] font-medium truncate">
                        {channel.category || (language === 'kz' ? 'Медиа' : 'Медиа')}
                      </span>
                      {channel.isLiveScraped && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 font-['JetBrains_Mono'] text-[9px] font-semibold shrink-0">
                          LIVE TG
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0">
                      {channel.subscribersOrVolume}
                    </span>
                  </div>

                  {/* Risk Score Meter */}
                  <div className="mt-3 bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/70 dark:border-zinc-800">
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                        {language === 'kz' ? 'Тәуекел индексі' : 'Индекс риска'}
                      </span>
                      <span
                        className={`font-['JetBrains_Mono'] font-semibold text-xs tabular-nums ${
                          risk >= 70 ? 'text-rose-600 dark:text-rose-400' : risk >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {risk}/100 ({risk >= 70 ? (language === 'kz' ? 'Сыни' : 'Критический') : risk >= 40 ? (language === 'kz' ? 'Орташа' : 'Средний') : (language === 'kz' ? 'Төмен' : 'Низкий')})
                      </span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          risk >= 70 ? 'bg-rose-500' : risk >= 40 ? 'bg-amber-500' : 'bg-zinc-900 dark:bg-zinc-100'
                        }`}
                        style={{ width: `${risk}%` }}
                      />
                    </div>
                  </div>

                  {/* Alert Note or Recent Violation */}
                  {channel.alertNote && (
                    <div className="mt-3 p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 text-[11px] flex items-start gap-2 leading-snug">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" strokeWidth={1.6} />
                      <span>{channel.alertNote}</span>
                    </div>
                  )}

                  {/* Last Scan & Frequency */}
                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono']">
                    <span className="truncate">{language === 'kz' ? 'Интервал' : 'Интервал'}: {channel.frequency}</span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {channel.isLiveScraped && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900 text-[10px]">
                          LIVE TG
                        </span>
                      )}
                      <span>{channel.lastScan}</span>
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
                  <button
                    onClick={() => handleScanSingleAccount(channel)}
                    disabled={isScanning}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {isScanning ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.6} />
                    ) : (
                      <Radar className="w-3.5 h-3.5" strokeWidth={1.6} />
                    )}
                    <span>{isScanning ? (language === 'kz' ? 'Сканерлеу...' : 'Сканирование...') : t('scanBtn')}</span>
                  </button>

                  <button
                    onClick={() => setSelectedDossierChannel(channel)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-medium transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.6} />
                    <span>{t('dossierBtn')}</span>
                  </button>

                  <button
                    onClick={() => handleTogglePause(channel.id)}
                    title={isPaused ? (language === 'kz' ? 'Жалғастыру' : 'Возобновить') : (language === 'kz' ? 'Үзіліске қою' : 'Поставить на паузу')}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {isPaused ? <Play className="w-4 h-4" strokeWidth={1.6} /> : <Pause className="w-4 h-4" strokeWidth={1.6} />}
                  </button>

                  <button
                    onClick={() => handleDeleteChannel(channel.id)}
                    title={language === 'kz' ? 'Мониторингтен жою' : 'Удалить из мониторинга'}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.6} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Live Stream of Monitored Incidents Across All Channels */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-100 dark:border-zinc-800 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <h2 className="font-['Plus_Jakarta_Sans'] font-semibold text-base sm:text-lg text-zinc-900 dark:text-zinc-100">
              {t('liveIncidentFeed')}
            </h2>
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono']">
            {language === 'kz' ? 'ҚР құқық бұзушылықтарын автоматты тіркеу' : 'Автоматическая фиксация правонарушений РК'}
          </span>
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
                className="p-3.5 sm:p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/60 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-['JetBrains_Mono'] font-semibold text-xs shrink-0 mt-0.5">
                    {item.channel.platform === 'instagram' ? 'IG' : item.channel.platform === 'telegram' ? 'TG' : 'TT'}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">{item.channel.name}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono']">{item.channel.handleOrUrl}</span>
                      <span className="text-[11px] text-zinc-400 font-['JetBrains_Mono']">· {item.date}</span>
                      {item.views && (
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] tabular-nums">
                          · {item.views} просм.
                        </span>
                      )}
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-['JetBrains_Mono'] text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white underline"
                        >
                          <span>t.me</span>
                          <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
                        </a>
                      )}
                    </div>
                    <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1.5 leading-relaxed bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 font-['JetBrains_Mono']">
                      &ldquo;{item.content}&rdquo;
                    </p>
                    <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px]">
                      <span className="inline-flex items-center gap-1.5 font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-200/80 dark:border-rose-900">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        {item.violationTitle}
                      </span>
                      {item.lawCode && (
                        <span className="font-['JetBrains_Mono'] text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                          {item.lawCode}
                        </span>
                      )}
                      {item.fineRisk && (
                        <span className="text-rose-600 dark:text-rose-400 font-medium font-['JetBrains_Mono'] tabular-nums">
                          {language === 'kz' ? 'Айыппұл:' : 'Штраф:'} {item.fineRisk}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => handleOpenCaseFromPost(item.channel, item)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium shadow-xs transition-colors whitespace-nowrap"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                    <span>{language === 'kz' ? 'Сараптамалық есепті ашу' : 'Открыть отчет'}</span>
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Account Dossier Modal */}
      {selectedDossierChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-['JetBrains_Mono'] font-semibold text-xs shrink-0">
                  {selectedDossierChannel.platform === 'instagram' ? 'IG' : selectedDossierChannel.platform === 'telegram' ? 'TG' : 'TT'}
                </div>
                <div className="min-w-0">
                  <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base sm:text-lg text-zinc-900 dark:text-zinc-100 truncate">
                    {language === 'kz' ? 'Досье:' : 'Досье:'} {selectedDossierChannel.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] flex-wrap">
                    <span className="text-zinc-900 dark:text-zinc-100 font-medium">{selectedDossierChannel.handleOrUrl}</span>
                    <span>· {selectedDossierChannel.platformLabel}</span>
                    <span>· {selectedDossierChannel.subscribersOrVolume}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDossierChannel(null)}
                className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors shrink-0"
                aria-label="Закрыть досье"
              >
                <X className="w-4 h-4" strokeWidth={1.6} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex flex-col gap-5">
              {/* Compliance Rating Meter */}
              <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400 uppercase font-medium">
                    {language === 'kz' ? 'ҚР комплаенс мәртебесі' : 'Статус комплаенса в РК'}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${selectedDossierChannel.status === 'ALERT' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                    <span className={`text-lg sm:text-xl font-semibold font-['Plus_Jakarta_Sans'] ${selectedDossierChannel.status === 'ALERT' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {selectedDossierChannel.status === 'ALERT'
                        ? (language === 'kz' ? 'ЖОЮДЫ ТАЛАП ЕТЕДІ' : 'ТРЕБУЕТ УСТРАНЕНИЯ')
                        : (language === 'kz' ? 'ТОЛЫҚ СӘЙКЕСТІК' : 'ПОЛНОЕ СООТВЕТСТВИЕ')}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 block">
                    {language === 'kz' ? 'Соңғы тексеру' : 'Последняя проверка'}: {selectedDossierChannel.lastScan}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[11px] font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400 uppercase font-medium">
                    {language === 'kz' ? 'Тәуекел индексі' : 'Индекс риска'}
                  </span>
                  <div className="text-2xl font-semibold font-['JetBrains_Mono'] text-zinc-900 dark:text-zinc-100 mt-0.5 tabular-nums">
                    {selectedDossierChannel.riskScore || 10}/100
                  </div>
                </div>
              </div>

              {/* Monitored Posts Feed */}
              <div>
                <h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-zinc-500 dark:text-zinc-400" strokeWidth={1.6} />
                  <span>{language === 'kz' ? 'Аккаунттағы соңғы жарияланымдар мен тексерулер' : 'Последние публикации и проверки в аккаунте'}</span>
                </h4>

                <div className="flex flex-col gap-3">
                  {(selectedDossierChannel.recentPosts || []).map((post) => (
                    <div
                      key={post.id}
                      className={`p-3.5 rounded-xl border transition-colors ${
                        post.hasViolation
                          ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/60'
                          : 'bg-zinc-50/70 dark:bg-zinc-950/60 border-zinc-200/80 dark:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs mb-2 flex-wrap">
                        <div className="flex items-center gap-2 font-medium text-zinc-700 dark:text-zinc-300 font-['JetBrains_Mono']">
                          <span className="capitalize">{post.type} · {post.date}</span>
                          {post.views && <span className="text-zinc-400 tabular-nums">· {post.views} просм.</span>}
                          {post.sourceUrl && (
                            <a
                              href={post.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-300 hover:underline"
                            >
                              <span>Источник</span>
                              <ExternalLink className="w-3 h-3" strokeWidth={1.6} />
                            </a>
                          )}
                        </div>
                        {post.hasViolation ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            {language === 'kz' ? 'БҰЗУШЫЛЫҚ' : 'НАРУШЕНИЕ'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-900">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {language === 'kz' ? 'ҚАЛЫПТЫ' : 'В НОРМЕ'}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-relaxed font-['JetBrains_Mono'] bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800">
                        {post.content}
                      </p>

                      {post.hasViolation && (
                        <div className="mt-2.5 pt-2.5 border-t border-rose-200/60 dark:border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="text-xs text-rose-700 dark:text-rose-300">
                            <span className="font-semibold">{post.violationTitle}</span>
                            {post.lawCode && (
                              <span className="ml-1.5 text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono']">({post.lawCode})</span>
                            )}
                          </div>
                          <button
                            onClick={() => handleOpenCaseFromPost(selectedDossierChannel, post)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium shadow-xs transition-colors shrink-0"
                          >
                            {language === 'kz' ? 'Есеп жасау' : 'Сформировать отчет'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
              <button
                onClick={() => handleScanSingleAccount(selectedDossierChannel)}
                disabled={scanningChannelId === selectedDossierChannel.id}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${scanningChannelId === selectedDossierChannel.id ? 'animate-spin' : ''}`}
                  strokeWidth={1.6}
                />
                <span>
                  {scanningChannelId === selectedDossierChannel.id
                    ? (language === 'kz' ? 'Сканерлеуде...' : 'Сканирование...')
                    : (language === 'kz' ? 'Қайта скан жасау' : 'Повторный скан')}
                </span>
              </button>

              <button
                onClick={() => setSelectedDossierChannel(null)}
                className="px-4 py-2 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium transition-colors"
              >
                {t('closeBtn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Monitored Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-lg w-full shadow-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldPlus className="w-5 h-5 text-zinc-700 dark:text-zinc-300" strokeWidth={1.6} />
                <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-base sm:text-lg text-zinc-900 dark:text-zinc-100">
                  {language === 'kz' ? 'Аккаунтты мониторингке қосу' : 'Добавить аккаунт на мониторинг'}
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
                aria-label="Закрыть окно"
              >
                <X className="w-4 h-4" strokeWidth={1.6} />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-4 sm:p-6 flex flex-col gap-4">
              {/* Platform selector */}
              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  {language === 'kz' ? 'Платформа' : 'Платформа'}
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
                      onClick={() => setNewPlatform(p.id as 'instagram' | 'telegram' | 'tiktok' | 'youtube' | 'web')}
                      className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors ${
                        newPlatform === p.id
                          ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                          : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Handle / URL */}
              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  {language === 'kz' ? 'Никнейм немесе сілтеме (@username / t.me/...)' : 'Никнейм или ссылка (@username / t.me/...)'}
                </label>
                <input
                  type="text"
                  required
                  value={newHandle}
                  onChange={(e) => setNewHandle(e.target.value)}
                  placeholder="@almaty_blogger_kz или t.me/channel"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                  {language === 'kz' ? 'Парақша атауы / Бренд (міндетті емес)' : 'Название страницы / Бренд (необязательно)'}
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder={language === 'kz' ? 'Блогер Аружан / Техника дүкені' : 'Блогер Аружан / Магазин техники'}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 px-3.5 py-2.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                />
              </div>

              {/* Category & Frequency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                    {language === 'kz' ? 'Санаты' : 'Категория'}
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                  >
                    <option value="Инфлюенсер / Блогер">{language === 'kz' ? 'Инфлюенсер / Блогер' : 'Инфлюенсер / Блогер'}</option>
                    <option value="Новостной паблик">{language === 'kz' ? 'Жаңалықтар парақшасы' : 'Новостной паблик'}</option>
                    <option value="Онлайн-магазин">{language === 'kz' ? 'Онлайн-дүкен' : 'Онлайн-магазин'}</option>
                    <option value="Эксперт / Курсы">{language === 'kz' ? 'Сарапшы / Курстар' : 'Эксперт / Курсы'}</option>
                    <option value="Развлечения">{language === 'kz' ? 'Көңіл көтеру' : 'Развлекательный'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5 block">
                    {language === 'kz' ? 'Аудит жиілігі' : 'Частота аудита'}
                  </label>
                  <select
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 rounded-lg px-3 py-2.5 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
                  >
                    <option value="Каждые 15 минут">{language === 'kz' ? 'Әр 15 минут сайын' : 'Каждые 15 минут'}</option>
                    <option value="Каждый час">{language === 'kz' ? 'Сағат сайын' : 'Каждый час'}</option>
                    <option value="Каждые 6 часов">{language === 'kz' ? 'Әр 6 сағат сайын' : 'Каждые 6 часов'}</option>
                    <option value="1 раз в сутки">{language === 'kz' ? 'Тәулігіне 1 рет' : '1 раз в сутки'}</option>
                  </select>
                </div>
              </div>

              {/* Legal compliance notice */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-[11px] text-zinc-600 dark:text-zinc-400 flex items-start gap-2 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0 mt-0.5" strokeWidth={1.6} />
                <span>
                  {language === 'kz'
                    ? 'Жүйе ҚР «Онлайн-платформалар және онлайн-жарнама туралы» Заңы (№ 230-VII, ҚР ӘҚБтК 455-б. 2-б.), казино жарнамасына тыйым (ӘҚБтК 455-б. 1-б.) және цифрлық этика нормалары бойынша үздіксіз аудитті бастайды.'
                    : 'Система начнет непрерывный аудит по Закону РК «Об онлайн-платформах и онлайн-рекламе» (ч. 2 ст. 455 КоАП РК / Приказ № 59-НҚ), запрету рекламы казино (ч. 1 ст. 455 КоАП РК) и нормам цифровой этики.'}
                </span>
              </div>

              {/* Form buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium transition-colors"
                >
                  {t('cancelBtn')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium shadow-xs transition-colors"
                >
                  {language === 'kz' ? 'Мониторингті қосу' : 'Подключить мониторинг'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
