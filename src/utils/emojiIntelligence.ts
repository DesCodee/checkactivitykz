/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { EmojiAnalysis, EmojiItem } from '../types';

export const EMOJI_DICTIONARY: Record<
  string,
  {
    category: EmojiItem['category'];
    label: string;
    description: string;
    riskLevel: EmojiItem['riskLevel'];
    riskPoints: number;
  }
> = {
  // Gambling & Casino (ст. 445-1 КоАП РК)
  '🎰': {
    category: 'gambling',
    label: 'Игровые автоматы / Слоты',
    description: 'Прямой визуальный маркер слотов и онлайн-казино (ст. 445-1 КоАП РК)',
    riskLevel: 'critical',
    riskPoints: 35,
  },
  '🎲': {
    category: 'gambling',
    label: 'Кости / Азартные игры',
    description: 'Символ ставок и азартных пари',
    riskLevel: 'warning',
    riskPoints: 20,
  },
  '🃏': {
    category: 'gambling',
    label: 'Карты / Джокер',
    description: 'Карточные азартные игры и покерные румы',
    riskLevel: 'warning',
    riskPoints: 15,
  },
  '💸': {
    category: 'gambling',
    label: 'Легкие деньги / Вывод средств',
    description: 'Приманка легкого заработка и выигрышей на карты',
    riskLevel: 'warning',
    riskPoints: 20,
  },
  '🤑': {
    category: 'gambling',
    label: 'Жажда наживы',
    description: 'Манипуляция быстрыми деньгами и бонусами',
    riskLevel: 'warning',
    riskPoints: 15,
  },
  '💰': {
    category: 'gambling',
    label: 'Мешок денег',
    description: 'Используется капперами для обещаний сверхприбыли',
    riskLevel: 'warning',
    riskPoints: 15,
  },
  '💎': {
    category: 'gambling',
    label: 'Крипто-гэмблинг / Алмазы',
    description: 'Маркер криптовалютных казино и краш-игр (Aviator/LuckyJet)',
    riskLevel: 'warning',
    riskPoints: 15,
  },

  // Insults & Cyberbullying (ст. 434, ст. 73-4 КоАП РК)
  '💩': {
    category: 'profanity_insult',
    label: 'Унижение / Фекалии',
    description: 'Оскорбление чести и достоинства пользователя (ст. 73-4 КоАП РК)',
    riskLevel: 'critical',
    riskPoints: 25,
  },
  '🖕': {
    category: 'profanity_insult',
    label: 'Неприличный жест (Факт хулиганства)',
    description: 'Грубый непристойный жест, квалифицируется как мелкое хулиганство (ст. 434 КоАП РК)',
    riskLevel: 'critical',
    riskPoints: 35,
  },
  '🤡': {
    category: 'profanity_insult',
    label: 'Клоун / Публичный шейминг',
    description: 'Широко используется в сетевой травле для дегуманизации оппонента',
    riskLevel: 'warning',
    riskPoints: 20,
  },
  '🤮': {
    category: 'profanity_insult',
    label: 'Отвращение / Шейминг',
    description: 'Выражение ненависти и травли в комментариях',
    riskLevel: 'warning',
    riskPoints: 20,
  },
  '🤬': {
    category: 'profanity_insult',
    label: 'Мат / Ненормативная брань',
    description: 'Символическая замена обсценной лексики (ст. 434 КоАП РК)',
    riskLevel: 'critical',
    riskPoints: 30,
  },
  '🐖': {
    category: 'profanity_insult',
    label: 'Бодишейминг / Оскорбление',
    description: 'Оскорбление внешности и физических данных в переписке',
    riskLevel: 'critical',
    riskPoints: 25,
  },
  '🐀': {
    category: 'profanity_insult',
    label: 'Крыса / Травля',
    description: 'Оскорбительный ярлык в публичном чате',
    riskLevel: 'warning',
    riskPoints: 20,
  },
  '💀': {
    category: 'profanity_insult',
    label: 'Угроза расправой / Травля',
    description: 'Контекстная угроза жизни или здоровью (ст. 115 УК РК)',
    riskLevel: 'warning',
    riskPoints: 15,
  },

  // Dark Patterns & FOMO (Этика)
  '🚨': {
    category: 'dark_pattern',
    label: 'Тревога / Искусственная паника',
    description: 'Психологическое давление и навязывание срочности (FOMO)',
    riskLevel: 'warning',
    riskPoints: 20,
  },
  '⚠️': {
    category: 'dark_pattern',
    label: 'Предупреждение о дефиците',
    description: 'Ложный дефицит мест или времени действия предложения',
    riskLevel: 'info',
    riskPoints: 10,
  },
  '⏰': {
    category: 'dark_pattern',
    label: 'Таймер сгорания скидки',
    description: 'Искусственное ограничение времени на раздумья',
    riskLevel: 'warning',
    riskPoints: 15,
  },
  '⏳': {
    category: 'dark_pattern',
    label: 'Песочные часы / Истекающее время',
    description: 'Стимулирование импульсивных неосознанных покупок',
    riskLevel: 'info',
    riskPoints: 10,
  },

  // Sexual & Inappropriate (ст. 133-1 КоАП РК)
  '🍆': {
    category: 'sexual',
    label: 'Фаллический символ / Домогательства',
    description: 'Неприемлемый сексуализированный подтекст в переписке',
    riskLevel: 'critical',
    riskPoints: 30,
  },
  '🍑': {
    category: 'sexual',
    label: 'Эротический контекст',
    description: 'Сексуализация контента без возрастного ценза 18+',
    riskLevel: 'warning',
    riskPoints: 20,
  },
  '🔞': {
    category: 'sexual',
    label: 'Возрастное ограничение 18+',
    description: 'Маркер взрослого или ограниченного к показу контента',
    riskLevel: 'warning',
    riskPoints: 15,
  },
};

