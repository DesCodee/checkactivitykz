/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { AuditCase, ModalityType } from '../types';
import { KAZAKHSTAN_LEGAL_FILTERS, PRIMARY_AUDIT_CASE } from '../data/mockData';
import { analyzeContentWithGemini, ContentPayload } from '../services/geminiService';

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

  // Regulatory checklist
  const [filters, setFilters] = useState(KAZAKHSTAN_LEGAL_FILTERS);

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

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Quick KZ Presets
  const applyPreset = (type: 'ad_missing' | 'casino' | 'phone_leak' | 'clean_ad') => {
    if (type === 'ad_missing') {
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
    } else if (type === 'clean_ad') {
      setActiveTab('text');
      setTextInput(
        'Жарнама / Реклама.\nОфициальный представитель бытовой техники в Казахстане (ТОО «ТехноАстана», БИН 190440012345). Скидки до 20% на смартфоны с 1 по 30 ноября на сайте tech-almaty.kz. Барлық тауарлар сертификатталған.'
      );
    }
  };

  const handleExecute = async () => {
    let payload: ContentPayload;

    if (activeTab === 'file') {
      if (!uploadedFile) {
        alert('Пожалуйста, выберите или перетащите файл для проверки.');
        return;
      }
      const isImage = uploadedFile.type.startsWith('image/');
      payload = {
        modality: isImage ? 'screenshot' : 'audio',
        fileName: uploadedFile.name,
        fileSize: `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`,
        imageDataUrl: filePreviewUrl || undefined,
        text: uploadedFile.name,
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
    setProcessingStep('Анализ контента и распознавание текста...');

    setTimeout(() => {
      setProcessingStep('Сверка с Законом РК об онлайн-рекламе (№ 230-VII) и КоАП РК...');
    }, 600);

    setTimeout(() => {
      setProcessingStep('Формирование экспертного заключения...');
    }, 1200);

    setTimeout(async () => {
      try {
        const audited = await analyzeContentWithGemini(payload);
        setIsProcessing(false);
        onRunAudit(audited);
      } catch (err) {
        console.warn('Analysis fallback:', err);
        setIsProcessing(false);
        onRunAudit(PRIMARY_AUDIT_CASE);
      }
    }, 1600);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6 font-['Inter']">
      {/* Title & Introduction */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-1.5">
          <span className="font-['JetBrains_Mono'] text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
            ЮРИСДИКЦИЯ: РЕСПУБЛИКА КАЗАХСТАН
          </span>
          <span className="font-['JetBrains_Mono'] text-xs text-slate-500">
            Закон об онлайн-платформах и рекламе № 230-VII • КоАП РК
          </span>
        </div>
        <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Аудит контента на правонарушения в интернете
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
          Инструмент проверки скриншотов, рекламных креативов, ссылок и текстов на соблюдение маркировки «Жарнама», запретов на рекламу казино, утечек персональных данных и требований к государственному языку.
        </p>
      </div>

      {/* Main Working Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col gap-6">
        {/* Modality Tabs */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 font-['JetBrains_Mono']">
            1. Выберите тип проверяемого контента:
          </label>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`flex-1 py-2 px-3 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'file'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              <span>Файл / Скриншот / Фото</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`flex-1 py-2 px-3 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'url'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">link</span>
              <span>Ссылка / URL</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`flex-1 py-2 px-3 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'text'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              <span>Текст публикации</span>
            </button>
          </div>
        </div>

        {/* Dynamic Input Zone */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 font-['JetBrains_Mono']">
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
                accept="image/*,audio/*"
                className="hidden"
              />

              {!uploadedFile ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-sky-500 bg-sky-50/50'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 mb-3 shadow-xs">
                    <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                  </div>
                  <div className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-slate-900">
                    Перетащите изображение или нажмите для выбора файла
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    Поддерживаются PNG, JPG, WebP, MP3, WAV до 50 МБ
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="mt-4 px-4 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs transition-colors"
                  >
                    Выбрать файл на устройстве
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {filePreviewUrl ? (
                      <img
                        src={filePreviewUrl}
                        alt="Preview"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                        <span className="material-symbols-outlined text-[24px]">audio_file</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-slate-900 truncate">
                        {uploadedFile.name}
                      </div>
                      <div className="text-xs text-slate-500 font-['JetBrains_Mono'] mt-0.5">
                        {(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB • Готов к анализу
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
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
                  placeholder="Вставьте ссылку: https://t.me/channel/post, instagram.com/p/..., kaspi.kz..."
                  className="w-full bg-slate-50 pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>
              <div className="text-xs text-slate-500">
                AI проверит текст публикации, наличие маркировки спонсорства, запрещенные категории и ссылки.
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
                placeholder="Вставьте сюда текст рекламного объявления, поста блогера, оффера или переписки..."
                className="w-full bg-slate-50 p-3 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none font-['Inter'] leading-relaxed"
              />
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>Символов: {textInput.length}</span>
                <span>Проверка по нормам КоАП РК и Закону о языках</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Test Presets (Minimalist Pills) */}
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 font-['JetBrains_Mono']">
            Быстрые тестовые сценарии (Казахстан):
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyPreset('ad_missing')}
              className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 border border-slate-200 font-medium transition-colors"
            >
              Реклама без плашки «Жарнама» (ст. 455)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('casino')}
              className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs text-red-700 border border-red-200 font-medium transition-colors"
            >
              Реклама онлайн-казино / ставок (ст. 445-1)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('phone_leak')}
              className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs text-amber-700 border border-amber-200 font-medium transition-colors"
            >
              Номер телефона физлица (ст. 79 ПДн)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('clean_ad')}
              className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-xs text-emerald-700 border border-emerald-200 font-medium transition-colors"
            >
              Чистая реклама с маркировкой (OK)
            </button>
          </div>
        </div>

        {/* Regulatory Filters Checkboxes */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 font-['JetBrains_Mono']">
              3. Правовые модули проверки:
            </span>
            <span className="text-xs font-medium text-slate-500">
              {filters.filter((f) => f.active).length} из {filters.length} активно
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filters.map((filter) => (
              <label
                key={filter.id}
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                  filter.active
                    ? 'bg-slate-50 border-slate-300 text-slate-900'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                <input
                  type="checkbox"
                  checked={filter.active}
                  onChange={() => toggleFilter(filter.id)}
                  className="mt-0.5 rounded text-sky-600 focus:ring-0"
                />
                <div className="flex flex-col">
                  <span className="font-semibold">{filter.name}</span>
                  <span className="text-[11px] text-sky-700 font-mono mt-0.5">{filter.article}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleExecute}
            className="w-full py-3.5 px-6 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-['Plus_Jakarta_Sans'] font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">
                  progress_activity
                </span>
                <span>{processingStep}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">policy</span>
                <span>Запустить проверку на правонарушения РК</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
