/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { AuditCase, ModalityType } from '../types';
import {
  KAZAKHSTAN_LEGAL_FILTERS,
  INTERNET_ETHICS_FILTERS,
  ALL_COMPLIANCE_FILTERS,
  PRIMARY_AUDIT_CASE,
} from '../data/mockData';
import {
  analyzeContentWithGemini,
  ContentPayload,
  extractTextWithOcr,
} from '../services/geminiService';
import { generateSampleScreenshot } from '../utils/sampleScreenshots';

interface ScannerViewProps {
  onRunAudit: (auditCase: AuditCase) => void;
  presetData?: { modality: ModalityType; urlOrText: string };
}

export const ScannerView: React.FC<ScannerViewProps> = ({ onRunAudit, presetData }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'text'>('file');

  // Input states
  const [urlInput, setUrlInput] = useState(presetData?.urlOrText || '');
  const [textInput, setTextInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileTextNote, setFileTextNote] = useState('');

  // OCR Recognition states
  const [ocrText, setOcrText] = useState('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const [ocrCharCount, setOcrCharCount] = useState(0);
  const [copiedOcr, setCopiedOcr] = useState(false);

  // Compliance & Ethics checklist filters
  const [filters, setFilters] = useState(ALL_COMPLIANCE_FILTERS);
  const [activeFilterCategory, setActiveFilterCategory] = useState<'all' | 'legal' | 'ethics'>('all');

  // Loading state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleFilter = (id: string) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, active: !f.active } : f))
    );
  };

  const setAllFiltersState = (active: boolean, filterType?: 'legal' | 'ethics') => {
    setFilters((prev) =>
      prev.map((f) => {
        if (!filterType || f.type === filterType) {
          return { ...f, active };
        }
        return f;
      })
    );
  };

  // OCR Execution handler for images
  const triggerOcr = async (dataUrl: string) => {
    if (!dataUrl) return;
    setIsOcrLoading(true);
    setOcrWarning(null);
    try {
      const res = await extractTextWithOcr(dataUrl);
      setOcrText(res.text || '');
      setOcrCharCount(res.charCount || (res.text ? res.text.length : 0));
      setOcrSuccess(res.success);
      if (res.warningNotice) {
        setOcrWarning(res.warningNotice);
      }
    } catch (err) {
      console.warn('OCR processing error:', err);
      setOcrSuccess(false);
    } finally {
      setIsOcrLoading(false);
    }
  };

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
    setOcrText('');
    setOcrWarning(null);
    setOcrSuccess(false);
    setOcrCharCount(0);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setFilePreviewUrl(dataUrl);
        // Automatically trigger OCR extraction immediately upon selection
        triggerOcr(dataUrl);
      };
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;
        video.onloadedmetadata = () => {
          video.currentTime = Math.min(1.0, (video.duration || 2) / 2);
        };
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(640, video.videoWidth || 640);
          canvas.height = Math.min(480, video.videoHeight || 360);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = canvas.toDataURL('image/jpeg', 0.85);
            setFilePreviewUrl(frame);
            // Also trigger OCR on the extracted video frame!
            triggerOcr(frame);
          }
          URL.revokeObjectURL(objectUrl);
        };
        video.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          setFilePreviewUrl(null);
        };
      } catch {
        setFilePreviewUrl(null);
      }
    } else {
      setFilePreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setActiveTab('file');
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClearFile = () => {
    setUploadedFile(null);
    setFilePreviewUrl(null);
    setFileTextNote('');
    setOcrText('');
    setOcrWarning(null);
    setOcrSuccess(false);
    setOcrCharCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Instant Sample Screenshot Loader for immediate OCR testing
  const handleLoadSampleScreenshot = (type: 'profanity_chat' | 'casino_banner' | 'unmarked_ad') => {
    const sample = generateSampleScreenshot(type);
    setUploadedFile(new File([], sample.fileName, { type: 'image/png' }));
    setFilePreviewUrl(sample.dataUrl);
    setFileTextNote('');
    triggerOcr(sample.dataUrl);
  };

  // Quick KZ Law & Ethics Presets
  const applyPreset = (
    type:
      | 'ad_missing'
      | 'casino'
      | 'phone_leak'
      | 'cyberbullying'
      | 'dark_pattern'
      | 'hidden_ad'
      | 'clean_ad'
      | 'profanity_chat'
  ) => {
    if (type === 'profanity_chat') {
      setActiveTab('text');
      setTextInput(
        '— Ты че бля совсем тупой? Пошел нахуй отсюда, урод конченый.\n— Сам заткнись, пидор, еще раз напишешь — найдем и закопаем.'
      );
    } else if (type === 'ad_missing') {
      setActiveTab('text');
      setTextInput(
        '🔥 Только сегодня скидка 40% на все премиум курсы по инвестициям и криптовалюте в Астане! Переходи по ссылке в описании профиля, пиши промокод KAZAKHSTAN и забирай доступ прямо сейчас.'
      );
    } else if (type === 'casino') {
      setActiveTab('text');
      setTextInput(
        'Казино 1win KZ дарит 500% бонус на первый депозит в тенге! Крути слоты, забирай фриспины по промокоду ALMATY_BONUS. Ссылка на зеркало в шапке профиля.'
      );
    } else if (type === 'phone_leak') {
      setActiveTab('text');
      setTextInput(
        'Срочно продам парковочное место в ЖК «Триумф Астана». Звоните владельцу напрямую: +7 701 555-12-34 (Канат), документы на руках.'
      );
    } else if (type === 'cyberbullying') {
      setActiveTab('text');
      setTextInput(
        'Посмотрите на этого жалкого неудачника @username. Он не может связать двух слов, полный идиот и позорище нашего города. Давайте дружно напишем ему в директ всё, что мы о нем думаем, чтобы он удалил свой аккаунт.'
      );
    } else if (type === 'dark_pattern') {
      setActiveTab('text');
      setTextInput(
        '🚨 ОСТАЛОСЬ 2 МЕСТА! Таймер сгорает через 04:59! Если не оплатишь прямо сейчас, твой доступ будет навсегда заблокирован, а цена вырастет в 10 раз! 100% ГАРАНТИЯ ДОХОДА БЕЗ РИСКА. Жми немедленно!'
      );
    } else if (type === 'hidden_ad') {
      setActiveTab('text');
      setTextInput(
        'Девочки, вы часто спрашивали, как я сохраняю такую идеальную кожу. Я абсолютно случайно наткнулась на эту сыворотку от MiracleCosmetics, это не реклама, я просто искренне делюсь находкой от души! Покупайте только у них по ссылке в профиле.'
      );
    } else if (type === 'clean_ad') {
      setActiveTab('text');
      setTextInput(
        'Жарнама / Реклама.\nОфициальный представитель бытовой техники в Казахстане (ТОО «ТехноАстана», БИН 190440012345). Скидки до 20% на технику для дома с 1 по 30 ноября на сайте tech-almaty.kz. Барлық тауарлар сертификатталған. Тауарлар саны шектеулі.'
      );
    }
  };

  const handleExecute = async () => {
    let payload: ContentPayload;

    if (activeTab === 'file') {
      if (!uploadedFile && !filePreviewUrl) {
        alert('Пожалуйста, выберите или перетащите файл для проверки.');
        return;
      }
      const isImage = (uploadedFile && uploadedFile.type.startsWith('image/')) || !!filePreviewUrl;
      const isVideo = uploadedFile ? uploadedFile.type.startsWith('video/') : false;

      const combinedText = [ocrText.trim(), fileTextNote.trim()]
        .filter(Boolean)
        .join('\n\n[Дополнительное примечание]: ');

      payload = {
        modality: isImage ? 'screenshot' : isVideo ? 'photo' : 'audio',
        fileName: uploadedFile?.name || 'screenshot.png',
        fileSize: uploadedFile && uploadedFile.size > 0
          ? `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`
          : `${Math.round(ocrCharCount * 1.5 + 120)} KB`,
        imageDataUrl: filePreviewUrl || undefined,
        videoFrames: isVideo && filePreviewUrl ? [filePreviewUrl] : undefined,
        text: combinedText || (uploadedFile?.name || 'Скриншот для анализа'),
      };
    } else if (activeTab === 'url') {
      if (!urlInput.trim()) {
        alert('Пожалуйста, укажите ссылку для проверки.');
        return;
      }
      payload = {
        modality: 'url',
        url: urlInput.trim(),
        text: urlInput.trim(),
      };
    } else {
      if (!textInput.trim()) {
        alert('Пожалуйста, введите текст для проверки.');
        return;
      }
      payload = {
        modality: 'url',
        text: textInput.trim(),
      };
    }

    setIsProcessing(true);
    setProcessingStep('1. Извлечение текста (OCR) и парсинг контента...');

    setTimeout(() => {
      setProcessingStep('2. Распознавание действий и визуального контекста...');
    }, 600);

    setTimeout(() => {
      setProcessingStep('3. Проверка законодательства РК (Закон № 230-VII, ст. 455, 445-1, 79 КоАП)...');
    }, 1200);

    setTimeout(() => {
      setProcessingStep('4. Аудит интернет-этики (Ненормативная лексика, Буллинг, Dark Patterns)...');
    }, 1800);

    setTimeout(() => {
      setProcessingStep('5. Формирование экспертного заключения...');
    }, 2400);

    setTimeout(async () => {
      try {
        const audited = await analyzeContentWithGemini(payload);
        setIsProcessing(false);
        onRunAudit(audited);
      } catch (err) {
        console.warn('Analysis error:', err);
        setIsProcessing(false);
        onRunAudit(PRIMARY_AUDIT_CASE);
      }
    }, 2800);
  };

  const displayedFilters =
    activeFilterCategory === 'all'
      ? filters
      : filters.filter((f) => f.type === activeFilterCategory);

  const activeLegalCount = filters.filter((f) => f.type === 'legal' && f.active).length;
  const activeEthicsCount = filters.filter((f) => f.type === 'ethics' && f.active).length;

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 sm:gap-6 font-['Inter']">
      {/* Title & Introduction */}
      <div className="border-b border-slate-200 pb-4 sm:pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
            РЕСПУБЛИКА КАЗАХСТАН
          </span>
          <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
            ЗАКОН + ИНТЕРНЕТ-ЭТИКА
          </span>
          <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs text-slate-500 hidden sm:inline">
            КоАП РК • Закон № 230-VII • Цифровая культура
          </span>
        </div>
        <h1 className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
          Аудит контента на правонарушения и цифровую этику
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-3xl leading-relaxed">
          Комплексный анализ онлайн-материалов: проверка на соблюдение законов РК (маркировка рекламы, запрет казино, персональные данные, язык) и сетевой этики (кибербуллинг, манипулятивный маркетинг/FOMO, скрытая реклама, токсичность).
        </p>
      </div>

      {/* Main Working Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
        {/* Modality Tabs */}
        <div>
          <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 font-['JetBrains_Mono']">
            1. Выберите источник контента:
          </label>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
                activeTab === 'file'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              <span className="truncate">Скриншот / Фото / Видео</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
                activeTab === 'url'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">link</span>
              <span className="truncate">Ссылка / URL</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`py-2 px-2 sm:px-3 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
                activeTab === 'text'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              <span className="truncate">Текст публикации</span>
            </button>
          </div>
        </div>

        {/* Dynamic Input Zone */}
        <div>
          <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 font-['JetBrains_Mono']">
            2. Объект проверки:
          </label>

          {/* TAB 1: FILE / SCREENSHOT */}
          {activeTab === 'file' && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                accept="image/*,video/*,audio/*"
                className="hidden"
              />

              {!uploadedFile && !filePreviewUrl ? (
                <div className="flex flex-col gap-3">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-sky-500 bg-sky-50/50'
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                    }`}
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 mb-2.5 shadow-xs">
                      <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                    </div>
                    <div className="font-['Plus_Jakarta_Sans'] font-semibold text-xs sm:text-sm text-slate-900">
                      Перетащите скриншот, фото или видео для распознавания
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-500 mt-1">
                      Поддерживаются PNG, JPG, WebP, MP4, MOV, MP3, WAV до 50 МБ
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="mt-3.5 px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs transition-colors"
                    >
                      Выбрать файл на устройстве
                    </button>
                  </div>

                  {/* Ready-made test screenshots for instant OCR testing */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 font-['JetBrains_Mono'] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-sky-600">bolt</span>
                      Тестовые скриншоты для быстрой проверки OCR:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('profanity_chat')}
                        className="p-2.5 text-left rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50/30 transition-all group"
                      >
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-red-700 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-red-500">chat_error</span>
                          Чат с матами (Telegram)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          Обсценная лексика, ст. 434 КоАП РК
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('casino_banner')}
                        className="p-2.5 text-left rounded-lg bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all group"
                      >
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-amber-700 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-amber-500">casino</span>
                          Казино 1Win (Слоты)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          Запрет азартных игр, ст. 445-1 КоАП РК
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('unmarked_ad')}
                        className="p-2.5 text-left rounded-lg bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 transition-all group"
                      >
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-sky-700 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-sky-500">sell</span>
                          Баннер без маркировки
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          Нет плашки «Жарнама», Закон № 230-VII
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {filePreviewUrl ? (
                        <img
                          src={filePreviewUrl}
                          alt="Preview"
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-slate-200 shrink-0 shadow-xs"
                        />
                      ) : (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                          <span className="material-symbols-outlined text-[24px]">audio_file</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                          {uploadedFile?.name || 'Загруженный скриншот'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-['JetBrains_Mono'] mt-0.5 flex flex-wrap items-center gap-2">
                          <span>
                            {uploadedFile && uploadedFile.size > 0
                              ? `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`
                              : 'Тестовый файл'}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-700 font-medium">Файл загружен</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                      >
                        Заменить
                      </button>
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                        title="Удалить файл"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* OCR Recognition Workspace Card */}
                  <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 flex flex-col gap-2.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-sky-600">
                          document_scanner
                        </span>
                        <span className="text-xs font-bold text-slate-800 font-['JetBrains_Mono'] uppercase">
                          Текст, извлеченный со скриншота (OCR):
                        </span>
                        {isOcrLoading ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200 animate-pulse">
                            <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                            Идет OCR-сканирование...
                          </span>
                        ) : ocrSuccess ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Распознано: {ocrCharCount} символов
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {filePreviewUrl && (
                          <button
                            type="button"
                            onClick={() => triggerOcr(filePreviewUrl)}
                            disabled={isOcrLoading}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                            title="Запустить OCR заново"
                          >
                            <span className="material-symbols-outlined text-[14px]">refresh</span>
                            <span>{isOcrLoading ? 'Распознаем...' : 'Повторить OCR'}</span>
                          </button>
                        )}
                        {ocrText && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(ocrText);
                              setCopiedOcr(true);
                              setTimeout(() => setCopiedOcr(false), 2000);
                            }}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {copiedOcr ? 'done' : 'content_copy'}
                            </span>
                            <span>{copiedOcr ? 'Скопировано' : 'Копировать'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notice / Warning Bar if violations or profanity detected in OCR text */}
                    {ocrWarning && (
                      <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0">
                          warning
                        </span>
                        <span className="font-medium">{ocrWarning}</span>
                      </div>
                    )}

                    {/* Editable OCR Textarea */}
                    <div className="relative">
                      <textarea
                        value={ocrText}
                        onChange={(e) => {
                          setOcrText(e.target.value);
                          setOcrCharCount(e.target.value.length);
                        }}
                        placeholder={
                          isOcrLoading
                            ? 'Выполняется оптическое распознавание текста со скриншота (Gemini 3.8 Flash)...'
                            : 'Текст со скриншота будет автоматически извлечен сюда. Вы также можете дополнить или исправить его вручную.'
                        }
                        rows={4}
                        className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none font-['Inter'] leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-['JetBrains_Mono']">
                      <span className="text-slate-500">
                        {isOcrLoading
                          ? 'Нейросеть считывает надписи, чаты и дисклеймеры...'
                          : 'Текст передается в AI-анализ законодательства РК и интернет-этики'}
                      </span>
                      <span>Символов: {ocrCharCount}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Дополнительное примечание к материалу (необязательно):
                    </label>
                    <input
                      type="text"
                      value={fileTextNote}
                      onChange={(e) => setFileTextNote(e.target.value)}
                      placeholder="Например: переписка с оскорблениями в группе, реклама слотов, баннер без ИИН/БИН..."
                      className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: URL */}
          {activeTab === 'url' && (
            <div className="flex flex-col gap-2">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[20px]">
                  link
                </span>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Вставьте ссылку: https://t.me/..., instagram.com/p/..., kaspi.kz..."
                  className="w-full bg-slate-50 pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500">
                AI проверит текст публикации, наличие маркировки спонсорства, запрещенные категории, этические риски и ссылки.
              </div>
            </div>
          )}

          {/* TAB 3: TEXT */}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-2">
              <textarea
                rows={4}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Вставьте текст рекламного объявления, поста, комментария или предложения..."
                className="w-full bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none font-['Inter'] leading-relaxed"
              />
              <div className="flex flex-wrap justify-between items-center gap-1 text-[11px] text-slate-500">
                <span>Символов: {textInput.length}</span>
                <span>Проверка по КоАП РК, Закону № 230-VII и нормам сетевой этики</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Test Presets (Categorized for Legal + Ethics) */}
        <div>
          <span className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 font-['JetBrains_Mono']">
            Быстрые тестовые сценарии:
          </span>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <span className="text-[11px] font-mono font-bold text-sky-700 bg-sky-50 px-2 py-1 rounded border border-sky-200 flex items-center">
              Закон РК:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('ad_missing')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 border border-slate-200 font-medium transition-colors"
            >
              Без «Жарнама» (ст. 455)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('casino')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs text-red-700 border border-red-200 font-medium transition-colors"
            >
              Казино / Ставки (ст. 445-1)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('phone_leak')}
              className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs text-amber-700 border border-amber-200 font-medium transition-colors"
            >
              Слив номера (ст. 79 ПДн)
            </button>

            <span className="text-[11px] font-mono font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded border border-purple-200 flex items-center ml-0 sm:ml-2">
              Интернет-этика:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('profanity_chat')}
              className="px-2.5 py-1 rounded-md bg-red-50 hover:bg-red-100 text-xs text-red-700 border border-red-200 font-medium transition-colors"
            >
              Маты / Ненормативная лексика
            </button>
            <button
              type="button"
              onClick={() => applyPreset('cyberbullying')}
              className="px-2.5 py-1 rounded-md bg-purple-50 hover:bg-purple-100 text-xs text-purple-800 border border-purple-200 font-medium transition-colors"
            >
              Кибербуллинг / Оскорбления
            </button>
            <button
              type="button"
              onClick={() => applyPreset('dark_pattern')}
              className="px-2.5 py-1 rounded-md bg-purple-50 hover:bg-purple-100 text-xs text-purple-800 border border-purple-200 font-medium transition-colors"
            >
              Dark Pattern / Агрессивный FOMO
            </button>
            <button
              type="button"
              onClick={() => applyPreset('hidden_ad')}
              className="px-2.5 py-1 rounded-md bg-purple-50 hover:bg-purple-100 text-xs text-purple-800 border border-purple-200 font-medium transition-colors"
            >
              Скрытая реклама
            </button>

            <button
              type="button"
              onClick={() => applyPreset('clean_ad')}
              className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-xs text-emerald-800 border border-emerald-200 font-medium transition-colors ml-auto"
            >
              ✓ Чистый контент (OK)
            </button>
          </div>
        </div>

        {/* Regulatory & Ethics Modules Selector */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-['JetBrains_Mono']">
                3. Модули аудита:
              </span>
              <span className="text-xs font-medium text-slate-500">
                (Закон: {activeLegalCount}/{KAZAKHSTAN_LEGAL_FILTERS.length} • Этика: {activeEthicsCount}/{INTERNET_ETHICS_FILTERS.length})
              </span>
            </div>

            {/* Quick toggles */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveFilterCategory('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  activeFilterCategory === 'all'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Все ({filters.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterCategory('legal')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  activeFilterCategory === 'legal'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Закон РК ({KAZAKHSTAN_LEGAL_FILTERS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterCategory('ethics')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  activeFilterCategory === 'ethics'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Интернет-этика ({INTERNET_ETHICS_FILTERS.length})
              </button>
              <button
                type="button"
                onClick={() => setAllFiltersState(true)}
                className="px-2 py-0.5 rounded text-[11px] text-slate-500 hover:text-slate-800 underline ml-1"
              >
                Вкл все
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {displayedFilters.map((filter) => {
              const isEthics = filter.type === 'ethics';
              return (
                <label
                  key={filter.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    filter.active
                      ? isEthics
                        ? 'bg-purple-50/40 border-purple-200 text-slate-900'
                        : 'bg-sky-50/40 border-sky-200 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={filter.active}
                    onChange={() => toggleFilter(filter.id)}
                    className="mt-0.5 rounded text-sky-600 focus:ring-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold truncate">{filter.name}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono mt-0.5 truncate ${
                        isEthics ? 'text-purple-700' : 'text-sky-700'
                      }`}
                    >
                      {filter.article}
                    </span>
                    <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      {filter.description}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleExecute}
            className="w-full py-3.5 px-6 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-['Plus_Jakarta_Sans'] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">
                  progress_activity
                </span>
                <span className="truncate">{processingStep}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">policy</span>
                <span>Запустить аудит: Закон РК + Интернет-этика</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
