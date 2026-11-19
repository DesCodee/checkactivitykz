/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuditCase, Violation } from '../types/index.ts';
import { findKzLawByViolation, KZ_LAWS_DB, type KzLawEntry } from '../data/kzLawsDb.ts';

export const MRP_2026_KZT = 4325;

export const HITL_PROTEST_ARTICLE =
  'Human-in-the-loop / ст. 174, 274 УК РК (проверка контекста)';
export const HITL_PROTEST_DESCRIPTION =
  'Обнаружен общественно-политический / протестный контекст. Выражение мнения не является нарушением, но требуется экспертная проверка человеком на отсутствие заведомо ложной информации или призывов к несогласованным акциям.';
export const PEACEFUL_ASSEMBLY_LAW_TITLE = HITL_PROTEST_ARTICLE;
export const PEACEFUL_ASSEMBLY_RECOMMENDATION = HITL_PROTEST_DESCRIPTION;

export type BusinessEntityType = 'individual' | 'small' | 'medium' | 'large';

export interface KzFraudLanguageAnalysis {
  hasPhishingOrScam: boolean;
  scamMatches: string[];
  hasDeepfakeIndicators: boolean;
  deepfakeMatches: string[];
  languageCoverage: 'bilingual' | 'ru_only' | 'kz_only' | 'neutral';
  needsKzParityWarning: boolean;
}

export interface LivePreCheckResult {
  riskScore: number;
  safetyScore: number;
  status: 'safe' | 'warning' | 'critical';
  statusLabelRu: 'БЕЗОПАСНО' | 'ПРЕДУПРЕЖДЕНИЕ' | 'ТРЕБУЕТ МЕР';
  statusLabelKz: 'ҚАУІПСІЗ' | 'ЕСКЕРТУ' | 'ШАРАЛАР ҚАЖЕТ';
  triggers: Array<{
    id: string;
    category: 'legal' | 'ethics';
    labelRu: string;
    labelKz: string;
    severity: 'critical' | 'warning';
    article: string;
  }>;
  penaltySummaryRu: string;
  penaltySummaryKz: string;
  penaltyCalc: PenaltyCalculation;
  languageCoverage: 'bilingual' | 'ru_only' | 'kz_only' | 'neutral';
}

export interface PenaltyCalculation {
  minMrp: number;
  maxMrp: number;
  minKzt: number;
  maxKzt: number;
  breakdown: Array<{
    code: string;
    title: string;
    minMrp: number;
    maxMrp: number;
  }>;
}

export interface CompliancePenaltyDisplay {
  mode: 'legal_fine' | 'ethics_only' | 'clean';
  mrpRangeText: string;
  kztRangeText: string;
  headline: string;
  subline: string;
  penaltyCalc: PenaltyCalculation;
  legalCount: number;
  ethicsOnlyCount: number;
}

const LEGAL_CODE_OR_LAW_REGEX =
  /human-in-the-loop|коап|ук\s*рк|әқбтк|қк\b|230-vii|94-v|закон|заң|ст\.\s*\d+|\d+-бап|445-1|455\b|434\b|456-2|73-4|131\b|115\b|147\b|79\b|190\b|274\b|174\b|133-1|301-1|ст\.\s*21/i;

const PURE_ETHICS_ONLY_REGEX =
  /dark\s*pattern|fomo|манипулят|таймер|дефицит|вовлечение\s+в\s+азарт|иллюзи|этика\s+реклам|этика\s+коммуникац|сетев[а-яё]+\s+этикет/i;

export function isHitlContextViolation(v: Pick<Violation, 'code' | 'title'>): boolean {
  const combined = `${v.code || ''} ${v.title || ''}`.toLowerCase();
  return /human-in-the-loop|проверка\s+контекста|протестный\s+контекст|общественно-политическ|мирных\s+собраний|бейбіт\s+жиналыс/.test(
    combined
  );
}

/**
 * Determines whether a violation corresponds to a Kazakhstan statutory norm
 * (КоАП РК, УК РК, Закон № 230-VII, Закон № 94-V, Закон о языках, etc.).
 */
export function isLegalViolation(v: Pick<Violation, 'category' | 'code' | 'title' | 'fineAmount'>): boolean {
  const combined = `${v.code || ''} ${v.title || ''}`.toLowerCase();
  if (LEGAL_CODE_OR_LAW_REGEX.test(combined)) {
    return true;
  }
  if (v.category === 'legal' && !PURE_ETHICS_ONLY_REGEX.test(combined)) {
    return true;
  }
  return false;
}

/**
 * Determines whether a violation also carries digital/communication ethics weight
 * (including legal offenses with strong ethical harm like profanity/bullying/gambling/scam).
 */
export function isEthicsViolation(v: Pick<Violation, 'category' | 'code' | 'title'>): boolean {
  if (v.category === 'ethics') return true;
  const combined = `${v.code || ''} ${v.title || ''}`.toLowerCase();
  return /434|73-4|131|115|445-1|190|274|этик|мат|буллинг|оскорб|травл|dark|fomo|манипул|скам|казино/i.test(
    combined
  );
}

/**
 * Determines whether a statutory violation is critical (70-100 risk bracket) vs warning (45-69 bracket).
 */
export function isCriticalLegalViolation(v: Pick<Violation, 'severity' | 'code' | 'title'>): boolean {
  if (isHitlContextViolation(v)) {
    return false;
  }
  const combined = `${v.code || ''} ${v.title || ''}`.toLowerCase();
  if (/445-1|190|274|456-2|147|79|434|131|115|73-4|301-1|133-1/.test(combined)) {
    return true;
  }
  if ((/455|230-vii/.test(combined)) && v.severity === 'critical') {
    return true;
  }
  return v.severity === 'critical';
}

export function getLocalizedStatus(status: AuditCase['status'] | string | undefined, lang: 'ru' | 'kz'): string {
  const norm = String(status || 'БЕЗОПАСНО').toUpperCase();
  if (lang === 'kz') {
    if (norm === 'ТРЕБУЕТ МЕР' || norm === 'ШАРАЛАР ҚАЖЕТ') return 'ШАРАЛАР ҚАЖЕТ';
    if (norm === 'ПРЕДУПРЕЖДЕНИЕ' || norm === 'ЕСКЕРТУ') return 'ЕСКЕРТУ';
    return 'ҚАУІПСІЗ';
  }
  if (norm === 'ШАРАЛАР ҚАЖЕТ' || norm === 'ТРЕБУЕТ МЕР') return 'ТРЕБУЕТ МЕР';
  if (norm === 'ЕСКЕРТУ' || norm === 'ПРЕДУПРЕЖДЕНИЕ') return 'ПРЕДУПРЕЖДЕНИЕ';
  return 'БЕЗОПАСНО';
}

export function getLocalizedRiskLevel(riskLevel: AuditCase['riskLevel'] | string | undefined, lang: 'ru' | 'kz'): string {
  const norm = String(riskLevel || 'Низкий').toLowerCase();
  if (lang === 'kz') {
    if (norm.includes('крит') || norm.includes('қатерлі')) return 'Қатерлі';
    if (norm.includes('высок') || norm.includes('жоғары')) return 'Жоғары';
    if (norm.includes('сред') || norm.includes('орташа')) return 'Орташа';
    return 'Төмен';
  }
  if (norm.includes('крит') || norm.includes('қатерлі')) return 'Критический';
  if (norm.includes('высок') || norm.includes('жоғары')) return 'Высокий';
  if (norm.includes('сред') || norm.includes('орташа')) return 'Средний';
  return 'Низкий';
}

