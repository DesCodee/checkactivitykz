/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type SampleCaseType =
  | 'political_doxing'
  | 'profanity_chat'
  | 'casino_banner'
  | 'unmarked_ad'
  | 'scam_phishing'
  | 'journalism_context';

export function getSampleText(type: SampleCaseType): string {
  if (type === 'political_doxing') {
    return `СРОЧНЫЙ СЛИВ! Депутат/кандидат №3 тайно переписал бюджет района на офшоры и забирает откаты!
Этот мошенник, продажная тварь и предатель города должен ответить.
Личный телефон: +7 701 777-45-90, ИИН 840512300194, адрес: г. Алматы, ул. Тимирязева, д. 42, кв. 18.
Приходите на выборы 15 марта и голосуйте по совести!`;
  }
  if (type === 'profanity_chat') {
    return `Чат «Алматы Базар / Авторазбор» (1 420 участников • 14:32)
@kanat_almaty (14:30): Ты че бля совсем тупой? Пошел нахуй отсюда, урод конченый, еще раз напишешь — найдем!
Вы (14:31): Сам заткнись, пидор, я тебя не боюсь! За базар ответишь, шешеңді сиктир!
@kanat_almaty (14:32): Скинь свой номер телефона, сука.`;
  }
  if (type === 'casino_banner') {
    return `★ 1WIN LUXURY SLOTS ★ 🎰
500% БОНУС + 150 ФРИСПИНОВ!
Крути барабаны и рулетку — JACKPOT $5 000 USD / €4 600
Мгновенный вывод в USDT, $ и на карты 💸
ПРОМОКОД: ALMATY_SPIN · 🔞 21+
КРУТИТЬ БАРАБАНЫ ➔`;
  }
  if (type === 'scam_phishing') {
    return `СРОЧНАЯ ГОСВЫПЛАТА 42 500 ₸ • KASPI PROFIT!
Токаев подписал выплату каждому гражданину РК от фонда КазМунайГаз.
Пассивный доход от 350 000 ₸ в день 100% гарантия без рисков!
Привяжите карту Kaspi на сайте до конца дня:
https://kaspi-bonus-gov.xyz/claim`;
  }
  if (type === 'journalism_context') {
    return `ОСТОРОЖНО, МОШЕННИКИ!
МВД РК и Департамент полиции предупреждают: злоумышленники рекламируют нелегальные казино 1Win и рассылают фейковые ссылки якобы от Kaspi на «выплаты 42 500 ₸».
Не переходите по сомнительным ссылкам и не сообщайте SMS-коды. Официальное информационное предупреждение.`;
  }
  return `🔥 ГРАНДИОЗНАЯ РАСПРОДАЖА В АСТАНЕ!
СКИДКИ ДО 50% НА ВСЕ СМАРТФОНЫ И НОУТБУКИ
Только до конца недели! Оплата в рассрочку 0-0-12.
Заказывай онлайн с бесплатной доставкой по РК:
https://astana-store-sale.kz/promo
Телефон отдела продаж: +7 7172 90-80-70
Успей оформить заказ по акции уже сегодня!`;
}

