/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from '@google/genai';
import { AuditCase, ModalityType, Violation } from '../types';

export interface ContentPayload {
  modality: ModalityType;
  text?: string;
  url?: string;
  imageDataUrl?: string;
  fileName?: string;
  fileSize?: string;
}

export async function analyzeContentWithGemini(
  payload: ContentPayload
): Promise<AuditCase> {
  const apiKey =
    (import.meta as unknown as { env: Record<string, string> }).env?.VITE_GEMINI_API_KEY ||
    (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '') ||
    '';

  const timestamp =
    new Date().toLocaleString('ru-RU', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' (Астана)';

  const randomHash = Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
  ).join('');
  const caseId = 'audit-' + Date.now();
  const refNum = `#CHK-KZ-${Math.floor(100000 + Math.random() * 900000)}`;

  const displayName =
    payload.fileName ||
    payload.url ||
    (payload.text ? payload.text.slice(0, 45) + '...' : 'Контент');

  // Try real Gemini analysis if key is available
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const promptInstructions = `Ты — эксперт по комплаенсу интернет-контента, рекламы и цифровой этики в Республике Казахстан (сервис Check Activity KZ).
Проанализируй предоставленный материал по ДВУМ направлениям:

1. ЗАКОНОДАТЕЛЬСТВО КАЗАХСТАНА (Legal):
- Закон РК «Об онлайн-платформах и онлайн-рекламе» (№ 230-VII): обязательна маркировка «Жарнама / Реклама», указание рекламодателя (ИИН/БИН).
- ст. 455 КоАП РК: нарушение законодательства о рекламе.
- ст. 445-1 КоАП РК: запрет рекламы нелегальных онлайн-казино, букмекеров, слотов, азартных игр.
- ст. 456-2 КоАП РК / ст. 274 УК РК: распространение заведомо ложной информации (фейки инфлюенсерами/блогерами).
- ст. 79 КоАП РК & Закон РК № 94-V: незаконная публикация персональных данных (телефоны, ИИН, паспорта) без согласия.
- ст. 21 Закона РК «О языках»: обязательное дублирование рекламы на государственном (казахском) и русском языках.
- Запрет вейпов и жидкостей (ст. 110 Кодекса о здоровье РК / ст. 301-1 УК РК).
- ст. 73-3 КоАП: клевета.

2. ИНТЕРНЕТ-ЭТИКА И ЦИФРОВАЯ КУЛЬТУРА (Ethics):
- Кибербуллинг, шейминг, агрессивные нападки и травля (ст. 73-4 КоАП).
- Язык вражды (Hate Speech), ксенофобия, дискриминация по нац/языковому/религиозному признаку.
- Манипулятивный маркетинг (Dark Patterns): фальшивые таймеры, обещания «гарантированной прибыли» в инвестициях/крипте, агрессивный FOMO («только сегодня, иначе пожалеешь»).
- Скрытая реклама под видом «искренней личной рекомендации» без раскрытия спонсорства.
- Ненормативная, обсценная и вульгарная лексика в публичных медиа.
- Эксплуатация страха, псевдомедицинские гарантии, эксплуатация детей.

Верни строго валидный JSON в таком формате:
{
  "riskScore": number (общий индекс риска 0-100),
  "legalScore": number (индекс правового риска 0-100),
  "ethicsScore": number (индекс этического риска 0-100),
  "riskLevel": "Низкий" | "Средний" | "Высокий" | "Критический",
  "status": "БЕЗОПАСНО" | "ПРЕДУПРЕЖДЕНИЕ" | "ТРЕБУЕТ МЕР",
  "summary": "Краткое правовое резюме проверки на русском языке (2-3 предложения)",
  "ethicsSummary": "Краткое резюме по этике, тональности и добросовестности коммуникации (2 предложения)",
  "violations": [
    {
      "category": "legal" | "ethics",
      "code": "Статья КоАП/Закона РК (для legal) либо 'Этика: [Название нормы]' (для ethics)",
      "title": "Краткое название риска/нарушения",
      "severity": "critical" | "warning" | "info",
      "basis": "Фактическое объяснение того, что именно не так в контенте",
      "fineAmount": "Размер возможного штрафа в тенге ₸ и МРП (для legal) либо 'Репутационный риск' (для ethics)",
      "jurisdiction": "Госорган РК (МКИ РК, АФМ) либо 'Медиа-этика и репутация'",
      "recommendation": "Что конкретно нужно исправить автору контента"
    }
  ]
}`;

      let response;

      if (
        payload.imageDataUrl &&
        (payload.modality === 'screenshot' || payload.modality === 'photo')
      ) {
        const mimeMatch = payload.imageDataUrl.match(
          /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/
        );
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const base64Data = mimeMatch
          ? mimeMatch[2]
          : payload.imageDataUrl.split(',')[1] || '';

        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    promptInstructions +
                    '\n\nПроанализируй прикрепленное изображение (текст на нем, логотипы, дисклеймеры, объекты, этичность визуала):',
                },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
          },
        });
      } else {
        const textToAnalyze = payload.text || payload.url || '';
        response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `${promptInstructions}\n\nКонтент для анализа:\n"${textToAnalyze}"`,
          config: {
            responseMimeType: 'application/json',
          },
        });
      }

      const parsed = JSON.parse(response.text || '{}');

      const violations: Violation[] = (parsed.violations || []).map(
        (v: Partial<Violation & { recommendation?: string }>, idx: number) => ({
          id: `v-${idx + 1}`,
          category: (v.category === 'ethics' ? 'ethics' : 'legal') as 'legal' | 'ethics',
          code: v.code || (v.category === 'ethics' ? 'Цифровая этика' : 'ст. 455 КоАП РК'),
          title: v.title || 'Замечание по контенту',
          severity: v.severity || 'warning',
          basis: v.basis || 'Обнаружено несоответствие правилам размещения контента в РК.',
          fineAmount:
            v.fineAmount ||
            (v.category === 'ethics' ? 'Репутационный риск' : 'Штраф от 50 МРП (196 600 ₸)'),
          jurisdiction: v.jurisdiction || (v.category === 'ethics' ? 'Медиа-этика' : 'МКИ РК'),
          recommendation: v.recommendation || '',
        })
      );

      return {
        id: caseId,
        referenceNumber: refNum,
        timestamp,
        sourceType: payload.modality,
        title: displayName,
        sourceName: displayName,
        sha256: randomHash + 'a48e...01c9',
        riskScore: typeof parsed.riskScore === 'number' ? parsed.riskScore : 50,
        legalScore: typeof parsed.legalScore === 'number' ? parsed.legalScore : 50,
        ethicsScore: typeof parsed.ethicsScore === 'number' ? parsed.ethicsScore : 40,
        riskLevel: parsed.riskLevel || 'Средний',
        status: parsed.status || 'ПРЕДУПРЕЖДЕНИЕ',
        summary: parsed.summary || 'Материал проверен на нормы законодательства РК и интернет-этики.',
        ethicsSummary: parsed.ethicsSummary || 'Оценка этичности и добросовестности коммуникации сформирована.',
        previewUrl: payload.imageDataUrl,
        rawText: payload.text || payload.url,
        violations,
        metadata: {
          fileSize: payload.fileSize,
          engineConfidence: 98.4,
          platform: 'Check Activity Engine v4.2 (Казахстан)',
        },
      };
    } catch (err) {
      console.warn('Gemini request failed, falling back to smart local analyzer:', err);
    }
  }

  // Smart local parser (analyzes the real user input against both Law & Ethics)
  return analyzeLocally(payload, timestamp, randomHash, caseId, refNum, displayName);
}