export function normalizeViolation(rawV: Violation): Violation {
  const safeV: Violation =
    rawV && typeof rawV === 'object'
      ? rawV
      : {
          id: 'v-fallback',
          category: 'legal',
          code: 'КоАП РК',
          title: 'Зафиксированное замечание',
          severity: 'warning',
          basis: '',
          fineAmount: '',
          jurisdiction: 'МКИ РК',
        };
  const safeCode = typeof safeV.code === 'string' && safeV.code.trim() ? safeV.code : 'Закон РК';
  const safeTitle = typeof safeV.title === 'string' && safeV.title.trim() ? safeV.title : 'Зафиксированное замечание';
  const safeSeverity: Violation['severity'] =
    safeV.severity === 'critical' || safeV.severity === 'warning' || safeV.severity === 'info'
      ? safeV.severity
      : 'warning';
  const withStrings: Violation = {
    ...safeV,
    id: typeof safeV.id === 'string' && safeV.id ? safeV.id : `v-${Math.random().toString(36).slice(2, 8)}`,
    code: safeCode,
    title: safeTitle,
    severity: safeSeverity,
    basis: typeof safeV.basis === 'string' ? safeV.basis : '',
    fineAmount: typeof safeV.fineAmount === 'string' ? safeV.fineAmount : '',
    jurisdiction: typeof safeV.jurisdiction === 'string' ? safeV.jurisdiction : '',
    ...(typeof safeV.quote === 'string' ? { quote: safeV.quote } : { quote: undefined }),
    ...(typeof safeV.recommendation === 'string' ? { recommendation: safeV.recommendation } : {}),
  };
  const legal = isLegalViolation(withStrings);
  return {
    ...withStrings,
    category: legal ? 'legal' : 'ethics',
  };
}

export function calculateMrpPenalty(
  violations: Violation[],
  entityType: BusinessEntityType,
  isRepeat = false
): PenaltyCalculation {
  const multiplier = isRepeat ? 2 : 1;
  const breakdown: PenaltyCalculation['breakdown'] = [];
  const seenArticles = new Set<string>();

  for (const rawV of violations) {
    if (!isLegalViolation(rawV)) {
      continue;
    }

    if (isHitlContextViolation(rawV)) {
      // Human-in-the-loop advisory check: 0 MRP, no automatic statutory fine or blocking
      continue;
    }

    const matchedLaw = findKzLawByViolation(rawV);
    if (matchedLaw?.isAdvisoryHitl) {
      continue;
    }

    let minMrp = 0;
    let maxMrp = 0;
    let articleKey = rawV.code || rawV.id;
    let isFixedIndividualArticle = false;

    if (matchedLaw) {
      articleKey = matchedLaw.articleGroupKey;
      const bracket = matchedLaw.penaltiesByTier[entityType] || matchedLaw.penaltiesByTier.small;
      minMrp = bracket.minMrp;
      maxMrp = bracket.maxMrp;
      isFixedIndividualArticle = Boolean(matchedLaw.isFixedIndividualArticle);
    } else {
      articleKey = rawV.code || 'КоАП РК';
      const tierFactor = entityType === 'individual' ? 1 : entityType === 'small' ? 2 : entityType === 'medium' ? 3 : 4;
      minMrp = 15 * tierFactor;
      maxMrp = 40 * tierFactor;
    }

    if (seenArticles.has(articleKey)) continue;
    seenArticles.add(articleKey);

    const effMin = isFixedIndividualArticle ? minMrp : minMrp * multiplier;
    const effMax = isFixedIndividualArticle ? maxMrp : maxMrp * multiplier;

    breakdown.push({
      code: articleKey,
      title: rawV.title,
      minMrp: effMin,
      maxMrp: effMax,
    });
  }

  const totalMinMrp = breakdown.reduce((acc, item) => acc + item.minMrp, 0);
  const totalMaxMrp = breakdown.reduce((acc, item) => acc + item.maxMrp, 0);

  return {
    minMrp: totalMinMrp,
    maxMrp: totalMaxMrp,
    minKzt: totalMinMrp * MRP_2026_KZT,
    maxKzt: totalMaxMrp * MRP_2026_KZT,
    breakdown,
  };
}

export function getCompliancePenaltyDisplay(
  violations: Violation[],
  entityType: BusinessEntityType = 'small',
  lang: 'ru' | 'kz' = 'ru',
  isRepeat = false
): CompliancePenaltyDisplay {
  const normalized = (violations || []).map(normalizeViolation);
  const legalList = normalized.filter((v) => isLegalViolation(v));
  const ethicsOnlyList = normalized.filter((v) => !isLegalViolation(v));
  const penaltyCalc = calculateMrpPenalty(normalized, entityType, isRepeat);

  if (legalList.length > 0 && penaltyCalc.maxMrp > 0) {
    const minMrpStr = penaltyCalc.minMrp.toLocaleString('ru-RU');
    const maxMrpStr = penaltyCalc.maxMrp.toLocaleString('ru-RU');
    const minKztStr = penaltyCalc.minKzt.toLocaleString('ru-RU');
    const maxKztStr = penaltyCalc.maxKzt.toLocaleString('ru-RU');
    const same = penaltyCalc.minMrp === penaltyCalc.maxMrp;

    const mrpRangeText = same
      ? `${minMrpStr} ${lang === 'kz' ? 'АЕК' : 'МРП'}`
      : `${minMrpStr}–${maxMrpStr} ${lang === 'kz' ? 'АЕК' : 'МРП'}`;

    const kztRangeText = same
      ? `${minKztStr} ₸`
      : `${minKztStr} – ${maxKztStr} ₸`;

    return {
      mode: 'legal_fine',
      mrpRangeText,
      kztRangeText,
      headline: same ? `${minKztStr} ₸ (${mrpRangeText})` : `${kztRangeText}`,
      subline:
        lang === 'kz'
          ? `${mrpRangeText} · ${legalList.length} заң бұзушылық`
          : `${mrpRangeText} · ${legalList.length} ${legalList.length === 1 ? 'нарушение закона' : 'нарушений закона'}`,
      penaltyCalc,
      legalCount: legalList.length,
      ethicsOnlyCount: ethicsOnlyList.length,
    };
  }

  const hasAssemblyReview = legalList.some((v) => isHitlContextViolation(v));

  if (legalList.length > 0 && penaltyCalc.maxMrp === 0 && hasAssemblyReview && ethicsOnlyList.length === 0) {
    return {
      mode: 'ethics_only',
      mrpRangeText: lang === 'kz' ? '0 АЕК (Human-in-the-loop)' : '0 МРП (Human-in-the-loop)',
      kztRangeText:
        lang === 'kz'
          ? 'Айыппұл 0 АЕК · Контекстті адаммен тексеру қажет'
          : 'Штраф 0 МРП · Требуется экспертная проверка контекста человеком',
      headline:
        lang === 'kz'
          ? 'Адаммен тексеру қажет (Human-in-the-loop)'
          : 'Требуется проверка человеком (Human-in-the-loop)',
      subline:
        lang === 'kz'
          ? 'Human-in-the-loop · Қоғамдық-саяси контекстті тексеру (0 АЕК)'
          : 'Human-in-the-loop · Проверка общественно-политического контекста (0 МРП)',
      penaltyCalc: { minMrp: 0, maxMrp: 0, minKzt: 0, maxKzt: 0, breakdown: [] },
      legalCount: legalList.length,
      ethicsOnlyCount: 0,
    };
  }

  if (ethicsOnlyList.length > 0) {
    return {
      mode: 'ethics_only',
      mrpRangeText: lang === 'kz' ? 'Әкімшілік айыппұлсыз' : 'Без адм. штрафа',
      kztRangeText:
        lang === 'kz'
          ? 'Әкімшілік айыппұл көзделмеген (этикалық тәуекел)'
          : 'Административный штраф не предусмотрен (этический риск)',
      headline:
        lang === 'kz'
          ? 'Әкімшілік айыппұл көзделмеген (этикалық тәуекел)'
          : 'Административный штраф не предусмотрен (этический риск)',
      subline:
        lang === 'kz'
          ? `${ethicsOnlyList.length} этикалық ескерту · ҚР заң бұзушылығы жоқ`
          : `${ethicsOnlyList.length} ${ethicsOnlyList.length === 1 ? 'этическое замечание' : 'этических замечания'} · Нарушений закона РК нет`,
      penaltyCalc: { minMrp: 0, maxMrp: 0, minKzt: 0, maxKzt: 0, breakdown: [] },
      legalCount: 0,
      ethicsOnlyCount: ethicsOnlyList.length,
    };
  }

  return {
    mode: 'clean',
    mrpRangeText: lang === 'kz' ? '0 АЕК' : '0 МРП',
    kztRangeText: lang === 'kz' ? '0 ₸ (Бұзушылықтар анықталмады)' : '0 ₸ (Нарушений не выявлено)',
    headline: lang === 'kz' ? '0 ₸ (Бұзушылықтар анықталмады)' : '0 ₸ (Нарушений не выявлено)',
    subline: lang === 'kz' ? 'Құқықтық және этикалық нормалар сақталған' : 'Правовые и этические нормы соблюдены',
    penaltyCalc: { minMrp: 0, maxMrp: 0, minKzt: 0, maxKzt: 0, breakdown: [] },
    legalCount: 0,
    ethicsOnlyCount: 0,
  };
}

