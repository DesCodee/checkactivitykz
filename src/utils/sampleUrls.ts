/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SampleUrlPreset {
  id: string;
  title: string;
  url: string;
  platform: 'instagram' | 'telegram' | 'tiktok' | 'youtube' | 'web';
  platformLabel: string;
  category: 'casino' | 'unmarked_ad' | 'profanity' | 'clean';
  previewTitle: string;
  scrapedSnippet: string;
  hasViolation: boolean;
  violationCode?: string;
  violationTitle?: string;
}

export const SAMPLE_URL_PRESETS: SampleUrlPreset[] = [
  {
    id: 'url-1',
    title: 'Instagram Reels: Реклама слотов 1Win у блогера',
    url: 'https://instagram.com/reel/C8x719K_casino_slots_1win',
    platform: 'instagram',
    platformLabel: 'Instagram KZ',
    category: 'casino',
    previewTitle: 'Reels: @capper_almaty_vip • Ссылка на слоты 1Win',
    scrapedSnippet:
      'Описание публикации Instagram: "Забрал 450 000 ₸ в слотах 🎰💸! Ссылка на рабочее зеркало 1Win в bio профиля. Промокод BONUS500 на 500% бонус на Kaspi Gold! #казино #слоты #1win #ставки"',
    hasViolation: true,
    violationCode: 'ст. 445-1 КоАП РК',
    violationTitle: 'Реклама нелицензированных онлайн-казино и азартных игр',
  },
  {
    id: 'url-2',
    title: 'Instagram: Рекламный пост инфлюенсера без маркировки «Жарнама»',
    url: 'https://instagram.com/p/DA_influencer_coffee_promo_kz',
    platform: 'instagram',
    platformLabel: 'Instagram KZ',
    category: 'unmarked_ad',
    previewTitle: 'Пост: @zheka_fatbelly • Промокод со скидкой 30%',
    scrapedSnippet:
      'Описание публикации: "Всем салам! Часто спрашивали про мой любимый бренд кофе. Ловите промокод со скидкой 30% только сегодня 🚨⏰. Заказывайте на сайте по ссылке. (Отметка #жарнама и БИН рекламодателя отсутствуют)"',
    hasViolation: true,
    violationCode: 'Закон № 230-VII / ст. 455 КоАП РК',
    violationTitle: 'Отсутствие обязательной маркировки рекламы («Жарнама»)',
  },
  {
    id: 'url-3',
    title: 'Telegram: Открытый чат с матами и кибербуллингом',
    url: 'https://t.me/almaty_bazar_autochat/48291',
    platform: 'telegram',
    platformLabel: 'Telegram KZ',
    category: 'profanity',
    previewTitle: 'Telegram чат: «Алматы Базар / Авторазбор»',
    scrapedSnippet:
      '@kanat_almaty: "Ты че бля совсем тупой? 💩🖕 Пошел нахуй отсюда, урод, еще раз напишешь — найдем!" @user2: "За базар ответишь, шешеңді сиктир!"',
    hasViolation: true,
    violationCode: 'ст. 434, ст. 73-4 КоАП РК',
    violationTitle: 'Ненормативная лексика и кибербуллинг в публичном чате',
  },
  {
    id: 'url-4',
    title: 'Tengrinews.kz: Официальный новостной материал',
    url: 'https://tengrinews.kz/kazakhstan_news/stroitelstvo-novoy-razvyazki-almaty-539120/',
    platform: 'web',
    platformLabel: 'СМИ Казахстана',
    category: 'clean',
    previewTitle: 'Tengrinews.kz: Строительство новой развязки в Алматы',
    scrapedSnippet:
      'Акимат города Алматы сообщил о завершении дорожных работ на восточном выезде. Официальный пресс-релиз проверен. Признаков правонарушений не обнаружено.',
    hasViolation: false,
  },
];
