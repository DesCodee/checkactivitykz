/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  FileCheck2,
  FlaskConical,
  Layers,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { AuditCase, RewriteResult } from '../types';
import { analyzeContentWithGemini, rewriteContentSafe } from '../services/geminiService';
import {
  isJournalisticWarningContext,
  MRP_2026_KZT,
  runLivePreCheck,
  getCompliancePenaltyDisplay,
  normalizeAuditCaseCompliance,
  type BusinessEntityType,
} from '../utils/kzComplianceIntelligence';
import { getSampleText } from '../utils/sampleScreenshots';
import { useApp } from '../utils/i18n';

interface SandboxAndLawsViewProps {
  onOpenReportForCase: (auditCase: AuditCase) => void;
}

type SandboxTab = 'sandbox' | 'batch' | 'laws';
type EntityTier = BusinessEntityType;

interface LawReferenceItem {
  id: string;
  code: string;
  titleRu: string;
  titleKz: string;
  summaryRu: string;
  summaryKz: string;
  regulator: string;
  mrpByTier: Record<EntityTier, [number, number]>;
  noteByTier?: Record<EntityTier, string>;
  sampleViolationText: string;
}

const KZ_LAWS_DB: LawReferenceItem[] = [
  {
    id: 'law-230',
    code: 'Закон № 230-VII · ст. 455 КоАП РК',
    titleRu: 'Маркировка онлайн-рекламы инфлюенсерами и блогерами',
    titleKz: 'Инфлюенсерлер мен блогерлердің онлайн-жарнаманы таңбалауы',
    summaryRu:
      'Любая коммерческая публикация, бартер или партнерская ссылка обязаны сопровождаться пометкой «Жарнама / Реклама» и идентификатором БИН/ИИН.',
    summaryKz:
      'Кез келген коммерциялық жарияланым, бартер немесе серіктестік сілтеме «Жарнама / Реклама» белгісімен және БСН/ЖСН көрсетілуі тиіс.',
    regulator: 'МКИ РК',
    mrpByTier: {
      individual: [20, 40],
      small: [50, 100],
      medium: [100, 150],
      large: [150, 200],
    },
    sampleViolationText:
      'Скидка 40% на курс по таргету! Заказывайте по ссылке в шапке профиля, промокод ALMATY2026.',
  },
  {
    id: 'law-445-1',
    code: 'ст. 445-1 КоАП РК',
    titleRu: 'Запрет рекламы нелицензированных онлайн-казино и слотов',
    titleKz: 'Лицензияланбаған онлайн-казино мен слоттарды жарнамалауға тыйым',
    summaryRu:
      'Категорически запрещено продвижение интернет-казино, онлайн-рулеток, реферальных ссылок на 1Win/1xBet, слотов и нелегальных букмекеров.',
    summaryKz:
      'Интернет-казино, онлайн-рулетка, 1Win/1xBet рефералдық сілтемелері және заңсыз букмекерлік кеңселерді жарнамалауға қатаң тыйым салынады.',
    regulator: 'АФМ РК / МКИ РК',
    mrpByTier: {
      individual: [60, 100],
      small: [200, 300],
      medium: [400, 500],
      large: [700, 1000],
    },
    sampleViolationText:
      '🎰 Забирай бонус 500% в 1WIN! Крути слоты и выводи выигрыш на Kaspi за 5 минут!',
  },
  {
    id: 'law-190-274',
    code: 'ст. 190, ст. 274 УК РК',
    titleRu: 'Противодействие интернет-мошенничеству, фишингу и дипфейкам',
    titleKz: 'Интернет-алаяқтық, фишинг және дипфейкке қарсы іс-қимыл',
    summaryRu:
      'Заведомо ложная информация, дипфейки с первыми лицами, фейковые выплаты (42500) и псевдо-инвестиции от имени банков/нацкомпаний РК.',
    summaryKz:
      'Көрінеу жалған ақпарат, лауазымды тұлғалардың дипфейктері, жалған төлемдер (42500) және ҚР банктері атынан жалған инвестициялар.',
    regulator: 'КНБ / МВД (Киберпол) / АФМ РК',
    mrpByTier: {
      individual: [200, 1000],
      small: [500, 2000],
      medium: [100, 3000],
      large: [250, 4000],
    },
    noteByTier: {
      individual: 'Либо ограничение/лишение свободы',
      small: 'Уголовная + блокировка',
      medium: 'Уголовная + конфискация',
      large: 'До 4 000 МРП / УК РК',
    },
    sampleViolationText:
      'СРОЧНО! Выплата 42500 от государства! Инвестиции в Kaspi и КазМунайГаз с доходом 300% в неделю — переходи на kaspi-bonus.xyz',
  },
  {
    id: 'law-434',
    code: 'ст. 434 КоАП РК',
    titleRu: 'Мелкое хулиганство и обсценная лексика в публичной сети',
    titleKz: 'Қоғамдық желідегі ұсақ бұзақылық және бейәдеп сөздер',
    summaryRu:
      'Публичное использование матов, нецензурных выражений на русском и казахском языках, оскорбительных высказываний в чатах и комментариях.',
    summaryKz:
      'Чаттар мен пікірлерде орыс және қазақ тілдерінде балағат сөздерді, бейәдеп сөйлеуді жария түрде қолдану.',
    regulator: 'МВД РК / Суд',
    mrpByTier: {
      individual: [20, 20],
      small: [20, 20],
      medium: [20, 20],
      large: [20, 20],
    },
    noteByTier: {
      individual: '20 МРП или арест 5–15 сут.',
      small: 'Ответственность автора',
      medium: 'Ответственность автора',
      large: 'Ответственность автора',
    },
    sampleViolationText:
      'Ты че бля совсем тупой? Пошел нахуй отсюда, урод, еще раз напишешь — найдем!',
  },
  {
    id: 'law-73-4',
    code: 'ст. 73-4 КоАП РК · ст. 131 УК РК',
    titleRu: 'Кибербуллинг, травля и публичное оскорбление личности',
    titleKz: 'Кибербуллинг, қудалау және жеке басты жария қорлау',
    summaryRu:
      'Систематические унижения, угрозы, публикация уничижительных материалов и оскорбление чести и достоинства в социальных сетях.',
    summaryKz:
      'Әлеуметтік желілерде жүйелі түрде кемсіту, қорқыту, ар-намысы мен қадір-қасиетін қорлау.',
    regulator: 'МВД РК / Прокуратура',
    mrpByTier: {
      individual: [15, 100],
      small: [30, 100],
      medium: [50, 150],
      large: [100, 200],
    },
    sampleViolationText:
      'Этот бездарный клоун обманывает людей, давайте устроим ему травлю и закидаем жалобами!',
  },
  {
    id: 'law-274-456-2',
    code: 'ст. 274 УК РК · ст. 456-2 КоАП РК',
    titleRu: 'Заведомо ложная информация (вбросы, фейки в СМИ и блогах)',
    titleKz: 'Көрінеу жалған ақпарат тарату (фейктер мен ақпараттық шабуылдар)',
    summaryRu:
      'Публикация недостоверных обвинений в хищении бюджета, коррупции или фейковых ЧС без судебного акта либо официального подтверждения.',
    summaryKz:
      'Сот актісінсіз немесе ресми растаусыз бюджетті жымқыру, сыбайлас жемқорлық туралы жалған ақпарат тарату.',
    regulator: 'МКИ РК / МВД РК / Прокуратура',
    mrpByTier: {
      individual: [20, 100],
      small: [50, 2000],
      medium: [100, 3000],
      large: [250, 4000],
    },
    noteByTier: {
      individual: 'до 100 МРП (456-2 КоАП) / УК 274',
      small: '50–100 МРП (456-2) / до 2 000 МРП УК 274',
      medium: '100–3 000 МРП / ст. 274 УК РК',
      large: 'До 4 000 МРП / ст. 274 УК РК',
    },
    sampleViolationText:
      'СРОЧНЫЙ СЛИВ! Депутат №3 тайно переписал бюджет района на офшоры и забирает откаты! Этот мошенник и предатель должен ответить. Приходите на выборы 15 марта и голосуйте по совести!',
  },
  {
    id: 'law-79',
    code: 'ст. 147 УК РК · ст. 79 КоАП РК · Закон № 94-V',
    titleRu: 'Защита персональных данных и доксинг (ИИН, телефоны, адреса)',
    titleKz: 'Дербес деректерді қорғау және доксинг (ЖСН, телефон, мекенжай)',
    summaryRu:
      'Запрещена публикация ИИН, удостоверений личности, номеров телефонов и домашних адресов граждан без их письменного согласия.',
    summaryKz:
      'Азаматтардың ЖСН, жеке куәлігін, телефон нөмірлері мен мекенжайларын жазбаша келісімсіз жариялауға тыйым салынады.',
    regulator: 'МЦРИАП РК / МВД РК',
    mrpByTier: {
      individual: [10, 30],
      small: [30, 60],
      medium: [60, 100],
      large: [100, 200],
    },
    sampleViolationText:
      'Публикуем данные: ИИН 840512300194, личный телефон +7 701 777-45-90, адрес: г. Алматы, ул. Тимирязева, д. 42, кв. 18.',
  },
  {
    id: 'law-lang-21',
    code: 'ст. 21 Закона РК «О языках»',
    titleRu: 'Обязательное двуязычие рекламы (KZ + RU)',
    titleKz: 'Жарнамадағы міндетті қостілділік (Қазақша + Орысша)',
    summaryRu:
      'Тексты коммерческой рекламы, ценники, вывески и баннеры в РК должны размещаться на казахском и русском языках с соблюдением паритета.',
    summaryKz:
      'ҚР аумағындағы коммерциялық жарнама, бағалар мен баннерлер міндетті түрде мемлекеттік және орыс тілдерінде орналастырылады.',
    regulator: 'МКИ РК / Акиматы',
    mrpByTier: {
      individual: [5, 15],
      small: [10, 25],
      medium: [25, 35],
      large: [35, 50],
    },
    sampleViolationText:
      'Скидка 50% на весь ассортимент электроники в Астане только до конца недели! Успей купить на сайте.',
  },
];