const ONLY_EMOJIS_REGEX = /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s.,!?-]+$/u;
const MONEY_EMOJI_CHARS_REGEX = /[💰💵💸💴💶💷🪙🤑]/u;
const TEXTUAL_SCAM_OR_GAMBLING_EVIDENCE_REGEX =
  /л[её]гк[а-яё]*\s+заработ|раскрутк|доход[а-яё]*\s+от.{0,24}в\s+день|перев[а-яё]*\s+на\s+карт|привяж[а-яё]*\s+карт|без\s+вложени|пассивн[а-яё]*\s+доход|42\s*500|42500|kaspi\s*profit|дипфейк|deepfake|казино|casino|ставк[аиуе]|слот|рулетк|фриспин|1win|1xbet|pin-up|mostbet|джекпот|jackpot|букмекер|\.(?:xyz|top|click|icu|buzz)\b/i;
const MONEY_SPAM_CLUSTER_TEXT_REGEX =
  /(?:💰|💵|💸|💴|💶|💷|🪙|🤑)(?:\s*(?:💰|💵|💸|💴|💶|💷|🪙|🤑)){2,}/u;

export function isEmojiOnlyViolation(v: Pick<Violation, 'id' | 'code' | 'title' | 'quote' | 'basis'>): boolean {
  const idLower = (v.id || '').toLowerCase();
  const codeLower = (v.code || '').toLowerCase();
  const titleLower = (v.title || '').toLowerCase();
  const quoteTrimmed = (v.quote || '').trim();
  if (idLower.startsWith('v-emoji-')) return true;
  if (/эмодзи-триггер|спам\s*эмодзи|денежный\s+спам|денежный\s+маркер/.test(`${codeLower} ${titleLower}`)) {
    return true;
  }
  if (quoteTrimmed && ONLY_EMOJIS_REGEX.test(quoteTrimmed)) {
    return true;
  }
  return false;
}

/**
 * Single authoritative normalizer for any AuditCase:
 * Enforces strict mathematical consistency across riskScore, legalScore, ethicsScore, riskLevel, status, and violations.
 */
