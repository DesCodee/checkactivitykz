/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SampleAudioPreset {
  id: string;
  name: string;
  fileName: string;
  category: 'cyberbullying' | 'unmarked_ad' | 'casino' | 'clean';
  badge: string;
  badgeColor: string;
  duration: string;
  description: string;
  rawTranscript: string;
  transcriptItems: {
    time: string;
    speaker: string;
    text: string;
    flagged?: boolean;
    flaggedText?: string;
    article?: string;
  }[];
}

export const SAMPLE_AUDIO_PRESETS: SampleAudioPreset[] = [
  {
    id: 'audio-cyberbullying-profanity',
    name: 'Голосовое в Telegram: оскорбления и мат',
    fileName: 'voice_msg_almaty_incident.m4a',
    category: 'cyberbullying',
    badge: 'КРИТИЧЕСКИЙ РИСК: МАТЫ И ТРАВЛЯ',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    duration: '00:28',
    description: 'Голосовое сообщение в публичном чате: прямые оскорбления личности, нецензурная брань на русском и казахском языках (ст. 434, 73-4 КоАП РК).',
    rawTranscript: `[00:01] Голос 1: Ты че бля совсем берега попутал? Пошел нахуй отсюда, урод конченый, еще раз здесь напишешь — мы тебя найдем!
[00:09] Голос 1: Сука, думаешь в интернете спрятался? Шешеңді сиктир, ответишь за свои слова, пидор!
[00:19] Голос 1: Номер свой скинь сюда живо, если не трус, поговорим по-мужски.`,
    transcriptItems: [
      {
        time: '00:01',
        speaker: '@kanat_live (Голосовое)',
        text: 'Ты че бля совсем берега попутал? Пошел нахуй отсюда, урод конченый, еще раз здесь напишешь — мы тебя найдем!',
        flagged: true,
        flaggedText: 'бля, нахуй, урод конченый',
        article: 'ст. 434 КоАП РК (Мат) / ст. 131 УК РК (Оскорбление)',
      },
      {
        time: '00:09',
        speaker: '@kanat_live (Голосовое)',
        text: 'Сука, думаешь в интернете спрятался? Шешеңді сиктир, ответишь за свои слова, пидор!',
        flagged: true,
        flaggedText: 'Сука, Шешеңді сиктир, пидор',
        article: 'ст. 434 КоАП РК / ст. 73-4 КоАП РК (Кибербуллинг)',
      },
      {
        time: '00:19',
        speaker: '@kanat_live (Голосовое)',
        text: 'Номер свой скинь сюда живо, если не трус, поговорим по-мужски.',
        flagged: true,
        flaggedText: 'угрозы преследования',
        article: 'ст. 73-4 КоАП РК (Травля / буллинг)',
      },
    ],
  },
  {
    id: 'audio-unmarked-influencer-ad',
    name: 'Подкаст: скрытая реклама без маркировки',
    fileName: 'podcast_astana_lifestyle_ep4.mp3',
    category: 'unmarked_ad',
    badge: 'НАРУШЕНИЕ: ЗАКОН № 230-VII',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    duration: '00:35',
    description: 'Инфлюенсер в аудиовыпуске рекомендует клинику и биодобавки со скидкой по промокоду, не произнося обязательную маркировку «Жарнама» и не указывая БИН.',
    rawTranscript: `[00:02] Ведущий: Ребята, многие спрашивали, как я поддерживаю энергию при таком графике. Короче, я уже месяц пью японский комплекс витаминов от Healthy Life KZ.
[00:14] Ведущий: Реально ушла усталость, голова свежая. Переходите по ссылке в описании выпуска, вводите мой промокод PODCAST20 и забирайте скидку 20%. Доставка по всему Казахстану бесплатная!
[00:26] Ведущий: (Маркировка «Жарнама» отсутствует в аудиоряде, БИН рекламодателя не озвучен).`,
    transcriptItems: [
      {
        time: '00:02',
        speaker: 'Ведущий подкаста',
        text: 'Ребята, многие спрашивали, как я поддерживаю энергию при таком графике. Короче, я уже месяц пью японский комплекс витаминов от Healthy Life KZ.',
        flagged: false,
      },
      {
        time: '00:14',
        speaker: 'Ведущий подкаста',
        text: 'Реально ушла усталость, голова свежая. Переходите по ссылке в описании выпуска, вводите мой промокод PODCAST20 и забирайте скидку 20%. Доставка по всему Казахстану бесплатная!',
        flagged: true,
        flaggedText: 'Коммерческая интеграция без озвучивания отметки «Жарнама»',
        article: 'Закон РК № 230-VII / ст. 455 КоАП РК',
      },
      {
        time: '00:26',
        speaker: 'Анализ аудиоряда',
        text: 'Аудиомаркировка спонсорского контента отсутствует, отсутствует наименование рекламодателя и БИН.',
        flagged: true,
        flaggedText: 'Отсутствие БИН и маркировки спонсора',
        article: 'ст. 455 КоАП РК (до 200 МРП)',
      },
    ],
  },
  {
    id: 'audio-casino-gambling',
    name: 'Голосовое: реклама онлайн-казино 1Win и слотов',
    fileName: 'voice_slots_bonus_promo.ogg',
    category: 'casino',
    badge: 'КРИТИЧЕСКИЙ РИСК: СТ. 445-1 КоАП РК',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    duration: '00:22',
    description: 'Голосовое обращение в Telegram-канале с призывом крутить слоты, обещанием 500% бонуса на депозит и выводом на Kaspi/Halyk.',
    rawTranscript: `[00:02] Спикер: Салам всем подписчикам! Короче, только что вывел 350 тысяч тенге со слотов в 1Win KZ на карту Kaspi!
[00:10] Спикер: Ссылка в закрепе канала, вводите секретный промокод LUCKY_KZ, вам сразу начислят 500 процентов бонуса к первому депозиту. Крутите Crazy Monkey и Gates of Olympus, пока даёт!`,
    transcriptItems: [
      {
        time: '00:02',
        speaker: '@capper_almaty',
        text: 'Салам всем подписчикам! Короче, только что вывел 350 тысяч тенге со слотов в 1Win KZ на карту Kaspi!',
        flagged: true,
        flaggedText: '1Win KZ, слоты, вывод на Kaspi',
        article: 'ст. 445-1 КоАП РК (Реклама нелицензированных азартных игр)',
      },
      {
        time: '00:10',
        speaker: '@capper_almaty',
        text: 'Ссылка в закрепе канала, вводите секретный промокод LUCKY_KZ, вам сразу начислят 500 процентов бонуса к первому депозиту. Крутите Crazy Monkey и Gates of Olympus, пока даёт!',
        flagged: true,
        flaggedText: 'Промокод на азартные игры, слоты, бонус',
        article: 'ст. 445-1 КоАП РК (до 1 000 МРП)',
      },
    ],
  },
  {
    id: 'audio-clean-business',
    name: 'Деловая запись: корректный комментарий',
    fileName: 'interview_pr_director_qazaq.wav',
    category: 'clean',
    badge: '100% БЕЗОПАСНО: НОРМА',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    duration: '00:30',
    description: 'Официальный комментарий руководителя проекта: корректный деловой тон, отсутствие брани, соблюдение цифровой этики и законов Казахстана.',
    rawTranscript: `[00:01] Спикер: Қайырлы күн, құрметті әріптестер! Біз жаңа цифрлық жобамызды сәтті іске қостық.
[00:11] Спикер: Проект ориентирован на повышение прозрачности онлайн-коммуникаций и соблюдение законодательства Республики Казахстан.
[00:22] Спикер: Благодарим всех участников за конструктивное сотрудничество и профессионализм.`,
    transcriptItems: [
      {
        time: '00:01',
        speaker: 'Официальный спикер',
        text: 'Қайырлы күн, құрметті әріптестер! Біз жаңа цифрлық жобамызды сәтті іске қостық.',
        flagged: false,
      },
      {
        time: '00:11',
        speaker: 'Официальный спикер',
        text: 'Проект ориентирован на повышение прозрачности онлайн-коммуникаций и соблюдение законодательства Республики Казахстан.',
        flagged: false,
      },
      {
        time: '00:22',
        speaker: 'Официальный спикер',
        text: 'Благодарим всех участников за конструктивное сотрудничество и профессионализм.',
        flagged: false,
      },
    ],
  },
];

/**
 * Generates an audible synthetic WAV Audio Data URL using Web Audio API or PCM byte array
 * This allows real audio playback directly in the browser without external network assets!
 */
export function generateSyntheticWavDataUrl(frequency = 440, durationSeconds = 3): string {
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  // Write WAV header
  // "RIFF" chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 1, true); // BlockAlign
  view.setUint16(34, 8, true); // BitsPerSample (8 bits)

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, numSamples, true);

  // Write audio samples: pleasant multi-tone chime simulating voice radio stream
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Modulate pitch slightly to simulate human cadence
    const freq = frequency + Math.sin(t * 8) * 40 + Math.sin(t * 18) * 20;
    const wave = Math.sin(2 * Math.PI * freq * t);
    // Envelope to prevent clicks
    const env = Math.min(1, Math.min(t * 4, (durationSeconds - t) * 4));
    const sample = Math.floor((wave * env * 0.4 + 0.5) * 255);
    view.setUint8(44 + i, Math.max(0, Math.min(255, sample)));
  }

  // Convert buffer to base64
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