// Generates realistic canvas screenshots for immediate testing of OCR functionality
export function generateSampleScreenshot(
  type: SampleCaseType
): { dataUrl: string; fileName: string; fileSize: string } {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', fileName: 'screenshot.png', fileSize: '150 KB' };
  }

  if (type === 'political_doxing') {
    canvas.width = 720;
    canvas.height = 520;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Top bar
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, canvas.width, 64);
    ctx.fillStyle = '#f43f5e';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('TELEGRAM КАНАЛ · АНОНИМНЫЙ ВБРОС', 28, 38);

    // Block 1: Disinfo leak
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.roundRect(24, 84, 672, 92, 12);
    ctx.fill();
    ctx.fillStyle = '#fda4af';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('СРОЧНЫЙ СЛИВ! Кандидат №3 тайно переписал', 42, 118);
    ctx.fillText('бюджет района на офшоры и забирает откаты!', 42, 146);

    // Block 2: Insult / Defamation
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.roundRect(24, 192, 672, 74, 12);
    ctx.fill();
    ctx.fillStyle = '#f4f4f5';
    ctx.font = '16px sans-serif';
    ctx.fillText('Этот мошенник, продажная тварь и предатель города', 42, 224);
    ctx.fillText('должен ответить перед народом.', 42, 248);

    // Block 3: Doxing Pii
    ctx.fillStyle = '#3f151d';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(24, 282, 672, 96, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fecdd3';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('Личный телефон: +7 701 777-45-90 · ИИН 840512300194', 42, 318);
    ctx.fillText('Адрес: г. Алматы, ул. Тимирязева, д. 42, кв. 18', 42, 350);

    // Block 4: Peaceful appeal (Safe!)
    ctx.fillStyle = '#064e3b';
    ctx.beginPath();
    ctx.roundRect(24, 400, 672, 84, 12);
    ctx.fill();
    ctx.fillStyle = '#a7f3d0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('Приходите на выборы 15 марта и голосуйте по совести!', 42, 448);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      fileName: 'sample_political_doxing_slide1.png',
      fileSize: '265 KB',
    };
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
      fileName: 'sample_profanity_chat.png',
      fileSize: '240 KB',
    };
  }

  if (type === 'casino_banner') {
    canvas.width = 720;
    canvas.height = 480;

    // Dark sleek luxury slots background (no literal word "казино")
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gold accent frame
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

    // Header badge
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(40, 40, 290, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('★ 1WIN LUXURY SLOTS ★ 🎰', 55, 66);

    // Big Promo text
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('500% БОНУС + 150 ФРИСПИНОВ!', 40, 140);

    ctx.fillStyle = '#ffffff';
    ctx.font = '21px sans-serif';
    ctx.fillText('Крути барабаны и рулетку — JACKPOT $5 000 USD', 40, 185);
    ctx.fillText('Мгновенный вывод в €4 600 / USDT и на карты 💸', 40, 225);

    // Code badge
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(40, 260, 450, 60, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('ПРОМОКОД: ALMATY_SPIN · 🔞 21+', 60, 298);

    // CTA Button
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.roundRect(40, 350, 320, 60, 12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('КРУТИТЬ БАРАБАНЫ ➔', 60, 388);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      fileName: 'sample_casino_slots_usd.png',
      fileSize: '290 KB',
    };
  }

  if (type === 'scam_phishing') {
    canvas.width = 720;
    canvas.height = 480;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, canvas.width, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('СРОЧНАЯ ГОСВЫПЛАТА 42 500 ₸ • KASPI PROFIT', 32, 40);

    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Токаев подписал выплату каждому гражданину РК!', 32, 120);

    ctx.fillStyle = '#e4e4e7';
    ctx.font = '18px sans-serif';
    ctx.fillText('Фонд «КазМунайГаз»: пассивный доход от 350 000 ₸/день', 32, 168);
    ctx.fillText('100% гарантия без рисков — только сегодня!', 32, 204);

    ctx.fillStyle = '#18181b';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(32, 245, 650, 72, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('https://kaspi-bonus-gov.xyz/claim', 54, 288);

    ctx.fillStyle = '#a1a1aa';
    ctx.font = '15px sans-serif';
    ctx.fillText('Привяжите карту Kaspi для мгновенного зачисления...', 32, 365);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      fileName: 'sample_scam_kaspi_profit.png',
      fileSize: '215 KB',
    };
  }

  if (type === 'journalism_context') {
    canvas.width = 720;
    canvas.height = 480;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#065f46';
    ctx.fillRect(0, 0, canvas.width, 70);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('МВД РК · ОФИЦИАЛЬНОЕ ПРЕДУПРЕЖДЕНИЕ', 32, 43);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('ОСТОРОЖНО, МОШЕННИКИ!', 32, 128);

    ctx.fillStyle = '#334155';
    ctx.font = '18px sans-serif';
    ctx.fillText('Департамент полиции предупреждает: злоумышленники', 32, 178);
    ctx.fillText('рекламируют нелегальные казино 1Win и рассылают', 32, 210);
    ctx.fillText('фейковые ссылки якобы от Kaspi на «выплаты 42 500 ₸».', 32, 242);

    ctx.fillStyle = '#ecfdf5';
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(32, 282, 656, 86, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('Не переходите по сомнительным ссылкам и не сообщайте SMS-коды.', 52, 322);
    ctx.font = '14px sans-serif';
    ctx.fillText('Информационно-профилактическое сообщение (СМИ / МВД РК)', 52, 350);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      fileName: 'sample_journalism_context.png',
      fileSize: '190 KB',
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

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('Успей оформить заказ по акции уже сегодня!', 40, 385);

  return {
    dataUrl: canvas.toDataURL('image/png'),
    fileName: 'sample_unmarked_advertisement.png',
    fileSize: '195 KB',
  };
}