export function normalizeAuditCaseCompliance(auditCase: AuditCase): AuditCase {
  const safeCase = (auditCase && typeof auditCase === 'object' ? auditCase : {}) as Partial<AuditCase>;
  const contextTextForGuard = `${safeCase.extractedText || ''} ${safeCase.rawText || ''} ${safeCase.title || ''}`;
  const hasMoneyScamTextEvidence = TEXTUAL_SCAM_OR_GAMBLING_EVIDENCE_REGEX.test(contextTextForGuard);
  const hasMoneySpamCluster = MONEY_SPAM_CLUSTER_TEXT_REGEX.test(contextTextForGuard);

  const rawViolations = Array.isArray(safeCase.violations) ? safeCase.violations : [];
  let normalizedViolations = rawViolations
    .filter((v): v is Violation => Boolean(v && typeof v === 'object'))
    .map(normalizeViolation)
    .filter((v) => {
      // Guard: drop false-positive 190/445-1 violations triggered solely by 1–2 neutral money emojis without textual evidence
      const isMoneyTriggered =
        MONEY_EMOJI_CHARS_REGEX.test(`${v.quote || ''} ${v.title || ''} ${v.basis || ''}`) ||
        /эмодзи\s+денег|смайл\S*\s+денег/i.test(`${v.title || ''} ${v.basis || ''}`);
      const isFraudOrGamblingCode = /190|274|445-1/.test((v.code || '').toLowerCase());
      if (isFraudOrGamblingCode && isMoneyTriggered && !hasMoneyScamTextEvidence && !hasMoneySpamCluster) {
        return false;
      }
      if (isEmojiOnlyViolation(v) && MONEY_EMOJI_CHARS_REGEX.test(v.quote || '') && !hasMoneyScamTextEvidence && !hasMoneySpamCluster) {
        return false;
      }
      return true;
    });

  // Guard: if ALL remaining violations are emoji-only triggers (no statutory КоАП/УК evidence in text/media),
  // demote them to soft ethics warnings (0 MRP) instead of elevating to ст. 190/445-1 critical fines.
  const onlyEmojiTriggersPresent =
    normalizedViolations.length > 0 && normalizedViolations.every((v) => isEmojiOnlyViolation(v));

  if (onlyEmojiTriggersPresent) {
    normalizedViolations = normalizedViolations.map((v) => ({
      ...v,
      category: 'ethics' as const,
      severity: 'warning' as const,
      code: v.code?.includes('Этика') ? v.code : 'Этика: Спам / визуальные триггеры (эмодзи)',
      fineAmount: '0 МРП (этический риск)',
    }));
  }

  const legalList = normalizedViolations.filter((v) => isLegalViolation(v));
  const ethicsOnlyList = normalizedViolations.filter((v) => !isLegalViolation(v));
  const hasAnyEthicsImpact = normalizedViolations.some((v) => isEthicsViolation(v));

  let riskScore = typeof safeCase.riskScore === 'number' && Number.isFinite(safeCase.riskScore) ? Math.round(safeCase.riskScore) : 0;
  let status: AuditCase['status'] = safeCase.status || 'БЕЗОПАСНО';
  let riskLevel: AuditCase['riskLevel'] = safeCase.riskLevel || 'Низкий';
  let legalScore = typeof safeCase.legalScore === 'number' && Number.isFinite(safeCase.legalScore) ? Math.round(safeCase.legalScore) : 0;
  let ethicsScore = typeof safeCase.ethicsScore === 'number' && Number.isFinite(safeCase.ethicsScore) ? Math.round(safeCase.ethicsScore) : 0;

  if (onlyEmojiTriggersPresent) {
    // Emoji-only trigger without statutory offense: cap strictly at soft ethics warning 25..35
    riskScore = Math.max(25, Math.min(35, riskScore >= 25 && riskScore <= 35 ? riskScore : 28));
    status = 'ПРЕДУПРЕЖДЕНИЕ';
    riskLevel = 'Средний';
    legalScore = 0;
    ethicsScore = riskScore;
  } else if (legalList.length > 0) {
    const hasCriticalLegal = legalList.some((v) => isCriticalLegalViolation(v));
    if (hasCriticalLegal) {
      // Rule 1a: Critical statutory violations -> strictly 70..100, status ТРЕБУЕТ МЕР
      const baseFloor = legalList.some((v) => /445-1|190|274/.test((v.code || '').toLowerCase())) ? 88 : 76;
      riskScore = Math.max(70, Math.min(100, Math.max(riskScore, baseFloor)));
      status = 'ТРЕБУЕТ МЕР';
      riskLevel = riskScore >= 75 ? 'Критический' : 'Высокий';
    } else {
      // Rule 1b: Legal warning violations (e.g. ст. 21 Закона о языках or Human-in-the-loop context check)
      const hasAssemblyReview = legalList.some((v) => isHitlContextViolation(v));
      if (hasAssemblyReview) {
        const defaultAssemblyScore = Math.min(55, 50 + Math.max(0, legalList.length - 1) * 2);
        riskScore = Math.max(
          46,
          Math.min(55, riskScore >= 46 && riskScore <= 55 ? riskScore : defaultAssemblyScore)
        );
      } else {
        riskScore = Math.max(45, Math.min(69, riskScore >= 45 ? riskScore : 52 + Math.min(15, (legalList.length - 1) * 7)));
      }
      status = 'ПРЕДУПРЕЖДЕНИЕ';
      riskLevel = riskScore >= 60 ? 'Высокий' : 'Средний';
    }
    legalScore = Math.max(45, Math.min(100, Math.max(legalScore, riskScore)));
    ethicsScore = hasAnyEthicsImpact
      ? Math.max(30, Math.min(100, ethicsScore > 0 ? ethicsScore : Math.min(85, riskScore)))
      : 0;
  } else if (ethicsOnlyList.length > 0) {
    // Rule 2: No legal violations, ethics-only risks -> strictly 25..55, status ПРЕДУПРЕЖДЕНИЕ
    const hasCriticalEthics = ethicsOnlyList.some((v) => v.severity === 'critical');
    const fallbackEthicsScore = hasCriticalEthics
      ? 48
      : Math.min(55, 34 + (ethicsOnlyList.length - 1) * 8);
    const bounded = riskScore >= 25 && riskScore <= 55 ? riskScore : fallbackEthicsScore;
    riskScore = Math.max(25, Math.min(55, bounded));
    status = 'ПРЕДУПРЕЖДЕНИЕ';
    riskLevel = 'Средний';
    legalScore = 0;
    ethicsScore = Math.max(30, Math.min(55, ethicsScore >= 25 && ethicsScore <= 55 ? ethicsScore : riskScore));
  } else {
    // Rule 3: Clean material (neither legal nor ethics violations) -> strictly 0..20, status БЕЗОПАСНО
    riskScore = Math.max(0, Math.min(20, riskScore <= 20 ? riskScore : 0));
    status = 'БЕЗОПАСНО';
    riskLevel = 'Низкий';
    legalScore = 0;
    ethicsScore = 0;
  }

  const normalizedMediaAnalysis =
    safeCase.mediaAnalysis && typeof safeCase.mediaAnalysis === 'object'
      ? {
          ...safeCase.mediaAnalysis,
          summary: typeof safeCase.mediaAnalysis.summary === 'string' ? safeCase.mediaAnalysis.summary : (typeof safeCase.summary === 'string' ? safeCase.summary : ''),
          language: safeCase.mediaAnalysis.language || 'русский',
          findings: Array.isArray(safeCase.mediaAnalysis.findings)
            ? safeCase.mediaAnalysis.findings.filter((f): f is NonNullable<typeof f> => Boolean(f && typeof f === 'object'))
            : [],
          overall_risk:
            status === 'ТРЕБУЕТ МЕР'
              ? ('высокий' as const)
              : status === 'ПРЕДУПРЕЖДЕНИЕ'
              ? ('средний' as const)
              : riskScore > 0
              ? ('низкий' as const)
              : ('нет' as const),
          needs_human_review: normalizedViolations.length > 0,
        }
      : undefined;

  const safeFraudSignals =
    safeCase.fraudSignals && typeof safeCase.fraudSignals === 'object'
      ? {
          isPhishingOrDeepfake: Boolean(safeCase.fraudSignals.isPhishingOrDeepfake),
          indicators: Array.isArray(safeCase.fraudSignals.indicators)
            ? safeCase.fraudSignals.indicators.map((ind) => String(ind)).filter(Boolean)
            : [],
          ...(typeof safeCase.fraudSignals.riskCategory === 'string'
            ? { riskCategory: safeCase.fraudSignals.riskCategory }
            : {}),
        }
      : undefined;

  const safeTranscript = Array.isArray(safeCase.transcript)
    ? safeCase.transcript
        .filter((t): t is NonNullable<typeof t> => Boolean(t && typeof t === 'object'))
        .map((t) => ({
          time: typeof t.time === 'string' && t.time ? t.time : '00:00',
          speaker: typeof t.speaker === 'string' && t.speaker ? t.speaker : 'Спикер',
          text: typeof t.text === 'string' ? t.text : '',
          flagged: Boolean(t.flagged),
          ...(typeof t.flaggedText === 'string' ? { flaggedText: t.flaggedText } : {}),
          ...(typeof t.article === 'string' ? { article: t.article } : {}),
        }))
    : undefined;

  const rawMeta = safeCase.metadata && typeof safeCase.metadata === 'object' ? safeCase.metadata : ({} as Partial<AuditCase['metadata']>);
  const safeMetadata: AuditCase['metadata'] = {
    ...(typeof rawMeta.fileSize === 'string' && rawMeta.fileSize ? { fileSize: rawMeta.fileSize } : {}),
    ...(typeof rawMeta.duration === 'string' && rawMeta.duration ? { duration: rawMeta.duration } : {}),
    engineConfidence:
      typeof rawMeta.engineConfidence === 'number' && Number.isFinite(rawMeta.engineConfidence)
        ? rawMeta.engineConfidence
        : 98.2,
    platform:
      typeof rawMeta.platform === 'string' && rawMeta.platform
        ? rawMeta.platform
        : 'CheckActivity Engine v5.0 (Казахстан)',
  };

  const safeTelemetry =
    safeCase.telemetry && typeof safeCase.telemetry === 'object'
      ? {
          extractMs: Number.isFinite(safeCase.telemetry.extractMs) ? Math.max(0, Math.round(safeCase.telemetry.extractMs)) : 0,
          retrievalMs: Number.isFinite(safeCase.telemetry.retrievalMs) ? Math.max(0, Math.round(safeCase.telemetry.retrievalMs)) : 0,
          aiAuditMs: Number.isFinite(safeCase.telemetry.aiAuditMs) ? Math.max(0, Math.round(safeCase.telemetry.aiAuditMs)) : 0,
          totalMs: Number.isFinite(safeCase.telemetry.totalMs) ? Math.max(1, Math.round(safeCase.telemetry.totalMs)) : 1,
          checkedLawsCount:
            typeof safeCase.telemetry.checkedLawsCount === 'number' && safeCase.telemetry.checkedLawsCount > 0
              ? safeCase.telemetry.checkedLawsCount
              : KZ_LAWS_DB.length,
          retrievedLawsCount:
            typeof safeCase.telemetry.retrievedLawsCount === 'number' && safeCase.telemetry.retrievedLawsCount >= 0
              ? safeCase.telemetry.retrievedLawsCount
              : 0,
          ...(Array.isArray(safeCase.telemetry.matchedLawCodes)
            ? { matchedLawCodes: safeCase.telemetry.matchedLawCodes.map((c) => String(c)).filter(Boolean) }
            : {}),
          engineMode:
            safeCase.telemetry.engineMode === 'rag-live-ai'
              ? ('rag-live-ai' as const)
              : ('deterministic-db-fallback' as const),
          ...(typeof safeCase.telemetry.aiModel === 'string' && safeCase.telemetry.aiModel
            ? { aiModel: safeCase.telemetry.aiModel }
            : {}),
          ...(typeof safeCase.telemetry.fallbackReason === 'string' && safeCase.telemetry.fallbackReason
            ? { fallbackReason: safeCase.telemetry.fallbackReason }
            : {}),
        }
      : undefined;

  return {
    ...safeCase,
    id: typeof safeCase.id === 'string' && safeCase.id ? safeCase.id : `audit-${Date.now()}`,
    referenceNumber: typeof safeCase.referenceNumber === 'string' && safeCase.referenceNumber ? safeCase.referenceNumber : '#CHK-KZ-000000',
    timestamp: typeof safeCase.timestamp === 'string' && safeCase.timestamp ? safeCase.timestamp : new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' }),
    sourceType: safeCase.sourceType || 'text',
    title: typeof safeCase.title === 'string' && safeCase.title ? safeCase.title : 'Проверенный материал',
    sourceName: typeof safeCase.sourceName === 'string' && safeCase.sourceName ? safeCase.sourceName : (typeof safeCase.title === 'string' ? safeCase.title : 'Материал'),
    sha256: typeof safeCase.sha256 === 'string' && safeCase.sha256 ? safeCase.sha256 : 'sha256-unavailable',
    summary: typeof safeCase.summary === 'string' ? safeCase.summary : '',
    ethicsSummary: typeof safeCase.ethicsSummary === 'string' ? safeCase.ethicsSummary : '',
    extractedText: typeof safeCase.extractedText === 'string' ? safeCase.extractedText : '',
    detectedActions: typeof safeCase.detectedActions === 'string' ? safeCase.detectedActions : '',
    violations: normalizedViolations,
    riskScore,
    legalScore,
    ethicsScore,
    riskLevel,
    status,
    metadata: safeMetadata,
    ...(safeTelemetry ? { telemetry: safeTelemetry } : {}),
    ...(safeFraudSignals ? { fraudSignals: safeFraudSignals } : {}),
    ...(safeTranscript ? { transcript: safeTranscript } : {}),
    ...(normalizedMediaAnalysis ? { mediaAnalysis: normalizedMediaAnalysis } : {}),
  } as AuditCase;
}

