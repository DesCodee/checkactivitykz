/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Generates realistic canvas screenshots for immediate testing of OCR functionality
export function generateSampleScreenshot(
  type: 'profanity_chat' | 'casino_banner' | 'unmarked_ad'
): { dataUrl: string; fileName: string; fileSize: string } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', fileName: 'screenshot.png', fileSize: '150 KB' };
  }

  if (type === 'profanity_chat') {
    canvas.width = 720;
    canvas.height = 540;

    // Telegram chat background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Chat Header
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvas.width, 70);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('Чат «Алматы Базар / Авторазбор»', 30, 42);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText('1 420 участников • 14:32', 30, 62);

    // Message 1 (Incoming)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(30, 110, 520, 110, 14);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('@kanat_almaty', 50, 138);
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '16px sans-serif';
    ctx.fillText('Ты че бля совсем тупой? Пошел нахуй отсюда,', 50, 168);
    ctx.fillText('урод конченый, еще раз напишешь — найдем!', 50, 195);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText('14:30', 500, 205);

    // Message 2 (Outgoing)
    ctx.fillStyle = '#0284c7';
    ctx.beginPath();
    ctx.roundRect(170, 250, 520, 110, 14);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = '16px sans-serif';
    ctx.fillText('Сам заткнись, пидор, я тебя не боюсь!', 190, 290);
    ctx.fillText('За базар ответишь, шешеңді сиктир!', 190, 318);
    ctx.fillStyle = '#bae6fd';
    ctx.font = '12px sans-serif';
    ctx.fillText('14:31 ✓✓', 635, 345);

    // Message 3 (Incoming)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.roundRect(30, 390, 480, 80, 14);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '16px sans-serif';
    ctx.fillText('Скинь свой номер телефона, сука.', 50, 435);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.fillText('14:32', 460, 455);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      fileName: 'screenshot_telegram_chat_profanity.png',
      fileSize: '240 KB',
    };
  }

  if (type === 'casino_banner') {
    canvas.width = 720;
    canvas.height = 480;

    // Dark sleek casino background
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gold accent frame
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

    // Header badge
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(40, 40, 240, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('★ ОНЛАЙН КАЗИНО KZ ★', 55, 66);

    // Big Promo text
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('1WIN KZ: 500% БОНУС!', 40, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = '22px sans-serif';
    ctx.fillText('Крути слоты и забирай джекпот в тенге ₸', 40, 185);
    ctx.fillText('Вывод на карты Kaspi и Halyk за 5 минут!', 40, 225);

    // Code badge
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(40, 260, 400, 60, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('ПРОМОКОД: ALMATY_SLOTS', 60, 298);

    // CTA Button
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.roundRect(40, 350, 320, 60, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('ИГРАТЬ ПРЯМО СЕЙЧАС ➔', 60, 388);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      fileName: 'screenshot_casino_1win_promo.png',
      fileSize: '290 KB',
    };
  }

  // unmarked_ad
  canvas.width = 720;
  canvas.height = 480;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('🔥 ГРАНДИОЗНАЯ РАСПРОДАЖА В АСТАНЕ!', 40, 90);

  ctx.fillStyle = '#e11d48';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('СКИДКИ ДО 50% НА ВСЕ СМАРТФОНЫ И НОУТБУКИ', 40, 140);

  ctx.fillStyle = '#334155';
  ctx.font = '18px sans-serif';
  ctx.fillText('Только до конца недели! Оплата в рассрочку 0-0-12.', 40, 190);
  ctx.fillText('Заказывай онлайн с бесплатной доставкой по РК:', 40, 225);

  ctx.fillStyle = '#0284c7';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('https://astana-store-sale.kz/promo', 40, 270);

  ctx.fillStyle = '#475569';
  ctx.font = '15px sans-serif';
  ctx.fillText('Телефон отдела продаж: +7 7172 90-80-70', 40, 320);

  ctx.fillStyle = '#dc2626';
  ctx.font = 'italic 14px sans-serif';
  ctx.fillText('(Маркировка «Жарнама» и данные рекламодателя БИН отсутствуют)', 40, 420);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    fileName: 'screenshot_unmarked_advertisement.png',
    fileSize: '195 KB',
  };
}
