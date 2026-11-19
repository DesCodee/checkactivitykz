/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  FlaskConical,
  Layers,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { AuditCase, RewriteResult } from '../types';
import { analyzeContentWithGemini, rewriteContentSafe } from '../services/geminiService';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  getCompliancePenaltyDisplay,
  getLocalizedStatus,
  isJournalisticWarningContext,
  MRP_2026_KZT,
  normalizeAuditCaseCompliance,
  runLivePreCheck,
  type BusinessEntityType,
} from '../utils/kzComplianceIntelligence';
import { getSampleText } from '../utils/sampleScreenshots';
import { useApp } from '../utils/i18n';
import { KZ_LAWS_DB } from '../data/kzLawsDb';

interface SandboxAndLawsViewProps {
  onOpenReportForCase: (auditCase: AuditCase) => void;
  entityTier?: BusinessEntityType;
  onEntityTierChange?: (tier: BusinessEntityType) => void;
}

type SandboxTab = 'sandbox' | 'batch' | 'laws';
type EntityTier = BusinessEntityType;
type BatchAuditRow = AuditCase & { batchError?: string };

export const SandboxAndLawsView: React.FC<SandboxAndLawsViewProps> = ({
  onOpenReportForCase,
  entityTier: propEntityTier,
  onEntityTierChange,
}) => {
  const { language } = useApp();
  const [activeTab, setActiveTab] = useState<SandboxTab>('sandbox');

  // Tab 1: Live Pre-Publish Sandbox
  const [draftText, setDraftText] = useState(
    '🔥 ГРАНДИОЗНАЯ РАСПРОДАЖА В АСТАНЕ! Скидки 50% только сегодня, успей купить курс со 100% гарантией результата!'
  );
  const [rewriteData, setRewriteData] = useState<RewriteResult | null>(null);
  const [rewriteLangView, setRewriteLangView] = useState<'ru' | 'kz'>('ru');
  const [isRewriting, setIsRewriting] = useState(false);
  const [isAuditingDraft, setIsAuditingDraft] = useState(false);
  const [copiedFixed, setCopiedFixed] = useState(false);

  // Tab 2: Batch Check
  const [batchInput, setBatchInput] = useState(
    [
      'Реклама / Жарнама: Новая коллекция спортивной одежды в Алматы. БИН 210440012345.',
      '---',
      '🎰 Бонус 500% в 1WIN KZ! Крути слоты и забирай кэш на Kaspi прямо сейчас!',
      '---',
      'Скидка 40% на все смартфоны! Пишите в директ для заказа!',
      '---',
      'СРОЧНО: Выплата 42500 от государства! Инвестиции в КазМунайГаз с гарантией — kaspi-pay.xyz',
    ].join('\n')
  );
  const [batchResults, setBatchResults] = useState<BatchAuditRow[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchCancelled, setBatchCancelled] = useState(false);
  const [copiedBatchSummary, setCopiedBatchSummary] = useState(false);

  // Shared Entity Tier (synced with App when provided)
  const [localEntityTier, setLocalEntityTier] = useState<EntityTier>('small');
  const entityTier = propEntityTier ?? localEntityTier;
  const setEntityTier = (tier: EntityTier) => {
    setLocalEntityTier(tier);
    onEntityTierChange?.(tier);
  };
  const [lawSearch, setLawSearch] = useState('');

  const isMountedRef = useRef(true);
  const rewriteOpIdRef = useRef(0);
  const draftAuditOpIdRef = useRef(0);
  const batchOpIdRef = useRef(0);
  const batchAbortRef = useRef<AbortController | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchCopyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      batchAbortRef.current?.abort();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (batchCopyTimerRef.current) clearTimeout(batchCopyTimerRef.current);
    };
  }, []);

  const entityTierShortLabel =
    entityTier === 'individual'
      ? language === 'kz'
        ? 'Жеке тұлға'
        : 'Физлицо'
      : entityTier === 'small'
      ? language === 'kz'
        ? 'ШОБ'
        : 'МБ / ИП'
      : entityTier === 'medium'
      ? language === 'kz'
        ? 'Орта'
        : 'Средний'
      : language === 'kz'
      ? 'Ірі'
      : 'Крупный';

  // Live instant pre-publish analysis (Strictly synced with runLivePreCheck)
  const liveDiagnostics = useMemo(() => {
    const text = draftText || '';
    const lower = text.toLowerCase();
    const isContextWarning = isJournalisticWarningContext(text);
    const pre = runLivePreCheck(text, undefined, entityTier, language);

    const hasCasino = pre.triggers.some((t) => t.id === 'gambling');
    const isCommercial =
      !isContextWarning &&
      !hasCasino &&
      /скидк|распродаж|акция|промокод|купить|заказать|цена|курс|жеңілдік/i.test(lower);
    const hasAdLabel = /жарнама|реклама/i.test(lower);
    const hasBinIin = /\b\d{12}\b|бин|иин|бсн|жсн/i.test(lower);
    const hasKazakhChars = /[әғқңөұүһі]/i.test(text) || /жарнама|теңге|қазақстан/i.test(lower);
    const hasRussianChars = /[а-яё]/i.test(text);

    const issues = pre.triggers.map(
      (trg) => `${trg.article}: ${language === 'kz' ? trg.labelKz : trg.labelRu}`
    );

    const noToxicOrScam = !pre.triggers.some((t) =>
      ['profanity', 'gambling', 'scam_deepfake', 'doxing', 'disinfo', 'bullying'].includes(t.id)
    );

    return {
      risk: pre.riskScore,
      status: pre.status,
      statusLabel: language === 'kz' ? pre.statusLabelKz : pre.statusLabelRu,
      penaltySummary: language === 'kz' ? pre.penaltySummaryKz : pre.penaltySummaryRu,
      hasLegalFine: pre.penaltyCalc.maxKzt > 0,
      triggers: pre.triggers,
      issues,
      hasAdLabel: !isCommercial || hasAdLabel,
      hasBinIin: !isCommercial || hasBinIin,
      hasBilingual: (hasKazakhChars && hasRussianChars) || isContextWarning,
      noToxicOrScam,
    };
  }, [draftText, entityTier, language]);

  const handleSafeRewrite = async () => {
    if (!draftText.trim() || isRewriting) return;
    const opId = ++rewriteOpIdRef.current;
    setIsRewriting(true);
    try {
      const res = await rewriteContentSafe({
        text: draftText,
        language,
        entityTier,
      });
      if (!isMountedRef.current || opId !== rewriteOpIdRef.current) return;
      setRewriteData(res);
    } finally {
      if (isMountedRef.current && opId === rewriteOpIdRef.current) {
        setIsRewriting(false);
      }
    }
  };

  const handleFullDraftAudit = async () => {
    if (!draftText.trim() || isAuditingDraft) return;
    const opId = ++draftAuditOpIdRef.current;
    setIsAuditingDraft(true);
    try {
      const auditCase = await analyzeContentWithGemini({
        modality: 'text',
        text: draftText,
        fileName: 'prepublish_sandbox.txt',
      });
      if (!isMountedRef.current || opId !== draftAuditOpIdRef.current) return;
      onOpenReportForCase(auditCase);
    } finally {
      if (isMountedRef.current && opId === draftAuditOpIdRef.current) {
        setIsAuditingDraft(false);
      }
    }
  };

  const handleRunBatchAudit = async () => {
    if (isBatchRunning) return;
    const rawItems = batchInput
      .split(/\n-{3,}\n|\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 15);

    if (rawItems.length === 0) return;

    batchAbortRef.current?.abort();
    const abortController = new AbortController();
    batchAbortRef.current = abortController;

    const opId = ++batchOpIdRef.current;
    setIsBatchRunning(true);
    setBatchCancelled(false);
    setBatchResults([]);
    setBatchProgress({ current: 0, total: rawItems.length });

    try {
      const results: BatchAuditRow[] = [];
      for (let i = 0; i < rawItems.length; i++) {
        if (!isMountedRef.current || opId !== batchOpIdRef.current || abortController.signal.aborted) {
          break;
        }
        setBatchProgress({ current: i + 1, total: rawItems.length });
        const item = rawItems[i];
        const isUrl = /^https?:\/\//i.test(item);

        try {
          const res = normalizeAuditCaseCompliance(
            await analyzeContentWithGemini(
              {
                modality: isUrl ? 'url' : 'text',
                url: isUrl ? item : undefined,
                text: item,
                fileName: `Пакет #${i + 1}`,
              },
              { signal: abortController.signal }
            )
          );
          results.push(res);
        } catch (err) {
          if (abortController.signal.aborted || (err instanceof DOMException && err.name === 'AbortError')) {
            break;
          }
          const errMsg =
            err instanceof Error && err.message
              ? err.message
              : language === 'kz'
              ? 'Элементті тексеру кезінде қате'
              : 'Ошибка проверки элемента';
          results.push({
            id: `batch-error-${i}-${Date.now()}`,
            referenceNumber: `#ERR-${i + 1}`,
            timestamp: new Date().toLocaleString('ru-RU'),
            sourceType: isUrl ? 'url' : 'text',
            title: item.slice(0, 70),
            sourceName: item.slice(0, 70),
            sha256: `err-${i}-${Date.now()}`,
            riskScore: 0,
            legalScore: 0,
            ethicsScore: 0,
            riskLevel: 'Средний',
            status: 'ПРЕДУПРЕЖДЕНИЕ',
            summary: errMsg,
            extractedText: item,
            violations: [],
            metadata: {
              engineConfidence: 0,
              platform: isUrl ? 'URL' : 'Текст',
            },
            batchError: errMsg,
          });
        }

        if (!isMountedRef.current || opId !== batchOpIdRef.current) return;
        setBatchResults([...results]);
      }
    } finally {
      if (batchAbortRef.current === abortController) {
        batchAbortRef.current = null;
      }
      if (isMountedRef.current && opId === batchOpIdRef.current) {
        setIsBatchRunning(false);
      }
    }
  };

  const handleCancelBatchAudit = () => {
    setBatchCancelled(true);
    batchAbortRef.current?.abort();
    setIsBatchRunning(false);
  };

  const handleClearBatch = () => {
    if (isBatchRunning) {
      batchAbortRef.current?.abort();
      setIsBatchRunning(false);
    }
    batchOpIdRef.current += 1;
    setBatchInput('');
    setBatchResults([]);
    setBatchProgress(null);
    setBatchCancelled(false);
  };

  const handleCopyBatchSummary = () => {
    if (batchResults.length === 0) return;
    const lines = [
      `CHECK ACTIVITY KZ · ${language === 'kz' ? 'ПАКЕТТІК АУДИТ ЖИЫНТЫҒЫ' : 'СВОДКА ПАКЕТНОГО АУДИТА'} (${entityTierShortLabel})`,
      ...batchResults.map((item, idx) => {
        if (item.batchError) {
          return `${idx + 1}. [ОШИБКА] ${item.extractedText || item.title} -> ${item.batchError}`;
        }
        const pDisp = getCompliancePenaltyDisplay(item.violations, entityTier, language);
        const mainCode = item.violations[0]?.code || (language === 'kz' ? 'Бұзушылық жоқ' : 'Соответствует РК');
        return `${idx + 1}. [${getLocalizedStatus(item.status, language)} · ${item.riskScore}/100] ${
          (item.extractedText || item.title).replace(/\s+/g, ' ').slice(0, 90)
        } | ${mainCode} | ${pDisp.headline}`;
      }),
    ];
    void copyTextToClipboard(lines.join('\n')).then((ok) => {
      if (!ok || !isMountedRef.current) return;
      setCopiedBatchSummary(true);
      if (batchCopyTimerRef.current) clearTimeout(batchCopyTimerRef.current);
      batchCopyTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) setCopiedBatchSummary(false);
      }, 2000);
    });
  };

  const handleDownloadBatchCsv = () => {
    if (batchResults.length === 0) return;
    const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const headers = ['#', 'Статус', 'Риск', 'Статья', 'Штраф (' + entityTierShortLabel + ')', 'Материал / Ошибка'];
    const rows = batchResults.map((item, idx) => {
      if (item.batchError) {
        return [idx + 1, 'ОШИБКА', 0, '-', '-', `${item.batchError}: ${item.extractedText || item.title}`]
          .map(escapeCsv)
          .join(',');
      }
      const pDisp = getCompliancePenaltyDisplay(item.violations, entityTier, language);
      const mainCode = item.violations.map((v) => v.code).filter(Boolean).join('; ') || 'Соответствует РК';
      return [
        idx + 1,
        getLocalizedStatus(item.status, language),
        `${item.riskScore}/100`,
        mainCode,
        pDisp.headline,
        (item.extractedText || item.title).replace(/\s+/g, ' '),
      ]
        .map(escapeCsv)
        .join(',');
    });
    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `checkactivity_batch_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filteredLaws = KZ_LAWS_DB.filter((law) => {
    const q = lawSearch.toLowerCase();
    return (
      law.code.toLowerCase().includes(q) ||
      law.title.toLowerCase().includes(q) ||
      law.titleKz.toLowerCase().includes(q) ||
      law.summary.toLowerCase().includes(q) ||
      law.summaryKz.toLowerCase().includes(q) ||
      law.lawName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 font-['Inter']">
      {/* Top Header & Sub-Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {language === 'kz' ? 'Жариялау алдындағы бақылау' : 'Pre-Publish Compliance Suite'}
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">·</span>
            <span className="font-['JetBrains_Mono'] text-[11px]">
              1 {language === 'kz' ? 'АЕК' : 'МРП'} = {MRP_2026_KZT.toLocaleString('ru-RU')} ₸
            </span>
          </div>
          <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">
            {language === 'kz'
              ? 'Жазбалар симуляторы, Пакеттік аудит және НҚА'
              : 'Песочница публикаций, Пакетный аудит и НПА РК'}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl leading-relaxed">
            {language === 'kz'
              ? 'Жарияламас бұрын мәтінді нақты уақытта тексеріңіз, ИИ арқылы 1 басумен түзетіңіз және ҚР ӘҚБтК айыппұлдарын есептеңіз.'
              : 'Проверяйте черновики до публикации в реальном времени, исправляйте нарушения с ИИ в 1 клик, запускайте пакетный аудит и рассчитывайте штрафы по КоАП РК.'}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800 self-start lg:self-auto overflow-x-auto max-w-full">
          {[
            {
              id: 'sandbox' as SandboxTab,
              label: language === 'kz' ? 'Симулятор (Live)' : 'Песочница (Live)',
              icon: FlaskConical,
            },
            {
              id: 'batch' as SandboxTab,
              label: language === 'kz' ? 'Пакеттік аудит' : 'Пакетный аудит',
              icon: Layers,
            },
            {
              id: 'laws' as SandboxTab,
              label: language === 'kz' ? 'НҚА және АЕК базасы' : 'База НПА и МРП',
              icon: BookOpen,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.6} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: LIVE SANDBOX & AI SAFE-REWRITE */}
      {activeTab === 'sandbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left 7 cols: Editor + Live Presets */}
          <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-['JetBrains_Mono'] text-[11px] uppercase font-semibold text-zinc-500 dark:text-zinc-400">
                {language === 'kz' ? 'МӘТІН ЖОБАСЫ (LIVE-АУДИТ)' : 'РЕДАКТОР ЧЕРНОВИКА (LIVE-АУДИТ)'}
              </span>
              <span className="font-['JetBrains_Mono'] text-[11px] text-zinc-400 tabular-nums">
                {draftText.length} {language === 'kz' ? 'таңба' : 'симв.'}
              </span>
            </div>

            {/* Quick Scenario Presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                {
                  label: language === 'kz' ? '1. Саяси вброс / доксинг' : '1. Политвброс и доксинг',
                  text: getSampleText('political_doxing'),
                },
                {
                  label: language === 'kz' ? 'Жарнама (таңбасыз)' : 'Реклама без «Жарнама»',
                  text: '🔥 ГРАНДИОЗНАЯ РАСПРОДАЖА В АСТАНЕ! Скидки 50% только сегодня, успей купить курс со 100% гарантией результата!',
                },
                {
                  label: language === 'kz' ? 'Дипфейк / Фишинг' : 'Дипфейк / Фишинг 42500',
                  text: 'СРОЧНО! Президент объявил новую выплату 42500 и инвестиции в Kaspi с пассивным доходом 250 000 ₸! Регистрация на kaspi-bonus.xyz',
                },
                {
                  label: language === 'kz' ? 'Слоттар ($/USDT)' : 'Слоты без слова «казино»',
                  text: getSampleText('casino_banner'),
                },
                {
                  label: language === 'kz' ? 'Эталон (RU+KZ)' : 'Эталонный пост (RU+KZ)',
                  text: 'Жарнама / Реклама\nҚазақстандық өндірушінің жаңа топтамасы. Новая коллекция одежды из Алматы.\nРекламодатель / Жарнама беруші: ТОО «Nomad Style», БИН 210440012345.',
                },
                {
                  label: language === 'kz' ? 'Полиция ескертуі (0 АЕК)' : 'Пост МВД о мошенниках (0 МРП)',
                  text: getSampleText('journalism_context'),
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setDraftText(preset.text);
                    setRewriteData(null);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={6}
              placeholder={
                language === 'kz'
                  ? 'Пост немесе жарнама мәтінін осында енгізіңіз — жүйе лезде тәуекелдерді есептейді...'
                  : 'Введите текст поста, сторис или объявления — индекс комплаенса пересчитается мгновенно...'
              }
              className="w-full p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none leading-relaxed font-['Inter']"
            />

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleSafeRewrite}
                disabled={isRewriting || !draftText.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
              >
                {isRewriting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.6} />
                ) : (
                  <Wand2 className="w-4 h-4" strokeWidth={1.6} />
                )}
                <span>
                  {isRewriting
                    ? language === 'kz'
                      ? 'Түзетілуде...'
                      : 'Исправление...'
                    : language === 'kz'
                    ? 'ИИ арқылы 1 басумен түзету (RU+KZ)'
                    : 'Исправить с ИИ в 1 клик (RU+KZ)'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleFullDraftAudit}
                disabled={isAuditingDraft || !draftText.trim()}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isAuditingDraft ? (
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.6} />
                ) : (
                  <FileCheck2 className="w-4 h-4" strokeWidth={1.6} />
                )}
                <span>
                  {language === 'kz' ? 'Толық сараптамалық есеп' : 'Полный экспертный отчёт'}
                </span>
              </button>
            </div>

            {/* AI Safe-Rewrite Output Box */}
            {rewriteData && (
              <div className="mt-2 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={1.6} />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      {language === 'kz'
                        ? 'ҚР заңына сәйкес түзетілген нұсқа'
                        : 'Безопасная версия по нормам РК'}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-emerald-200/80 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 tabular-nums">
                      {language === 'kz' ? 'Тәуекел:' : 'Риск:'} {liveDiagnostics.risk}% → {rewriteData.newRiskScore}%
                    </span>
                  </div>

                  <div className="flex items-center bg-white dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-['JetBrains_Mono']">
                    <button
                      type="button"
                      onClick={() => setRewriteLangView('ru')}
                      className={`px-2 py-1 rounded-md font-medium ${
                        rewriteLangView === 'ru'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'text-zinc-500'
                      }`}
                    >
                      РУС
                    </button>
                    <button
                      type="button"
                      onClick={() => setRewriteLangView('kz')}
                      className={`px-2 py-1 rounded-md font-medium ${
                        rewriteLangView === 'kz'
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : 'text-zinc-500'
                      }`}
                    >
                      ҚАЗ
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed font-['JetBrains_Mono']">
                  {rewriteLangView === 'ru' ? rewriteData.safeTextRu : rewriteData.safeTextKz}
                </div>

                <div className="flex flex-col gap-1">
                  {rewriteData.appliedFixes.map((fix, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-1.5 text-[11px] text-emerald-800 dark:text-emerald-300"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.6} />
                      <span>{fix}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const chosen =
                        rewriteLangView === 'ru' ? rewriteData.safeTextRu : rewriteData.safeTextKz;
                      void copyTextToClipboard(chosen).then((ok) => {
                        if (!ok || !isMountedRef.current) return;
                        setCopiedFixed(true);
                        if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
                        copyTimerRef.current = setTimeout(() => {
                          if (isMountedRef.current) setCopiedFixed(false);
                        }, 2000);
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {copiedFixed ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.8} />
                    ) : (
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.6} />
                    )}
                    <span>
                      {copiedFixed
                        ? language === 'kz'
                          ? 'Көшірілді'
                          : 'Скопировано'
                        : language === 'kz'
                        ? 'Көшіру'
                        : 'Копировать'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraftText(
                        rewriteLangView === 'ru' ? rewriteData.safeTextRu : rewriteData.safeTextKz
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium"
                  >
                    <span>
                      {language === 'kz' ? 'Редакторға қолдану' : 'Подставить в редактор'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right 5 cols: Real-Time Compliance Gauge & Micro-Indicators */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {language === 'kz' ? 'Лезде тәуекел бағасы' : 'Мгновенная оценка риска'}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-['JetBrains_Mono'] font-bold px-2.5 py-0.5 rounded-md border ${
                    liveDiagnostics.status === 'critical'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : liveDiagnostics.status === 'warning'
                      ? 'bg-amber-500 text-zinc-950 border-amber-500'
                      : 'bg-emerald-600 text-white border-emerald-600'
                  }`}
                >
                  {liveDiagnostics.statusLabel}
                </span>
              </div>

              <div>
                <div className="font-['Plus_Jakarta_Sans'] text-4xl font-bold text-zinc-950 dark:text-zinc-50 tabular-nums tracking-tight">
                  {liveDiagnostics.risk}
                  <span className="text-base font-normal text-zinc-400"> / 100</span>
                </div>
                <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mt-3">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      liveDiagnostics.status === 'critical'
                        ? 'bg-rose-600'
                        : liveDiagnostics.status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-emerald-600'
                    }`}
                    style={{ width: `${Math.max(4, liveDiagnostics.risk)}%` }}
                  />
                </div>
                <div
                  className={`mt-3 p-2.5 rounded-xl border text-xs font-['JetBrains_Mono'] font-semibold ${
                    liveDiagnostics.hasLegalFine
                      ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                      : liveDiagnostics.triggers.length > 0
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
                      : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] uppercase opacity-80 font-normal mb-1">
                    <span>
                      {language === 'kz'
                        ? `Санкция бағасы (${entityTierShortLabel}):`
                        : `Оценка штрафа по КоАП РК (${entityTierShortLabel}):`}
                    </span>
                    <select
                      aria-label={language === 'kz' ? 'Субъект санаты' : 'Категория субъекта'}
                      value={entityTier}
                      onChange={(e) => setEntityTier(e.target.value as EntityTier)}
                      className="bg-white/90 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-300/80 dark:border-zinc-700 rounded px-1.5 py-0.5 text-[10px] font-['JetBrains_Mono'] focus:outline-none"
                    >
                      <option value="individual">{language === 'kz' ? 'Жеке тұлға' : 'Физлицо'}</option>
                      <option value="small">{language === 'kz' ? 'ШОБ / ЖК' : 'МБ / ИП'}</option>
                      <option value="medium">{language === 'kz' ? 'Орта' : 'Средний'}</option>
                      <option value="large">{language === 'kz' ? 'Ірі' : 'Крупный'}</option>
                    </select>
                  </div>
                  {liveDiagnostics.penaltySummary}
                </div>
              </div>

              {/* 4 Live Micro Checks */}
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {[
                  {
                    label:
                      language === 'kz'
                        ? '«Жарнама / Реклама» таңбасы'
                        : 'Маркировка «Жарнама / Реклама»',
                    ok: liveDiagnostics.hasAdLabel,
                  },
                  {
                    label:
                      language === 'kz'
                        ? 'БСН/ЖСН реквизиттері (№ 230-VII)'
                        : 'Реквизиты БИН/ИИН (Закон № 230-VII)',
                    ok: liveDiagnostics.hasBinIin,
                  },
                  {
                    label:
                      language === 'kz'
                        ? 'ҚАЗ + ОРЫС тілдік теңгерім'
                        : 'Языковой паритет ҚАЗ + РУС',
                    ok: liveDiagnostics.hasBilingual,
                  },
                  {
                    label:
                      language === 'kz'
                        ? 'Анти-скам, казино, бейәдеп сөз'
                        : 'Отсутствие мата, казино и скама',
                    ok: liveDiagnostics.noToxicOrScam,
                  },
                ].map((chk) => (
                  <div key={chk.label} className="flex items-center justify-between py-2.5">
                    <span className="text-zinc-700 dark:text-zinc-300">{chk.label}</span>
                    <span
                      className={`inline-flex items-center gap-1 font-['JetBrains_Mono'] text-[11px] font-medium ${
                        chk.ok
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          chk.ok ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      {chk.ok ? 'OK' : language === 'kz' ? 'ЖОҚ' : 'НЕТ'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Live Issues List */}
              {liveDiagnostics.issues.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 flex flex-col gap-1.5">
                  <div className="text-[11px] font-['JetBrains_Mono'] font-semibold text-rose-700 dark:text-rose-300 uppercase">
                    {language === 'kz' ? 'Табылған тәуекелдер:' : 'Обнаруженные триггеры:'}
                  </div>
                  {liveDiagnostics.issues.map((issue) => (
                    <div
                      key={issue}
                      className="text-xs text-rose-800 dark:text-rose-200 flex items-start gap-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-500" strokeWidth={1.6} />
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BATCH AUDIT */}
      {activeTab === 'batch' && (
        <div className="flex flex-col gap-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-['Plus_Jakarta_Sans'] text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {language === 'kz'
                    ? 'Бірнеше жазба мен сілтемені пакеттік тексеру'
                    : 'Пакетная проверка ленты постов и рекламных интеграций'}
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {language === 'kz'
                    ? 'Жазбаларды «---» немесе бос жол арқылы бөліңіз (15 материалға дейін)'
                    : 'Разделяйте публикации строкой «---» или пустой строкой (до 15 материалов за один запуск)'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {(batchInput.trim() || batchResults.length > 0) && !isBatchRunning && (
                  <button
                    type="button"
                    onClick={handleClearBatch}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                    <span>{language === 'kz' ? 'Тізімді тазарту' : 'Очистить список'}</span>
                  </button>
                )}

                {isBatchRunning && (
                  <button
                    type="button"
                    onClick={handleCancelBatchAudit}
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium shadow-xs transition-colors"
                  >
                    <X className="w-4 h-4" strokeWidth={1.7} />
                    <span>{language === 'kz' ? 'Тоқтату' : 'Отмена'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRunBatchAudit}
                  disabled={isBatchRunning || !batchInput.trim()}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium shadow-xs transition-colors disabled:opacity-50"
                >
                  {isBatchRunning ? (
                    <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.6} />
                  ) : (
                    <Layers className="w-4 h-4" strokeWidth={1.6} />
                  )}
                  <span>
                    {isBatchRunning
                      ? batchProgress
                        ? `${language === 'kz' ? 'Тексеру' : 'Проверка'} ${batchProgress.current}/${batchProgress.total}...`
                        : language === 'kz'
                        ? 'Тексерілуде...'
                        : 'Выполняется аудит...'
                      : language === 'kz'
                      ? 'Пакетті тексеру'
                      : 'Проверить весь пакет'}
                  </span>
                </button>
              </div>
            </div>

            {isBatchRunning && batchProgress && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400">
                  <span>
                    {language === 'kz' ? 'Пакеттік талдау орындалуда...' : 'Выполняется пакетный анализ...'}
                  </span>
                  <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                    {batchProgress.current} / {batchProgress.total}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-300"
                    style={{ width: `${Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {batchCancelled && !isBatchRunning && (
              <div className="px-3 py-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300">
                {language === 'kz'
                  ? `Пакеттік тексеру тоқтатылды. Аяқталған жолдар: ${batchResults.length}.`
                  : `Пакетная проверка остановлена пользователем. Сохранено обработанных записей: ${batchResults.length}.`}
              </div>
            )}

            <textarea
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              rows={7}
              placeholder={
                language === 'kz'
                  ? 'Сілтемелер мен жазбаларды «---» арқылы бөліп қойыңыз...'
                  : 'Вставьте публикации или URL-ссылки, разделяя их строкой «---»...'
              }
              className="w-full p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-['JetBrains_Mono'] leading-relaxed focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
          </div>

          {batchResults.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-4 sm:px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    {language === 'kz' ? 'Пакеттік аудит нәтижелері' : 'Сводный реестр пакетной проверки'} ({batchResults.length})
                  </span>
                  <span className="font-['JetBrains_Mono'] text-xs text-zinc-500 tabular-nums">
                    {language === 'kz' ? 'Бұзушылықтар:' : 'Нарушений:'}{' '}
                    {batchResults.filter((r) => !r.batchError && r.violations.length > 0).length} / {batchResults.length}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyBatchSummary}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 transition-colors"
                  >
                    {copiedBatchSummary ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.8} />
                    ) : (
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.6} />
                    )}
                    <span>
                      {copiedBatchSummary
                        ? language === 'kz'
                          ? 'Көшірілді'
                          : 'Скопировано'
                        : language === 'kz'
                        ? 'Жиынтықты көшіру'
                        : 'Копировать сводку'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadBatchCsv}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" strokeWidth={1.6} />
                    <span>{language === 'kz' ? 'CSV жүктеу' : 'Скачать CSV'}</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-['JetBrains_Mono'] uppercase text-zinc-500 dark:text-zinc-400 bg-zinc-50/70 dark:bg-zinc-950/60">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">{language === 'kz' ? 'Материал үзіндісі' : 'Фрагмент материала'}</th>
                      <th className="py-3 px-4">{language === 'kz' ? 'Тәуекел' : 'Риск'}</th>
                      <th className="py-3 px-4">{language === 'kz' ? 'Бап / Айыппұл ҚР' : 'Статья / Штраф РК'}</th>
                      <th className="py-3 px-4 text-right">{language === 'kz' ? 'Есеп' : 'Отчёт'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                    {batchResults.map((item, idx) => {
                      const mainV = item.violations[0];
                      const pDisp = getCompliancePenaltyDisplay(item.violations, entityTier, language);
                      return (
                        <tr
                          key={item.id || idx}
                          className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-['JetBrains_Mono'] text-zinc-400 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 max-w-md">
                            <div className="text-zinc-900 dark:text-zinc-100 font-medium line-clamp-2 break-words">
                              {item.extractedText || item.title}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {item.batchError ? (
                              <span className="inline-flex items-center gap-1.5 font-['JetBrains_Mono'] font-semibold text-rose-600 dark:text-rose-400">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                {language === 'kz' ? 'ҚАТЕ' : 'ОШИБКА'}
                              </span>
                            ) : item.accessRestricted ? (
                              <span className="inline-flex items-center gap-1.5 font-['JetBrains_Mono'] font-semibold text-amber-600 dark:text-amber-400">
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                {language === 'kz' ? 'Қолжетімділік шектеулі' : 'Доступ ограничен'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-['JetBrains_Mono'] font-semibold tabular-nums">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    item.riskScore >= 70
                                      ? 'bg-rose-500'
                                      : item.riskScore >= 25
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                />
                                {item.riskScore}/100 · {getLocalizedStatus(item.status, language)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-['JetBrains_Mono'] text-zinc-700 dark:text-zinc-300">
                            {item.batchError ? (
                              <div className="text-[11px] text-rose-600 dark:text-rose-400 max-w-xs break-words">
                                {item.batchError}
                              </div>
                            ) : (
                              <>
                                <div className="font-medium">
                                  {mainV ? mainV.code : language === 'kz' ? 'ҚР заңына сәйкес' : 'Соответствует РК'}
                                </div>
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{pDisp.headline}</div>
                              </>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.batchError ? (
                              <span className="text-[11px] font-['JetBrains_Mono'] text-zinc-400">—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenReportForCase(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-medium hover:opacity-90"
                              >
                                <FileCheck2 className="w-3 h-3" strokeWidth={1.6} />
                                <span>{language === 'kz' ? 'Ашу' : 'Открыть'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: KZ LEGAL HUB & MRP CALCULATOR */}
      {activeTab === 'laws' && (
        <div className="flex flex-col gap-5">
          {/* Controls Bar: Entity Tier + Search */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-['JetBrains_Mono'] uppercase font-semibold text-zinc-500 dark:text-zinc-400">
                {language === 'kz'
                  ? 'Субъект санатын таңдаңыз (АЕК есебі):'
                  : 'Выберите категорию субъекта (расчет в МРП):'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'individual' as EntityTier, label: language === 'kz' ? 'Жеке тұлға / Блогер' : 'Физлицо / Блогер' },
                  { id: 'small' as EntityTier, label: language === 'kz' ? 'Шағын бизнес / ЖК' : 'Малый бизнес / ИП' },
                  { id: 'medium' as EntityTier, label: language === 'kz' ? 'Орта бизнес' : 'Средний бизнес' },
                  { id: 'large' as EntityTier, label: language === 'kz' ? 'Ірі бизнес' : 'Крупный бизнес' },
                ].map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setEntityTier(tier.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      entityTier === tier.id
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                        : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative w-full lg:w-72">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.6} />
              <input
                type="text"
                value={lawSearch}
                onChange={(e) => setLawSearch(e.target.value)}
                placeholder={language === 'kz' ? 'ҚР ӘҚБтК / ҚК бойынша іздеу...' : 'Поиск по КоАП / УК РК...'}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* Law Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLaws.map((law) => {
              const bracket = law.penaltiesByTier[entityTier];
              const minMrp = bracket.minMrp;
              const maxMrp = bracket.maxMrp;
              const minTenge = minMrp * MRP_2026_KZT;
              const maxTenge = maxMrp * MRP_2026_KZT;
              const isExact = minMrp === maxMrp;
              const unit = language === 'kz' ? 'АЕК' : 'МРП';
              const mrpText = isExact
                ? `${minMrp.toLocaleString('ru-RU')} ${unit}`
                : `${minMrp.toLocaleString('ru-RU')}–${maxMrp.toLocaleString('ru-RU')} ${unit}`;
              const tengeText = isExact
                ? `${minTenge.toLocaleString('ru-RU')} ₸`
                : `${minTenge.toLocaleString('ru-RU')} – ${maxTenge.toLocaleString('ru-RU')} ₸`;
              const note =
                language === 'kz'
                  ? bracket.noteKz || bracket.note
                  : bracket.note;

              return (
                <div
                  key={law.id}
                  className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-['JetBrains_Mono'] text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-700">
                        {law.code}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[11px] text-zinc-500 dark:text-zinc-400 text-right">
                        {language === 'kz' ? law.regulatorKz : law.regulator}
                      </span>
                    </div>
                    <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                      {language === 'kz' ? law.titleKz : law.title}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      {language === 'kz' ? law.summaryKz : law.summary}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-['JetBrains_Mono'] uppercase text-zinc-400 block">
                        {language === 'kz' ? 'Субъектіге арналған санкция' : 'Санкция для субъекта'}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-sm font-semibold text-rose-600 dark:text-rose-400 tabular-nums">
                        {mrpText} ({tengeText})
                      </span>
                      {note && (
                        <span className="block text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {note}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDraftText(law.sampleViolationText);
                        setRewriteData(null);
                        setActiveTab('sandbox');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 shrink-0 self-start sm:self-auto transition-colors"
                    >
                      <Scale className="w-3.5 h-3.5" strokeWidth={1.6} />
                      <span>{language === 'kz' ? 'Симуляторда тексеру' : 'Тест в песочнице'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