export function runLivePreCheck(
  text: string,
  url?: string,
  entityType: BusinessEntityType = 'small',
  lang: 'ru' | 'kz' = 'ru'
): LivePreCheckResult {
  const combined = `${text || ''} ${url || ''}`.trim();
  const lower = combined.toLowerCase();
  const triggers: LivePreCheckResult['triggers'] = [];

  if (!combined) {
    return {
      riskScore: 0,
      safetyScore: 100,
      status: 'safe',
      statusLabelRu: 'БЕЗОПАСНО',
      statusLabelKz: 'ҚАУІПСІЗ',
      triggers: [],
      penaltySummaryRu: '0 ₸ (Нарушений не выявлено)',
      penaltySummaryKz: '0 ₸ (Бұзушылықтар анықталмады)',
      penaltyCalc: { minMrp: 0, maxMrp: 0, minKzt: 0, maxKzt: 0, breakdown: [] },
      languageCoverage: 'neutral',
    };
  }

  const isContextWarning = isJournalisticWarningContext(combined);
  const fraudAndLang = analyzeKzFraudAndLanguage(combined, url);
  const doxing = !isContextWarning ? detectPersonalDataDoxing(combined) : { detected: false, matches: [] };
  const disinfo = !isContextWarning ? detectPoliticalDisinfo(combined) : { detected: false };

  if (PROFANITY_REGEX.test(lower)) {
    triggers.push({
      id: 'profanity',
      category: 'legal',
      labelRu: 'Ненормативная лексика',
      labelKz: 'Бейәдеп лексика',
      severity: 'critical',
      article: 'ст. 434 КоАП РК',
    });
  }
  if (!isContextWarning && GAMBLING_REGEX.test(lower)) {
    triggers.push({
      id: 'gambling',
      category: 'legal',
      labelRu: 'Нелегальный гэмблинг / слоты',
      labelKz: 'Заңсыз казино / слоттар',
      severity: 'critical',
      article: 'ст. 445-1 КоАП РК',
    });
  }

  if (disinfo.detected) {
    triggers.push({
      id: 'disinfo',
      category: 'legal',
      labelRu: 'Вброс / заведомо ложная информация',
      labelKz: 'Көрінеу жалған ақпарат',
      severity: 'critical',
      article: 'ст. 274 УК РК / ст. 456-2 КоАП РК',
    });
  }

  if (doxing.detected) {
    triggers.push({
      id: 'doxing',
      category: 'legal',
      labelRu: 'Утечка ПДн / Доксинг',
      labelKz: 'Дербес деректерді тарату',
      severity: 'critical',
      article: 'ст. 147 УК РК / ст. 79 КоАП РК',
    });
  }

  if (!isContextWarning && (fraudAndLang.hasPhishingOrScam || fraudAndLang.hasDeepfakeIndicators)) {
    triggers.push({
      id: 'scam_deepfake',
      category: 'legal',
      labelRu: 'Фишинг / Дипфейк-скам РК',
      labelKz: 'Фишинг / Дипфейк-алаяқтық',
      severity: 'critical',
      article: 'ст. 190, 274 УК РК',
    });
  }

  if (!isContextWarning && COMMERCIAL_REGEX.test(lower) && !AD_MARK_REGEX.test(lower) && !GAMBLING_REGEX.test(lower)) {
    triggers.push({
      id: 'ad_label',
      category: 'legal',
      labelRu: 'Нет маркировки «Жарнама»',
      labelKz: '«Жарнама» белгісі жоқ',
      severity: 'critical',
      article: 'ст. 455 КоАП РК',
    });
  }

  if (!isContextWarning && BULLY_REGEX.test(lower)) {
    triggers.push({
      id: 'bullying',
      category: 'legal',
      labelRu: 'Оскорбления / клевета / кибербуллинг',
      labelKz: 'Қорлау / жала жабу / кибербуллинг',
      severity: 'critical',
      article: 'ст. 131 УК РК / ст. 73-4 КоАП РК',
    });
  }

  if (!isContextWarning && FOMO_REGEX.test(lower)) {
    triggers.push({
      id: 'dark_pattern',
      category: 'ethics',
      labelRu: 'Dark Pattern / FOMO давление',
      labelKz: 'Dark Pattern / FOMO қысым',
      severity: 'warning',
      article: 'Цифровая этика',
    });
  }

  const assemblyCall = detectPeacefulAssemblyCall(combined);
  if (assemblyCall.detected) {
    triggers.push({
      id: 'peaceful_assembly',
      category: 'legal',
      labelRu: 'Общественно-политический / протестный контекст (Human-in-the-loop)',
      labelKz: 'Қоғамдық-саяси / наразылық контексі (Human-in-the-loop)',
      severity: 'warning',
      article: HITL_PROTEST_ARTICLE,
    });
  }

  if (fraudAndLang.needsKzParityWarning && !GAMBLING_REGEX.test(lower)) {
    triggers.push({
      id: 'lang_parity',
      category: 'legal',
      labelRu: 'Нет версии на казахском языке',
      labelKz: 'Қазақша нұсқасы жоқ',
      severity: 'warning',
      article: 'ст. 21 Закона о языках',
    });
  }

  const pseudoViolations: Violation[] = triggers.map((trg) => ({
    id: trg.id,
    category: trg.category,
    code: trg.article,
    title: trg.labelRu,
    severity: trg.severity,
    basis: trg.labelRu,
    fineAmount: '',
    jurisdiction: '',
  }));

  const legalTriggers = triggers.filter((t) => t.category === 'legal');
  const ethicsOnlyTriggers = triggers.filter((t) => t.category === 'ethics');
  const hasCriticalLegal = legalTriggers.some((t) => t.severity === 'critical');

  let riskScore = isContextWarning ? 0 : 4;
  let status: LivePreCheckResult['status'] = 'safe';
  let statusLabelRu: LivePreCheckResult['statusLabelRu'] = 'БЕЗОПАСНО';
  let statusLabelKz: LivePreCheckResult['statusLabelKz'] = 'ҚАУІПСІЗ';

  if (legalTriggers.length > 0) {
    if (hasCriticalLegal) {
      riskScore = Math.min(98, 76 + (legalTriggers.length - 1) * 6);
      status = 'critical';
      statusLabelRu = 'ТРЕБУЕТ МЕР';
      statusLabelKz = 'ШАРАЛАР ҚАЖЕТ';
    } else {
      const hasAssemblyTrigger = legalTriggers.some((t) => t.id === 'peaceful_assembly');
      riskScore = hasAssemblyTrigger
        ? Math.min(55, Math.max(46, 50 + (legalTriggers.length - 1) * 2))
        : Math.min(69, 48 + (legalTriggers.length - 1) * 7);
      status = 'warning';
      statusLabelRu = 'ПРЕДУПРЕЖДЕНИЕ';
      statusLabelKz = 'ЕСКЕРТУ';
    }
  } else if (ethicsOnlyTriggers.length > 0) {
    riskScore = Math.min(55, 36 + (ethicsOnlyTriggers.length - 1) * 8);
    status = 'warning';
    statusLabelRu = 'ПРЕДУПРЕЖДЕНИЕ';
    statusLabelKz = 'ЕСКЕРТУ';
  }

  const dispRu = getCompliancePenaltyDisplay(pseudoViolations, entityType, 'ru');
  const dispKz = getCompliancePenaltyDisplay(pseudoViolations, entityType, 'kz');

  return {
    riskScore,
    safetyScore: Math.max(0, 100 - riskScore),
    status,
    statusLabelRu,
    statusLabelKz,
    triggers,
    penaltySummaryRu: dispRu.headline,
    penaltySummaryKz: dispKz.headline,
    penaltyCalc: lang === 'kz' ? dispKz.penaltyCalc : dispRu.penaltyCalc,
    languageCoverage: fraudAndLang.languageCoverage,
  };
}


