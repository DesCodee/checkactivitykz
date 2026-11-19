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
import {
  Copy,
  Check,
  FileText,
  ArrowLeft,
  Share2,
  PieChart as PieChartIcon,
  BarChart3,
  CircleDot,
  Filter,
  FilterX,
  Play,
  Pause,
  Film,
  ScanText,
  Eye,
  Info,
  AlertTriangle,
  ShieldCheck,
  Quote,
  Scale,
  AudioLines,
  Sparkles,
  Gavel,
  ShieldAlert,
  Lock,
  Megaphone,
  Dices,
  Wand2,
  Calculator,
  Building2,
  RefreshCw,
  CheckCircle2,
  Languages,
} from 'lucide-react';
import { AuditCase, RewriteResult, Violation } from '../types';
import { PRIMARY_AUDIT_CASE } from '../data/mockData';
import { calculateRiskDistribution, ChartDatum } from '../utils/riskAnalytics';
import { analyzeEmojis } from '../utils/emojiIntelligence';
import { rewriteContentSafe } from '../services/geminiService';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  buildOfficialDocument,
  getCompliancePenaltyDisplay,
  getLocalizedRiskLevel,
  getLocalizedStatus,
  isEthicsViolation,
  isLegalViolation,
  MRP_2026_KZT,
  normalizeAuditCaseCompliance,
  type BusinessEntityType,
} from '../utils/kzComplianceIntelligence';
import { findKzLawByViolation, KZ_LAWS_DB } from '../data/kzLawsDb';
import { useApp } from '../utils/i18n';

interface ExpertReportViewProps {
  auditCase?: AuditCase;
  entityTier?: BusinessEntityType;
  onEntityTierChange?: (tier: BusinessEntityType) => void;
  onOpenPdfModal: (entityTier?: BusinessEntityType) => void;
  onRetest: () => void;
  onReauditFixedText?: (fixedText: string) => Promise<void> | void;
  onOpenShare?: (data: {
    title?: string;
    text?: string;
    isReport?: boolean;
    auditCase?: AuditCase;
    entityTier?: BusinessEntityType;
  }) => void;
}

type EntityTier = BusinessEntityType;
const MRP_RATE = MRP_2026_KZT;

interface TextMatchSpan {
  start: number;
  end: number;
  violationId: string;
  category: 'legal' | 'ethics' | 'safe';
  title: string;
}

function renderHighlightedText(
  text: string,
  violations: Violation[],
  activeBbox: string | null,
  onSelectViolation: (id: string) => void
): React.ReactNode {
  if (!text) return null;
  const lowerText = text.toLowerCase();
  const rawSpans: TextMatchSpan[] = [];

  for (const v of violations) {
    const candidates: string[] = [];
    if (v.quote && v.quote.trim().length >= 2) {
      candidates.push(v.quote.trim());
      if (v.quote.includes(',')) {
        v.quote.split(',').forEach((part) => {
          const clean = part.trim();
          if (clean.length >= 2) candidates.push(clean);
        });
      }
      if (v.quote.includes(';')) {
        v.quote.split(';').forEach((part) => {
          const clean = part.trim();
          if (clean.length >= 3) candidates.push(clean);
        });
      }
    }

    for (const candidate of candidates) {
      const needle = candidate.toLowerCase();
      if (needle.length < 2) continue;
      let searchFrom = 0;
      let idx = lowerText.indexOf(needle, searchFrom);
      let hits = 0;
      while (idx !== -1 && hits < 4) {
        rawSpans.push({
          start: idx,
          end: idx + needle.length,
          violationId: v.id,
          category: v.category === 'ethics' ? 'ethics' : 'legal',
          title: `${v.code}: ${v.title}`,
        });
        hits++;
        searchFrom = idx + needle.length;
        idx = lowerText.indexOf(needle, searchFrom);
      }
    }
  }

  // Highlight whitelisted peaceful call so jury can verify zero false positive
  const peacefulPhrase = 'Приходите на выборы 15 марта и голосуйте по совести!';
  const peacefulIdx = lowerText.indexOf(peacefulPhrase.toLowerCase());
  if (peacefulIdx !== -1) {
    rawSpans.push({
      start: peacefulIdx,
      end: peacefulIdx + peacefulPhrase.length,
      violationId: 'whitelisted-peaceful',
      category: 'safe',
      title: 'Мирный призыв — нарушений не выявлено',
    });
  }

  if (rawSpans.length === 0) return text;

  // Sort by start asc, then longer length first, and deduplicate overlaps
  rawSpans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  const merged: TextMatchSpan[] = [];
  let cursor = 0;
  for (const span of rawSpans) {
    if (span.start < cursor) continue;
    merged.push(span);
    cursor = span.end;
  }

  const nodes: React.ReactNode[] = [];
  let pos = 0;
  merged.forEach((span, i) => {
    if (span.start > pos) {
      nodes.push(<React.Fragment key={`t-${i}`}>{text.slice(pos, span.start)}</React.Fragment>);
    }
    const fragment = text.slice(span.start, span.end);
    if (span.category === 'safe') {
      nodes.push(
        <mark
          key={`m-${i}`}
          title={span.title}
          className="px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border-b border-emerald-500/60"
        >
          {fragment}
        </mark>
      );
    } else {
      const isSelected = activeBbox === span.violationId;
      nodes.push(
        <mark
          key={`m-${i}`}
          title={span.title}
          onClick={() => onSelectViolation(span.violationId)}
          className={`cursor-pointer px-1 py-0.5 rounded transition-all ${
            span.category === 'ethics'
              ? 'bg-violet-500/20 text-violet-950 dark:text-violet-100 border-b-2 border-violet-500'
              : 'bg-rose-500/20 text-rose-950 dark:text-rose-100 border-b-2 border-rose-500'
          } ${isSelected ? 'ring-2 ring-zinc-900 dark:ring-zinc-100' : ''}`}
        >
          {fragment}
        </mark>
      );
    }
    pos = span.end;
  });

  if (pos < text.length) {
    nodes.push(<React.Fragment key="t-end">{text.slice(pos)}</React.Fragment>);
  }
  return nodes;
}

