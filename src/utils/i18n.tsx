/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ru' | 'kz';
export type Theme = 'light' | 'dark';

export interface Translations {
  [key: string]: {
    ru: string;
    kz: string;
  };
}

export const DICTIONARY = {
  // Brand & Header
  appTitle: {
    ru: 'Check Activity',
    kz: 'Check Activity',
  },
  appSubtitle: {
    ru: 'Аудит онлайн-контента и этики',
    kz: 'Онлайн-мазмұн мен этика аудиті',
  },
  kazakhstan: {
    ru: 'Республика Казахстан',
    kz: 'Қазақстан Республикасы',
  },
  lawsAndEthics: {
    ru: 'Закон + Интернет-этика',
    kz: 'Заң + Интернет-этикасы',
  },
  regulatoryHeaderBadge: {
    ru: 'Закон № 230-VII • КоАП РК • Цифровая этика',
    kz: '№ 230-VII Заңы • ҚР ӘҚБтК • Сандық этика',
  },
  searchPlaceholder: {
    ru: 'Поиск по статьям КоАП РК, этике, ссылкам...',
    kz: 'ҚР ӘҚБтК баптары, этика, сілтемелер бойынша іздеу...',
  },

  // Navigation Tabs
  navScanner: {
    ru: 'Сканер контента',
    kz: 'Мазмұн сканері',
  },
  navMonitoring: {
    ru: 'Мониторинг каналов',
    kz: 'Арналар мониторингі',
  },
  navReport: {
    ru: 'Экспертный отчет',
    kz: 'Сараптамалық есеп',
  },
  navDashboard: {
    ru: 'Дашборд',
    kz: 'Дашборд',
  },
  navArchive: {
    ru: 'Журнал проверок',
    kz: 'Тексеру журналы',
  },
  navSandbox: {
    ru: 'Песочница и НПА',
    kz: 'Симулятор және НҚА',
  },

  // Scanner View
  scannerHeroTitle: {
    ru: 'Аудит контента на правонарушения и цифровую этику',
    kz: 'Мазмұнды құқық бұзушылықтар мен цифрлық этикаға аудиттеу',
  },
  scannerHeroDesc: {
    ru: 'Мгновенная проверка материалов перед публикацией: нормы КоАП РК, Закон № 230-VII, УК РК, двуязычие и цифровая этика.',
    kz: 'Жариялау алдындағы материалдарды лезде тексеру: ҚР ӘҚБтК нормалары, № 230-VII Заңы, ҚК және цифрлық этика.',
  },
  stepSource: {
    ru: '1. Выберите формат материала:',
    kz: '1. Материал пішімін таңдаңыз:',
  },
  stepObject: {
    ru: '2. Загрузите или вставьте материал:',
    kz: '2. Материалды жүктеңіз немесе енгізіңіз:',
  },
  stepModules: {
    ru: '3. Модули аудита:',
    kz: '3. Аудит модульдері:',
  },

  // Modality Tabs
  tabFileUniversal: {
    ru: 'Скриншот / Файл',
    kz: 'Скриншот / Файл',
  },
  tabMedia: {
    ru: 'Аудио / Видео',
    kz: 'Аудио / Бейне',
  },
  tabScreenshot: {
    ru: 'Скриншот',
    kz: 'Скриншот',
  },
  tabVideo: {
    ru: 'Видео / Reels',
    kz: 'Бейне / Reels',
  },
  tabAudio: {
    ru: 'Аудио',
    kz: 'Аудио',
  },
  tabUrl: {
    ru: 'По ссылке',
    kz: 'Сілтеме арқылы',
  },
  tabText: {
    ru: 'Текст',
    kz: 'Мәтін',
  },

  // File Upload
  dropScreenshotTitle: {
    ru: 'Перетащите скриншот, документ или вставьте из буфера (Ctrl+V)',
    kz: 'Скриншотты, құжатты сүйреңіз немесе буферден қойыңыз (Ctrl+V)',
  },
  dropScreenshotSubtitle: {
    ru: 'Поддерживаются: PNG, JPG, PDF, DOCX, TXT, CSV',
    kz: 'Қолдау көрсетіледі: PNG, JPG, PDF, DOCX, TXT, CSV',
  },
  chooseFileBtn: {
    ru: 'Выбрать файл',
    kz: 'Файлды таңдау',
  },
  pasteHint: {
    ru: 'Или просто нажмите Ctrl+V в любом месте для вставки из буфера обмена',
    kz: 'Немесе алмасу буферінен қою үшін кез келген жерде Ctrl+V басыңыз',
  },
  testCasesTitle: {
    ru: 'Готовые тестовые кейсы (нажмите для проверки):',
    kz: 'Дайын сынақ кейстері (тексеру үшін басыңыз):',
  },
  testChatProfanity: {
    ru: 'Чат с матами (Telegram)',
    kz: 'Бейәдеп сөздері бар чат (Telegram)',
  },
  testChatProfanitySub: {
    ru: 'Обсценная лексика, ст. 434 КоАП РК',
    kz: 'Бейәдеп сөздер, ҚР ӘҚБтК 434-бабы',
  },
  testCasinoBanner: {
    ru: 'Казино 1Win (Слоты)',
    kz: '1Win казиносы (Слоттар)',
  },
  testCasinoBannerSub: {
    ru: 'Запрет казино, ч. 1 ст. 455 КоАП РК',
    kz: 'Казиноға тыйым, ҚР ӘҚБтК 455-бабы 1-б.',
  },
  testUnmarkedAd: {
    ru: 'Баннер без маркировки',
    kz: 'Таңбаланбаған жарнамалық баннер',
  },
  testUnmarkedAdSub: {
    ru: 'Нет плашки «Жарнама», ч. 2 ст. 455 КоАП РК',
    kz: '«Жарнама» белгісі жоқ, ҚР ӘҚБтК 455-бабы 2-б.',
  },

  // OCR Section
  ocrExtractedTitle: {
    ru: 'Текст, извлеченный со скриншота (OCR):',
    kz: 'Скриншоттан оқылған мәтін (OCR):',
  },
  ocrScanning: {
    ru: 'Идет OCR-сканирование...',
    kz: 'OCR арқылы оқу орындалуда...',
  },
  ocrRecognized: {
    ru: 'Распознано',
    kz: 'Танылды',
  },
  ocrSymbols: {
    ru: 'символов',
    kz: 'таңба',
  },
  ocrRepeat: {
    ru: 'Повторить OCR',
    kz: 'Қайта оқу',
  },
  ocrCopy: {
    ru: 'Копировать',
    kz: 'Көшіру',
  },
  ocrCopied: {
    ru: 'Скопировано',
    kz: 'Көшірілді',
  },
  ocrClear: {
    ru: 'Очистить',
    kz: 'Тазарту',
  },
  ocrPlaceholder: {
    ru: 'Текст со скриншота извлечен сюда. Вы также можете дополнить или исправить его вручную.',
    kz: 'Скриншот мәтіні осында шығарылды. Сондай-ақ оны қолмен толықтыруға немесе түзетуге болады.',
  },
  noteLabel: {
    ru: 'Дополнительное примечание к материалу (необязательно):',
    kz: 'Материалға қосымша ескертпе (міндетті емес):',
  },
  notePlaceholder: {
    ru: 'Укажите источник, контекст публикации или данные автора...',
    kz: 'Басылымның көзін, контекстін немесе автор деректерін көрсетіңіз...',
  },

  // Video Tab
  videoUrlLabel: {
    ru: 'Анализ видео по ссылке (YouTube, TikTok, Reels, Shorts):',
    kz: 'Сілтеме арқылы бейнені талдау (YouTube, TikTok, Reels, Shorts):',
  },
  videoDropTitle: {
    ru: 'Загрузить видеофайл для детальной раскадровки',
    kz: 'Бөлшектеп раскадровка жасау үшін бейнефайл жүктеу',
  },
  videoDropSubtitle: {
    ru: 'Поддерживаются MP4, MOV, WebM, M4V (до 100 МБ)',
    kz: 'MP4, MOV, WebM, M4V қолдау көрсетіледі (100 МБ дейін)',
  },
  videoSelectBtn: {
    ru: 'Выбрать видеофайл на устройстве',
    kz: 'Құрылғыдан бейнефайлды таңдау',
  },
  videoExtracting: {
    ru: 'Извлечение ключевых сцен и покадровая раскадровка видео...',
    kz: 'Негізгі көріністерді алу және бейнені кадр бойынша жіктеу...',
  },
  videoFilmstripTitle: {
    ru: 'Раскадровка ключевых кадров (Keyframe Filmstrip):',
    kz: 'Негізгі кадрлар раскадровкасы (Keyframe Filmstrip):',
  },
  videoFramesCount: {
    ru: 'кадров',
    kz: 'кадр',
  },

  // Audio Tab
  audioRecordMode: {
    ru: 'Запись с микрофона',
    kz: 'Микрофоннан жазу',
  },
  audioUploadMode: {
    ru: 'Загрузить аудиофайл',
    kz: 'Аудиофайлды жүктеу',
  },
  audioStartRecord: {
    ru: 'Начать запись с микрофона',
    kz: 'Микрофоннан жазуды бастау',
  },
  audioRecordingInProgress: {
    ru: 'Идет запись аудио с микрофона...',
    kz: 'Микрофоннан дыбыс жазылуда...',
  },
  audioStopRecord: {
    ru: 'Остановить запись',
    kz: 'Жазуды тоқтату',
  },
  audioDropTitle: {
    ru: 'Перетащите аудиофайл или голосовую запись',
    kz: 'Аудиофайлды немесе дауыстық жазбаны сүйреп апарыңыз',
  },
  audioDropSubtitle: {
    ru: 'Поддерживаются MP3, WAV, M4A, OGG, WebM, AAC (до 100 МБ)',
    kz: 'MP3, WAV, M4A, OGG, WebM, AAC қолдау көрсетіледі (100 МБ дейін)',
  },

  // URL Tab
  urlInputLabel: {
    ru: 'Вставьте веб-ссылку на материал для аудита:',
    kz: 'Аудиттелетін материалдың веб-сілтемесін қойыңыз:',
  },
  urlSupportedServices: {
    ru: 'Поддерживаются: Instagram, Telegram, TikTok, YouTube, новостные порталы РК и онлайн-магазины.',
    kz: 'Қолдау көрсетілетіндер: Instagram, Telegram, TikTok, YouTube, ҚР жаңалықтар порталдары мен интернет-дүкендері.',
  },

  // Text Tab
  textPlaceholder: {
    ru: 'Вставьте текст рекламного объявления, поста, комментария или предложения (включая эмодзи 🎰, 💩, 🚨)...',
    kz: 'Жарнамалық хабарландырудың, жазбаның, пікірдің немесе ұсыныстың мәтінін қойыңыз (эмодзилерді қоса 🎰, 💩, 🚨)...',
  },

  // Filter Modules
  modulesTitle: {
    ru: '3. Модули аудита:',
    kz: '3. Аудит модульдері:',
  },
  filterAll: {
    ru: 'Все',
    kz: 'Барлығы',
  },
  filterLegal: {
    ru: 'Закон РК',
    kz: 'ҚР Заңы',
  },
  filterEthics: {
    ru: 'Интернет-этика',
    kz: 'Интернет-этикасы',
  },
  executeBtn: {
    ru: 'Запустить аудит: Закон РК + Интернет-этика',
    kz: 'Аудитті бастау: ҚР Заңы + Интернет-этикасы',
  },
  processingTitle: {
    ru: 'Выполняется аудит контента...',
    kz: 'Мазмұнды аудиттеу орындалуда...',
  },

  // Expert Report
  reportTitle: {
    ru: 'Экспертное заключение комплаенс-контроля',
    kz: 'Комплаенс-бақылаудың сараптамалық қорытындысы',
  },
  reportSubtitle: {
    ru: 'Правовая фиксация нарушений норм законодательства Республики Казахстан и правил цифровой этики.',
    kz: 'Қазақстан Республикасы заңнамасының нормалары мен цифрлық этика ережелерінің бұзылуын құқықтық бекіту.',
  },
  printPdfBtn: {
    ru: 'Печать / Сохранить в PDF',
    kz: 'Басып шығару / PDF сақтау',
  },
  newAuditBtn: {
    ru: 'Новый аудит',
    kz: 'Жаңа аудит',
  },
  shareBtn: {
    ru: 'Поделиться',
    kz: 'Бөлісу',
  },
  riskIndex: {
    ru: 'Индекс риска',
    kz: 'Тәуекел индексі',
  },
  legalCompliance: {
    ru: 'Правовой комплаенс',
    kz: 'Құқықтық комплаенс',
  },
  digitalEthics: {
    ru: 'Цифровая этика',
    kz: 'Сандық этика',
  },
  totalFindings: {
    ru: 'Всего замечаний',
    kz: 'Барлық ескертулер',
  },
  criticalFindings: {
    ru: 'критических пунктов',
    kz: 'сыни тармақтар',
  },
  statusSafe: {
    ru: 'БЕЗОПАСНО',
    kz: 'ҚАУІПСІЗ',
  },
  statusWarning: {
    ru: 'ПРЕДУПРЕЖДЕНИЕ',
    kz: 'ЕСКЕРТУ',
  },
  statusActionRequired: {
    ru: 'ТРЕБУЕТ МЕР',
    kz: 'ШАРАЛАР ҚАЖЕТ',
  },
  statusBlocked: {
    ru: 'БЛОКИРОВКА',
    kz: 'БҰҒАТТАУ',
  },
  cleanMaterialNote: {
    ru: 'Материал чист. Признаков правонарушений не обнаружено.',
    kz: 'Материал таза. Құқық бұзушылық белгілері анықталмады.',
  },
  tabFindings: {
    ru: 'Выявленные нарушения',
    kz: 'Анықталған бұзушылықтар',
  },
  tabTranscript: {
    ru: 'Стенограмма и таймкоды',
    kz: 'Стенограмма және таймкодтар',
  },
  tabVisuals: {
    ru: 'Визуальный ряд и действия',
    kz: 'Визуалды көрініс пен әрекеттер',
  },
  tabLegalBasis: {
    ru: 'Юридические статьи и нормы РК',
    kz: 'Заң баптары және ҚР нормалары',
  },

  // Account Monitoring
  monitoringHeroTitle: {
    ru: 'Мониторинг аккаунтов и каналов (Казахстан)',
    kz: 'Аккаунттар мен арналарды бақылау (Қазақстан)',
  },
  monitoringHeroDesc: {
    ru: 'Автоматический аудит инфлюенсеров, блогеров и публичных медиа РК на соответствие Закону № 230-VII и КоАП РК.',
    kz: 'ҚР инфлюенсерлерін, блогерлерін және қоғамдық медиасын № 230-VII Заңы мен ҚР ӘҚБтК сәйкестігіне автоматты түрде аудиттеу.',
  },
  addAccountBtn: {
    ru: 'Добавить аккаунт',
    kz: 'Аккаунт қосу',
  },
  scanAllBtn: {
    ru: 'Сканировать все',
    kz: 'Барлығын сканерлеу',
  },
  accountsUnderControl: {
    ru: 'Аккаунтов на контроле',
    kz: 'Бақылаудағы аккаунттар',
  },
  incidents24h: {
    ru: 'Инцидентов за 24 ч',
    kz: '24 сағаттағы оқиғалар',
  },
  alertChannels: {
    ru: 'Каналов с ALERT',
    kz: 'ALERT арналары',
  },
  rkComplianceNorm: {
    ru: 'Индекс соответствия РК',
    kz: 'ҚР сәйкестік индексі',
  },
  liveIncidentFeed: {
    ru: 'Лента зафиксированных инцидентов и публикаций',
    kz: 'Тіркелген оқиғалар мен жарияланымдар таспасы',
  },
  dossierBtn: {
    ru: 'Досье',
    kz: 'Досье',
  },
  scanBtn: {
    ru: 'Скан',
    kz: 'Скан',
  },
  closeBtn: {
    ru: 'Закрыть',
    kz: 'Жабу',
  },
  cancelBtn: {
    ru: 'Отмена',
    kz: 'Бас тарту',
  },

  // Dashboard
  dashboardTitle: {
    ru: 'Дашборд и динамика нарушений',
    kz: 'Дашборд және құқық бұзушылық динамикасы',
  },
  dashboardSubtitle: {
    ru: 'Комплексная статистика аудита онлайн-контента в Казахстане: анализ видеорядов, аудиодорожек, скриншотов и веб-страниц по Закону РК № 230-VII и статьям КоАП РК.',
    kz: 'Қазақстандағы онлайн-мазмұн аудитінің кешенді статистикасы: № 230-VII Заңы және ҚР ӘҚБтК баптары бойынша бейне, аудио, скриншоттар мен веб-беттерді талдау.',
  },
  complianceCenter: {
    ru: 'Аналитический центр комплаенса',
    kz: 'Комплаенс талдау орталығы',
  },
  auditedMaterials: {
    ru: 'Проверено материалов',
    kz: 'Тексерілген материалдар',
  },
  detectedViolations: {
    ru: 'Выявлено нарушений',
    kz: 'Анықталған бұзушылықтар',
  },
  preventedFineRisk: {
    ru: 'Предотвращенный штраф',
    kz: 'Алдын алынған айыппұл',
  },
  complianceIndex: {
    ru: 'Индекс соответствия',
    kz: 'Сәйкестік индексі',
  },
  criticalViolations: {
    ru: 'Критических',
    kz: 'Сыни',
  },
  cleanMaterials: {
    ru: 'Чистые материалы',
    kz: 'Таза материалдар',
  },
  filterByContentType: {
    ru: 'Фильтр по типу контента:',
    kz: 'Мазмұн түрі бойынша сүзгі:',
  },
  allFormats: {
    ru: 'Все форматы',
    kz: 'Барлық форматтар',
  },
  videoFormat: {
    ru: 'Видео (Reels, TikTok, MP4)',
    kz: 'Бейне (Reels, TikTok, MP4)',
  },
  audioFormat: {
    ru: 'Аудио (Подкасты, Voice)',
    kz: 'Аудио (Подкасттар, Voice)',
  },
  screenshotFormat: {
    ru: 'Скриншоты & OCR',
    kz: 'Скриншоттар & OCR',
  },
  urlFormat: {
    ru: 'Веб-ссылки & Текст',
    kz: 'Веб-сілтемелер & Мәтін',
  },
  dynamicsTitle: {
    ru: 'Динамика найденных нарушений по типам контента',
    kz: 'Мазмұн түрлері бойынша табылған бұзушылықтар динамикасы',
  },
  riskStructureTitle: {
    ru: 'Структура правовых рисков',
    kz: 'Құқықтық тәуекелдер құрылымы',
  },
  formatBreakdownTitle: {
    ru: 'Категории нарушений в разрезе форматов контента',
    kz: 'Мазмұн форматтары бөлінісіндегі бұзушылық санаттары',
  },
  languageCompositionTitle: {
    ru: 'Языковой состав медиаматериалов',
    kz: 'Медиа-материалдардың тілдік құрамы',
  },
  registryMaterials: {
    ru: 'Материалы в реестре комплаенса',
    kz: 'Комплаенс тізіліміндегі материалдар',
  },
  clickToOpenReport: {
    ru: 'Кликните на любой проверенный материал для открытия детального экспертного заключения с таймкодами',
    kz: 'Таймкодтары бар егжей-тегжейлі сараптамалық қорытындыны ашу үшін кез келген тексерілген материалды басыңыз',
  },
  colFormat: {
    ru: 'Формат',
    kz: 'Формат',
  },
  colTitle: {
    ru: 'Наименование материала',
    kz: 'Материал атауы',
  },
  colDate: {
    ru: 'Дата аудита',
    kz: 'Аудит күні',
  },
  colStatus: {
    ru: 'Статус & Риск',
    kz: 'Статус & Тәуекел',
  },
  colViolations: {
    ru: 'Нарушения',
    kz: 'Бұзушылықтар',
  },
  colAction: {
    ru: 'Действие',
    kz: 'Әрекет',
  },
  openReportAction: {
    ru: 'Отчет',
    kz: 'Есеп',
  },
  noViolationsDetected: {
    ru: 'Нарушений не выявлено',
    kz: 'Бұзушылықтар анықталмады',
  },

  // Archive & History
  archiveTitle: {
    ru: 'Журнал проведенных проверок',
    kz: 'Жүргізілген тексерулер журналы',
  },
  archiveSubtitle: {
    ru: 'Реестр завершенных AI-аудитов по нормам Закона РК об онлайн-платформах и рекламе (№ 230-VII), статьям КоАП РК и правилам интернет-этики.',
    kz: 'ҚР онлайн-платформалар және жарнама туралы Заңы (№ 230-VII), ҚР ӘҚБтК баптары және интернет-этика ережелері бойынша аяқталған AI-аудиттер тізілімі.',
  },

  // PDF
  pdfReportTitle: {
    ru: 'Отчет аудита контента (PDF)',
    kz: 'Мазмұн аудитінің есебі (PDF)',
  },
  pdfPrintBtn: {
    ru: 'Печать / Сохранить в PDF',
    kz: 'Басып шығару / PDF сақтау',
  },

  // Footer
  footerRights: {
    ru: 'Аудит законодательства РК и интернет-этики',
    kz: 'ҚР заңнамасы мен интернет-этика аудиті',
  },
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  t: (key: keyof typeof DICTIONARY) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'ru',
  setLanguage: () => {},
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  t: (key) => DICTIONARY[key]?.ru || String(key),
});

export const ThemeLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('checkactivity_lang');
      if (saved === 'kz' || saved === 'ru') return saved;
    } catch {}
    return 'ru';
  });

  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('checkactivity_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {}
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem('checkactivity_lang', language);
    } catch {}
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem('checkactivity_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {}
  }, [theme]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const t = (key: keyof typeof DICTIONARY): string => {
    const entry = DICTIONARY[key];
    if (!entry) return String(key);
    return entry[language] || entry.ru || String(key);
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, theme, setTheme, toggleTheme, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useApp = () => useContext(I18nContext);