const SAFE_PROFANITY_SOURCE =
  '(?:^|[^а-яёәғқңөұүһі])(бля(?:т[ья]?|д[ьт]?)?|ху[йияеёю][а-яё]*|пизд[а-яё]*|(?:за|по|вы|до|на|от|под|при|пере|раз|у|долбо|съ|въ)?[её]б(?:ать|ал[аио]?|ан[аоы]?|ут|ет|ёт|ись|уч|ок|ище|ну[а-яё]*)|сук[аиеу](?=$|[^а-яё])|сучк[аи]|наху[йи]|муда[кч][а-яё]*|гондон[а-яё]*|пид[оа]р[а-яё]*|чмо(?=$|[^а-яё])|шеше[ңн][а-яәғқңөұүһі]*|си[кқ]т[а-яәғқңөұүһі]*|көт(?:і|ті|ін|ің|ке)?(?=$|[^а-яёәғқңөұүһі])|қота[қк][а-яәғқңөұүһі]*)';

export function findProfanityMatches(text: string): string[] {
  if (!text) return [];
  const regex = new RegExp(SAFE_PROFANITY_SOURCE, 'gi');
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m[1]) matches.push(m[1].trim());
  }
  return matches;
}

const PROFANITY_REGEX = new RegExp(SAFE_PROFANITY_SOURCE, 'i');
const GAMBLING_REGEX =
  /казино|casino|1win|1xbet|pin-up|mostbet|слот|рулетк|фриспин|jackpot|жекпот|барабан|букмекер|aviator|luckyjet|luxury\s+slots/i;
const COMMERCIAL_REGEX =
  /скидк|распродаж|(?<!наразылық\s)(?<!уличн[а-яё]*\s)акци(?:я|ю|и)(?!\s+протеста)(?=$|[\s.,!?:;»"')\]])|промокод|купить|заказать|цена|курс|инвестиц|тариф|доставка|открывайте\s+счет|счета\s+в\s+тенге|оформляй|кредит|депозит|кэшбэк|кешбэк|рассрочк|подключай|бронируй|бесплатный\s+выпуск|заказывайте|оставьте\s+заявку|подробнее\s+на\s+сайте/i;
const AD_MARK_REGEX = /жарнама|реклама|жарнамалық|спонсор/i;
const BULLY_REGEX =
  /бездар|тупой|тупая|идиот|урод|мразь|ничтожеств|даун|клоун|найдем|за базар|продажн[а-я]+\s+твар|предател|мошенник[а-я]*(?=.*(?:кандидат|депутат|тварь|предатель))/i;
const FOMO_REGEX = /только сегодня|пожалеешь|100% гарант|без рисков|сгорает через|успей сейчас|осталось [1-9] мест/i;

// Doxing & Personal Data Leaks (ст. 147 УК РК / ст. 79 КоАП РК)
const PERSONAL_PHONE_REGEX = /(?:\+7|8)[\s(-]*7\d{2}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/;
const IIN_REGEX = /\b\d{12}\b/;
const ADDRESS_LEAK_REGEX = /(?:адрес|проживает|живет)\s*:|ул\.\s*[А-ЯЁА-ЯA-Zәғқңөұүһі]{3,}|д\.\s*\d+[\s,]+кв\.\s*\d+/i;
const DOXING_CONTEXT_REGEX = /(?:личн(?:ый|ые)\s+(?:телефон|данные|номер)|иин|жсн|слив|должник|адрес)/i;

// Political fake / disinfo leak (ст. 274 УК РК / ст. 456-2 КоАП РК)
const DISINFO_LEAK_REGEX =
  /срочн(?:ый|о)\s+слив|тайно\s+переписал|офшор[а-я]*|откат[ыа-я]*|вброс\s+про\s+кандидат|кандидат\s*№?\s*\d+.*(?:украл|офшор|откат)/i;

const KZ_SCAM_REGEX =
  /kaspi\s*(profit|бонус|выплат|инвест|акци)|kazmunaygas|қазмұнайгаз|42\s*500|42500|egov[\s.-]*выплат|halyk\s*invest|халык\s*инвест|заработок\s*от\s*\d{3}\s*000|пассивн[а-я]*\s*доход\s*в\s*день|привяж[а-я]*\s*карту\s*kaspi/i;
const SUSPICIOUS_DOMAIN_REGEX =
  /(?:kaspi|halyk|egov|jusan|forte|kmg)[\w-]*\.(?:xyz|top|click|site|online|club|icu|buzz|info|vip)/i;
const DEEPFAKE_TRIGGER_REGEX =
  /токаев\s*(подписал|объявил|пообещал)\s*выплат|аким\s*(раздает|выплатит)|госвыплата\s*каждому\s*гражданину|секретная\s*платформа\s*от\s*президента|ии[\s-]*бот\s*зарабатывает/i;

const WARNING_FRAMING_REGEX =
  /осторожно[\s,!:]*мошенник|внимание[\s,!:]*мошенник|предупреждают|предупреждает|предупреждение\s+полиц|мвд\s+рк|афм\s+рк|киберпол|департамент\s+полиц|прокуратур[аы]\s+рк|схем[ауы]\s+обмана|не\s+переходите\s+по\s+(?:сомнительным\s+)?ссылкам|не\s+сообщайте\s+(?:sms|смс|код)|официальное\s+(?:информационное\s+)?предупреждение|журналистск|редакция\s+предупреждает|фейков(?:ые|ых)\s+ссылк|злоумышленники\s+(?:рекламируют|рассылают)|абайлаңыз[\s,!:]*алаяқ|іім\s+ескертеді|ресми\s+ескерту/i;

const ACTIVE_SCAM_PROMO_REGEX =
  /500%\s*бонус|крути\s+(?:слот|барабан)|промокод\s*:|играть\s+прямо\s+сейчас|забирай\s+джекпот|реферальн[а-я]*\s+ссылк|привяж[а-я]*\s+карту\s+kaspi|пассивн[а-я]*\s+доход\s+от\s+\d+|токаев\s+подписал\s+выплат|https?:\/\/(?:kaspi|halyk|egov)[\w-]*\.(?:xyz|top|click|icu|buzz)/i;

export function isJournalisticWarningContext(rawText: string): boolean {
  if (!rawText) return false;
  const lower = rawText.toLowerCase();
  if (PROFANITY_REGEX.test(lower)) return false;
  if (ACTIVE_SCAM_PROMO_REGEX.test(lower)) return false;
  return WARNING_FRAMING_REGEX.test(lower);
}

const ADVERTISER_BIN_DISCLOSURE_REGEX =
  /(?:рекламодател[ья]|жарнама\s+беруші|заказчик\s+рекламы)(?:\s*\/\s*(?:рекламодател[ья]|жарнама\s+беруші))?\s*[:\-–]?\s*(?:(?:иин\/бин|жсн\/бсн|ұйым\s+бсн|бин\s+организации|иин|жсн|бин|бсн)\s*[:\-–]?\s*)?[\[\(]?\d{12}[\]\)]?|\b(?:иин\/бин|жсн\/бсн|ұйым\s+бсн|бин\s+организации|бин|бсн)\s*[:\-–]?\s*[\[\(]?\d{12}[\]\)]?/gi;

export function detectPersonalDataDoxing(rawText: string): {
  detected: boolean;
  matches: string[];
} {
  if (!rawText) return { detected: false, matches: [] };
  const sanitizedForDoxing = rawText.replace(ADVERTISER_BIN_DISCLOSURE_REGEX, ' ');
  const matches: string[] = [];
  const phoneMatch = sanitizedForDoxing.match(PERSONAL_PHONE_REGEX);
  const iinMatch = sanitizedForDoxing.match(IIN_REGEX);
  const addrMatch = sanitizedForDoxing.match(ADDRESS_LEAK_REGEX);
  const hasDoxingContext =
    DOXING_CONTEXT_REGEX.test(sanitizedForDoxing) || Boolean(iinMatch && phoneMatch) || Boolean(addrMatch);

  if (hasDoxingContext) {
    if (phoneMatch) matches.push(phoneMatch[0]);
    if (iinMatch) matches.push(`ИИН ${iinMatch[0]}`);
    if (addrMatch) matches.push(addrMatch[0]);
  }
  return { detected: matches.length > 0, matches };
}

// Deterministic fallback marker categories only (resignation, picket, rally, protest, march) — no specific slogans, dates, or surnames
const PEACEFUL_ASSEMBLY_CALL_REGEX =
  /(?:^|[\s«"(])(?:в\s+)?отставк[аеиуой](?=$|[\s.,!?;:»"')\]])|отставкағ?а|(?:выйти|выходим|выходите|приходи(?:те)?|собираемся|собирайтесь)\s+(?:на\s+)?(?:площад[ьи]|митинг|шестви[ея]|пикет|акци[юя]\s+протеста|уличн[а-яё]+\s+акци[юи]|перекрыти[ея]\s+дорог)|несанкционированн[а-яё]+\s+(?:митинг|шестви[ея]|пикет|акци[юия])|перекрыти[ея]\s+дорог|перекры(?:ть|вай(?:те)?|ваем)\s+дорог[уи]|(?:^|[\s«"(])(?:на|в)\s+митинг(?:и|ов|ам|ах|е|а|у)?(?=$|[\s.,!?;:»"')\]])|(?:^|[\s«"(])митинг(?:и|ов|ам|ах|е|а|у|ке|іге|қа|ге|те)?(?=$|[\s.,!?;:»"')\]])|(?:уличн[а-яё]+\s+)?акци[яюи]\s+протеста|(?:^|[\s«"(])(?:на|к)\s+протест[ауы]?(?=$|[\s.,!?;:»"')\]])|(?:^|[\s«"(])протест(?:овать|уем|уют|ный|ная|ное|ные|ов)?(?=$|[\s.,!?;:»"')\]])|(?:^|[\s«"(])шестви[еяйю](?=$|[\s.,!?;:»"')\]])|(?:^|[\s«"(])пикет(?:ы|ов|а|у|ам|е)?(?=$|[\s.,!?;:»"')\]])|алаңға\s*(?:шығ|жинал|кел)[а-яәғқңөұүһі]*|наразылық(?:\s+акция|\s+шеру|\s+білдір)?|шеру(?:ге)?(?=$|[\s.,!?;:»"')\]])|рұқсат\s+етілмеген\s+(?:митинг|жиын|акция)|жол(?:ды)?\s+жабу/i;

