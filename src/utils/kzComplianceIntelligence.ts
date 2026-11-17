/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { AuditCase, Violation } from '../types/index.ts';

export const MRP_2026_KZT = 4325;

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
  /коап|ук\s*рк|әқбтк|қк\b|230-vii|94-v|закон|заң|ст\.\s*\d+|\d+-бап|445-1|455\b|434\b|456-2|73-4|131\b|115\b|147\b|79\b|190\b|274\b|133-1|301-1|ст\.\s*21/i;

const PURE_ETHICS_ONLY_REGEX =
  /dark\s*pattern|fomo|манипулят|таймер|дефицит|вовлечение\s+в\s+азарт|иллюзи|этика\s+реклам|этика\s+коммуникац|сетев\w+\s+этикет/i;

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
  const combined = `${v.code || ''} ${v.title || ''}`.toLowerCase();
  if (/445-1|190|274|456-2|147|79|434|131|115|73-4|301-1|133-1/.test(combined)) {
    return true;
  }
  if ((/455|230-vii/.test(combined)) && v.severity === 'critical') {
    return true;
  }
  return v.severity === 'critical';
}

export function normalizeViolation(v: Violation): Violation {
  const legal = isLegalViolation(v);
  return {
    ...v,
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

    const code = `${rawV.code || ''} ${rawV.title || ''}`.toLowerCase();
    let minMrp = 0;
    let maxMrp = 0;
    let articleKey = rawV.code || rawV.id;
    let isFixedIndividualArticle = false;

    if (code.includes('445-1')) {
      articleKey = 'ст. 445-1 КоАП РК';
      if (entityType === 'individual') {
        minMrp = 60;
        maxMrp = 100;
      } else if (entityType === 'small') {
        minMrp = 200;
        maxMrp = 300;
      } else if (entityType === 'medium') {
        minMrp = 400;
        maxMrp = 500;
      } else {
        minMrp = 700;
        maxMrp = 1000;
      }
    } else if (code.includes('455') || code.includes('230-vii') || code.includes('230')) {
      articleKey = 'ст. 455 КоАП РК / Закон № 230-VII';
      if (entityType === 'individual') {
        minMrp = 20;
        maxMrp = 40;
      } else if (entityType === 'small') {
        minMrp = 50;
        maxMrp = 100;
      } else if (entityType === 'medium') {
        minMrp = 100;
        maxMrp = 150;
      } else {
        minMrp = 150;
        maxMrp = 200;
      }
    } else if (code.includes('434')) {
      articleKey = 'ст. 434 КоАП РК';
      isFixedIndividualArticle = true;
      minMrp = isRepeat ? 20 : 20;
      maxMrp = isRepeat ? 30 : 20;
    } else if (code.includes('73-4') || code.includes('131') || code.includes('115')) {
      articleKey = code.includes('131')
        ? 'ст. 131 УК РК / ст. 73-4 КоАП РК'
        : code.includes('115')
        ? 'ст. 115 УК РК / ст. 73-4 КоАП РК'
        : 'ст. 73-4 КоАП РК';
      if (entityType === 'individual') {
        minMrp = 15;
        maxMrp = code.includes('131') ? 100 : 30;
      } else if (entityType === 'small') {
        minMrp = 30;
        maxMrp = 100;
      } else if (entityType === 'medium') {
        minMrp = 50;
        maxMrp = 150;
      } else {
        minMrp = 100;
        maxMrp = 200;
      }
    } else if (code.includes('79') || code.includes('147') || code.includes('94-v')) {
      articleKey = code.includes('147') ? 'ст. 147 УК РК / ст. 79 КоАП РК' : 'ст. 79 КоАП РК';
      if (entityType === 'individual') {
        minMrp = 10;
        maxMrp = 30;
      } else if (entityType === 'small') {
        minMrp = 30;
        maxMrp = 60;
      } else if (entityType === 'medium') {
        minMrp = 60;
        maxMrp = 100;
      } else {
        minMrp = 100;
        maxMrp = 200;
      }
    } else if (code.includes('190') || code.includes('274') || code.includes('456-2') || code.includes('301-1')) {
      articleKey = code.includes('456-2')
        ? 'ст. 274 УК РК / ст. 456-2 КоАП РК'
        : code.includes('301-1')
        ? 'ст. 301-1 УК РК'
        : 'ст. 190 / 274 УК РК';
      if (entityType === 'individual') {
        minMrp = code.includes('456-2') ? 20 : 200;
        maxMrp = code.includes('456-2') ? 100 : 1000;
      } else if (entityType === 'small') {
        minMrp = code.includes('456-2') ? 50 : 500;
        maxMrp = 2000;
      } else if (entityType === 'medium') {
        minMrp = 100;
        maxMrp = 3000;
      } else {
        minMrp = 250;
        maxMrp = 4000;
      }
    } else if (code.includes('133-1')) {
      articleKey = 'ст. 133-1 КоАП РК';
      if (entityType === 'individual') {
        minMrp = 20;
        maxMrp = 40;
      } else if (entityType === 'small') {
        minMrp = 50;
        maxMrp = 100;
      } else if (entityType === 'medium') {
        minMrp = 100;
        maxMrp = 150;
      } else {
        minMrp = 150;
        maxMrp = 200;
      }
    } else if (code.includes('язык') || code.includes('ст. 21') || code.includes('21-бап')) {
      articleKey = 'ст. 21 Закона о языках';
      if (entityType === 'individual') {
        minMrp = 5;
        maxMrp = 15;
      } else if (entityType === 'small') {
        minMrp = 10;
        maxMrp = 25;
      } else if (entityType === 'medium') {
        minMrp = 25;
        maxMrp = 35;
      } else {
        minMrp = 35;
        maxMrp = 50;
      }
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

/**
 * Single authoritative normalizer for any AuditCase:
 * Enforces strict mathematical consistency across riskScore, legalScore, ethicsScore, riskLevel, status, and violations.
 */
export function normalizeAuditCaseCompliance(auditCase: AuditCase): AuditCase {
  const normalizedViolations = (auditCase.violations || []).map(normalizeViolation);
  const legalList = normalizedViolations.filter((v) => isLegalViolation(v));
  const ethicsOnlyList = normalizedViolations.filter((v) => !isLegalViolation(v));
  const hasAnyEthicsImpact = normalizedViolations.some((v) => isEthicsViolation(v));

  let riskScore = Number.isFinite(auditCase.riskScore) ? Math.round(auditCase.riskScore) : 0;
  let status: AuditCase['status'] = auditCase.status || 'БЕЗОПАСНО';
  let riskLevel: AuditCase['riskLevel'] = auditCase.riskLevel || 'Низкий';
  let legalScore = typeof auditCase.legalScore === 'number' && Number.isFinite(auditCase.legalScore) ? Math.round(auditCase.legalScore) : 0;
  let ethicsScore = typeof auditCase.ethicsScore === 'number' && Number.isFinite(auditCase.ethicsScore) ? Math.round(auditCase.ethicsScore) : 0;

  if (legalList.length > 0) {
    const hasCriticalLegal = legalList.some((v) => isCriticalLegalViolation(v));
    if (hasCriticalLegal) {
      // Rule 1a: Critical statutory violations -> strictly 70..100, status ТРЕБУЕТ МЕР
      const baseFloor = legalList.some((v) => /445-1|190|274/.test((v.code || '').toLowerCase())) ? 88 : 76;
      riskScore = Math.max(70, Math.min(100, Math.max(riskScore, baseFloor)));
      status = 'ТРЕБУЕТ МЕР';
      riskLevel = riskScore >= 75 ? 'Критический' : 'Высокий';
    } else {
      // Rule 1b: Legal warning violations (e.g. ст. 21 Закона о языках) -> strictly 45..69, status ПРЕДУПРЕЖДЕНИЕ
      riskScore = Math.max(45, Math.min(69, riskScore >= 45 ? riskScore : 52 + Math.min(15, (legalList.length - 1) * 7)));
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

  const normalizedMediaAnalysis = auditCase.mediaAnalysis
    ? {
        ...auditCase.mediaAnalysis,
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

  return {
    ...auditCase,
    violations: normalizedViolations,
    riskScore,
    legalScore,
    ethicsScore,
    riskLevel,
    status,
    ...(normalizedMediaAnalysis ? { mediaAnalysis: normalizedMediaAnalysis } : {}),
  };
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
      riskScore = Math.min(69, 48 + (legalTriggers.length - 1) * 7);
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
  /скидк|распродаж|акция|промокод|купить|заказать|цена|курс|инвестиц|тариф|доставка|открывайте\s+счет|счета\s+в\s+тенге|оформляй|кредит|депозит|кэшбэк|кешбэк|рассрочк|подключай|бронируй|бесплатный\s+выпуск|заказывайте|оставьте\s+заявку|подробнее\s+на\s+сайте/i;
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

export function detectPersonalDataDoxing(rawText: string): {
  detected: boolean;
  matches: string[];
} {
  if (!rawText) return { detected: false, matches: [] };
  const matches: string[] = [];
  const phoneMatch = rawText.match(PERSONAL_PHONE_REGEX);
  const iinMatch = rawText.match(IIN_REGEX);
  const addrMatch = rawText.match(ADDRESS_LEAK_REGEX);
  const hasDoxingContext = DOXING_CONTEXT_REGEX.test(rawText) || Boolean(iinMatch && phoneMatch) || Boolean(addrMatch);

  if (hasDoxingContext) {
    if (phoneMatch) matches.push(phoneMatch[0]);
    if (iinMatch) matches.push(`ИИН ${iinMatch[0]}`);
    if (addrMatch) matches.push(addrMatch[0]);
  }
  return { detected: matches.length > 0, matches };
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

  const violationsText =
    auditCase.violations.length > 0
      ? auditCase.violations
          .map((v, idx) => {
            const cardDisp = getCompliancePenaltyDisplay([v], entityType, lang);
            const cardPenaltyText =
              cardDisp.mode === 'legal_fine'
                ? `${cardDisp.mrpRangeText} (${cardDisp.kztRangeText})`
                : cardDisp.headline;
            if (lang === 'kz') {
              return `${idx + 1}. [${v.code}] ${v.title}${v.quote ? ` — үзінді: «${v.quote}»` : ''}. Санкция бағасы: ${cardPenaltyText}.`;
            }
            return `${idx + 1}. [${v.code}] ${v.title}${v.quote ? ` — фрагмент: «${v.quote}»` : ''}. Риск: ${cardPenaltyText}.`;
          })
          .join('\n')
      : lang === 'kz'
      ? 'ҚР қолданыстағы заңнама нормаларын бұзушылықтар анықталған жоқ.'
      : 'Нарушений действующих норм законодательства РК не зафиксировано.';

  if (docType === 'eotinish') {
    if (lang === 'kz') {
      return `ҚАЗАҚСТАН РЕСПУБЛИКАСЫНЫҢ УӘКІЛЕТТІ ОРГАНЫНА
(ҚР Мәдениет және ақпарат министрлігі / ҚМА / ІІМ, eOtinish порталы арқылы)

ӨТІНІШ (КОМПЛАЕНС-ХАТТАМА НЕГІЗІНДЕ)
Тіркеу нөмірі: ${ref}
Күні мен уақыты: ${dateStr}
Дәлелдеменің цифрлық ізбегі (SHA-256): ${hash}

1. ТЕКСЕРІЛГЕН НЫСАН:
Атауы / Көзі: ${auditCase.title} (${auditCase.sourceName})
Тәуекел индексі: ${auditCase.riskScore}% (${auditCase.riskLevel})
Жиынтық санкция бағасы: ${overallPenaltyLine}

2. АНЫҚТАЛҒАН ҚҰҚЫҚ БҰЗУШЫЛЫҚ БЕЛГІЛЕРІ:
${violationsText}

3. ТАЛАП ЕТЕМІН:
Қазақстан Республикасының «Онлайн-платформалар және онлайн-жарнама туралы» № 230-VII Заңына және ҚР ӘҚБтК нормаларына сәйкес тексеру жүргізіп, заңсыз контентті бұғаттау немесе әкімшілік шара қолдануыңызды сұраймын.

Қосымша: Цифрлық сараптама есебі (${ref}), скриншоттар / стенограмма.
Дайындалды: Check Activity KZ Compliance Engine`;
    }

    return `В УПОЛНОМОЧЕННЫЙ ГОСУДАРСТВЕННЫЙ ОРГАН РК
(${recipientOrOrg || 'Министерство культуры и информации РК / АФМ РК / МВД РК — формат eOtinish'})

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

3. ПРОСИТЕЛЬНАЯ ЧАСТЬ:
На основании Закона РК от 10.07.2023 № 230-VII «Об онлайн-платформах и онлайн-рекламе» и норм КоАП РК прошу провести проверку указанного информационного материала и принять предусмотренные законом меры реагирования (вынесение предписания об удалении / блокировке либо привлечение к административной ответственности).

Приложение: Экспертный отчет Check Activity KZ (${ref}), фиксация текста/кадров.
Сформировано автоматически: Check Activity KZ Compliance Engine`;
  }

  // Pretension / notice to blogger or contractor
  if (lang === 'kz') {
    return `СОТҚА ДЕЙІНГІ ЕСКЕРТУ ЖӘНЕ КОМПЛАЕНС-НҰСҚАМА
Құжат № ${ref} | Күні: ${dateStr}
Алушы: ${recipientOrOrg || auditCase.sourceName}

«Check Activity KZ» жүйесінің тексеру нәтижесі бойынша сіздің жарияланымыңызда (${auditCase.title}) ҚР заңнамасы мен цифрлық этика нормаларына сәйкессіздік анықталды:

${violationsText}

Есептік санкция тәуекелі: ${overallPenaltyLine}.

ТАЛАП:
24 сағат ішінде бұзушылықты жоюыңызды сұраймыз:
• Міндетті «Жарнама / Реклама» таңбасын және жарнама берушінің БИН/ЖСН деректерін қосыңыз (№ 230-VII Заң);
• Бейәдеп сөздерді, тыйым салынған сілтемелерді және манипулятивті уәделерді алып тастаңыз;
• ҚР «Тілдер туралы» Заңының 21-бабына сәйкес қазақша нұсқасын қамтамасыз етіңіз.

Тәуекелді қайта тексеру референсі: ${ref}`;
  }

  return `ДОСУДЕБНОЕ УВЕДОМЛЕНИЕ / ПРЕДПИСАНИЕ ОБ УСТРАНЕНИИ НАРУШЕНИЙ
Документ № ${ref} | Дата: ${dateStr}
Адресат: ${recipientOrOrg || auditCase.sourceName}

По результатам комплаенс-аудита публикации «${auditCase.title}» зафиксированы несоответствия нормам законодательства Республики Казахстан и стандартам цифровой этики:

${violationsText}

Расчётный риск санкций: ${overallPenaltyLine}.

ТРЕБОВАНИЕ:
В течение 24 часов с момента получения настоящего уведомления необходимо:
1. Устранить выявленные нарушения и удалить запрещенные формулировки / ссылки.
2. При коммерческом характере контента нанести маркировку «Жарнама / Реклама» и указать ИИН/БИН рекламодателя (Закон РК № 230-VII, ст. 455 КоАП РК).
3. Привести рекламные материалы в соответствие со ст. 21 Закона РК «О языках в Республике Казахстан».

В противном случае материалы с цифровой фиксацией SHA-256 (${hash}) могут быть направлены в уполномоченные органы РК.
Сформировано: Check Activity KZ`;
}
