/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Violation } from '../types/index';

export interface RiskCategoryItem {
  id: 'cyberbullying' | 'privacy' | 'hidden_ad' | 'casino' | 'dark_pattern' | 'other' | 'clean';
  name: string;
  shortName: string;
  article: string;
  count: number;
  weight: number;
  percentage: number;
  color: string;
  lightColor: string;
  borderColor: string;
  icon: string;
  description: string;
  fineRange: string;
  jurisdiction: string;
  status: 'detected' | 'clear';
}

export interface ChartDatum {
  id: string;
  name: string;
  shortName: string;
  value: number; // Percentage (e.g. 35)
  count: number; // Number of violations
  weight: number;
  color: string;
  article: string;
}

export function calculateRiskDistribution(violations: Violation[] = []): {
  coreCategories: RiskCategoryItem[];
  activeChartData: ChartDatum[];
  dominantRisk: RiskCategoryItem | null;
  totalViolations: number;
  totalWeight: number;
  isClean: boolean;
} {
  const isClean = violations.length === 0;

  // Base definition of core risk categories (prioritizing user requirements)
  const categoryDefs: Array<{
    id: RiskCategoryItem['id'];
    name: string;
    shortName: string;
    article: string;
    color: string;
    lightColor: string;
    borderColor: string;
    icon: string;
    description: string;
    fineRange: string;
    jurisdiction: string;
    matcher: (v: Violation) => boolean;
  }> = [
    {
      id: 'cyberbullying',
      name: 'Кибербуллинг и оскорбления',
      shortName: 'Кибербуллинг',
      article: 'ст. 73-4, 434 КоАП РК / ст. 131 УК РК',
      color: '#E11D48', // rose-600
      lightColor: '#FFE4E6', // rose-100
      borderColor: '#FDA4AF', // rose-300
      icon: 'sentiment_extremely_dissatisfied',
      description: 'Публичная травля, унижение чести и достоинства, обсценная нецензурная брань и угрозы',
      fineRange: 'Штраф от 5 до 15 МРП (19 660 — 58 980 ₸) либо арест до 15 суток',
      jurisdiction: 'МВД РК / Судебные органы',
      matcher: (v) => {
        const text = `${v.code} ${v.title} ${v.basis} ${v.quote || ''}`.toLowerCase();
        return /73-4|131|434|115|кибербуллинг|буллинг|травл|оскорблен|унижен|маты|ненормативн|обсценн|хулиганств|токсичн|агресс|угроз/i.test(
          text
        );
      },
    },
    {
      id: 'privacy',
      name: 'Нарушение персональных данных (ПДн)',
      shortName: 'Нарушение ПДн',
      article: 'ст. 79 КоАП РК / Закон № 94-V',
      color: '#2563EB', // blue-600
      lightColor: '#DBEAFE', // blue-100
      borderColor: '#93C5FD', // blue-300
      icon: 'lock_person',
      description: 'Незаконная публикация личных сотовых номеров, ИИН, фото удостоверений и геолокации без согласия',
      fineRange: 'Штраф от 30 до 200 МРП (117 960 — 786 400 ₸)',
      jurisdiction: 'МЦРИАП РК (Комитет по информбезопасности)',
      matcher: (v) => {
        const text = `${v.code} ${v.title} ${v.basis} ${v.quote || ''}`.toLowerCase();
        return /79|94-v|персональн|пдн|номер телефон|сотов|иин|паспорт|удостоверен|утечк|слив|конфиденциальн/i.test(
          text
        );
      },
    },
    {
      id: 'hidden_ad',
      name: 'Скрытая и немаркированная реклама',
      shortName: 'Скрытая реклама',
      article: 'Закон № 230-VII / ст. 455 КоАП РК',
      color: '#F59E0B', // amber-500
      lightColor: '#FEF3C7', // amber-100
      borderColor: '#FCD34D', // amber-300
      icon: 'sell',
      description: 'Отсутствие обязательной маркировки «Жарнама», скрытый промоушен без идентификатора рекламодателя (БИН)',
      fineRange: 'Штраф от 50 до 350 МРП (196 600 — 1 376 200 ₸)',
      jurisdiction: 'МКИ РК / Антимонопольный комитет',
      matcher: (v) => {
        const text = `${v.code} ${v.title} ${v.basis} ${v.quote || ''}`.toLowerCase();
        return /230-vii|230|455|маркировк|жарнама|реклам|скрытая реклама|спонсор|бин|инфлюенс|двуязычи|ст\. 21/i.test(
          text
        );
      },
    },
    {
      id: 'casino',
      name: 'Нелегальный гемблинг и казино',
      shortName: 'Казино и ставки',
      article: 'ст. 445-1 КоАП РК',
      color: '#9333EA', // purple-600
      lightColor: '#F3E8FF', // purple-100
      borderColor: '#D8B4FE', // purple-300
      icon: 'casino',
      description: 'Прямая реклама, промокоды, ссылки на интернет-казино, слоты и нелицензированных букмекеров',
      fineRange: 'до 1 000 МРП (3 932 000 ₸) + блокировка ресурса',
      jurisdiction: 'АФМ РК / МКИ РК',
      matcher: (v) => {
        const text = `${v.code} ${v.title} ${v.basis} ${v.quote || ''}`.toLowerCase();
        return /445-1|казино|casino|1win|1xbet|слот|букмекер|ставк|рулетк|фриспин|азартн/i.test(
          text
        );
      },
    },
    {
      id: 'dark_pattern',
      name: 'Манипулятивный маркетинг (Dark Patterns)',
      shortName: 'Dark Patterns',
      article: 'Кодекс цифровой этики РК',
      color: '#06B6D4', // cyan-500
      lightColor: '#CFFAFE', // cyan-100
      borderColor: '#67E8F9', // cyan-300
      icon: 'timer',
      description: 'Ложные таймеры сгорания цены, искусственный дефицит мест, навязанный FOMO и обещания 100% дохода',
      fineRange: 'Репутационный ущерб / Исключение из ассоциаций',
      jurisdiction: 'Комиссия по интернет-этике и медиа',
      matcher: (v) => {
        const text = `${v.code} ${v.title} ${v.basis} ${v.quote || ''}`.toLowerCase();
        return /dark pattern|манипуляц|fomo|дефицит|таймер|гарантир|обман|ложный|давлен/i.test(
          text
        );
      },
    },
  ];

  if (isClean) {
    const cleanCategories: RiskCategoryItem[] = categoryDefs.map((def) => ({
      ...def,
      count: 0,
      weight: 0,
      percentage: 0,
      status: 'clear',
    }));

    return {
      coreCategories: cleanCategories,
      activeChartData: [
        {
          id: 'clean',
          name: 'Соответствие нормам РК и этике',
          shortName: '100% Чисто',
          value: 100,
          count: 0,
          weight: 0,
          color: '#10B981', // emerald-500
          article: 'КоАП РК / Закон № 230-VII',
        },
      ],
      dominantRisk: null,
      totalViolations: 0,
      totalWeight: 0,
      isClean: true,
    };
  }

  // Weight assignment based on violation severity
  const getSeverityWeight = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 3;
      case 'warning':
        return 2;
      case 'info':
      default:
        return 1;
    }
  };

  // Group violations into categories
  const matchedViolationsSet = new Set<string>();
  const categoryStats = categoryDefs.map((def) => {
    const matched = violations.filter((v) => {
      const isMatch = def.matcher(v);
      if (isMatch) matchedViolationsSet.add(v.id || v.title);
      return isMatch;
    });

    const weight = matched.reduce((sum, v) => sum + getSeverityWeight(v.severity), 0);

    return {
      def,
      count: matched.length,
      weight,
      violations: matched,
    };
  });

  // Check for any unmapped violations to put into 'other'
  const unmatched = violations.filter((v) => !matchedViolationsSet.has(v.id || v.title));
  let otherWeight = 0;
  if (unmatched.length > 0) {
    otherWeight = unmatched.reduce((sum, v) => sum + getSeverityWeight(v.severity), 0);
  }

  const totalWeight =
    categoryStats.reduce((sum, c) => sum + c.weight, 0) + otherWeight || 1;

  // Compute percentages
  let remainingPct = 100;
  const activeItems: ChartDatum[] = [];

  const coreCategories: RiskCategoryItem[] = categoryStats.map((item) => {
    const pct = item.weight > 0 ? Math.round((item.weight / totalWeight) * 100) : 0;
    const riskItem: RiskCategoryItem = {
      ...item.def,
      count: item.count,
      weight: item.weight,
      percentage: pct,
      status: item.count > 0 ? 'detected' : 'clear',
    };

    if (item.count > 0 && pct > 0) {
      activeItems.push({
        id: item.def.id,
        name: item.def.name,
        shortName: item.def.shortName,
        value: pct,
        count: item.count,
        weight: item.weight,
        color: item.def.color,
        article: item.def.article,
      });
      remainingPct -= pct;
    }

    return riskItem;
  });

  // Include "other" category if any unmatched violations exist
  if (unmatched.length > 0) {
    const otherPct = Math.round((otherWeight / totalWeight) * 100);
    const otherItem: RiskCategoryItem = {
      id: 'other',
      name: 'Прочие несоответствия КоАП РК',
      shortName: 'Прочие риски',
      article: 'КоАП РК / Закон РК',
      count: unmatched.length,
      weight: otherWeight,
      percentage: otherPct,
      color: '#64748B', // slate-500
      lightColor: '#F1F5F9',
      borderColor: '#CBD5E1',
      icon: 'report_problem',
      description: 'Дополнительные замечания по законодательству и регламентам',
      fineRange: 'В соответствии со статьей КоАП',
      jurisdiction: 'Государственные органы РК',
      status: 'detected',
    };
    coreCategories.push(otherItem);

    if (otherPct > 0) {
      activeItems.push({
        id: 'other',
        name: otherItem.name,
        shortName: otherItem.shortName,
        value: otherPct,
        count: unmatched.length,
        weight: otherWeight,
        color: otherItem.color,
        article: otherItem.article,
      });
      remainingPct -= otherPct;
    }
  }

  // Adjust rounding discrepancy to guarantee exact 100% sum
  if (activeItems.length > 0 && remainingPct !== 0) {
    activeItems[0].value += remainingPct;
    const targetCore = coreCategories.find((c) => c.id === activeItems[0].id);
    if (targetCore) {
      targetCore.percentage = activeItems[0].value;
    }
  }

  // Determine dominant risk category
  const dominant = [...coreCategories]
    .filter((c) => c.count > 0)
    .sort((a, b) => b.weight - a.weight || b.count - a.count)[0] || null;

  return {
    coreCategories,
    activeChartData: activeItems,
    dominantRisk: dominant,
    totalViolations: violations.length,
    totalWeight,
    isClean: false,
  };
}