const PEACEFUL_ELECTION_CONTEXT_REGEX =
  /приходите\s+на\s+выборы|голосуйте\s+по\s+совести|официальн[а-яё]+\s+выбор[а-яё]*|избирательн[а-яё]+\s+участ|сайлауға\s+(?:кел|қатыс)|ар-?ождан\S*\s+дауыс\s+бер/i;

export function detectPeacefulAssemblyCall(rawText: string): {
  detected: boolean;
  quote?: string;
} {
  if (!rawText) return { detected: false };
  if (PEACEFUL_ELECTION_CONTEXT_REGEX.test(rawText)) {
    return { detected: false };
  }
  const match = rawText.match(PEACEFUL_ASSEMBLY_CALL_REGEX);
  return { detected: Boolean(match), quote: match ? match[0].trim() : undefined };
}

export function detectPoliticalDisinfo(rawText: string): {
  detected: boolean;
  quote?: string;
} {
  if (!rawText || isJournalisticWarningContext(rawText)) return { detected: false };
  const m = rawText.match(DISINFO_LEAK_REGEX);
  return { detected: Boolean(m), quote: m ? m[0] : undefined };
}

export function analyzeKzFraudAndLanguage(rawText: string, url?: string): KzFraudLanguageAnalysis {
  const combined = `${rawText || ''} ${url || ''}`.trim();
  const lower = combined.toLowerCase();
  const isContextWarning = isJournalisticWarningContext(combined);

  const scamMatches: string[] = [];
  if (!isContextWarning) {
    const scamMatch = lower.match(KZ_SCAM_REGEX);
    if (scamMatch) scamMatches.push(scamMatch[0]);
    const domainMatch = lower.match(SUSPICIOUS_DOMAIN_REGEX);
    if (domainMatch) scamMatches.push(domainMatch[0]);
  }

  const deepfakeMatches: string[] = [];
  if (!isContextWarning) {
    const deepfakeMatch = lower.match(DEEPFAKE_TRIGGER_REGEX);
    if (deepfakeMatch) deepfakeMatches.push(deepfakeMatch[0]);
  }

  const hasKazakhChars = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/.test(combined);
  const hasKazakhWords = /\b(және|үшін|қазақстан|жарнама|арзандату|жеңілдік|теңге|сатып|тегін|бүгін)\b/i.test(lower);
  const hasRussianWords = /[а-яё]{3,}/i.test(lower.replace(/[әғқңөұүһі]/gi, ''));

  let languageCoverage: KzFraudLanguageAnalysis['languageCoverage'] = 'neutral';
  if ((hasKazakhChars || hasKazakhWords) && hasRussianWords) {
    languageCoverage = 'bilingual';
  } else if (hasKazakhChars || hasKazakhWords) {
    languageCoverage = 'kz_only';
  } else if (hasRussianWords) {
    languageCoverage = 'ru_only';
  }

  const isCommercial = COMMERCIAL_REGEX.test(lower);
  const isGambling = GAMBLING_REGEX.test(lower);
  const needsKzParityWarning = !isContextWarning && isCommercial && !isGambling && languageCoverage === 'ru_only' && combined.length > 25;

  return {
    hasPhishingOrScam: scamMatches.length > 0,
    scamMatches,
    hasDeepfakeIndicators: deepfakeMatches.length > 0,
    deepfakeMatches,
    languageCoverage,
    needsKzParityWarning,
  };
}