export const SandboxAndLawsView: React.FC<SandboxAndLawsViewProps> = ({
  onOpenReportForCase,
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
  const [batchResults, setBatchResults] = useState<AuditCase[]>([]);
  const [isBatchRunning, setIsBatchRunning] = useState(false);

  // Tab 3: Laws & MRP Calculator
  const [entityTier, setEntityTier] = useState<EntityTier>('small');
  const [lawSearch, setLawSearch] = useState('');

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
    if (!draftText.trim()) return;
    setIsRewriting(true);
    try {
      const res = await rewriteContentSafe({
        text: draftText,
        language,
      });
      setRewriteData(res);
    } finally {
      setIsRewriting(false);
    }
  };

  const handleFullDraftAudit = async () => {
    if (!draftText.trim()) return;
    setIsAuditingDraft(true);
    try {
      const auditCase = await analyzeContentWithGemini({
        modality: 'text',
        text: draftText,
        fileName: 'prepublish_sandbox.txt',
      });
      onOpenReportForCase(auditCase);
    } finally {
      setIsAuditingDraft(false);
    }
  };

  const handleRunBatchAudit = async () => {
    const rawItems = batchInput
      .split(/\n-{3,}\n|\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 15);

    if (rawItems.length === 0) return;

    setIsBatchRunning(true);
    try {
      const results: AuditCase[] = [];
      for (let i = 0; i < rawItems.length; i++) {
        const item = rawItems[i];
        const isUrl = /^https?:\/\//i.test(item);
        const res = normalizeAuditCaseCompliance(
          await analyzeContentWithGemini({
            modality: isUrl ? 'url' : 'text',
            url: isUrl ? item : undefined,
            text: item,
            fileName: `Пакет #${i + 1}`,
          })
        );
        results.push(res);
      }
      setBatchResults(results);
    } finally {
      setIsBatchRunning(false);
    }
  };

  const filteredLaws = KZ_LAWS_DB.filter(
    (law) =>
      law.code.toLowerCase().includes(lawSearch.toLowerCase()) ||
      law.titleRu.toLowerCase().includes(lawSearch.toLowerCase()) ||
      law.titleKz.toLowerCase().includes(lawSearch.toLowerCase()) ||
      law.summaryRu.toLowerCase().includes(lawSearch.toLowerCase())
  );

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
              1 МРП = {MRP_2026_KZT.toLocaleString('ru-RU')} ₸
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
                      Риск: {liveDiagnostics.risk}% → {rewriteData.newRiskScore}%
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
                      navigator.clipboard?.writeText(chosen);
                      setCopiedFixed(true);
                      setTimeout(() => setCopiedFixed(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {copiedFixed ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.8} />
                    ) : (
                      <Copy className="w-3.5 h-3.5" strokeWidth={1.6} />
                    )}
                    <span>{copiedFixed ? 'Скопировано' : 'Копировать'}</span>
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
                  <div className="text-[10px] uppercase opacity-75 font-normal mb-0.5">
                    {language === 'kz' ? 'Санкция бағасы (ШОБ):' : 'Оценка штрафа по КоАП РК (МБ):'}
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
                      {chk.ok ? 'OK' : 'НЕТ'}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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
              <button
                type="button"
                onClick={handleRunBatchAudit}
                disabled={isBatchRunning || !batchInput.trim()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium shadow-xs transition-colors disabled:opacity-50 shrink-0"
              >
                {isBatchRunning ? (
                  <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.6} />
                ) : (
                  <Layers className="w-4 h-4" strokeWidth={1.6} />
                )}
                <span>
                  {isBatchRunning
                    ? language === 'kz'
                      ? 'Тексерілуде...'
                      : 'Выполняется аудит...'
                    : language === 'kz'
                    ? 'Пакетті тексеру'
                    : 'Проверить весь пакет'}
                </span>
              </button>
            </div>

            <textarea
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              rows={7}
              className="w-full p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-['JetBrains_Mono'] leading-relaxed focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600"
            />
          </div>

          {batchResults.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-5 py-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
                <span className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  {language === 'kz' ? 'Пакеттік аудит нәтижелері' : 'Сводный реестр пакетной проверки'} ({batchResults.length})
                </span>
                <span className="font-['JetBrains_Mono'] text-xs text-zinc-500 tabular-nums">
                  Нарушений: {batchResults.filter((r) => r.violations.length > 0).length} / {batchResults.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200/80 dark:border-zinc-800 text-[11px] font-['JetBrains_Mono'] uppercase text-zinc-500 dark:text-zinc-400 bg-zinc-50/70 dark:bg-zinc-950/60">
                      <th className="py-3 px-4">#</th>
                      <th className="py-3 px-4">Фрагмент материала</th>
                      <th className="py-3 px-4">Риск</th>
                      <th className="py-3 px-4">Статья / Штраф РК</th>
                      <th className="py-3 px-4 text-right">Отчёт</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                    {batchResults.map((item, idx) => {
                      const mainV = item.violations[0];
                      const pDisp = getCompliancePenaltyDisplay(item.violations, entityTier, language);
                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-['JetBrains_Mono'] text-zinc-400 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-4 max-w-md">
                            <div className="text-zinc-900 dark:text-zinc-100 font-medium line-clamp-2">
                              {item.extractedText || item.title}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
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
                              {item.riskScore}/100 · {item.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-['JetBrains_Mono'] text-zinc-700 dark:text-zinc-300">
                            <div className="font-medium">{mainV ? mainV.code : 'Соответствует РК'}</div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{pDisp.headline}</div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => onOpenReportForCase(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-medium hover:opacity-90"
                            >
                              <FileCheck2 className="w-3 h-3" strokeWidth={1.6} />
                              <span>Открыть</span>
                            </button>
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
                  { id: 'individual' as EntityTier, label: 'Физлицо / Блогер' },
                  { id: 'small' as EntityTier, label: 'Малый бизнес / ИП' },
                  { id: 'medium' as EntityTier, label: 'Средний бизнес' },
                  { id: 'large' as EntityTier, label: 'Крупный бизнес' },
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
                placeholder="Поиск по КоАП / УК РК..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-zinc-400"
              />
            </div>
          </div>

          {/* Law Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredLaws.map((law) => {
              const [minMrp, maxMrp] = law.mrpByTier[entityTier];
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
              const note = law.noteByTier?.[entityTier];

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
                      <span className="font-['JetBrains_Mono'] text-[11px] text-zinc-500 dark:text-zinc-400">
                        {law.regulator}
                      </span>
                    </div>
                    <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                      {language === 'kz' ? law.titleKz : law.titleRu}
                    </h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed">
                      {language === 'kz' ? law.summaryKz : law.summaryRu}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-['JetBrains_Mono'] uppercase text-zinc-400 block">
                        Санкция для субъекта
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium text-zinc-800 dark:text-zinc-200 shrink-0 transition-colors"
                    >
                      <Scale className="w-3.5 h-3.5" strokeWidth={1.6} />
                      <span>Тест в песочнице</span>
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