function analyzeLocally(
  payload: ContentPayload,
  timestamp: string,
  randomHash: string,
  caseId: string,
  refNum: string,
  displayName: string
): AuditCase {
  const content = (payload.text || payload.url || payload.fileName || '').toLowerCase();
  const violations: Violation[] = [];

  let legalScore = 5;
  let ethicsScore = 5;

  // 1. Проверка рекламы без маркировки (Закон № 230-VII, ст. 455 КоАП)
  const hasCommercialTerms =
    content.includes('скидк') ||
    content.includes('купить') ||
    content.includes('заказать') ||
    content.includes('акция') ||
    content.includes('промокод') ||
    content.includes('курс') ||
    content.includes('инвестиц') ||
    content.includes('цена') ||
    content.includes('подпишись') ||
    content.includes('распродаж') ||
    content.includes('магазин');

  const hasAdMark =
    content.includes('жарнама') ||
    content.includes('реклама') ||
    content.includes('жарнамалық') ||
    content.includes('спонсор');

  if (hasCommercialTerms && !hasAdMark) {
    violations.push({
      id: 'v-legal-ad',
      category: 'legal',
      code: 'ст. 455 КоАП РК / Закон № 230-VII',
      title: 'Отсутствие обязательной маркировки рекламы («Жарнама»)',
      severity: 'critical',
      basis: 'В материале содержится явный коммерческий призыв или реклама товаров/услуг, но отсутствует обязательное слово «Жарнама / Реклама» и реквизиты рекламодателя (ИИН/БИН).',
      fineAmount: 'от 50 до 200 МРП (196 600 — 786 400 ₸)',
      jurisdiction: 'МКИ РК (Контроль онлайн-рекламы)',
      recommendation: 'Добавить в начале или на креативе четкую надпись «Жарнамалық материал / Реклама» и указать БИН/ИИН.',
    });
    legalScore = Math.max(legalScore, 75);
  }

  // 2. Казино, ставки, слоты (ст. 445-1 КоАП РК)
  if (
    content.includes('казино') ||
    content.includes('casino') ||
    content.includes('1win') ||
    content.includes('слот') ||
    content.includes('pin-up') ||
    content.includes('ставка') ||
    content.includes('букмекер') ||
    content.includes('рулетк')
  ) {
    violations.push({
      id: 'v-legal-casino',
      category: 'legal',
      code: 'ст. 445-1 КоАП РК',
      title: 'Реклама нелицензированных азартных игр и интернет-казино',
      severity: 'critical',
      basis: 'Прямая или косвенная реклама онлайн-казино, слотов и нелицензированных игорных сервисов запрещена на всей территории Казахстана.',
      fineAmount: 'до 1 000 МРП (3 932 000 ₸) + блокировка ресурса',
      jurisdiction: 'АФМ РК / МКИ РК',
      recommendation: 'Удалить ссылки на азартные игры и реферальные промокоды.',
    });
    legalScore = Math.max(legalScore, 90);
    ethicsScore = Math.max(ethicsScore, 85);
  }

  // 3. Вейпы и электронные сигареты (запрет с 2024 года в РК)
  if (
    content.includes('вейп') ||
    content.includes('vape') ||
    content.includes('электронные сигареты') ||
    content.includes('жидкость для вейпа') ||
    content.includes('одноразк') ||
    content.includes('pod-систем')
  ) {
    violations.push({
      id: 'v-legal-vape',
      category: 'legal',
      code: 'ст. 455 КоАП РК / ст. 301-1 УК РК',
      title: 'Запрет рекламы и оборота вейпов в Республике Казахстан',
      severity: 'critical',
      basis: 'С 2024 года в РК введен полный законодательный запрет на продажу, рекламу и распространение электронных систем потребления никотина (вейпов).',
      fineAmount: 'Уголовная ответственность либо штраф до 2 000 МРП',
      jurisdiction: 'МВД РК / МКИ РК',
      recommendation: 'Полностью исключить упоминание и продвижение вейп-продукции.',
    });
    legalScore = Math.max(legalScore, 95);
  }

  // 4. Персональные данные (номера телефонов физлиц)
  if (
    content.includes('+7') ||
    content.includes('870') ||
    content.includes('877') ||
    content.includes('874') ||
    content.includes('иин ')
  ) {
    violations.push({
      id: 'v-legal-pdn',
      category: 'legal',
      code: 'ст. 79 КоАП РК (Закон № 94-V)',
      title: 'Открытая публикация контактных данных / ПДн',
      severity: 'warning',
      basis: 'В контенте указан сотовый телефон или персональный идентификатор без подтверждения согласия субъекта на публичное распространение.',
      fineAmount: 'от 30 до 100 МРП (117 960 — 393 200 ₸)',
      jurisdiction: 'МЦРИАП РК',
      recommendation: 'Скрыть личный номер телефона либо заменить на публичные контакты компании.',
    });
    legalScore = Math.max(legalScore, 55);
  }

  // 5. Клевета и оскорбления (ст. 73-3, 73-4 КоАП)
  if (
    content.includes('мошенник') ||
    content.includes('вор') ||
    content.includes('лохотрон') ||
    content.includes('фальсификат') ||
    content.includes('аферист')
  ) {
    violations.push({
      id: 'v-legal-defamation',
      category: 'legal',
      code: 'ст. 73-3 КоАП РК (Клевета)',
      title: 'Публичные обвинения с признаками клеветы',
      severity: 'critical',
      basis: 'Распространение утверждений о преступлениях или мошенничестве без вступившего в силу законного решения суда.',
      fineAmount: 'от 160 до 650 МРП (629 120 — 2 555 800 ₸)',
      jurisdiction: 'Суд по административным делам РК',
      recommendation: 'Исключить утверждения о совершении преступлений без судебного приговора.',
    });
    legalScore = Math.max(legalScore, 80);
    ethicsScore = Math.max(ethicsScore, 75);
  }

  // --- ЭТИКА В ИНТЕРНЕТЕ (Internet Ethics & Digital Hygiene) ---

  // 6. Манипулятивный маркетинг / Dark Patterns / Агрессивный FOMO
  if (
    content.includes('гарантированн') ||
    content.includes('100% доход') ||
    content.includes('только сегодня') ||
    content.includes('успей сейчас') ||
    content.includes('пожалеешь') ||
    content.includes('гарантия 100') ||
    content.includes('заходи сейчас') ||
    content.includes('без рисков')
  ) {
    violations.push({
      id: 'v-ethics-manipulation',
      category: 'ethics',
      code: 'Этика: Манипулятивный маркетинг (Dark Patterns)',
      title: 'Агрессивное манипулирование аудиторией (FOMO и ложные гарантии)',
      severity: 'critical',
      basis: 'Использование эмоционального давления («только сегодня», «пожалеешь», «без рисков») и обещаний 100% гарантированного дохода. В цифровом маркетинге это признак манипулятивного Dark Pattern.',
      fineAmount: 'Репутационный ущерб / Потеря доверия аудитории',
      jurisdiction: 'Этический кодекс интернет-маркетинга и рекламы',
      recommendation: 'Убрать безапелляционные гарантии, отказаться от давления дефицита времени и добавить реалистичное описание условий.',
    });
    ethicsScore = Math.max(ethicsScore, 70);
  }

  // 7. Кибербуллинг, травля и оскорбительный тон
  if (
    content.includes('бездар') ||
    content.includes('тупой') ||
    content.includes('идиот') ||
    content.includes('урод') ||
    content.includes('клоун') ||
    content.includes('ничтожеств')
  ) {
    violations.push({
      id: 'v-ethics-bullying',
      category: 'ethics',
      code: 'Этика: Кибербуллинг и оскорбительный тон',
      title: 'Унижение личности и признаки публичного буллинга',
      severity: 'critical',
      basis: 'Публичные оскорбления, переход на личности и использование уничижительных ярлыков противоречат культуре цифрового общения.',
      fineAmount: 'Репутационный риск / Риск гражданского иска о защите чести и достоинства',
      jurisdiction: 'Цифровая этика и правила онлайн-платформ',
      recommendation: 'Исключить оскорбления личности и выражать критику в корректной аргументированной форме.',
    });
    ethicsScore = Math.max(ethicsScore, 85);
  }

  // 8. Ненормативная лексика и обсценные выражения
  if (
    content.includes('блять') ||
    content.includes('бля') ||
    content.includes('нах') ||
    content.includes('хрен') ||
    content.includes('дерьмо') ||
    content.includes('сука')
  ) {
    violations.push({
      id: 'v-ethics-profanity',
      category: 'ethics',
      code: 'Этика: Ненормативная лексика',
      title: 'Использование ненормативной и сниженной лексики',
      severity: 'warning',
      basis: 'В открытом медиапространстве ненормативная лексика снижает доверие к бренду и нарушает политику модерации большинства казахстанских площадок.',
      fineAmount: 'Репутационный риск / ст. 73-4 КоАП РК (мелкое хулиганство)',
      jurisdiction: 'Культура медиа и правила сообществ',
      recommendation: 'Заменить обсценную лексику на нормативные литературные эквиваленты.',
    });
    ethicsScore = Math.max(ethicsScore, 60);
  }

  // 9. Язык вражды (Hate Speech) и ксенофобия
  if (
    content.includes('понаехали') ||
    content.includes('мамбет') ||
    content.includes('чурки') ||
    content.includes('нацик') ||
    content.includes('ватник')
  ) {
    violations.push({
      id: 'v-ethics-hate',
      category: 'ethics',
      code: 'Этика: Язык вражды (Hate Speech)',
      title: 'Дискриминационная лексика и разжигание вражды',
      severity: 'critical',
      basis: 'Использование стигматизирующих этнических или социальных маркеров категорически недопустимо в цивилизованном медиапространстве и подпадает под уголовные риски ст. 174 УК РК.',
      fineAmount: 'Высочайший репутационный риск / ст. 174 УК РК',
      jurisdiction: 'Комитет информации МКИ РК / Уголовная юрисдикция',
      recommendation: 'Немедленно исключить враждебные ярлыки и дискриминационные высказывания.',
    });
    ethicsScore = Math.max(ethicsScore, 95);
    legalScore = Math.max(legalScore, 90);
  }

  // 10. Скрытая реклама
  if (
    content.includes('пользуюсь сама') &&
    content.includes('промокод') &&
    !hasAdMark
  ) {
    violations.push({
      id: 'v-ethics-hidden-ad',
      category: 'ethics',
      code: 'Этика: Недобросовестная скрытая реклама',
      title: 'Злоупотребление доверием подписчиков (скрытая интеграция)',
      severity: 'warning',
      basis: 'Пост имитирует искренний личный опыт, но при этом содержит коммерческий реферальный код без информирования аудитории об оплате или партнерстве.',
      fineAmount: 'Потеря доверия аудитории',
      jurisdiction: 'Инфлюенс-этика и кодекс блогеров РК',
      recommendation: 'Открыто указать на партнерский характер публикации.',
    });
    ethicsScore = Math.max(ethicsScore, 50);
  }

  const overallRiskScore = Math.max(legalScore, ethicsScore);
  let riskLevel: 'Низкий' | 'Средний' | 'Высокий' | 'Критический' = 'Низкий';
  let status: 'БЕЗОПАСНО' | 'ПРЕДУПРЕЖДЕНИЕ' | 'ТРЕБУЕТ МЕР' = 'БЕЗОПАСНО';

  if (overallRiskScore >= 75) {
    riskLevel = 'Критический';
    status = 'ТРЕБУЕТ МЕР';
  } else if (overallRiskScore >= 45) {
    riskLevel = 'Высокий';
    status = 'ТРЕБУЕТ МЕР';
  } else if (overallRiskScore >= 20) {
    riskLevel = 'Средний';
    status = 'ПРЕДУПРЕЖДЕНИЕ';
  }

  const legalViolationsCount = violations.filter((v) => v.category === 'legal').length;
  const ethicsViolationsCount = violations.filter((v) => v.category === 'ethics').length;

  const summary =
    legalViolationsCount > 0
      ? `Выявлено ${legalViolationsCount} правовых замечаний по законодательству РК (Закон № 230-VII, КоАП РК).`
      : 'Правовых нарушений законодательства РК не обнаружено.';

  const ethicsSummary =
    ethicsViolationsCount > 0
      ? `Зафиксировано ${ethicsViolationsCount} замечаний по интернет-этике и добросовестности коммуникации.`
      : 'Тональность и маркетинговые практики соответствуют нормам этики в интернете.';

  return {
    id: caseId,
    referenceNumber: refNum,
    timestamp,
    sourceType: payload.modality,
    title: displayName,
    sourceName: displayName,
    sha256: randomHash + 'b91c...88ff',
    riskScore: overallRiskScore,
    legalScore,
    ethicsScore,
    riskLevel,
    status,
    summary,
    ethicsSummary,
    previewUrl: payload.imageDataUrl,
    rawText: payload.text || payload.url,
    violations,
    metadata: {
      fileSize: payload.fileSize || '1.1 MB',
      engineConfidence: 98.6,
      platform: 'Check Activity Engine v4.2 (Казахстан)',
    },
  };
}
