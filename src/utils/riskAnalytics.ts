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

export function calculateRiskDistribution(
  rawViolations: Violation[] = [],
  lang: 'ru' | 'kz' = 'ru'
): {
  coreCategories: RiskCategoryItem[];
  activeChartData: ChartDatum[];
  dominantRisk: RiskCategoryItem | null;
  totalViolations: number;
  totalWeight: number;
  isClean: boolean;
} {
  const violations = Array.isArray(rawViolations)
    ? rawViolations.filter((v): v is Violation => Boolean(v && typeof v === 'object'))
    : [];
  const isClean = violations.length === 0;
  const isKz = lang === 'kz';

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
      name: isKz ? 'Кибербуллинг және қорлау' : 'Кибербуллинг и оскорбления',
      shortName: isKz ? 'Кибербуллинг' : 'Кибербуллинг',
      article: isKz ? 'ҚР ӘҚБтК 73-4, 434-бап. / ҚК 131-бап' : 'ст. 73-4, 434 КоАП РК / ст. 131 УК РК',
      color: '#E11D48', // rose-600
      lightColor: '#FFE4E6', // rose-100
      borderColor: '#FDA4AF', // rose-300
      icon: 'sentiment_extremely_dissatisfied',
      description: isKz
        ? 'Көпшілік алдында қудалау, ар-намысы мен қадір-қасиетін қорлау, бейәдеп сөздер мен қоқан-лоқы'
        : 'Публичная травля, унижение чести и достоинства, обсценная нецензурная брань и угрозы',
      fineRange: isKz
        ? '15–100 АЕК айыппұл (64 875 — 432 500 ₸); ҚР ӘҚБтК 434-бап — 20 АЕК (86 500 ₸) немесе 15 тәулікке дейін қамау'
        : 'Штраф от 15 до 100 МРП (64 875 — 432 500 ₸); ст. 434 КоАП РК — 20 МРП (86 500 ₸) либо арест до 15 суток',
      jurisdiction: isKz ? 'ҚР ІІМ / Сот органдары' : 'МВД РК / Судебные органы',
      matcher: (v) => {
        const text = `${v.code || ''} ${v.title || ''} ${v.basis || ''} ${v.quote || ''}`.toLowerCase();
        return /73-4|131|434|115|кибербуллинг|буллинг|травл|оскорблен|унижен|маты|ненормативн|обсценн|хулиганств|токсичн|агресс|угроз/i.test(
          text
        );
      },
    },
    {
      id: 'privacy',
      name: isKz ? 'Дербес деректерді (ДД) бұзу' : 'Нарушение персональных данных (ПДн)',
      shortName: isKz ? 'ДД бұзу' : 'Нарушение ПДн',
      article: isKz ? 'ҚР ӘҚБтК 79-бап / ҚК 147-бап' : 'ст. 79 КоАП РК / ст. 147 УК РК',
      color: '#2563EB', // blue-600
      lightColor: '#DBEAFE', // blue-100
      borderColor: '#93C5FD', // blue-300
      icon: 'lock_person',
      description: isKz
        ? 'Жеке ұялы телефон нөмірлерін, ЖСН, мекенжайларды келісімсіз жариялау және доксинг'
        : 'Незаконная публикация личных сотовых номеров, ИИН, домашних адресов и доксинг без согласия',
      fineRange: isKz ? '30–200 АЕК айыппұл (129 750 — 865 000 ₸)' : 'Штраф от 30 до 200 МРП (129 750 — 865 000 ₸)',
      jurisdiction: isKz ? 'ҚР ЦДИАӨМ / ІІМ' : 'МЦРИАП РК / МВД РК',
      matcher: (v) => {
        const text = `${v.code || ''} ${v.title || ''} ${v.basis || ''} ${v.quote || ''}`.toLowerCase();
        return /79|147|94-v|персональн|пдн|номер телефон|сотов|иин|адрес|доксинг|паспорт|удостоверен|утечк|слив|конфиденциальн/i.test(
          text
        );
      },
    },
    {
      id: 'hidden_ad',
      name: isKz ? 'Жасырын және таңбаланбаған жарнама' : 'Скрытая и немаркированная реклама',
      shortName: isKz ? 'Жасырын жарнама' : 'Скрытая реклама',
      article: isKz ? '№ 230-VII Заң / ҚР ӘҚБтК 455-бап' : 'Закон № 230-VII / ст. 455 КоАП РК',
      color: '#F59E0B', // amber-500
      lightColor: '#FEF3C7', // amber-100
      borderColor: '#FCD34D', // amber-300
      icon: 'sell',
      description: isKz
        ? 'Міндетті «Жарнама» белгісінің болмауы, жарнама берушінің БСН/ЖСН көрсетілмеген жасырын промоушен'
        : 'Отсутствие обязательной маркировки «Жарнама», скрытый промоушен без идентификатора рекламодателя (БИН)',
      fineRange: isKz ? '50–350 АЕК айыппұл (216 250 — 1 513 750 ₸)' : 'Штраф от 50 до 350 МРП (216 250 — 1 513 750 ₸)',
      jurisdiction: isKz ? 'ҚР МАМ / Бәсекелестікті қорғау агенттігі' : 'МКИ РК / Антимонопольный комитет',
      matcher: (v) => {
        const text = `${v.code || ''} ${v.title || ''} ${v.basis || ''} ${v.quote || ''}`.toLowerCase();
        return /230-vii|230|455|маркировк|жарнама|реклам|скрытая реклама|спонсор|бин|инфлюенс|двуязычи|ст\. 21/i.test(
          text
        );
      },
    },
    {
      id: 'casino',
      name: isKz ? 'Заңсыз гэмблинг және казино' : 'Нелегальный гемблинг и казино',
      shortName: isKz ? 'Казино және бәс' : 'Казино и ставки',
      article: isKz ? 'ҚР ӘҚБтК 445-1-бап' : 'ст. 445-1 КоАП РК',
      color: '#9333EA', // purple-600
      lightColor: '#F3E8FF', // purple-100
      borderColor: '#D8B4FE', // purple-300
      icon: 'casino',
      description: isKz
        ? 'Интернет-казино, слоттар және лицензиясы жоқ букмекерлерді тікелей жарнамалау, промокодтар мен сілтемелер'
        : 'Прямая реклама, промокоды, ссылки на интернет-казино, слоты и нелицензированных букмекеров',
      fineRange: isKz ? '1 000 АЕК-ке дейін (4 325 000 ₸) + ресурсты бұғаттау' : 'до 1 000 МРП (4 325 000 ₸) + блокировка ресурса',
      jurisdiction: isKz ? 'ҚР ҚМА / МАМ' : 'АФМ РК / МКИ РК',
      matcher: (v) => {
        const text = `${v.code || ''} ${v.title || ''} ${v.basis || ''} ${v.quote || ''}`.toLowerCase();
        return /445-1|казино|casino|1win|1xbet|слот|букмекер|ставк|рулетк|фриспин|азартн/i.test(
          text
        );
      },
    },
    {
      id: 'dark_pattern',
      name: isKz ? 'Манипулятивті маркетинг (Dark Patterns)' : 'Манипулятивный маркетинг (Dark Patterns)',
      shortName: 'Dark Patterns',
      article: isKz ? 'ҚР Цифрлық этика кодексі' : 'Кодекс цифровой этики РК',
      color: '#06B6D4', // cyan-500
      lightColor: '#CFFAFE', // cyan-100
      borderColor: '#67E8F9', // cyan-300
      icon: 'timer',
      description: isKz
        ? 'Бағаның жалған таймерлері, орындардың жасанды тапшылығы, FOMO қысымы және 100% табыс уәделері'
        : 'Ложные таймеры сгорания цены, искусственный дефицит мест, навязанный FOMO и обещания 100% дохода',
      fineRange: isKz ? 'Беделге нұқсан келуі / Қауымдастықтардан шығару' : 'Репутационный ущерб / Исключение из ассоциаций',
      jurisdiction: isKz ? 'Интернет-этика және медиа жөніндегі комиссия' : 'Комиссия по интернет-этике и медиа',
      matcher: (v) => {
        const text = `${v.code || ''} ${v.title || ''} ${v.basis || ''} ${v.quote || ''}`.toLowerCase();
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
          name: isKz ? 'ҚР нормалары мен этикасына сәйкестік' : 'Соответствие нормам РК и этике',
          shortName: isKz ? '100% Таза' : '100% Чисто',
          value: 100,
          count: 0,
          weight: 0,
          color: '#10B981', // emerald-500
          article: isKz ? 'ҚР ӘҚБтК / № 230-VII Заң' : 'КоАП РК / Закон № 230-VII',
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
      name: isKz ? 'ҚР ӘҚБтК өзге сәйкессіздіктері' : 'Прочие несоответствия КоАП РК',
      shortName: isKz ? 'Өзге тәуекелдер' : 'Прочие риски',
      article: isKz ? 'ҚР ӘҚБтК / ҚР Заңы' : 'КоАП РК / Закон РК',
      count: unmatched.length,
      weight: otherWeight,
      percentage: otherPct,
      color: '#64748B', // slate-500
      lightColor: '#F1F5F9',
      borderColor: '#CBD5E1',
      icon: 'report_problem',
      description: isKz ? 'Заңнама мен регламенттер бойынша қосымша ескертулер' : 'Дополнительные замечания по законодательству и регламентам',
      fineRange: isKz ? 'ӘҚБтК бабына сәйкес' : 'В соответствии со статьей КоАП',
      jurisdiction: isKz ? 'ҚР мемлекеттік органдары' : 'Государственные органы РК',
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
