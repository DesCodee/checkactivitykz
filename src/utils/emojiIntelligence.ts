/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { EmojiAnalysis, EmojiItem } from '../types/index.ts';

export const MONEY_EMOJIS = ['💰', '💵', '💸', '💴', '💶', '💷', '🪙', '🤑'] as const;
const MONEY_EMOJI_SET = new Set<string>(MONEY_EMOJIS);

const MONEY_SCAM_MARKERS_REGEX =
  /л[её]гк[а-яё]*\s+заработ|раскрутк|доход[а-яё]*\s+от.{0,24}в\s+день|перев[а-яё]*\s+на\s+карт|привяж[а-яё]*\s+карт|без\s+вложени|бонус|пассивн[а-яё]*\s+доход|удвоим|быстр[а-яё]*\s+деньг/i;

const MONEY_GAMBLING_MARKERS_REGEX =
  /казино|casino|ставк[аиуе]|слот|рулетк|фриспин|1win|1xbet|pin-up|mostbet|джекпот|jackpot|выигрыш|каппер|букмекер/i;

const MONEY_SPAM_CLUSTER_REGEX =
  /(?:💰|💵|💸|💴|💶|💷|🪙|🤑)(?:\s*(?:💰|💵|💸|💴|💶|💷|🪙|🤑)){2,}/u;

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
  '💎': {
    category: 'gambling',
    label: 'Крипто-гэмблинг / Алмазы',
    description: 'Маркер криптовалютных казино и краш-игр (Aviator/LuckyJet)',
    riskLevel: 'warning',
    riskPoints: 15,
  },

  // Money & Finance (нейтральные в обычном контексте; триггер только при спаме 3+ или скам/гэмблинг-словах)
  '💰': {
    category: 'neutral',
    label: 'Деньги / Финансы',
    description: 'Нейтральный декоративный эмодзи финансов, зарплаты или бюджета в обычном контексте',
    riskLevel: 'info',
    riskPoints: 0,
  },
  '💵': {
    category: 'neutral',
    label: 'Банкноты / Оплата',
    description: 'Нейтральный символ денег или покупки при отсутствии признаков мошенничества',
    riskLevel: 'info',
    riskPoints: 0,
  },
  '💸': {
    category: 'neutral',
    label: 'Расходы / Перевод',
    description: 'Декоративный символ трат или бюджета; не является нарушением сам по себе',
    riskLevel: 'info',
    riskPoints: 0,
  },
  '💴': {
    category: 'neutral',
    label: 'Валюта / Финансы',
    description: 'Нейтральный денежный символ',
    riskLevel: 'info',
    riskPoints: 0,
  },
  '💶': {
    category: 'neutral',
    label: 'Валюта / Евро',
    description: 'Нейтральный денежный символ',
    riskLevel: 'info',
    riskPoints: 0,
  },
  '💷': {
    category: 'neutral',
    label: 'Валюта / Фунты',
    description: 'Нейтральный денежный символ',
    riskLevel: 'info',
    riskPoints: 0,
  },
  '🪙': {
    category: 'neutral',
    label: 'Монета / Кешбэк',
    description: 'Нейтральный символ монеты или стоимости',
    riskLevel: 'info',
    riskPoints: 0,
  },
  '🤑': {
    category: 'neutral',
    label: 'Доход / Прибыль',
    description: 'Декоративный эмодзи дохода или выгоды в нейтральном контексте',
    riskLevel: 'info',
    riskPoints: 0,
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

  const hasMoneySpamCluster = MONEY_SPAM_CLUSTER_REGEX.test(text);
  const hasMoneyGamblingContext = MONEY_GAMBLING_MARKERS_REGEX.test(text);
  const hasMoneyScamContext = MONEY_SCAM_MARKERS_REGEX.test(text);
  const isMoneyContextRisky = hasMoneySpamCluster || hasMoneyGamblingContext || hasMoneyScamContext;

  const flaggedEmojis: EmojiItem[] = [];
  let totalRiskPoints = 0;

  for (const emoji of detectedEmojis) {
    if (MONEY_EMOJI_SET.has(emoji)) {
      // Single/occasional money emoji in neutral text is purely decorative (0 pts, not flagged)
      if (!isMoneyContextRisky) {
        continue;
      }
      if (hasMoneyGamblingContext) {
        flaggedEmojis.push({
          emoji,
          category: 'gambling',
          label: 'Денежный маркер в контексте азартных игр',
          description: 'Используется совместно с упоминанием казино, слотов или ставок (ст. 445-1 КоАП РК)',
          riskLevel: 'warning',
        });
        totalRiskPoints += 15;
      } else {
        flaggedEmojis.push({
          emoji,
          category: 'spam',
          label: hasMoneySpamCluster ? 'Спам-повтор денежных эмодзи' : 'Денежная приманка в рекламном/скам-тексте',
          description: hasMoneySpamCluster
            ? 'Серия из 3+ денежных эмодзи подряд (визуальный спам / паттерн наживы)'
            : 'Денежный символ в сочетании с маркерами лёгкого заработка, раскрутки или бонусов',
          riskLevel: 'warning',
        });
        totalRiskPoints += 15;
      }
      continue;
    }

    const info = EMOJI_DICTIONARY[emoji];
    if (info && info.category !== 'neutral' && info.riskPoints > 0) {
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

  // Check for repeated spam emojis (3+ in a row, e.g. 🚀🚀🚀 or 💰💰💰)
  const spamRegex = /((\p{Emoji_Presentation}|\p{Extended_Pictographic})\2{2,})/gu;
  const spamMatches = text.match(spamRegex);
  if (spamMatches && spamMatches.length > 0) {
    totalRiskPoints += 15;
    if (flaggedEmojis.length === 0) {
      const sampleEmoji = Array.from(spamMatches[0])[0] || '⚠️';
      flaggedEmojis.push({
        emoji: sampleEmoji,
        category: 'spam',
        label: 'Повторяющийся спам эмодзи (3+)',
        description: 'Массовое повторение одинаковых эмодзи снижает этическую оценку материала',
        riskLevel: 'warning',
      });
    }
  }

  let summary = 'Эмодзи соответствуют нейтральному тону общения.';
  if (flaggedEmojis.length > 0) {
    const hasGambling = flaggedEmojis.some((e) => e.category === 'gambling');
    const hasBullying = flaggedEmojis.some((e) => e.category === 'profanity_insult');
    const hasDarkPattern = flaggedEmojis.some((e) => e.category === 'dark_pattern');
    const hasSexual = flaggedEmojis.some((e) => e.category === 'sexual');
    const hasSpam = flaggedEmojis.some((e) => e.category === 'spam');

    const issues: string[] = [];
    if (hasGambling) issues.push('маркеры азартных игр и слотов (ст. 445-1 КоАП РК)');
    if (hasBullying) issues.push('оскорбительные символы и кибербуллинг (ст. 434, 73-4 КоАП РК)');
    if (hasDarkPattern) issues.push('манипулятивные паттерны срочности и FOMO');
    if (hasSexual) issues.push('сексуализированный контекст (18+)');
    if (hasSpam) issues.push('спам-повтор или агрессивные денежные триггеры');

    summary = `Обнаружены триггеры в эмодзи (${flaggedEmojis.map((e) => e.emoji).join(' ')}): ${issues.join(', ')}.`;
  } else if (detectedEmojis.some((e) => MONEY_EMOJI_SET.has(e))) {
    summary = 'Обнаружены нейтральные денежные эмодзи без признаков мошенничества или азартных игр.';
  }

  return {
    detectedEmojis,
    flaggedEmojis,
    summary,
    totalRiskPoints: Math.min(totalRiskPoints, 100),
  };
}
