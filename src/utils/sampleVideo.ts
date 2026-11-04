/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SampleVideoPreset {
  id: string;
  title: string;
  category: 'casino' | 'unmarked_ad' | 'profanity' | 'clean';
  platform: 'instagram' | 'tiktok' | 'youtube';
  fileName: string;
  duration: string;
  resolution: string;
  fps: number;
  author: string;
  caption: string;
  emojis: string[];
  frames: string[]; // Base64 data URLs
  hasViolation: boolean;
  violationCode?: string;
  violationTitle?: string;
  fineRisk?: string;
}

/**
 * Generate a synthetic canvas frame for video simulation
 */
function generateVideoFrameSvg(
  theme: 'casino' | 'ad' | 'profanity' | 'clean',
  timecode: string,
  headline: string,
  author: string
): string {
  const bgColors = {
    casino: '#180B26',
    ad: '#0D2137',
    profanity: '#2D0F14',
    clean: '#0F291E',
  };

  const accentColors = {
    casino: '#FFD700',
    ad: '#38BDF8',
    profanity: '#F43F5E',
    clean: '#10B981',
  };

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
    <rect width="640" height="360" fill="${bgColors[theme]}"/>
    <!-- Grid overlay -->
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="640" height="360" fill="url(#grid)" />
    
    <!-- Top badge bar -->
    <rect x="24" y="24" width="180" height="28" rx="6" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.15)"/>
    <text x="36" y="42" fill="#E2E8F0" font-family="monospace" font-size="12" font-weight="bold">VIDEO REC • ${timecode}</text>

    <!-- Author tag -->
    <text x="24" y="90" fill="${accentColors[theme]}" font-family="sans-serif" font-size="16" font-weight="bold">${author}</text>
    
    <!-- Big Headline / Content -->
    <text x="24" y="140" fill="#FFFFFF" font-family="sans-serif" font-size="22" font-weight="900">${headline}</text>

    <!-- Subtitle / Visual banner -->
    <rect x="24" y="200" width="592" height="70" rx="8" fill="rgba(0,0,0,0.4)" stroke="${accentColors[theme]}" stroke-dasharray="4 4"/>
    <text x="40" y="235" fill="#F8FAFC" font-family="sans-serif" font-size="14" font-weight="bold">Кадр захвачен видеоанализатором Check Activity Video AI</text>
    <text x="40" y="255" fill="#94A3B8" font-family="monospace" font-size="11">Детекция: Речь • Текст в кадре • Субтитры • Эмодзи • Аудиодорожка</text>

    <!-- Player HUD bottom -->
    <rect x="0" y="320" width="640" height="40" fill="rgba(0,0,0,0.7)"/>
    <circle cx="40" cy="340" r="12" fill="${accentColors[theme]}"/>
    <polygon points="36,334 48,340 36,346" fill="#000000"/>
    <line x1="70" y1="340" x2="520" y2="340" stroke="rgba(255,255,255,0.3)" stroke-width="4" stroke-linecap="round"/>
    <circle cx="210" cy="340" r="6" fill="${accentColors[theme]}"/>
    <text x="540" y="344" fill="#E2E8F0" font-family="monospace" font-size="12">${timecode} / 00:20</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_VIDEO_PRESETS: SampleVideoPreset[] = [
  {
    id: 'vid-casino-1win',
    title: 'Reels: Реклама слотов 1Win и зеркало в bio',
    category: 'casino',
    platform: 'instagram',
    fileName: 'capper_reels_slots_1win.mp4',
    duration: '00:15',
    resolution: '1080x1920 (9:16 Vertical)',
    fps: 30,
    author: '@capper_almaty_vip',
    caption: 'Залетайте в игру 🎰💸! Забрал 450к тенге со слота Sweet Bonanza. Ссылка на зеркало 1Win в bio, промокод BONUS500!',
    emojis: ['🎰', '💸', '🤑', '💎'],
    hasViolation: true,
    violationCode: 'ст. 445-1 КоАП РК',
    violationTitle: 'Реклама нелицензированных онлайн-казино и слотов',
    fineRisk: 'до 1 000 МРП (3 932 000 ₸) + блокировка ресурса',
    frames: [
      generateVideoFrameSvg('casino', '00:02', '🎰 ВЫИГРЫШ 450 000 ₸ В СЛОТАХ!', '@capper_almaty_vip'),
      generateVideoFrameSvg('casino', '00:08', '💸 ВЫВОД НА КАРТУ KASPI GOLD', '@capper_almaty_vip'),
      generateVideoFrameSvg('casino', '00:14', 'ПРОМОКОД BONUS500 В BIO', '@capper_almaty_vip'),
    ],
  },
  {
    id: 'vid-unmarked-ad',
    title: 'Stories / Reels: Скрытая реклама без «Жарнама»',
    category: 'unmarked_ad',
    platform: 'instagram',
    fileName: 'influencer_story_promo.mp4',
    duration: '00:22',
    resolution: '1080x1920',
    fps: 30,
    author: '@zheka_fatbelly',
    caption: 'Ребята, часто спрашивали про мой любимый бренд кофе! Держите промокод ZHEKA со скидкой 30% только сегодня 🚨⏰!',
    emojis: ['🚨', '⏰', '🔥'],
    hasViolation: true,
    violationCode: 'Закон № 230-VII / ст. 455 КоАП РК',
    violationTitle: 'Отсутствие обязательной маркировки рекламы («Жарнама»)',
    fineRisk: 'от 50 до 200 МРП (196 600 — 786 400 ₸)',
    frames: [
      generateVideoFrameSvg('ad', '00:03', 'ЛУЧШИЙ КОФЕ АЛМАТЫ СО СКИДКОЙ 30%', '@zheka_fatbelly'),
      generateVideoFrameSvg('ad', '00:11', '🚨 ТОЛЬКО СЕГОДНЯ ПО ПРОМОКОДУ ZHEKA', '@zheka_fatbelly'),
      generateVideoFrameSvg('ad', '00:19', 'ОТСУТСТВУЕТ МАРКИРОВКА «ЖАРНАМА» И БИН', '@zheka_fatbelly'),
    ],
  },
  {
    id: 'vid-profanity',
    title: 'TikTok: Вайны с ненормативной бранью и матами',
    category: 'profanity',
    platform: 'tiktok',
    fileName: 'tiktok_almaty_clash.mp4',
    duration: '00:18',
    resolution: '720x1280',
    fps: 60,
    author: '@almaty_clash_tiktok',
    caption: 'Разборка на парковке 💩🤬: "Ты че бля пошел нахуй, шешеңді сиктир!"',
    emojis: ['💩', '🤬', '🖕'],
    hasViolation: true,
    violationCode: 'ст. 434 КоАП РК',
    violationTitle: 'Мелкое хулиганство: нецензурная брань и маты в публичном доступе',
    fineRisk: '5 МРП (19 660 ₸) либо арест до 15 суток',
    frames: [
      generateVideoFrameSvg('profanity', '00:02', 'РАЗБОРКА НА САЙРАНЕ (18+)', '@almaty_clash_tiktok'),
      generateVideoFrameSvg('profanity', '00:09', 'ОБСЦЕННЫЕ ВЫРАЖЕНИЯ: «БЛЯ», «ШЕШЕҢДІ»', '@almaty_clash_tiktok'),
      generateVideoFrameSvg('profanity', '00:16', 'НАРУШЕНИЕ ОБЩЕСТВЕННОГО ПОРЯДКА В СЕТИ', '@almaty_clash_tiktok'),
    ],
  },
  {
    id: 'vid-clean',
    title: 'Дайджест: Безопасный новостной сюжет',
    category: 'clean',
    platform: 'youtube',
    fileName: 'tengri_news_digest.mp4',
    duration: '00:30',
    resolution: '1920x1080 (16:9)',
    fps: 30,
    author: '@tengrinewskz',
    caption: 'Официальный выпуск новостей: افتتاح новой развязки на Кульджинском тракте и прогноз погоды.',
    emojis: ['🇰🇿', '🚗', '🌦️'],
    hasViolation: false,
    frames: [
      generateVideoFrameSvg('clean', '00:05', 'НОВОСТИ АЛМАТЫ И КАЗАХСТАНА', '@tengrinewskz'),
      generateVideoFrameSvg('clean', '00:15', 'ОТКРЫТИЕ НОВОЙ РАЗВЯЗКИ В ГОРОДЕ', '@tengrinewskz'),
      generateVideoFrameSvg('clean', '00:28', 'ПРАВОВЫХ НАРУШЕНИЙ НЕ ВЫЯВЛЕНО', '@tengrinewskz'),
    ],
  },
];