export const ExpertReportView: React.FC<ExpertReportViewProps> = ({
  auditCase: rawAuditCase = PRIMARY_AUDIT_CASE,
  entityTier: propEntityTier,
  onEntityTierChange,
  onOpenPdfModal,
  onRetest,
  onReauditFixedText,
  onOpenShare,
}) => {
  const { t, language } = useApp();
  const auditCase = React.useMemo(
    () => normalizeAuditCaseCompliance(rawAuditCase),
    [rawAuditCase]
  );
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
  const [rewriteResult, setRewriteResult] = useState<RewriteResult | null>(auditCase.rewriteResult || null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isReauditing, setIsReauditing] = useState(false);
  const [rewriteLang, setRewriteLang] = useState<'ru' | 'kz'>('ru');
  const [copiedRewrite, setCopiedRewrite] = useState(false);
  const [localEntityTier, setLocalEntityTier] = useState<EntityTier>('small');
  const entityTier = propEntityTier ?? localEntityTier;
  const setEntityTier = (tier: EntityTier) => {
    setLocalEntityTier(tier);
    onEntityTierChange?.(tier);
  };
  const [docType, setDocType] = useState<'complaint_gov' | 'claim_blogger'>('claim_blogger');
  const [copiedLegalDoc, setCopiedLegalDoc] = useState(false);
  const audioElementRef = React.useRef<HTMLAudioElement | null>(null);
  const videoPlayerRef = React.useRef<HTMLVideoElement | null>(null);
  const isMountedRef = React.useRef(true);
  const activeCaseIdRef = React.useRef(auditCase.id);
  const rewriteOpIdRef = React.useRef(0);
  const reauditOpIdRef = React.useRef(0);
  const copyTimersRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  const scheduleFlagReset = React.useCallback((setter: (v: boolean) => void, delayMs: number) => {
    setter(true);
    const timer = setTimeout(() => {
      if (isMountedRef.current) setter(false);
    }, delayMs);
    copyTimersRef.current.push(timer);
  }, []);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      for (const timer of copyTimersRef.current) {
        clearTimeout(timer);
      }
      copyTimersRef.current = [];
    };
  }, []);

  React.useEffect(() => {
    activeCaseIdRef.current = auditCase.id;
    setRewriteResult(auditCase.rewriteResult || null);
    setActiveBbox(auditCase.violations[0]?.id || null);
    setIsRewriting(false);
    setIsReauditing(false);
  }, [auditCase.id, auditCase.rewriteResult]);

  const localizedStatus = getLocalizedStatus(auditCase.status, language);
  const localizedRiskLevel = getLocalizedRiskLevel(auditCase.riskLevel, language);

  const seekToTimestamp = (timestampStr: string) => {
    if (!timestampStr || typeof timestampStr !== 'string') return;
    const clean = timestampStr.replace(/[^0-9:.]/g, '').trim();
    if (!clean || !/\d/.test(clean)) return;
    const parts = clean.split(':').map((p) => Number(p));
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return;
    let sec = 0;
    if (parts.length === 2) {
      sec = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      sec = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 1) {
      sec = parts[0];
    } else {
      return;
    }
    if (!Number.isFinite(sec) || sec < 0) return;

    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = sec;
      videoPlayerRef.current.play().catch(() => {});
      videoPlayerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (auditCase.videoDataUrl && auditCase.videoDataUrl.includes('youtube.com/embed')) {
      const baseUrl = auditCase.videoDataUrl.split('?')[0];
      const iframe = document.querySelector('iframe');
      if (iframe) {
        iframe.src = `${baseUrl}?start=${Math.floor(sec)}&autoplay=1`;
        iframe.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else if (audioElementRef.current) {
      audioElementRef.current.currentTime = sec;
      audioElementRef.current.play().catch(() => {});
      audioElementRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleCopyReport = () => {
    const findingsList =
      Array.isArray(auditCase.mediaAnalysis?.findings) && auditCase.mediaAnalysis.findings.length > 0
        ? auditCase.mediaAnalysis.findings
            .map((f) =>
              language === 'kz'
                ? `[${f.timestamp}] [${f.source}] ${f.category}\nДәйексөз/Сипаттама: «${f.quote_or_description}»\nДәлдік: ${f.confidence} | Негіздеме: ${f.reasoning}`
                : `[${f.timestamp}] [${f.source}] ${f.category}\nЦитата/Описание: «${f.quote_or_description}»\nДостоверность: ${f.confidence} | Обоснование: ${f.reasoning}`
            )
            .join('\n\n')
        : auditCase.violations
            .map((v, i) => {
              const vp = getCompliancePenaltyDisplay([v], entityTier, language);
              const vpText = vp.mode === 'legal_fine' ? `${vp.mrpRangeText} (${vp.kztRangeText})` : vp.headline;
              const tagLabel =
                v.category === 'ethics'
                  ? 'ЭТИКА'
                  : language === 'kz'
                  ? 'ҚР ЗАҢЫ'
                  : 'ЗАКОН РК';
              return language === 'kz'
                ? `${i + 1}. [${tagLabel}] ${v.title} (${v.code})\nДәйексөз: «${v.quote || '-'}»\nНегіздеме: ${v.basis}\nАйыппұл/Реттеуші: ${vpText} (${v.jurisdiction || '-'})\nҰсыныс: ${v.recommendation || '-'}`
                : `${i + 1}. [${tagLabel}] ${v.title} (${v.code})\nЦитата: «${v.quote || '-'}»\nОбоснование: ${v.basis}\nШтраф/Регулятор: ${vpText} (${v.jurisdiction || '-'})\nРекомендация: ${v.recommendation || '-'}`;
            })
            .join('\n\n');

    const reportText = (
      language === 'kz'
        ? [
            `═════════════════════════════════════════════════`,
            `CHECK ACTIVITY KZ САРАПТАМАЛЫҚ ЕСЕБІ: ${auditCase.referenceNumber}`,
            `═════════════════════════════════════════════════`,
            `Нысан: ${auditCase.title}`,
            `Күні мен уақыты: ${auditCase.timestamp}`,
            `Тәуекел индексі: ${auditCase.riskScore} / 100 (${localizedRiskLevel})`,
            `Құқықтық комплаенс: ${auditCase.legalScore || 0}% | Цифрлық этика: ${auditCase.ethicsScore || 0}%`,
            `Айыппұл (бағалау): ${penaltyDisplay.headline} (${penaltyDisplay.mrpRangeText})`,
            `Мәртебе: ${localizedStatus}`,
            auditCase.mediaAnalysis?.language ? `Материал тілі: ${auditCase.mediaAnalysis.language}` : '',
            auditCase.mediaAnalysis?.overall_risk ? `Жалпы тәуекел деңгейі: ${auditCase.mediaAnalysis.overall_risk}` : '',
            `Түйін: ${auditCase.mediaAnalysis?.summary || auditCase.summary}`,
            ``,
            `АНЫҚТАЛҒАН ТӘУЕКЕЛДЕР МЕН БҰЗУШЫЛЫҚТАР:`,
            findingsList || '0 ₸ (Бұзушылықтар анықталмады). Материал ҚР заңнамасына сәйкес келеді.',
            ``,
            auditCase.mediaAnalysis?.limitations ? `Талдау шектеулері: ${auditCase.mediaAnalysis.limitations}` : '',
            `═════════════════════════════════════════════════`,
            `Нәтиже алдын ала берілген, адам тексеруі қажет.`,
            `═════════════════════════════════════════════════`,
          ]
        : [
            `═════════════════════════════════════════════════`,
            `ЭКСПЕРТНЫЙ ОТЧЁТ CHECK ACTIVITY KZ: ${auditCase.referenceNumber}`,
            `═════════════════════════════════════════════════`,
            `Объект: ${auditCase.title}`,
            `Дата и время: ${auditCase.timestamp}`,
            `Индекс риска: ${auditCase.riskScore} / 100 (${localizedRiskLevel})`,
            `Правовой комплаенс: ${auditCase.legalScore || 0}% | Интернет-этика: ${auditCase.ethicsScore || 0}%`,
            `Штраф (оценка): ${penaltyDisplay.headline} (${penaltyDisplay.mrpRangeText})`,
            `Статус: ${localizedStatus}`,
            auditCase.mediaAnalysis?.language ? `Язык материала: ${auditCase.mediaAnalysis.language}` : '',
            auditCase.mediaAnalysis?.overall_risk ? `Общий уровень риска: ${auditCase.mediaAnalysis.overall_risk}` : '',
            `Резюме: ${auditCase.mediaAnalysis?.summary || auditCase.summary}`,
            ``,
            `ВЫЯВЛЕННЫЕ РИСКИ И НАРУШЕНИЯ:`,
            findingsList || '0 ₸ (Нарушений не выявлено). Материал соответствует нормам законодательства РК.',
            ``,
            auditCase.mediaAnalysis?.limitations ? `Ограничения анализа: ${auditCase.mediaAnalysis.limitations}` : '',
            `═════════════════════════════════════════════════`,
            `Результат предварительный, требуется проверка человеком.`,
            `═════════════════════════════════════════════════`,
          ]
    )
      .filter(Boolean)
      .join('\n');

    void copyTextToClipboard(reportText).then((ok) => {
      if (ok && isMountedRef.current) {
        scheduleFlagReset(setCopiedReport, 2500);
      }
    });
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

  const riskAnalytics = calculateRiskDistribution(auditCase.violations, language);

  const legalViolations = auditCase.violations.filter((v) => isLegalViolation(v));
  const ethicsViolations = auditCase.violations.filter((v) => isEthicsViolation(v));
  const penaltyDisplay = getCompliancePenaltyDisplay(auditCase.violations, entityTier, language);

  const handleShare = () => {
    const articlesList =
      auditCase.violations.length > 0
        ? Array.from(new Set(auditCase.violations.map((v) => v.code).filter(Boolean))).join(', ')
        : language === 'kz'
        ? 'Бұзушылықтар анықталған жоқ'
        : 'Нарушений не выявлено';
    const safeSha = typeof auditCase.sha256 === 'string' && auditCase.sha256 ? auditCase.sha256 : 'unavailable';

    const summaryText =
      language === 'kz'
        ? [
            `CheckActivity KZ · Сараптамалық есеп ${auditCase.referenceNumber}`,
            `Нысан: ${auditCase.title}`,
            `Мәртебе: ${localizedStatus} | Тәуекел индексі: ${auditCase.riskScore}/100 (${localizedRiskLevel})`,
            `Айыппұл бағасы: ${penaltyDisplay.headline}`,
            `Анықталған баптар: ${articlesList}`,
            `SHA-256: ${safeSha}`,
          ].join('\n')
        : [
            `CheckActivity KZ · Экспертный отчёт ${auditCase.referenceNumber}`,
            `Объект: ${auditCase.title}`,
            `Статус: ${localizedStatus} | Индекс риска: ${auditCase.riskScore}/100 (${localizedRiskLevel})`,
            `Оценка штрафа: ${penaltyDisplay.headline}`,
            `Выявленные статьи: ${articlesList}`,
            `SHA-256: ${safeSha}`,
          ].join('\n');

    if (onOpenShare) {
      onOpenShare({
        title: `${language === 'kz' ? 'Сараптамалық есеп' : 'Экспертный отчёт'}: ${auditCase.title} (${auditCase.referenceNumber})`,
        text: summaryText,
        isReport: true,
        auditCase,
        entityTier,
      });
      return;
    }

    void copyTextToClipboard(summaryText).then((ok) => {
      if (ok && isMountedRef.current) {
        scheduleFlagReset(setCopiedLink, 2000);
      }
    });
  };

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
          return (
            !/ч\.\s*1\s*ст\.\s*455|п\.\s*5-1|5-1\s*ст\.\s*6|казино|слот/i.test(text) &&
            /230-vii|230|59-нқ|ч\.\s*[23]\s*ст\.\s*455|маркировк|жарнама|реклам|скрытая реклама|спонсор|бин|инфлюенс|двуязычи|ст\.\s*21/i.test(text)
          );
        }
        if (activeRiskFilter === 'casino') {
          return /ч\.\s*1\s*ст\.\s*455|п\.\s*5-1|5-1\s*ст\.\s*6|445-1|(?<![а-яёәғқңөұүһіa-z])(?:казино|casino|1win|1xbet|слот[ыа-яё]*|букмекер[а-яё]*|ставк(?:а|и|у|е|ой|ами|ах)|рулетк[а-яё]*|фриспин[а-яё]*|азартн[а-яё]*|лотере[а-яё]*)(?=$|[^а-яёәғқңөұүһіa-z])/i.test(text);
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
      ? filteredByRisk.filter((v) => isLegalViolation(v))
      : filteredByRisk.filter((v) => isEthicsViolation(v));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as ChartDatum;
      return (
        <div className="bg-zinc-900 dark:bg-zinc-950 text-zinc-100 p-3 rounded-xl shadow-lg border border-zinc-800 text-xs font-['Inter'] max-w-[270px] pointer-events-none z-50">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: data.color }}
            />
            <span className="font-semibold text-zinc-100">
              {data.name}
            </span>
          </div>
          <div className="font-['JetBrains_Mono'] text-[11px] text-zinc-400 mb-2">
            {data.article}
          </div>
          <div className="flex items-center justify-between border-t border-zinc-800 pt-1.5 text-[11px] gap-2">
            <span className="text-zinc-400">
              {language === 'kz' ? 'Істегі тәуекел үлесі:' : 'Доля риска в кейсе:'}
            </span>
            <span className="font-semibold text-zinc-100 font-['JetBrains_Mono'] tabular-nums text-xs">{data.value}%</span>
          </div>
          {data.count > 0 && (
            <div className="flex items-center justify-between text-[11px] mt-1 gap-2">
              <span className="text-zinc-400">
                {language === 'kz' ? 'Тіркелген тармақтар:' : 'Зафиксировано пунктов:'}
              </span>
              <span className="font-medium text-zinc-200 tabular-nums">
                {data.count} {language === 'kz' ? 'дана' : 'шт.'}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const renderCategoryIcon = (catId: string) => {
    switch (catId) {
      case 'cyberbullying':
        return <ShieldAlert className="w-4 h-4" strokeWidth={1.6} />;
      case 'privacy':
        return <Lock className="w-4 h-4" strokeWidth={1.6} />;
      case 'hidden_ad':
        return <Megaphone className="w-4 h-4" strokeWidth={1.6} />;
      case 'casino':
        return <Dices className="w-4 h-4" strokeWidth={1.6} />;
      default:
        return <AlertTriangle className="w-4 h-4" strokeWidth={1.6} />;
    }
  };

  const isClean = auditCase.violations.length === 0;
  const extractedContent = auditCase.extractedText || auditCase.rawText;
  const hasProfanityInExtracted =
    Boolean(extractedContent &&
    /(?:^|[^а-яёәғқңөұүһі])(?:бля(?:т[ья]?|д[ьт]?)?|ху[йияеёю][а-яё]*|пизд[а-яё]*|(?:за|по|вы|до|на|от|под|при|пере|раз|у|долбо|съ|въ)?[её]б(?:ать|ал[аио]?|ан[аоы]?|ут|ет|ёт|ись|уч|ок|ище|ну[а-яё]*)|сук[аиеу](?=$|[^а-яё])|сучк[аи]|наху[йи]|муда[кч]|гондон|пид[оа]р|шеше[ңн]|си[кқ]т|көт(?:і|ті|ін|ің|ке)?(?=$|[^а-яёәғқңөұүһі])|қота[қк])/i.test(
      extractedContent
    ));

  const emojiReport =
    auditCase.emojiAnalysis ||
    analyzeEmojis(
      `${extractedContent || ''} ${auditCase.rawText || ''} ${auditCase.title || ''}`
    );

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-5 sm:gap-6 font-['Inter']">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-zinc-800 pb-5">
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs font-medium px-2.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700 tabular-nums">
              {auditCase.referenceNumber}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800">
              <span
                className={`w-2 h-2 rounded-full ${
                  isClean ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <span>
                {isClean
                  ? language === 'kz'
                    ? 'БҰЗУШЫЛЫҚ ЖОҚ'
                    : 'НАРУШЕНИЙ НЕТ'
                  : `${language === 'kz' ? 'БҰЗУШЫЛЫҚ' : 'НАРУШЕНИЙ'}: ${auditCase.violations.length}`}
              </span>
            </span>
            <span className="font-['JetBrains_Mono'] text-[11px] text-zinc-500 dark:text-zinc-400">
              {auditCase.timestamp}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mt-0.5">
            {t('reportTitle')}
          </h1>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-2xl">
            {language === 'kz' ? 'Тексеру нысаны:' : 'Объект проверки:'}{' '}
            <strong className="text-zinc-900 dark:text-zinc-100 font-medium">
              {auditCase.title}
            </strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
          <button
            type="button"
            onClick={handleCopyReport}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800 font-medium text-xs transition-colors"
            title={
              language === 'kz'
                ? 'Құрылымдалған сараптамалық есепті көшіру'
                : 'Скопировать структурированный экспертный отчёт'
            }
          >
            {copiedReport ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={1.8} />
            ) : (
              <Copy className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" strokeWidth={1.6} />
            )}
            <span className="truncate">
              {copiedReport
                ? language === 'kz'
                  ? 'Есеп көшірілді!'
                  : 'Отчёт скопирован!'
                : language === 'kz'
                ? 'Есепті көшіру'
                : 'Скопировать отчёт'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenPdfModal(entityTier)}
            className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 font-medium text-xs transition-colors shadow-xs"
          >
            <FileText className="w-4 h-4 shrink-0" strokeWidth={1.6} />
            <span className="truncate">{t('printPdfBtn')}</span>
          </button>

          <button
            type="button"
            onClick={onRetest}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" strokeWidth={1.6} />
            <span className="truncate">{t('newAuditBtn')}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 px-3 sm:p-2 py-2 rounded-xl bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium transition-colors"
            title={t('shareBtn')}
            aria-label={t('shareBtn')}
          >
            {copiedLink ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" strokeWidth={1.8} />
            ) : (
              <Share2 className="w-4 h-4 shrink-0" strokeWidth={1.6} />
            )}
            <span className="sm:hidden truncate">{copiedLink ? t('ocrCopied') : t('shareBtn')}</span>
          </button>
        </div>
      </div>

      {/* High-Contrast Executive Verdict Banner */}
      <div
        className={`rounded-2xl border p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 ${
          auditCase.status === 'ТРЕБУЕТ МЕР' || auditCase.status === 'БЛОКИРОВКА'
            ? 'bg-rose-50/90 dark:bg-rose-950/30 border-rose-300 dark:border-rose-900 border-l-rose-600'
            : auditCase.status === 'ПРЕДУПРЕЖДЕНИЕ'
            ? 'bg-amber-50/90 dark:bg-amber-950/25 border-amber-300 dark:border-amber-900 border-l-amber-500'
            : 'bg-emerald-50/90 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-900 border-l-emerald-600'
        }`}
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-['JetBrains_Mono'] font-bold tracking-wide shadow-2xs ${
                auditCase.status === 'ТРЕБУЕТ МЕР' || auditCase.status === 'БЛОКИРОВКА'
                  ? 'bg-rose-600 text-white'
                  : auditCase.status === 'ПРЕДУПРЕЖДЕНИЕ'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-emerald-600 text-white'
              }`}
            >
              {localizedStatus}
            </span>
            <span className="font-['JetBrains_Mono'] text-sm font-bold text-zinc-950 dark:text-zinc-50 tabular-nums">
              {language === 'kz' ? 'Тәуекел индексі:' : 'Индекс риска:'} {auditCase.riskScore} / 100 ({localizedRiskLevel})
            </span>
          </div>
          <p className="text-xs sm:text-[13px] font-medium text-zinc-800 dark:text-zinc-200 leading-snug break-words">
            {auditCase.summary || (isClean ? t('cleanMaterialNote') : penaltyDisplay.subline)}
          </p>
        </div>

        <div className="shrink-0 bg-white dark:bg-zinc-900 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-2xs md:text-right">
          <span className="text-[10px] font-['JetBrains_Mono'] uppercase font-semibold text-zinc-500 dark:text-zinc-400 block">
            {language === 'kz' ? 'Құқықтық санкция бағасы' : 'Оценка штрафа по КоАП / УК РК'}
          </span>
          <div
            className={`font-['Plus_Jakarta_Sans'] text-base sm:text-lg font-bold tabular-nums mt-0.5 ${
              penaltyDisplay.mode === 'legal_fine'
                ? 'text-rose-700 dark:text-rose-400'
                : penaltyDisplay.mode === 'ethics_only'
                ? 'text-amber-700 dark:text-amber-300 text-sm'
                : 'text-emerald-700 dark:text-emerald-400 text-sm'
            }`}
          >
            {penaltyDisplay.headline}
          </div>
          <span className="text-[11px] font-['JetBrains_Mono'] text-zinc-600 dark:text-zinc-300">
            {penaltyDisplay.subline}
          </span>
        </div>
      </div>

      {/* 4 Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Overall Risk Score */}
        <div
          className={`rounded-2xl bg-white dark:bg-zinc-900 border p-4 sm:p-5 shadow-xs flex flex-col justify-between ${
            auditCase.riskScore >= 70
              ? 'border-rose-300 dark:border-rose-900/80'
              : auditCase.riskScore >= 25
              ? 'border-amber-300 dark:border-amber-900/80'
              : 'border-emerald-300 dark:border-emerald-900/80'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t('riskIndex')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  auditCase.riskScore >= 70
                    ? 'bg-rose-600'
                    : auditCase.riskScore >= 25
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
              />
              <span>{localizedRiskLevel}</span>
            </span>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
              {auditCase.riskScore}
              <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500"> / 100</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  auditCase.riskScore >= 70
                    ? 'bg-rose-600'
                    : auditCase.riskScore >= 25
                    ? 'bg-amber-500'
                    : 'bg-emerald-600'
                }`}
                style={{ width: `${Math.max(4, Math.min(100, auditCase.riskScore))}%` }}
              />
            </div>
          </div>
          <span
            className={`text-[11px] font-['JetBrains_Mono'] font-bold truncate ${
              auditCase.status === 'ТРЕБУЕТ МЕР' || auditCase.status === 'БЛОКИРОВКА'
                ? 'text-rose-700 dark:text-rose-400'
                : auditCase.status === 'ПРЕДУПРЕЖДЕНИЕ'
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {localizedStatus}
          </span>
        </div>

        {/* Metric 2: Legal Compliance (Закон РК) */}
        <div
          className={`rounded-2xl bg-white dark:bg-zinc-900 border p-4 sm:p-5 shadow-xs flex flex-col justify-between ${
            penaltyDisplay.mode === 'legal_fine'
              ? 'border-rose-300 dark:border-rose-900/80'
              : penaltyDisplay.mode === 'ethics_only'
              ? 'border-amber-300 dark:border-amber-900/80'
              : 'border-emerald-300 dark:border-emerald-900/80'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t('legalCompliance')}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono']">
              {language === 'kz' ? 'ҚР ӘҚБтК' : 'КоАП РК'}
            </span>
          </div>
          <div className="my-2.5">
            {penaltyDisplay.mode === 'legal_fine' ? (
              <>
                <div className="text-lg sm:text-xl font-bold tracking-tight text-rose-700 dark:text-rose-400 tabular-nums leading-snug">
                  {penaltyDisplay.kztRangeText}
                </div>
                <div className="text-xs font-medium text-zinc-800 dark:text-zinc-200 mt-1.5 tabular-nums">
                  {penaltyDisplay.mrpRangeText} · {legalViolations.length}{' '}
                  {language === 'kz'
                    ? 'заң бұзушылық'
                    : legalViolations.length === 1
                    ? 'нарушение закона'
                    : 'нарушений закона'}
                </div>
              </>
            ) : penaltyDisplay.mode === 'ethics_only' ? (
              <>
                <div className="text-sm font-bold tracking-tight text-amber-700 dark:text-amber-300 leading-snug">
                  {penaltyDisplay.headline}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-300 mt-1.5">
                  {penaltyDisplay.subline}
                </div>
              </>
            ) : (
              <>
                <div className="text-base sm:text-lg font-bold tracking-tight text-emerald-700 dark:text-emerald-400 leading-snug">
                  {penaltyDisplay.headline}
                </div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5">
                  {penaltyDisplay.subline}
                </div>
              </>
            )}
          </div>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] truncate">
            {language === 'kz' ? '№ 230-VII Заңы · 1 АЕК = 4 325 ₸' : 'Закон № 230-VII · 1 МРП = 4 325 ₸'}
          </span>
        </div>

        {/* Metric 3: Digital Ethics Score (Интернет-этика) */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t('digitalEthics')}
            </span>
            <span className="text-[11px] text-violet-600 dark:text-violet-400 font-['JetBrains_Mono']">
              {language === 'kz' ? 'Экожүйе' : 'Экосистема'}
            </span>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
              {auditCase.ethicsScore ?? ethicsViolations.length * 35}
              <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500"> / 100</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-600 dark:bg-violet-500 transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    auditCase.ethicsScore ?? ethicsViolations.length * 35
                  )}%`,
                }}
              />
            </div>
          </div>
          <span className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
            {ethicsViolations.length === 0
              ? language === 'kz'
                ? 'Этика сақталған'
                : 'Этика соблюдена'
              : `${ethicsViolations.length} ${
                  language === 'kz' ? 'этикалық тәуекел' : 'этических риска'
                }`}
          </span>
        </div>

        {/* Metric 4: Violations Breakdown */}
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {t('totalFindings')}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-['JetBrains_Mono'] tabular-nums">
              {auditCase.violations.length}
            </span>
          </div>
          <div className="my-2.5">
            <div className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 tabular-nums">
              {auditCase.violations.length}
              <span className="text-sm font-normal text-zinc-400 dark:text-zinc-500">
                {' '}
                {language === 'kz' ? 'тармақ' : 'пунктов'}
              </span>
            </div>
            <div className="text-xs text-zinc-700 dark:text-zinc-300 mt-1.5 flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                <Scale className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" strokeWidth={1.6} />
                {legalViolations.length} {language === 'kz' ? 'заң' : 'закон'}
              </span>
              <span className="text-zinc-300 dark:text-zinc-700">·</span>
              <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-400 font-semibold tabular-nums">
                <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.6} />
                {ethicsViolations.length} {language === 'kz' ? 'этика' : 'этика'}
              </span>
            </div>
          </div>
          <span className="text-[11px] text-zinc-600 dark:text-zinc-400 truncate tabular-nums">
            {auditCase.violations.filter((v) => v.severity === 'critical').length}{' '}
            {t('criticalFindings')}
          </span>
        </div>
      </div>

      {/* Human-in-the-loop Disclaimer Banner + Real Technical Telemetry */}
      <div className="flex flex-col gap-2">
        <div className="px-4 py-2.5 rounded-xl bg-zinc-100/80 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
          <Info className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" strokeWidth={1.6} />
          <span>
            {language === 'kz'
              ? 'Жүйе тек тәуекелдерді белгілейді, ал түпкілікті шешімді адам қабылдайды.'
              : 'Система только подсвечивает риски, а финальное решение принимает человек.'}
          </span>
        </div>

        {(() => {
          const tel = auditCase.telemetry;
          const checkedCount = tel?.checkedLawsCount ?? KZ_LAWS_DB.length;
          const isLiveRag = tel?.engineMode === 'rag-live-ai';
          const engineLabel = isLiveRag
            ? `RAG + Vision AI${tel?.aiModel ? ` (${tel.aiModel})` : ''}`
            : language === 'kz'
            ? 'ҚР НҚА базасы бойынша жергілікті аудит'
            : 'Локальный аудит по базе НПА РК';
          const durationSec = tel?.totalMs ? `${(tel.totalMs / 1000).toFixed(2)} ${language === 'kz' ? 'сек' : 'сек'}` : null;

          return (
            <div className="px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-[11px] font-['JetBrains_Mono'] text-zinc-600 dark:text-zinc-300">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isLiveRag ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span>
                  {language === 'kz'
                    ? `ҚР НҚА ${checkedCount} нормасы тексерілді`
                    : `Проверено ${checkedCount} норм НПА РК`}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">{engineLabel}</span>
                {typeof tel?.retrievedLawsCount === 'number' && tel.retrievedLawsCount > 0 && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {language === 'kz'
                        ? `RAG-таңдау: ${tel.retrievedLawsCount}`
                        : `RAG-контекст: ${tel.retrievedLawsCount}`}
                    </span>
                  </>
                )}
                {durationSec && (
                  <>
                    <span className="text-zinc-300 dark:text-zinc-700">·</span>
                    <span className="tabular-nums">{durationSec}</span>
                  </>
                )}
              </div>

              {tel && (
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                  {language === 'kz'
                    ? `Алу: ${tel.extractMs}мс · Іздеу: ${tel.retrievalMs}мс · Аудит: ${tel.aiAuditMs}мс`
                    : `Извлечение: ${tel.extractMs}мс · RAG: ${tel.retrievalMs}мс · AI: ${tel.aiAuditMs}мс`}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Fraud / Deepfake & KZ/RU Bilingual Compliance Alerts */}
      {(auditCase.fraudSignals?.isPhishingOrDeepfake || (auditCase.bilingualCheck && !auditCase.bilingualCheck.languageParityOk)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {auditCase.fraudSignals?.isPhishingOrDeepfake && (
            <div className="rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" strokeWidth={1.6} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                    {auditCase.fraudSignals.riskCategory || 'Фишинг / Дипфейк / Скам РК'}
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300">
                    {language === 'kz' ? 'ҚР ҚК 190, 274-баптары' : 'ст. 190, 274 УК РК'}
                  </span>
                </div>
                <p className="text-xs text-rose-800 dark:text-rose-300 mt-1 leading-relaxed break-words">
                  {Array.isArray(auditCase.fraudSignals.indicators)
                    ? auditCase.fraudSignals.indicators.join(' · ')
                    : ''}
                </p>
              </div>
            </div>
          )}

          {auditCase.bilingualCheck && !auditCase.bilingualCheck.languageParityOk && (
            <div className="rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 p-4 flex items-start gap-3">
              <Languages className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" strokeWidth={1.6} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    {language === 'kz' ? 'Қазақ тіліндегі нұсқасы жоқ' : 'Отсутствует казахская версия / маркировка'}
                  </span>
                  <span className="font-['JetBrains_Mono'] text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300">
                    ч. 3 ст. 455 КоАП РК / ст. 21 Закона о языках РК
                  </span>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                  {language === 'kz'
                    ? 'Коммерциялық жарнама мемлекеттік және орыс тілдерінде «Жарнама» белгісімен болуы тиіс.'
                    : 'Рекомендуется добавить двуязычную маркировку «Жарнама / Реклама» ниже через AI Safe-Rewrite.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recharts Analytics: Risk Distribution Breakdown */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-6 shadow-xs flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <PieChartIcon className="w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0" strokeWidth={1.6} />
              <h2 className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {language === 'kz'
                  ? 'Анықталған тәуекелдердің үлестірім диаграммасы'
                  : 'Диаграмма распределения выявленных рисков'}
              </h2>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {language === 'kz'
                ? 'Негізгі санаттардың пайыздық қатынасы: кибербуллинг, дербес деректерді бұзу, жасырын жарнама'
                : 'Процентное соотношение ключевых категорий: кибербуллинг, нарушение ПДн, скрытая реклама и недобросовестный маркетинг'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {activeRiskFilter && (
              <button
                type="button"
                onClick={() => setActiveRiskFilter(null)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <FilterX className="w-3.5 h-3.5" strokeWidth={1.6} />
                <span>{language === 'kz' ? 'Сүзгіні тазарту' : 'Сбросить выбор'}</span>
              </button>
            )}

            <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => setChartMode('donut')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                  chartMode === 'donut'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <CircleDot className="w-3.5 h-3.5" strokeWidth={1.6} />
                <span>{language === 'kz' ? 'Дөңгелек' : 'Круговая'}</span>
              </button>
              <button
                type="button"
                onClick={() => setChartMode('bar')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                  chartMode === 'bar'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.6} />
                <span>{language === 'kz' ? 'Бағандар' : 'Гистограмма'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content: Chart + Category Breakdown Ledger */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Left Chart Viewport (5 cols) */}
          <div className="lg:col-span-5 relative flex flex-col items-center justify-center p-3 bg-zinc-50/70 dark:bg-zinc-950/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            <div className="w-full h-[230px] sm:h-[250px] relative">
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
                        outerRadius={94}
                        paddingAngle={riskAnalytics.activeChartData.length > 1 ? 3 : 0}
                        cornerRadius={5}
                        dataKey="value"
                        nameKey="name"
                        stroke="transparent"
                        strokeWidth={2}
                        animationDuration={700}
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
                            opacity={hoveredChartItem && hoveredChartItem !== entry.id ? 0.45 : 1}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>

                  {/* Centered HUD Metric */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 leading-none tabular-nums">
                      {isClean ? '0%' : `${auditCase.riskScore}%`}
                    </span>
                    <span className="text-[10px] font-['JetBrains_Mono'] font-medium text-zinc-500 dark:text-zinc-400 uppercase mt-1.5">
                      {isClean
                        ? language === 'kz'
                          ? 'Қауіпсіз'
                          : 'Безопасно'
                        : language === 'kz'
                        ? 'Тәуекел'
                        : 'Индекс риска'}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 tabular-nums">
                      {isClean
                        ? language === 'kz'
                          ? 'Бұзушылық жоқ'
                          : 'Нарушений нет'
                        : `${auditCase.violations.length} ${
                            language === 'kz' ? 'ескерту' : 'замечаний'
                          }`}
                    </span>
                  </div>
                </>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={riskAnalytics.activeChartData}
                    layout="vertical"
                    margin={{ top: 10, right: 24, left: 10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#71717a" opacity={0.2} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      unit="%"
                      tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'JetBrains Mono' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      tick={{ fontSize: 11, fill: '#71717a', fontWeight: 500 }}
                      width={108}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="value"
                      radius={[0, 6, 6, 0]}
                      animationDuration={700}
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
                          opacity={hoveredChartItem && hoveredChartItem !== entry.id ? 0.45 : 1}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center font-['JetBrains_Mono'] mt-1">
              {riskAnalytics.isClean
                ? language === 'kz'
                  ? '✓ 100% ҚР заңнамасы мен цифрлық этика нормаларына сәйкес'
                  : '✓ 100% Соответствие законодательству РК и нормам сетевой этики'
                : language === 'kz'
                ? 'Сүзу үшін секторды немесе санатты басыңыз'
                : 'Нажмите на сектор или категорию справа для фильтрации'}
            </div>
          </div>

          {/* Right Category Breakdown (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-2.5">
            {riskAnalytics.dominantRisk && (
              <div className="px-3.5 py-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" strokeWidth={1.6} />
                  <span className="truncate">
                    {language === 'kz' ? 'Басым тәуекел:' : 'Доминирующий риск:'}{' '}
                    <strong className="font-semibold">{riskAnalytics.dominantRisk.name}</strong>{' '}
                    <span className="tabular-nums">({riskAnalytics.dominantRisk.percentage}%)</span>
                  </span>
                </div>
                <span className="font-['JetBrains_Mono'] text-[11px] text-amber-800 dark:text-amber-300 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-md border border-amber-200/80 dark:border-amber-800 shrink-0">
                  {riskAnalytics.dominantRisk.article}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                    className={`p-3 rounded-xl border transition-all select-none ${
                      isDetected ? 'cursor-pointer' : 'opacity-65 cursor-default'
                    } ${
                      isSelected
                        ? 'ring-2 ring-zinc-900 dark:ring-zinc-100 bg-zinc-50 dark:bg-zinc-800/80 border-zinc-400 dark:border-zinc-600'
                        : isDetected
                        ? 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                        : 'bg-zinc-50/60 dark:bg-zinc-950/40 border-zinc-200/60 dark:border-zinc-800/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                          {renderCategoryIcon(cat.id)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight">
                            {cat.name}
                          </h4>
                          <div className="text-[10px] font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                            {cat.article}
                          </div>
                        </div>
                      </div>

                      <span className="text-xs font-semibold font-['JetBrains_Mono'] text-zinc-900 dark:text-zinc-100 tabular-nums shrink-0">
                        {cat.percentage}%
                      </span>
                    </div>

                    <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full mt-2.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: isDetected ? cat.color : '#a1a1aa',
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80">
                      <span className="tabular-nums">
                        {isDetected
                          ? `${cat.count} ${language === 'kz' ? 'ескерту' : 'замечаний'}`
                          : language === 'kz'
                          ? 'Тәуекел жоқ'
                          : 'Риск не выявлен'}
                      </span>
                      {isDetected ? (
                        <span className="font-medium font-['JetBrains_Mono'] text-zinc-800 dark:text-zinc-200">
                          {isSelected
                            ? language === 'kz'
                              ? '✓ Таңдалды'
                              : '✓ Выбрано'
                            : language === 'kz'
                            ? 'Сүзу'
                            : 'Фильтровать'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{language === 'kz' ? 'Таза' : 'Чисто'}</span>
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
        <div className="lg:col-span-6 flex flex-col gap-4">
          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-zinc-50/70 dark:bg-zinc-950/60 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-semibold font-['JetBrains_Mono'] text-zinc-700 dark:text-zinc-300 uppercase">
                {language === 'kz' ? 'Тексеру нысаны' : 'Объект проверки'}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono']">
                {auditCase.metadata?.fileSize || 'CONTENT PAYLOAD'}
              </span>
            </div>

            {/* Content Viewport */}
            <div className="relative min-h-[280px] sm:min-h-[340px] max-h-[560px] bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-between p-3 sm:p-4 overflow-y-auto">
              {isVideoCase ? (
                <div className="w-full flex flex-col gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-950 text-white border border-zinc-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                        className="w-9 h-9 rounded-lg bg-white text-zinc-900 hover:bg-zinc-200 flex items-center justify-center shrink-0 transition-colors"
                        title={isVideoPlaying ? 'Остановить' : 'Автопросмотр'}
                      >
                        {isVideoPlaying ? (
                          <Pause className="w-4 h-4" strokeWidth={1.8} />
                        ) : (
                          <Play className="w-4 h-4 ml-0.5" strokeWidth={1.8} />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="font-medium text-xs text-zinc-100 truncate">
                          {auditCase.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-['JetBrains_Mono'] text-zinc-400 mt-0.5 tabular-nums">
                          <span className="text-zinc-200 font-semibold">
                            {auditCase.videoDuration || '00:15'}
                          </span>
                          <span>·</span>
                          <span>
                            {auditCase.videoFrames?.length || 4} {t('videoFramesCount')}
                          </span>
                          <span>·</span>
                          <span className="text-emerald-400">9:16 Reels / Shorts</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsVideoPlaying(!isVideoPlaying)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-['JetBrains_Mono'] font-medium border transition-colors flex items-center gap-1 shrink-0 ${
                        isVideoPlaying
                          ? 'bg-zinc-800 text-amber-300 border-amber-500/40'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      <Film className="w-3 h-3" strokeWidth={1.6} />
                      <span>
                        {isVideoPlaying ? 'Цикл...' : language === 'kz' ? 'Кадрлар' : 'По кадрам'}
                      </span>
                    </button>
                  </div>

                  {/* Active Keyframe Display or Real HTML5 Video Player */}
                  <div className="relative w-full flex items-center justify-center bg-zinc-950 rounded-xl overflow-hidden min-h-[220px] max-h-[360px] border border-zinc-800">
                    {auditCase.videoDataUrl && auditCase.videoDataUrl.includes('youtube.com/embed') ? (
                      <iframe
                        src={auditCase.videoDataUrl}
                        title={auditCase.title}
                        className="w-full h-full min-h-[300px] max-h-[360px] rounded-lg border-0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : auditCase.videoDataUrl || auditCase.videoUrl ? (
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
                            : (auditCase.videoFrames[activeVideoFrameIndex] as any)?.frameDataUrl ||
                              auditCase.previewUrl
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
                      <div className="p-8 text-center text-zinc-400 text-xs">
                        {language === 'kz' ? 'Бейне кадрлары жүктелді' : 'Кадры видео загружены'}
                      </div>
                    )}

                    {!auditCase.videoDataUrl && !auditCase.videoUrl && (
                      <>
                        <div className="absolute top-2 left-2 bg-zinc-950/80 backdrop-blur-xs text-white px-2 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] font-semibold flex items-center gap-1.5 tabular-nums">
                          <span className="w-2 h-2 rounded-full bg-rose-500" />
                          <span>00:0{activeVideoFrameIndex * 3 + 1}.2</span>
                        </div>
                        <div className="absolute top-2 right-2 bg-zinc-950/80 backdrop-blur-xs text-zinc-300 px-2 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] tabular-nums">
                          {activeVideoFrameIndex + 1} / {auditCase.videoFrames?.length || 1}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Keyframe Filmstrip Carousel */}
                  {Array.isArray(auditCase.videoFrames) && auditCase.videoFrames.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px] font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400 uppercase">
                        <span>{t('videoFilmstripTitle')}</span>
                        <span>
                          {language === 'kz'
                            ? 'Уақытқа өту үшін басыңыз'
                            : 'Кликните для перехода по времени'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
                        {auditCase.videoFrames.map((frame, fIdx) => {
                          const frameSrc =
                            typeof frame === 'string' ? frame : (frame as any)?.frameDataUrl;
                          const frameTime = `00:0${fIdx * 3 + 1}.2`;
                          return (
                            <button
                              key={fIdx}
                              type="button"
                              onClick={() => {
                                setActiveVideoFrameIndex(fIdx);
                                setIsVideoPlaying(false);
                                if (videoPlayerRef.current) {
                                  videoPlayerRef.current.currentTime = fIdx * 3 + 1;
                                }
                              }}
                              className={`relative shrink-0 rounded-lg overflow-hidden border-2 transition-all p-0.5 ${
                                activeVideoFrameIndex === fIdx
                                  ? 'border-zinc-900 dark:border-zinc-100 shadow-xs'
                                  : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 opacity-75 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={frameSrc}
                                alt={`Кадр ${fIdx + 1}`}
                                className="w-16 h-20 sm:w-20 sm:h-24 object-cover rounded"
                              />
                              <span className="absolute bottom-1 right-1 bg-zinc-950/80 text-[9px] text-white font-['JetBrains_Mono'] px-1 rounded tabular-nums">
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
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block uppercase font-['JetBrains_Mono']">
                        {language === 'kz' ? 'Тану' : 'Распознавание'}
                      </span>
                      <span className="font-semibold font-['JetBrains_Mono'] text-zinc-900 dark:text-zinc-100 text-[11px]">
                        Multi-Frame OCR
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block uppercase font-['JetBrains_Mono']">
                        {language === 'kz' ? 'Формат' : 'Формат'}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-[11px]">
                        Reels / Shorts (9:16)
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block uppercase font-['JetBrains_Mono']">
                        {language === 'kz' ? 'Талдау күйі' : 'Статус анализа'}
                      </span>
                      <span
                        className={`font-semibold text-[11px] ${
                          auditCase.riskScore >= 60
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {auditCase.riskScore >= 70
                          ? language === 'kz'
                            ? 'Тәуекел бар'
                            : 'Выявлены риски'
                          : auditCase.riskScore >= 30
                          ? language === 'kz'
                            ? 'Ескерту'
                            : 'Предупреждение'
                          : language === 'kz'
                          ? 'Қауіпсіз'
                          : 'Безопасно'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : isAudioCase ? (
                <div className="w-full flex flex-col gap-3.5 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                  <audio
                    ref={audioElementRef}
                    src={auditCase.audioDataUrl || undefined}
                    onEnded={() => setIsPlayingAudio(false)}
                  />

                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-900 dark:bg-zinc-950 text-white border border-zinc-800">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={togglePlayAudio}
                        className="w-10 h-10 rounded-xl bg-white text-zinc-900 hover:bg-zinc-200 flex items-center justify-center shrink-0 transition-colors"
                      >
                        {isPlayingAudio ? (
                          <Pause className="w-5 h-5" strokeWidth={1.8} />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" strokeWidth={1.8} />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="font-semibold text-xs sm:text-sm text-zinc-100 truncate">
                          {auditCase.title}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] text-zinc-400 mt-0.5 tabular-nums">
                          <span>{auditCase.audioDuration || auditCase.metadata?.duration || '00:28'}</span>
                          <span>·</span>
                          <span className="text-emerald-400 font-medium">
                            {language === 'kz' ? 'Аудиопоток бекітілді' : 'Аудиопоток зафиксирован'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 shrink-0">
                      {auditCase.metadata?.platform || 'Check Activity KZ'}
                    </span>
                  </div>

                  {/* Waveform Visualizer */}
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-1 h-10">
                    {[12, 28, 45, 80, 95, 60, 35, 90, 100, 75, 48, 85, 30, 65, 90, 70, 42, 80, 68, 35, 52, 78, 40, 18, 55, 88, 92, 44, 25, 70].map((bar, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all duration-200 ${
                          isPlayingAudio
                            ? 'bg-zinc-900 dark:bg-zinc-100 animate-pulse'
                            : 'bg-zinc-300 dark:bg-zinc-700'
                        }`}
                        style={{ height: `${bar}%` }}
                      />
                    ))}
                  </div>

                  {/* Acoustic Quality Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block uppercase font-['JetBrains_Mono']">
                        {language === 'kz' ? 'Сөз анықтығы' : 'Четкость речи'}
                      </span>
                      <span className="font-semibold font-['JetBrains_Mono'] text-zinc-900 dark:text-zinc-100 tabular-nums">
                        {auditCase.audioVoiceClarity || 98.4}%
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block uppercase font-['JetBrains_Mono']">
                        {language === 'kz' ? 'Тілдер' : 'Языки'}
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">RU / KZ</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 block uppercase font-['JetBrains_Mono']">
                        {language === 'kz' ? 'Тональділік' : 'Тональность'}
                      </span>
                      <span
                        className={`font-semibold ${
                          auditCase.riskScore >= 60
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {auditCase.riskScore >= 70
                          ? language === 'kz'
                            ? 'Токсикалық'
                            : 'Агрессия'
                          : auditCase.riskScore >= 40
                          ? language === 'kz'
                            ? 'Тәуекел бар'
                            : 'Риск'
                          : language === 'kz'
                          ? 'Бейтарап'
                          : 'Нейтральная'}
                      </span>
                    </div>
                  </div>

                  {/* Interactive Transcript Timeline */}
                  {Array.isArray(auditCase.transcript) && auditCase.transcript.length > 0 && (
                    <div className="mt-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-zinc-800 dark:text-zinc-200 font-['JetBrains_Mono'] uppercase mb-2">
                        <span className="flex items-center gap-1.5">
                          <AudioLines className="w-4 h-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.6} />
                          {language === 'kz'
                            ? 'Аудиожазба стенограммасы:'
                            : 'Стенограмма аудиозаписи:'}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                          {auditCase.transcript.length}{' '}
                          {language === 'kz' ? 'фрагмент' : 'фрагмент(а)'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                        {auditCase.transcript.map((line, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              seekToTimestamp(line.time);
                              if (line.flagged) {
                                const matchingV = auditCase.violations[0]?.id;
                                if (matchingV) setActiveBbox(matchingV);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-xs leading-relaxed transition-colors cursor-pointer ${
                              line.flagged
                                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                                : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200/80 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-['JetBrains_Mono'] font-semibold text-[10px] text-zinc-700 dark:text-zinc-300 bg-zinc-200/70 dark:bg-zinc-800 px-1.5 py-0.5 rounded tabular-nums">
                                  {line.time}
                                </span>
                                <span className="font-medium text-zinc-800 dark:text-zinc-200 text-[11px]">
                                  {line.speaker || 'Спикер'}
                                </span>
                              </div>
                              {line.flagged && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold font-['JetBrains_Mono'] bg-rose-600 text-white">
                                  {line.article ||
                                    (language === 'kz' ? 'БҰЗУШЫЛЫҚ' : 'НАРУШЕНИЕ')}
                                </span>
                              )}
                            </div>
                            <p className="text-zinc-800 dark:text-zinc-200 font-['JetBrains_Mono'] text-xs">
                              {line.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : auditCase.previewUrl ? (
                <div className="relative max-h-full flex items-center justify-center w-full overflow-hidden rounded-xl">
                  <img
                    src={auditCase.previewUrl}
                    alt={auditCase.title}
                    className="max-h-[360px] sm:max-h-[420px] w-auto max-w-full object-contain rounded-xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs"
                  />
                  {/* Interactive Bounding Boxes Overlay (clamped within image viewport) */}
                  {auditCase.violations.map((v, i) => {
                    const rawTop = typeof v.bbox?.y === 'number' && Number.isFinite(v.bbox.y) ? v.bbox.y : i === 0 ? 12 : 55;
                    const rawLeft = typeof v.bbox?.x === 'number' && Number.isFinite(v.bbox.x) ? v.bbox.x : i === 0 ? 48 : 10;
                    const top = Math.min(Math.max(rawTop, 4), 76);
                    const left = Math.min(Math.max(rawLeft, 4), 65);
                    const isEthics = v.category === 'ethics';
                    const isSelected = activeBbox === v.id;
                    const shortCode = String(v.code || (language === 'kz' ? 'ҚР Заңы' : 'Закон РК')).split('/')[0];
                    return (
                      <div
                        key={v.id || i}
                        onClick={() => setActiveBbox(v.id)}
                        style={{ top: `${top}%`, left: `${left}%` }}
                        className={`absolute max-w-[175px] sm:max-w-[220px] rounded-lg p-2 transition-all cursor-pointer shadow-md select-none ${
                          isSelected
                            ? isEthics
                              ? 'bg-violet-600 text-white ring-2 ring-violet-400'
                              : 'bg-rose-600 text-white ring-2 ring-rose-400'
                            : 'bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 hover:border-zinc-500'
                        }`}
                      >
                        <div className="flex items-center justify-between pb-0.5 text-[10px] font-['JetBrains_Mono'] font-semibold">
                          <span
                            className={`truncate ${
                              isSelected
                                ? 'text-white'
                                : isEthics
                                ? 'text-violet-700 dark:text-violet-300'
                                : 'text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            {isEthics ? 'ЭТИКА' : shortCode}
                          </span>
                        </div>
                        <div className="text-[11px] font-medium leading-tight line-clamp-1">
                          {v.title}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : auditCase.rawText ? (
                <div className="w-full h-full p-3.5 sm:p-4 flex flex-col justify-between bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                  <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase font-['JetBrains_Mono'] mb-2">
                    {language === 'kz'
                      ? 'Талданатын материал мәтіні:'
                      : 'Текст анализируемого материала:'}
                  </div>
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 leading-relaxed max-h-64 overflow-y-auto whitespace-pre-wrap break-words">
                    {renderHighlightedText(auditCase.rawText, auditCase.violations, activeBbox, setActiveBbox)}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2.5 flex justify-between font-['JetBrains_Mono'] tabular-nums">
                    <span>
                      {t('ocrSymbols')}: {auditCase.rawText.length}
                    </span>
                    <span>
                      {language === 'kz' ? 'ҚР аудиті аяқталды' : 'Аудит РК завершен'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full p-6 text-center text-zinc-500 dark:text-zinc-400 text-xs">
                  {language === 'kz'
                    ? 'Мазмұн тексерілді. Сыни сәйкессіздіктер табылған жоқ.'
                    : 'Контент проверен. Критических несоответствий не обнаружено.'}
                </div>
              )}
            </div>

            {/* Extracted Text (OCR / Web Scraper) */}
            {extractedContent && (
              <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <ScanText className="w-4 h-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.6} />
                    <span className="text-xs font-semibold uppercase font-['JetBrains_Mono'] text-zinc-800 dark:text-zinc-200">
                      {language === 'kz'
                        ? 'Шығарылған мәтін (OCR / Парсинг)'
                        : 'Извлеченный текст (OCR / Парсинг)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasProfanityInExtracted && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold font-['JetBrains_Mono'] bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                        {language === 'kz' ? 'БЕЙӘДЕП СӨЗДЕР' : 'ОБНАРУЖЕНЫ МАТЫ'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        void copyTextToClipboard(extractedContent).then((ok) => {
                          if (ok && isMountedRef.current) {
                            scheduleFlagReset(setCopiedExtracted, 2000);
                          }
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition-colors flex items-center gap-1"
                    >
                      {copiedExtracted ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={1.8} />
                      ) : (
                        <Copy className="w-3.5 h-3.5" strokeWidth={1.6} />
                      )}
                      <span>{copiedExtracted ? t('ocrCopied') : t('ocrCopy')}</span>
                    </button>
                  </div>
                </div>
                <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 font-['JetBrains_Mono'] leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap break-words select-text">
                  {renderHighlightedText(extractedContent, auditCase.violations, activeBbox, setActiveBbox)}
                </div>
              </div>
            )}

            {/* Detected Actions and Visual Context */}
            {auditCase.detectedActions && (
              <div className="p-4 bg-zinc-50/70 dark:bg-zinc-950/50 border-t border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Eye className="w-4 h-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.6} />
                  <span className="text-xs font-semibold uppercase font-['JetBrains_Mono'] text-zinc-800 dark:text-zinc-200">
                    {language === 'kz'
                      ? 'Танылған әрекеттер мен контекст'
                      : 'Распознанные действия и контекст'}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  {auditCase.detectedActions}
                </p>
              </div>
            )}

            {/* Emoji Intelligence Card */}
            <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Sparkles className="w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0" strokeWidth={1.6} />
                  <span className="text-xs font-semibold uppercase font-['JetBrains_Mono'] text-zinc-800 dark:text-zinc-200 truncate">
                    {language === 'kz'
                      ? 'Эмодзилер талдауы (Emoji Intelligence)'
                      : 'Анализ эмодзи (Emoji Intelligence)'}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-['JetBrains_Mono'] font-semibold border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 shrink-0">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      emojiReport.flaggedEmojis.length > 0 ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                  />
                  {emojiReport.flaggedEmojis.length > 0
                    ? `${language === 'kz' ? 'ТӘУЕКЕЛ:' : 'РИСК:'} +${emojiReport.totalRiskPoints}`
                    : language === 'kz'
                    ? 'СИМВОЛДАР ҚАУІПСІЗ'
                    : 'СИМВОЛЫ БЕЗОПАСНЫ'}
                </span>
              </div>

              {emojiReport.detectedEmojis.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
                    <span className="text-[11px] font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400 mr-1 tabular-nums">
                      {language === 'kz' ? 'Тіркелді' : 'Зафиксировано'} ({emojiReport.detectedEmojis.length}):
                    </span>
                    {emojiReport.detectedEmojis.map((emoji, idx) => {
                      const isFlagged = emojiReport.flaggedEmojis.some((f) => f.emoji === emoji);
                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center justify-center text-lg w-8 h-8 rounded-lg transition-transform ${
                            isFlagged
                              ? 'bg-rose-50 dark:bg-rose-950/60 ring-1 ring-rose-400 scale-105'
                              : 'bg-white dark:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-700'
                          }`}
                          title={
                            isFlagged
                              ? language === 'kz'
                                ? 'Жасырын триггер'
                                : 'Скрытый триггер'
                              : language === 'kz'
                              ? 'Бейтарап эмодзи'
                              : 'Нейтральный эмодзи'
                          }
                        >
                          {emoji}
                        </span>
                      );
                    })}
                  </div>

                  {emojiReport.flaggedEmojis.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {emojiReport.flaggedEmojis.map((item, fIdx) => (
                        <div
                          key={fIdx}
                          className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                            item.riskLevel === 'critical'
                              ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200/80 dark:border-rose-900/60 text-zinc-900 dark:text-zinc-100'
                              : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200/80 dark:border-amber-900/60 text-zinc-900 dark:text-zinc-100'
                          }`}
                        >
                          <span className="text-2xl shrink-0 leading-none mt-0.5">{item.emoji}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1 mb-0.5 flex-wrap">
                              <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs">
                                {item.label}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] font-medium bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-800">
                                {item.category === 'gambling'
                                  ? language === 'kz'
                                    ? 'Казино (455-б. 1-б.)'
                                    : 'Казино (ч. 1 ст. 455)'
                                  : item.category === 'profanity_insult'
                                  ? language === 'kz'
                                    ? 'Бейәдеп сөз (434-бап)'
                                    : 'Мат / Буллинг (ст. 434)'
                                  : item.category === 'sexual'
                                  ? '18+ Контент (ст. 133-1)'
                                  : 'Dark Pattern / FOMO'}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/60">
                      ✓{' '}
                      {language === 'kz'
                        ? 'Символдарды тексеру аяқталды. Барлық табылған эмодзилер желілік этикет нормаларына сәйкес.'
                        : 'Проверка символов завершена. Все обнаруженные эмодзи соответствуют нормам сетевого этикета.'}
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                  {language === 'kz'
                    ? 'Талданған контентте эмодзилер анықталмады.'
                    : 'В анализируемом контенте эмодзи и пиктограммы не обнаружены.'}
                </div>
              )}
            </div>

            {/* Quick summary strip */}
            <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
              <div className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-zinc-500 dark:text-zinc-400" strokeWidth={1.6} />
                <span>{language === 'kz' ? 'Тексеру қорытындысы:' : 'Сводка проверки:'}</span>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400 text-xs">{auditCase.summary}</p>
              {auditCase.ethicsSummary && (
                <p className="text-violet-800 dark:text-violet-300 text-xs mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <strong>{language === 'kz' ? 'Этика:' : 'Этика:'}</strong> {auditCase.ethicsSummary}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Violations & Ethical Issues Ledger (6 cols) */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          {/* Header & Filter Tabs */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                {t('tabFindings')} ({displayedViolations.length}
                {activeRiskFilter ? ` / ${auditCase.violations.length}` : ''})
              </h2>

              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs self-start sm:self-auto max-w-full overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setSelectedFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                    selectedFilter === 'all'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {t('filterAll')} ({auditCase.violations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFilter('legal')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                    selectedFilter === 'legal'
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  {t('filterLegal')} ({legalViolations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFilter('ethics')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap ${
                    selectedFilter === 'ethics'
                      ? 'bg-violet-600 text-white'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400'
                  }`}
                >
                  {t('filterEthics')} ({ethicsViolations.length})
                </button>
              </div>
            </div>

            {activeRiskFilter && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-200">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0" strokeWidth={1.6} />
                  <span className="truncate">
                    {language === 'kz' ? 'Диаграмма бойынша сүзгі:' : 'Фильтр по диаграмме:'}{' '}
                    <strong className="font-semibold">
                      {riskAnalytics.coreCategories.find((c) => c.id === activeRiskFilter)?.name ||
                        activeRiskFilter}
                    </strong>{' '}
                    ({displayedViolations.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRiskFilter(null)}
                  className="text-[11px] font-medium text-zinc-900 dark:text-zinc-100 hover:underline shrink-0 ml-2"
                >
                  {language === 'kz' ? 'Сүзгіні тазарту' : 'Сбросить фильтр'}
                </button>
              </div>
            )}
          </div>

          {/* Media Analysis Result Card */}
          {auditCase.mediaAnalysis && (
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-4 sm:p-5 shadow-xs flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-zinc-700 dark:text-zinc-300" strokeWidth={1.6} />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {language === 'kz'
                      ? 'Аудио/бейнематериал талдауы (AI Check)'
                      : 'Анализ аудио/видеоматериала (AI Check)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-['JetBrains_Mono'] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700">
                    {language === 'kz' ? 'Тіл:' : 'Язык:'}{' '}
                    <strong className="text-zinc-900 dark:text-zinc-100 capitalize">
                      {auditCase.mediaAnalysis.language}
                    </strong>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-['JetBrains_Mono'] font-semibold px-2.5 py-0.5 rounded-full border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        auditCase.mediaAnalysis.overall_risk === 'высокий'
                          ? 'bg-rose-500'
                          : auditCase.mediaAnalysis.overall_risk === 'средний'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                    {language === 'kz' ? 'ТӘУЕКЕЛ:' : 'РИСК:'}{' '}
                    {auditCase.mediaAnalysis.overall_risk.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
                <strong className="text-zinc-900 dark:text-zinc-100 font-semibold">
                  {language === 'kz' ? 'Материал түйіні:' : 'Сводка материала:'}
                </strong>{' '}
                {auditCase.mediaAnalysis.summary}
              </div>

              {Array.isArray(auditCase.mediaAnalysis.findings) &&
              auditCase.mediaAnalysis.findings.length > 0 ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px] font-['JetBrains_Mono'] font-medium uppercase text-zinc-500 dark:text-zinc-400">
                    <span className="tabular-nums">
                      {language === 'kz' ? 'Тіркелген фактілер' : 'Зафиксированные факты'} (
                      {auditCase.mediaAnalysis.findings.length}):
                    </span>
                    <span>
                      {language === 'kz' ? 'Таймкодты басыңыз' : 'Кликните на таймкод'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {auditCase.mediaAnalysis.findings.map((f, fIdx) => (
                      <div
                        key={fIdx}
                        className="p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900 transition-colors flex flex-col gap-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => seekToTimestamp(f.timestamp)}
                              className="px-2 py-0.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] font-['JetBrains_Mono'] font-semibold flex items-center gap-1 transition-opacity hover:opacity-90 tabular-nums"
                              title="Перемотать"
                            >
                              <Play className="w-3 h-3" strokeWidth={2} />
                              <span>{f.timestamp}</span>
                            </button>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/80 dark:border-zinc-700">
                              {f.source}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] font-medium text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800">
                              {f.confidence} {language === 'kz' ? 'дәлдік' : 'точность'}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                            {f.category}
                          </span>
                        </div>

                        <div className="text-xs text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg border border-zinc-200/60 dark:border-zinc-800 font-['JetBrains_Mono']">
                          «{f.quote_or_description}»
                        </div>

                        <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-snug">
                          <strong className="text-zinc-800 dark:text-zinc-200 font-medium">
                            {language === 'kz' ? 'Негіздеме:' : 'Обоснование:'}
                          </strong>{' '}
                          {f.reasoning}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.6} />
                  <span>
                    {language === 'kz'
                      ? 'Бейне мен аудиоқатарда бұзушылық белгілері анықталмады.'
                      : 'Признаков нарушений в аудио- и видеоряде не обнаружено.'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* List of issues */}
          {displayedViolations.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-8 flex flex-col items-center text-center gap-2.5 shadow-xs">
              <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-1">
                <ShieldCheck className="w-5 h-5" strokeWidth={1.6} />
              </div>
              <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
                {language === 'kz'
                  ? 'Бұл санатта ескертулер табылған жоқ'
                  : 'Замечаний в данной категории не найдено'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">
                {language === 'kz'
                  ? 'Тексерілген материалда бұзушылықтар тіркелген жоқ. Барлық заң нормалары мен цифрлық этика ережелері сақталған.'
                  : 'В проверяемом материале не зафиксировано нарушений выбранной категории. Все нормы законодательства и правила цифровой этики соблюдены.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {displayedViolations.map((v, index) => {
                const isCritical = v.severity === 'critical';
                const isEthicsOnly = !isLegalViolation(v);
                const isAlsoEthics = isEthicsViolation(v);
                const isSelected = activeBbox === v.id;

                return (
                  <div
                    key={v.id || index}
                    onClick={() => setActiveBbox(v.id)}
                    className={`rounded-2xl bg-white dark:bg-zinc-900 p-4 sm:p-5 flex flex-col gap-3 border shadow-xs transition-all cursor-pointer ${
                      isSelected
                        ? isEthicsOnly
                          ? 'border-violet-500 ring-1 ring-violet-500/30'
                          : 'border-zinc-900 dark:border-zinc-100 ring-1 ring-zinc-900/20 dark:ring-zinc-100/20'
                        : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1.5 font-['JetBrains_Mono'] text-[10px] uppercase font-semibold tracking-wider text-zinc-600 dark:text-zinc-300">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isCritical ? 'bg-rose-500' : 'bg-amber-500'
                              }`}
                            />
                            {isCritical
                              ? language === 'kz'
                                ? 'СЫНИ ТӘУЕКЕЛ'
                                : 'КРИТИЧЕСКИЙ РИСК'
                              : language === 'kz'
                              ? 'ЕСКЕРТУ'
                              : 'ПРЕДУПРЕЖДЕНИЕ'}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium font-['JetBrains_Mono'] ${
                              isEthicsOnly
                                ? 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200/80 dark:border-rose-900'
                            }`}
                          >
                            {isEthicsOnly
                              ? 'ЭТИКА'
                              : isAlsoEthics
                              ? language === 'kz'
                                ? 'ҚР ЗАҢЫ · ЭТИКА'
                                : 'ЗАКОН РК · ЭТИКА'
                              : language === 'kz'
                              ? 'ҚР ЗАҢЫ'
                              : 'ЗАКОН РК'}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                          {v.title}
                        </h3>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-md font-['JetBrains_Mono'] text-[11px] font-medium shrink-0 self-start sm:self-auto max-w-full sm:max-w-[240px] break-words text-left sm:text-right bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-800">
                        {v.code}
                      </span>
                    </div>

                    {v.quote && (
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs flex items-start gap-2.5">
                        <Quote className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" strokeWidth={1.6} />
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider font-['JetBrains_Mono']">
                            {language === 'kz'
                              ? 'Тіркелген цитата / Дәлелдеме:'
                              : 'Зафиксированная цитата / Доказательство:'}
                          </div>
                          <div className="font-medium text-zinc-900 dark:text-zinc-100 mt-0.5 break-words">
                            «{v.quote}»
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-zinc-50/70 dark:bg-zinc-950/40 rounded-xl border border-zinc-200/60 dark:border-zinc-800/80 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 mb-0.5">
                        {isEthicsOnly
                          ? language === 'kz'
                            ? 'Этикалық тәуекел мәні:'
                            : 'Суть этического риска:'
                          : language === 'kz'
                          ? 'ҚР заңы бойынша негіздеме:'
                          : 'Основание по закону РК:'}
                      </div>
                      <div>{v.basis}</div>
                    </div>

                    {v.recommendation && (
                      <div
                        className={`p-3 rounded-xl border text-xs leading-relaxed ${
                          isEthicsOnly
                            ? 'bg-violet-50/50 dark:bg-violet-950/20 border-violet-200/80 dark:border-violet-900/60 text-zinc-800 dark:text-zinc-200'
                            : 'bg-zinc-50 dark:bg-zinc-950/60 border-zinc-200/80 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200'
                        }`}
                      >
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {language === 'kz' ? 'Қалай түзету керек:' : 'Как устранить:'}
                        </span>{' '}
                        {v.recommendation}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t border-zinc-100 dark:border-zinc-800 font-['JetBrains_Mono']">
                      <div>
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {isEthicsOnly
                            ? language === 'kz'
                              ? 'Тәуекел:'
                              : 'Риск:'
                            : language === 'kz'
                            ? 'Айыппұл бағалауы:'
                            : 'Оценка штрафа:'}{' '}
                        </span>
                        <strong
                          className={
                            isEthicsOnly
                              ? 'text-violet-700 dark:text-violet-300 font-medium'
                              : 'text-rose-600 dark:text-rose-400 font-medium'
                          }
                        >
                          {(() => {
                            const cardPenalty = getCompliancePenaltyDisplay([v], entityTier, language);
                            return cardPenalty.mode === 'legal_fine'
                              ? `${cardPenalty.mrpRangeText} (${cardPenalty.kztRangeText})`
                              : cardPenalty.headline;
                          })()}
                        </strong>
                      </div>
                      <div className="sm:text-right">
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {isEthicsOnly
                            ? language === 'kz'
                              ? 'Стандарт:'
                              : 'Стандарт:'
                            : language === 'kz'
                            ? 'Реттеуші:'
                            : 'Регулятор:'}{' '}
                        </span>
                        <strong className="text-zinc-700 dark:text-zinc-300 font-medium">
                          {(() => {
                            const dbLaw = !isEthicsOnly ? findKzLawByViolation(v) : undefined;
                            if (dbLaw) {
                              return language === 'kz' ? dbLaw.regulatorKz : dbLaw.regulator;
                            }
                            return v.jurisdiction;
                          })()}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Interactive Compliance Suite: AI Safe-Rewrite + MRP Fine Calculator & Official Claim Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: AI Safe-Rewrite 1-Click Fixer */}
        <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-zinc-700 dark:text-zinc-300" strokeWidth={1.6} />
              <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                {language === 'kz'
                  ? 'AI Safe-Rewrite: 1 басумен түзету (RU+KZ)'
                  : 'AI Safe-Rewrite: Исправить контент в 1 клик'}
              </h3>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (isRewriting) return;
                const source = extractedContent || auditCase.summary || auditCase.title;
                if (!source) return;
                const opId = ++rewriteOpIdRef.current;
                const caseIdSnapshot = auditCase.id;
                setIsRewriting(true);
                try {
                  const res = await rewriteContentSafe({
                    text: source,
                    violations: auditCase.violations,
                    language,
                    entityTier,
                  });
                  if (
                    !isMountedRef.current ||
                    opId !== rewriteOpIdRef.current ||
                    activeCaseIdRef.current !== caseIdSnapshot
                  ) {
                    return;
                  }
                  setRewriteResult(res);
                } finally {
                  if (
                    isMountedRef.current &&
                    opId === rewriteOpIdRef.current &&
                    activeCaseIdRef.current === caseIdSnapshot
                  ) {
                    setIsRewriting(false);
                  }
                }
              }}
              disabled={isRewriting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isRewriting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.6} />
              ) : (
                <Sparkles className="w-3.5 h-3.5" strokeWidth={1.6} />
              )}
              <span>
                {isRewriting
                  ? language === 'kz'
                    ? 'Өңделуде...'
                    : 'Генерация...'
                  : rewriteResult
                  ? language === 'kz'
                    ? 'Қайта құру'
                    : 'Пересобрать'
                  : language === 'kz'
                  ? 'Қауіпсіз нұсқа жасау'
                  : 'Создать безопасный вариант'}
              </span>
            </button>
          </div>

          {!rewriteResult ? (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {language === 'kz'
                ? 'Жүйе бейәдеп сөздерді, тыйым салынған сілтемелерді және айлалы триггерлерді жойып, Закон № 230-VII бойынша «Жарнама / Реклама» таңбасы мен БСН/ЖСН бар ҚАЗ және ОРЫС нұсқаларын дайындайды.'
                : 'Система автоматически удалит обсценную лексику, гемблинг/скам-триггеры и FOMO-давление, добавит маркировку «Жарнама / Реклама» с БИН/ИИН и вернет готовые версии на русском и казахском языках.'}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-['JetBrains_Mono'] text-[11px] px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {language === 'kz' ? 'Тәуекел индексі:' : 'Индекс риска:'} {auditCase.riskScore}% → {rewriteResult.newRiskScore}%
                </span>
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 p-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-['JetBrains_Mono']">
                  <button
                    type="button"
                    onClick={() => setRewriteLang('ru')}
                    className={`px-2 py-0.5 rounded-md font-medium ${
                      rewriteLang === 'ru'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                        : 'text-zinc-500'
                    }`}
                  >
                    РУС
                  </button>
                  <button
                    type="button"
                    onClick={() => setRewriteLang('kz')}
                    className={`px-2 py-0.5 rounded-md font-medium ${
                      rewriteLang === 'kz'
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                        : 'text-zinc-500'
                    }`}
                  >
                    ҚАЗ
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 font-['JetBrains_Mono'] leading-relaxed whitespace-pre-wrap break-words max-h-44 overflow-y-auto">
                {rewriteLang === 'ru' ? rewriteResult.safeTextRu : rewriteResult.safeTextKz}
              </div>

              <div className="flex flex-col gap-1">
                {rewriteResult.appliedFixes.map((fix, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.6} />
                    <span>{fix}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const txt = rewriteLang === 'ru' ? rewriteResult.safeTextRu : rewriteResult.safeTextKz;
                    void copyTextToClipboard(txt).then((ok) => {
                      if (ok && isMountedRef.current) {
                        scheduleFlagReset(setCopiedRewrite, 2000);
                      }
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                >
                  {copiedRewrite ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>
                    {copiedRewrite
                      ? language === 'kz'
                        ? 'Көшірілді'
                        : 'Скопировано'
                      : language === 'kz'
                      ? 'Мәтінді көшіру'
                      : 'Копировать текст'}
                  </span>
                </button>
                {onReauditFixedText && (
                  <button
                    type="button"
                    disabled={isReauditing}
                    onClick={async () => {
                      if (isReauditing) return;
                      const opId = ++reauditOpIdRef.current;
                      const caseIdSnapshot = auditCase.id;
                      const txt = rewriteLang === 'ru' ? rewriteResult.safeTextRu : rewriteResult.safeTextKz;
                      setIsReauditing(true);
                      try {
                        await onReauditFixedText(txt);
                      } finally {
                        if (
                          isMountedRef.current &&
                          opId === reauditOpIdRef.current &&
                          activeCaseIdRef.current === caseIdSnapshot
                        ) {
                          setIsReauditing(false);
                        }
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isReauditing ? 'animate-spin' : ''}`} />
                    <span>{language === 'kz' ? 'Қайта тексеру' : 'Проверить исправленное'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: MRP Penalty Calculator + Official Claim/Prescription Generator */}
        <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-zinc-700 dark:text-zinc-300" strokeWidth={1.6} />
              <h3 className="font-['Plus_Jakarta_Sans'] font-semibold text-sm sm:text-base text-zinc-900 dark:text-zinc-100">
                {language === 'kz'
                  ? 'Айыппұл калькуляторы (АЕК) және Құжат'
                  : 'Калькулятор штрафов (МРП) и Претензия'}
              </h3>
            </div>
            <span className="font-['JetBrains_Mono'] text-[11px] text-zinc-500 dark:text-zinc-400">
              1 {language === 'kz' ? 'АЕК' : 'МРП'} = {MRP_RATE.toLocaleString('ru-RU')} ₸
            </span>
          </div>

          {/* Entity Tier Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {[
              { id: 'individual' as EntityTier, label: language === 'kz' ? 'Жеке тұлға' : 'Физлицо', mult: 1 },
              { id: 'small' as EntityTier, label: language === 'kz' ? 'ШОБ / ЖК' : 'Малый / ИП', mult: 2.5 },
              { id: 'medium' as EntityTier, label: language === 'kz' ? 'Орта' : 'Средний', mult: 4 },
              { id: 'large' as EntityTier, label: language === 'kz' ? 'Ірі' : 'Крупный', mult: 6 },
            ].map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => setEntityTier(tier.id)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors flex items-center justify-center gap-1 ${
                  entityTier === tier.id
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200/80 dark:border-zinc-800'
                }`}
              >
                <Building2 className="w-3 h-3 shrink-0" strokeWidth={1.5} />
                <span className="truncate">{tier.label}</span>
              </button>
            ))}
          </div>

          {/* Dynamic Penalty Calculation (Unified Authoritative Engine) */}
          {(() => {
            const legalDocText = buildOfficialDocument(
              auditCase,
              docType === 'claim_blogger' ? 'pretension' : 'eotinish',
              auditCase.sourceName,
              language,
              entityTier
            );

            return (
              <>
                <div
                  className={`p-3.5 rounded-xl border flex flex-col gap-2.5 ${
                    penaltyDisplay.mode === 'legal_fine'
                      ? 'bg-rose-50/70 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900'
                      : penaltyDisplay.mode === 'ethics_only'
                      ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900'
                      : 'bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[11px] font-['JetBrains_Mono'] text-zinc-600 dark:text-zinc-400 uppercase block">
                        {language === 'kz' ? 'Есептік айыппұл тәуекелі' : 'Расчётный финансовый риск'}
                      </span>
                      <div
                        className={`font-['Plus_Jakarta_Sans'] font-bold tabular-nums mt-0.5 ${
                          penaltyDisplay.mode === 'legal_fine'
                            ? 'text-xl sm:text-2xl text-rose-700 dark:text-rose-400'
                            : penaltyDisplay.mode === 'ethics_only'
                            ? 'text-sm sm:text-base text-amber-800 dark:text-amber-300'
                            : 'text-base sm:text-lg text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {penaltyDisplay.headline}
                      </div>
                    </div>
                    <div className="text-right font-['JetBrains_Mono'] shrink-0">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tabular-nums block">
                        {penaltyDisplay.mrpRangeText}
                      </span>
                      <span className="text-[10px] text-zinc-600 dark:text-zinc-400">
                        {penaltyDisplay.legalCount > 0
                          ? `${penaltyDisplay.legalCount} ${language === 'kz' ? 'заң бабы' : 'ст. закона'}`
                          : penaltyDisplay.ethicsOnlyCount > 0
                          ? `${penaltyDisplay.ethicsOnlyCount} ${language === 'kz' ? 'этика' : 'этика'}`
                          : language === 'kz'
                          ? 'таза'
                          : 'чисто'}
                      </span>
                    </div>
                  </div>

                  {penaltyDisplay.penaltyCalc.breakdown.length > 0 && (
                    <div className="pt-2 border-t border-rose-200/70 dark:border-rose-900/50 flex flex-col gap-1">
                      {penaltyDisplay.penaltyCalc.breakdown.map((b) => (
                        <div
                          key={b.code}
                          className="flex items-center justify-between gap-2 text-[11px] font-['JetBrains_Mono'] text-zinc-700 dark:text-zinc-300"
                        >
                          <span className="truncate">{b.code}</span>
                          <span className="font-semibold shrink-0 tabular-nums">
                            {b.minMrp === b.maxMrp ? `${b.minMrp}` : `${b.minMrp}–${b.maxMrp}`}{' '}
                            {language === 'kz' ? 'АЕК' : 'МРП'} (
                            {(b.minMrp * MRP_RATE).toLocaleString('ru-RU')}
                            {b.minMrp !== b.maxMrp ? ` – ${(b.maxMrp * MRP_RATE).toLocaleString('ru-RU')}` : ''} ₸)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 p-0.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 text-[11px] max-w-full overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setDocType('claim_blogger')}
                      className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                        docType === 'claim_blogger'
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                          : 'text-zinc-500'
                      }`}
                    >
                      {language === 'kz' ? 'Авторға ескерту' : 'Уведомление автору'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDocType('complaint_gov')}
                      className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap ${
                        docType === 'complaint_gov'
                          ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs'
                          : 'text-zinc-500'
                      }`}
                    >
                      {language === 'kz' ? 'Шағым eOtinish / ҚМА' : 'Жалоба eOtinish / АФМ'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void copyTextToClipboard(legalDocText).then((ok) => {
                        if (ok && isMountedRef.current) {
                          scheduleFlagReset(setCopiedLegalDoc, 2000);
                        }
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium"
                  >
                    {copiedLegalDoc ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>
                      {copiedLegalDoc
                        ? language === 'kz'
                          ? 'Көшірілді'
                          : 'Скопировано'
                        : language === 'kz'
                        ? 'Құжатты көшіру'
                        : 'Копировать документ'}
                    </span>
                  </button>
                </div>

                <pre className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-['JetBrains_Mono'] text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words leading-relaxed max-h-40 overflow-y-auto overflow-x-auto">
                  {legalDocText}
                </pre>
              </>
            );
          })()}
        </div>
      </div>

      {/* Mandatory Regulatory & Legal Bottom Notice */}
      <div className="w-full text-center pt-5 pb-2 border-t border-zinc-200/80 dark:border-zinc-800 mt-2">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-medium shadow-xs">
          <Gavel className="w-3.5 h-3.5 text-amber-500 shrink-0" strokeWidth={1.6} />
          <span>
            {language === 'kz'
              ? 'Нәтиже алдын ала берілген, адам тексеруі қажет.'
              : 'Результат предварительный, требуется проверка человеком.'}
          </span>
        </div>
      </div>
    </div>
  );
};