export function buildOfficialDocument(
  auditCase: AuditCase,
  docType: 'eotinish' | 'pretension',
  recipientOrOrg: string,
  lang: 'ru' | 'kz',
  entityType: BusinessEntityType = 'small'
): string {
  const ref = auditCase.referenceNumber || '#CHK-KZ-000000';
  const dateStr = auditCase.timestamp || new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Almaty' });
  const hash = auditCase.sha256 || 'sha256-verified';
  const overallPenalty = getCompliancePenaltyDisplay(auditCase.violations, entityType, lang);
  const overallPenaltyLine =
    overallPenalty.mode === 'legal_fine'
      ? `${overallPenalty.mrpRangeText} (${overallPenalty.kztRangeText})`
      : overallPenalty.headline;

  const matchedLaws: KzLawEntry[] = [];
  const seenLawIds = new Set<string>();
  for (const v of auditCase.violations || []) {
    const found = findKzLawByViolation(v);
    if (found && !seenLawIds.has(found.id)) {
      seenLawIds.add(found.id);
      matchedLaws.push(found);
    }
  }

  const dynamicRegulators = Array.from(
    new Set(
      matchedLaws
        .map((l) => (lang === 'kz' ? l.regulatorKz : l.regulator))
        .filter(Boolean)
    )
  );
  const dynamicOrgLine =
    recipientOrOrg ||
    (dynamicRegulators.length > 0
      ? dynamicRegulators.join(' / ')
      : lang === 'kz'
      ? 'ҚР Мәдениет және ақпарат министрлігі / ҚМА / ІІМ — eOtinish форматы'
      : 'Министерство культуры и информации РК / АФМ РК / МВД РК — формат eOtinish');

  const violationsText =
    auditCase.violations.length > 0
      ? auditCase.violations
          .map((v, idx) => {
            const matchedLaw = findKzLawByViolation(v);
            const cardDisp = getCompliancePenaltyDisplay([v], entityType, lang);
            const cardPenaltyText =
              cardDisp.mode === 'legal_fine'
                ? `${cardDisp.mrpRangeText} (${cardDisp.kztRangeText})`
                : cardDisp.headline;
            const lawRef = matchedLaw
              ? lang === 'kz'
                ? matchedLaw.lawNameKz
                : matchedLaw.lawName
              : v.code;
            if (lang === 'kz') {
              return `${idx + 1}. [${v.code}] ${v.title}${v.quote ? ` — үзінді: «${v.quote}»` : ''}.\n   Норма: ${lawRef}. Санкция бағасы: ${cardPenaltyText}.`;
            }
            return `${idx + 1}. [${v.code}] ${v.title}${v.quote ? ` — фрагмент: «${v.quote}»` : ''}.\n   Норма: ${lawRef}. Риск: ${cardPenaltyText}.`;
          })
          .join('\n')
      : lang === 'kz'
      ? 'ҚР қолданыстағы заңнама нормаларын бұзушылықтар анықталған жоқ.'
      : 'Нарушений действующих норм законодательства РК не зафиксировано.';

  if (docType === 'eotinish') {
    const eOtinishBases =
      matchedLaws.length > 0
        ? matchedLaws
            .map((l, i) => `${i + 1}) ${lang === 'kz' ? l.eOtinishBasisKz : l.eOtinishBasisRu}`)
            .join('\n')
        : lang === 'kz'
        ? '«Онлайн-платформалар және онлайн-жарнама туралы» № 230-VII Заңы мен ҚР ӘҚБтК нормалары негізінде тексеру жүргізуді сұраймын.'
        : 'На основании Закона РК № 230-VII «Об онлайн-платформах и онлайн-рекламе» и норм КоАП РК прошу провести проверку и принять меры реагирования.';

    if (lang === 'kz') {
      return `ҚАЗАҚСТАН РЕСПУБЛИКАСЫНЫҢ УӘКІЛЕТТІ ОРГАНЫНА
(${dynamicOrgLine}, eOtinish порталы арқылы)

ӨТІНІШ (КОМПЛАЕНС-ХАТТАМА НЕГІЗІНДЕ)
Тіркеу нөмірі: ${ref}
Күні мен уақыты: ${dateStr}
Дәлелдеменің цифрлық ізбегі (SHA-256): ${hash}

1. ТЕКСЕРІЛГЕН НЫСАН:
Атауы / Көзі: ${auditCase.title} (${auditCase.sourceName})
Тәуекел индексі: ${auditCase.riskScore}% (${getLocalizedRiskLevel(auditCase.riskLevel, 'kz')})
Жиынтық санкция бағасы: ${overallPenaltyLine}

2. АНЫҚТАЛҒАН ҚҰҚЫҚ БҰЗУШЫЛЫҚ БЕЛГІЛЕРІ:
${violationsText}

3. ҚҰҚЫҚТЫҚ НЕГІЗДЕМЕ ЖӘНЕ ТАЛАП (ҚР НҚА БАЗАСЫ БОЙЫНША):
${eOtinishBases}

Қосымша: Цифрлық сараптама есебі (${ref}), скриншоттар / стенограмма.
Дайындалды: Check Activity KZ Compliance Engine`;
    }

    return `В УПОЛНОМОЧЕННЫЙ ГОСУДАРСТВЕННЫЙ ОРГАН РК
(${dynamicOrgLine})

ОБРАЩЕНИЕ О ПРИЗНАКАХ НАРУШЕНИЯ ЗАКОНОДАТЕЛЬСТВА РК
Идентификатор аудита: ${ref}
Дата фиксации: ${dateStr}
Контрольная сумма доказательства (SHA-256): ${hash}

1. СВЕДЕНИЯ ОБ ОБЪЕКТЕ ПРОВЕРКИ:
Источник / Материал: ${auditCase.title} (${auditCase.sourceName})
Интегральный индекс риска: ${auditCase.riskScore}% (${auditCase.riskLevel})
Совокупная оценка санкции: ${overallPenaltyLine}

2. ЗАФИКСИРОВАННЫЕ ПРИЗНАКИ НАРУШЕНИЙ:
${violationsText}

3. ПРАВОВОЕ ОБОСНОВАНИЕ И ПРОСИТЕЛЬНАЯ ЧАСТЬ (ПО БАЗЕ НПА РК):
${eOtinishBases}

Приложение: Экспертный отчет Check Activity KZ (${ref}), фиксация текста/кадров.
Сформировано автоматически: Check Activity KZ Compliance Engine`;
  }

  // Pretension / notice to blogger or contractor grounded strictly in matched KZ_LAWS_DB records
  const pretensionSteps =
    matchedLaws.length > 0
      ? matchedLaws
          .map((l, i) => `${i + 1}. ${lang === 'kz' ? l.pretensionRequirementKz : l.pretensionRequirementRu}`)
          .join('\n')
      : lang === 'kz'
      ? '1. ҚР заңнамасы мен цифрлық этика стандарттарына сәйкес материалды түзетуді сұраймыз.'
      : '1. Привести публикацию в соответствие с нормами законодательства РК и цифровой этики.';

  if (lang === 'kz') {
    return `СОТҚА ДЕЙІНГІ ЕСКЕРТУ ЖӘНЕ КОМПЛАЕНС-НҰСҚАМА
Құжат № ${ref} | Күні: ${dateStr}
Алушы: ${recipientOrOrg || auditCase.sourceName}

«Check Activity KZ» жүйесінің тексеру нәтижесі бойынша сіздің жарияланымыңызда (${auditCase.title}) ҚР заңнамасы мен цифрлық этика нормаларына сәйкессіздік анықталды:

${violationsText}

Есептік санкция тәуекелі: ${overallPenaltyLine}.

ТАЛАП (24 сағат ішінде орындау):
${pretensionSteps}

Тәуекелді қайта тексеру референсі: ${ref}`;
  }

  return `ДОСУДЕБНОЕ УВЕДОМЛЕНИЕ / ПРЕДПИСАНИЕ ОБ УСТРАНЕНИИ НАРУШЕНИЙ
Документ № ${ref} | Дата: ${dateStr}
Адресат: ${recipientOrOrg || auditCase.sourceName}

По результатам комплаенс-аудита публикации «${auditCase.title}» зафиксированы несоответствия нормам законодательства Республики Казахстан и стандартам цифровой этики:

${violationsText}

Расчётный риск санкций: ${overallPenaltyLine}.

ТРЕБОВАНИЕ (устранить в течение 24 часов):
${pretensionSteps}

В противном случае материалы с цифровой фиксацией SHA-256 (${hash}) могут быть направлены в уполномоченные органы РК (${dynamicRegulators.join(', ') || 'МКИ РК / АФМ РК / МВД РК'}).
Сформировано: Check Activity KZ`;
}