/**
 * Universal Emoji Extractor & Semantic Analyzer
 */
export function analyzeEmojis(text: string): EmojiAnalysis {
  if (!text) {
    return {
      detectedEmojis: [],
      flaggedEmojis: [],
      summary: 'Эмодзи в контенте не обнаружены.',
      totalRiskPoints: 0,
    };
  }

  // Regex matching all emoji unicode ranges
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
  const matches = text.match(emojiRegex) || [];

  // Deduplicate detected emojis while preserving order
  const detectedEmojis = Array.from(new Set(matches));

  const flaggedEmojis: EmojiItem[] = [];
  let totalRiskPoints = 0;

  for (const emoji of detectedEmojis) {
    const info = EMOJI_DICTIONARY[emoji];
    if (info) {
      flaggedEmojis.push({
        emoji,
        category: info.category,
        label: info.label,
        description: info.description,
        riskLevel: info.riskLevel,
      });
      totalRiskPoints += info.riskPoints;
    }
  }

  // Check for repeated spam emojis (e.g. 🚀🚀🚀 or 💸💸💸)
  const spamRegex = /((\p{Emoji_Presentation}|\p{Extended_Pictographic})\2{2,})/gu;
  const spamMatches = text.match(spamRegex);
  if (spamMatches && spamMatches.length > 0) {
    totalRiskPoints += 15;
  }

  let summary = 'Эмодзи соответствуют нейтральному тону общения.';
  if (flaggedEmojis.length > 0) {
    const hasGambling = flaggedEmojis.some((e) => e.category === 'gambling');
    const hasBullying = flaggedEmojis.some((e) => e.category === 'profanity_insult');
    const hasDarkPattern = flaggedEmojis.some((e) => e.category === 'dark_pattern');
    const hasSexual = flaggedEmojis.some((e) => e.category === 'sexual');

    const issues: string[] = [];
    if (hasGambling) issues.push('маркеры азартных игр и слотов (ст. 445-1 КоАП РК)');
    if (hasBullying) issues.push('оскорбительные символы и кибербуллинг (ст. 434, 73-4 КоАП РК)');
    if (hasDarkPattern) issues.push('манипулятивные паттерны срочности и FOMO');
    if (hasSexual) issues.push('сексуализированный контекст (18+)');

    summary = `Обнаружены скрытые триггеры в эмодзи (${flaggedEmojis.map((e) => e.emoji).join(' ')}): ${issues.join(', ')}.`;
  }

  return {
    detectedEmojis,
    flaggedEmojis,
    summary,
    totalRiskPoints: Math.min(totalRiskPoints, 100),
  };
}
