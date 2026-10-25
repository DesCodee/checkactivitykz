/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { AuditCase, ModalityType } from '../types';
import { analyzeContentWithGemini, ContentPayload } from '../services/geminiService';

interface AuditPipelineViewProps {
  onOpenPdf: (auditCase: AuditCase) => void;
  history: AuditCase[];
  onSaveToHistory: (auditCase: AuditCase) => void;
  onSelectHistoryCase: (auditCase: AuditCase) => void;
}

export const AuditPipelineView: React.FC<AuditPipelineViewProps> = ({
  onOpenPdf,
  history,
  onSaveToHistory,
  onSelectHistoryCase,
}) => {
  // Input mode
  const [activeTab, setActiveTab] = useState<'image' | 'url' | 'text'>('image');

  // Input states
  const [urlInput, setUrlInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Analysis process
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState('');

  // Current active result
  const [currentResult, setCurrentResult] = useState<AuditCase | null>(null);

  // Handle file selection
  const handleFileChange = (file: File) => {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Drag handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setActiveTab('image');
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // One-click quick test presets
  const handleQuickPreset = (type: 'ad_missing' | 'casino' | 'phone_leak' | 'clean_ad') => {
    if (type === 'ad_missing') {
      setActiveTab('text');
      setTextInput(
        '🔥 Только сегодня скидка 40% на все курсы по крипте и арбитражу! Переходи по ссылке в описании профиля, пиши промокод KAZAKHSTAN и забирай доступ прямо сейчас.'
      );
    } else if (type === 'casino') {
      setActiveTab('text');
      setTextInput(
        'Казино 1win дарит 500% на первый депозит в тенге! Крути слоты, забирай фриспины по промокоду ALMATY_BONUS. Ссылка на зеркало в шапке профиля.'
      );
    } else if (type === 'phone_leak') {
      setActiveTab('text');
      setTextInput(
        'Срочно продам парковочное место в ЖК «Триумф Астана». Звоните владельцу напрямую: +7 701 555-12-34 (Канат), документы готовы.'
      );
    } else if (type === 'clean_ad') {
      setActiveTab('text');
      setTextInput(
        'Жарнама / Реклама.\nОфициальный представитель бренда электроники в Казахстане (ТОО «ТехноАстана», БИН 190440012345). Скидки до 20% на смартфоны с 1 по 30 ноября на официальном сайте tech-almaty.kz. Барлық тауарлар сертификатталған.'
      );
    }
  };

  // Start analysis
  const handleStartAnalysis = async () => {
    let payload: ContentPayload;

    if (activeTab === 'image') {
      if (!imagePreviewUrl) {
        alert('Пожалуйста, загрузите изображение для проверки.');
        return;
      }
      payload = {
        modality: 'screenshot',
        imageDataUrl: imagePreviewUrl,
        fileName: imageFile?.name || 'uploaded_image.png',
        fileSize: imageFile ? `${(imageFile.size / (1024 * 1024)).toFixed(2)} MB` : '1.2 MB',
      };
    } else if (activeTab === 'url') {
      if (!urlInput.trim()) {
        alert('Пожалуйста, введите ссылку для проверки.');
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

    setIsAnalyzing(true);
    setAnalysisStep('Чтение контента и распознавание текста (OCR)...');

    setTimeout(() => {
      setAnalysisStep('Сверка с Законом РК «Об онлайн-рекламе» (№ 230-VII)...');
    }, 700);

    setTimeout(() => {
      setAnalysisStep('Проверка на запрещенный контент (казино, вейпы, фейки, клевета, ПДн)...');
    }, 1400);

    setTimeout(async () => {
      try {
        const result = await analyzeContentWithGemini(payload);
        if (payload.imageDataUrl) {
          result.previewUrl = payload.imageDataUrl;
        }
        if (payload.text) {
          result.rawText = payload.text;
        }

        setCurrentResult(result);
        onSaveToHistory(result);
      } catch (err) {
        console.error('Audit failed:', err);
      } finally {
        setIsAnalyzing(false);
      }
    }, 2100);
  };

  // Reset to new scan
  const handleReset = () => {
    setCurrentResult(null);
    setImageFile(null);
    setImagePreviewUrl(null);
    setUrlInput('');
    setTextInput('');
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
      {/* App Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#3d494c]/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#06b6d4] to-[#4cd7f6] flex items-center justify-center text-[#003640] shadow-sm font-bold">
            <span className="material-symbols-outlined text-[20px]">verified_user</span>
          </div>
          <div>
            <h1 className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-bold text-[#dae2fd]">
              Check Activity KZ
            </h1>
            <p className="text-xs text-[#bcc9cd] font-['Inter']">
              Загрузить контент → AI-анализ → Вывод нарушений и рекомендаций
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {currentResult && (
            <button
              onClick={handleReset}
              className="px-3.5 py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] text-xs font-semibold flex items-center gap-1.5 border border-[#4cd7f6]/40 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              <span>Новая проверка</span>
            </button>
          )}
          {history.length > 0 && (
            <span className="font-['JetBrains_Mono'] text-[11px] text-[#869397] px-2.5 py-1 rounded bg-[#131b2e] border border-[#3d494c]/30">
              Проверено: {history.length}
            </span>
          )}
        </div>
      </div>

      {/* ==================== STEP 2: PROCESSING STATE ==================== */}
      {isAnalyzing && (
        <div className="rounded-2xl bg-[#131b2e] border border-[#4cd7f6]/50 p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-2xl animate-in fade-in">
          <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-[#222a3d] border-t-[#4cd7f6] animate-spin"></div>
            <span className="material-symbols-outlined text-[#4cd7f6] text-3xl">policy</span>
          </div>
          <h2 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#dae2fd] mb-2">
            Выполняется AI-аудит контента
          </h2>
          <p className="text-xs sm:text-sm text-[#4edea3] font-['JetBrains_Mono'] animate-pulse mb-4">
            {analysisStep}
          </p>
          <div className="w-full max-w-md bg-[#060e20] h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#06b6d4] to-[#4edea3] animate-[pulse_1s_infinite]"></div>
          </div>
        </div>
      )}

      {/* ==================== STEP 1: UPLOAD / INGESTION ==================== */}
      {!isAnalyzing && !currentResult && (
        <div className="flex flex-col gap-6">
          {/* Ingestion Type Tabs */}
          <div className="grid grid-cols-3 gap-2 bg-[#131b2e] p-1.5 rounded-xl border border-[#3d494c]/40">
            <button
              onClick={() => setActiveTab('image')}
              className={`py-2.5 px-3 rounded-lg font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'image'
                  ? 'bg-[#222a3d] text-[#4cd7f6] border border-[#4cd7f6]/40 shadow-sm'
                  : 'text-[#bcc9cd] hover:text-[#dae2fd]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">image</span>
              <span>Изображение / Скриншот</span>
            </button>
            <button
              onClick={() => setActiveTab('url')}
              className={`py-2.5 px-3 rounded-lg font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'url'
                  ? 'bg-[#222a3d] text-[#4cd7f6] border border-[#4cd7f6]/40 shadow-sm'
                  : 'text-[#bcc9cd] hover:text-[#dae2fd]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">link</span>
              <span>Ссылка на публикацию</span>
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`py-2.5 px-3 rounded-lg font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'text'
                  ? 'bg-[#222a3d] text-[#4cd7f6] border border-[#4cd7f6]/40 shadow-sm'
                  : 'text-[#bcc9cd] hover:text-[#dae2fd]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              <span>Текст рекламы / поста</span>
            </button>
          </div>

          {/* Active Tab Input Area */}
          <div className="bg-[#131b2e] rounded-2xl border border-[#3d494c]/50 p-6 flex flex-col gap-4 shadow-xl">
            {/* 1. IMAGE UPLOAD TAB */}
            {activeTab === 'image' && (
              <div className="flex flex-col gap-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  className="hidden"
                />

                {imagePreviewUrl ? (
                  <div className="relative rounded-xl overflow-hidden bg-[#060e20] border border-[#3d494c]/60 p-4 flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={imagePreviewUrl}
                      alt="Превью контента"
                      className="max-h-56 max-w-xs object-contain rounded-lg border border-[#3d494c]/40"
                    />
                    <div className="flex flex-col gap-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#dae2fd] truncate">
                          {imageFile?.name || 'Загруженное изображение'}
                        </span>
                        <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3] px-2 py-0.5 rounded bg-[#4edea3]/20">
                          ГОТОВО К АНАЛИЗУ
                        </span>
                      </div>
                      <span className="font-['JetBrains_Mono'] text-xs text-[#869397]">
                        Размер: {imageFile ? `${(imageFile.size / (1024 * 1024)).toFixed(2)} MB` : '1.2 MB'}
                      </span>
                      <p className="text-xs text-[#bcc9cd] mt-1">
                        Нейросеть распознает весь текст на картинке (OCR), проверит наличие плашки «Жарнама», логотипы брендов и отсутствие запрещенных товаров.
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 self-start text-xs text-[#4cd7f6] hover:underline flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                        <span>Выбрать другой файл</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`rounded-xl border-2 border-dashed p-8 sm:p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-[#4cd7f6] bg-[#222a3d]/80 scale-[1.01]'
                        : 'border-[#3d494c] bg-[#060e20]/60 hover:border-[#4cd7f6]/60 hover:bg-[#060e20]'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full bg-[#222a3d] flex items-center justify-center text-[#4cd7f6] mb-3 shadow-md">
                      <span className="material-symbols-outlined text-3xl">upload_file</span>
                    </div>
                    <span className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd] mb-1">
                      Перетащите скриншот сюда или нажмите для выбора
                    </span>
                    <span className="text-xs text-[#bcc9cd] font-['Inter'] max-w-sm mb-3">
                      Поддерживаются скриншоты постов Telegram, Instagram Reels, рекламные баннеры (PNG, JPG, WEBP).
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-[#222a3d] text-[#4cd7f6] font-['Plus_Jakarta_Sans'] text-xs font-semibold border border-[#4cd7f6]/30">
                      Выбрать файл на устройстве
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 2. URL INPUT TAB */}
            {activeTab === 'url' && (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold text-[#dae2fd]">
                  Ссылка на публикацию (Telegram, Instagram, сайт, TikTok)
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-3.5 text-[#4cd7f6] text-[20px]">link</span>
                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://t.me/channel/123 или https://instagram.com/p/..."
                    className="w-full bg-[#060e20] pl-11 pr-4 py-3 rounded-xl text-xs sm:text-sm text-[#dae2fd] font-['JetBrains_Mono'] border border-[#3d494c]/60 focus:border-[#4cd7f6] focus:outline-none"
                  />
                </div>
                <span className="text-[11px] text-[#869397] font-['Inter']">
                  AI-движок проверит текст поста, наличие идентификатора рекламы и отсутствие ссылок на нелицензированные сервисы.
                </span>
              </div>
            )}

            {/* 3. TEXT INPUT TAB */}
            {activeTab === 'text' && (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-semibold text-[#dae2fd]">
                  Текст рекламного поста или публикации для аудита
                </label>
                <textarea
                  rows={5}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Вставьте сюда текст рекламного сообщения, поста блогера, объявление или транскрипт..."
                  className="w-full bg-[#060e20] p-4 rounded-xl text-xs sm:text-sm text-[#dae2fd] font-['Inter'] border border-[#3d494c]/60 focus:border-[#4cd7f6] focus:outline-none leading-relaxed"
                />
                <span className="text-[11px] text-[#869397] font-['Inter']">
                  Проверка на Закон об онлайн-рекламе № 230-VII, запрет нелегальных казино, клевету (ст. 73-3) и открытые ПДн (ст. 79).
                </span>
              </div>
            )}

            {/* Quick 1-click test examples */}
            <div className="pt-2 border-t border-[#222a3d] flex flex-col gap-2">
              <span className="text-[11px] font-['JetBrains_Mono'] text-[#869397] uppercase">
                Быстрые примеры для тестирования в 1 клик:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickPreset('ad_missing')}
                  className="px-2.5 py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-xs text-[#dae2fd] border border-[#3d494c]/40 font-['Inter'] transition-colors"
                >
                  ⚡ Реклама без «Жарнама»
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('casino')}
                  className="px-2.5 py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-xs text-[#ff6b6b] border border-[#ff6b6b]/30 font-['Inter'] transition-colors"
                >
                  🎰 Реклама онлайн-казино
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('phone_leak')}
                  className="px-2.5 py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-xs text-[#adc6ff] border border-[#3d494c]/40 font-['Inter'] transition-colors"
                >
                  📱 Публикация телефона физлица
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickPreset('clean_ad')}
                  className="px-2.5 py-1.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-xs text-[#4edea3] border border-[#4edea3]/30 font-['Inter'] transition-colors"
                >
                  ✓ Чистая реклама с маркировкой
                </button>
              </div>
            </div>

            {/* Big Action Button */}
            <button
              onClick={handleStartAnalysis}
              className="mt-2 w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#0566d9] hover:opacity-95 text-[#001f26] font-['Plus_Jakarta_Sans'] text-sm sm:text-base font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[22px]">policy</span>
              <span>Запустить AI-анализ контента</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP 3: OUTPUT / RESULT ==================== */}
      {!isAnalyzing && currentResult && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          {/* Result Header & Risk Score Card */}
          <div className="rounded-2xl bg-[#131b2e] border border-[#3d494c]/50 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="flex flex-col gap-1 text-center md:text-left">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <span className="font-['JetBrains_Mono'] text-xs text-[#4cd7f6] font-bold">
                  {currentResult.referenceNumber}
                </span>
                <span className="text-[#3d494c]">|</span>
                <span className="font-['JetBrains_Mono'] text-xs text-[#869397]">
                  {currentResult.timestamp}
                </span>
              </div>
              <h2 className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-bold text-[#dae2fd]">
                Результат аудита: {currentResult.title}
              </h2>
              <span className="text-xs text-[#bcc9cd]">
                Проверено по законам Республики Казахстан (Закон № 230-VII, КоАП РК, Закон о языках)
              </span>
            </div>

            {/* Risk Badge Dial */}
            <div className="flex items-center gap-4 bg-[#060e20] p-4 rounded-xl border border-[#3d494c]/40 shrink-0">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 72 72">
                  <circle cx="36" cy="36" r="30" fill="transparent" stroke="#222a3d" strokeWidth="6"></circle>
                  <circle
                    cx="36"
                    cy="36"
                    r="30"
                    fill="transparent"
                    stroke={
                      currentResult.riskScore > 65
                        ? '#ff6b6b'
                        : currentResult.riskScore > 35
                        ? '#adc6ff'
                        : '#4edea3'
                    }
                    strokeWidth="6"
                    strokeDasharray="188.4"
                    strokeDashoffset={188.4 - (188.4 * currentResult.riskScore) / 100}
                    strokeLinecap="round"
                  ></circle>
                </svg>
                <span
                  className={`font-['JetBrains_Mono'] text-sm font-bold absolute ${
                    currentResult.riskScore > 65
                      ? 'text-[#ff6b6b]'
                      : currentResult.riskScore > 35
                      ? 'text-[#adc6ff]'
                      : 'text-[#4edea3]'
                  }`}
                >
                  {currentResult.riskScore}%
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-['JetBrains_Mono'] text-[#869397] uppercase">
                  Уровень риска:
                </span>
                <span
                  className={`font-['Plus_Jakarta_Sans'] text-base font-bold ${
                    currentResult.riskScore > 65
                      ? 'text-[#ff6b6b]'
                      : currentResult.riskScore > 35
                      ? 'text-[#adc6ff]'
                      : 'text-[#4edea3]'
                  }`}
                >
                  {currentResult.riskLevel}
                </span>
                <span
                  className={`mt-0.5 px-2 py-0.5 rounded text-[10px] font-['JetBrains_Mono'] font-bold self-start ${
                    currentResult.status === 'ТРЕБУЕТ МЕР'
                      ? 'bg-[#ff6b6b]/20 text-[#ff6b6b]'
                      : currentResult.status === 'ПРЕДУПРЕЖДЕНИЕ'
                      ? 'bg-[#0566d9]/25 text-[#adc6ff]'
                      : 'bg-[#1bbd85]/20 text-[#4edea3]'
                  }`}
                >
                  {currentResult.status}
                </span>
              </div>
            </div>
          </div>

          {/* Grid: Preview & Issues */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Content Preview */}
            <div className="lg:col-span-5 rounded-2xl bg-[#131b2e] border border-[#3d494c]/50 p-5 flex flex-col gap-3 shadow-lg">
              <span className="font-['JetBrains_Mono'] text-xs font-semibold text-[#dae2fd] uppercase flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#4cd7f6]">visibility</span>
                Проверяемый материал
              </span>

              {currentResult.previewUrl ? (
                <div className="rounded-xl overflow-hidden border border-[#3d494c]/60 bg-[#060e20] p-2">
                  <img
                    src={currentResult.previewUrl}
                    alt="Загруженный скриншот"
                    className="w-full max-h-80 object-contain rounded-lg"
                  />
                </div>
              ) : currentResult.rawText ? (
                <div className="rounded-xl bg-[#060e20] p-4 border border-[#3d494c]/40 text-xs text-[#dae2fd] font-['Inter'] whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {currentResult.rawText}
                </div>
              ) : (
                <div className="rounded-xl bg-[#060e20] p-4 border border-[#3d494c]/40 text-xs text-[#dae2fd] font-['JetBrains_Mono']">
                  {currentResult.sourceName}
                </div>
              )}

              <div className="flex items-center justify-between text-[11px] font-['JetBrains_Mono'] text-[#869397] pt-1">
                <span>Хеш: {currentResult.sha256.slice(0, 16)}...</span>
                <span className="text-[#4edea3]">AI OCR Verified</span>
              </div>
            </div>

            {/* Right: Detected Issues & Legal Rules */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#ff6b6b] text-[20px]">report_problem</span>
                  <span>Обнаруженные замечания ({currentResult.violations.length})</span>
                </h3>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">
                  Законодательство РК
                </span>
              </div>

              {currentResult.violations.length === 0 ? (
                <div className="rounded-xl bg-[#131b2e] border border-[#4edea3]/40 p-6 flex items-center gap-3 text-xs text-[#dae2fd]">
                  <span className="material-symbols-outlined text-[#4edea3] text-3xl">verified</span>
                  <div>
                    <span className="font-bold text-sm block text-[#4edea3]">Нарушений не выявлено</span>
                    <span className="text-[#bcc9cd]">
                      Материал соответствует базовым правилам онлайн-рекламы и не содержит запрещенного контента.
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {currentResult.violations.map((violation, idx) => (
                    <div
                      key={violation.id || idx}
                      className="rounded-xl bg-[#131b2e] border border-[#3d494c]/40 p-4.5 flex flex-col gap-2.5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-['JetBrains_Mono'] text-xs font-bold text-[#ff6b6b]">
                            #{idx + 1}
                          </span>
                          <h4 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#dae2fd]">
                            {violation.title}
                          </h4>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-[#ff6b6b]/20 text-[#ff6b6b] font-['JetBrains_Mono'] text-[10px] font-bold shrink-0">
                          {violation.code}
                        </span>
                      </div>

                      <p className="text-xs text-[#bcc9cd] font-['Inter'] leading-relaxed bg-[#060e20] p-3 rounded-lg border border-[#3d494c]/30">
                        {violation.basis}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-['JetBrains_Mono'] text-[#869397] pt-1">
                        <span>
                          Возможный штраф: <strong className="text-[#ff6b6b]">{violation.fineAmount}</strong>
                        </span>
                        <span>
                          Орган: <strong className="text-[#dae2fd]">{violation.jurisdiction}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actionable Recommendations Checklist */}
              <div className="rounded-xl bg-[#131b2e] border border-[#06b6d4]/40 p-5 flex flex-col gap-2.5 shadow-md">
                <span className="font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-bold text-[#4cd7f6] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">checklist</span>
                  Что нужно исправить автору перед публикацией:
                </span>
                <ul className="text-xs text-[#bcc9cd] font-['Inter'] space-y-1.5 list-disc list-inside">
                  <li>
                    Добавить четкую отметку <strong className="text-[#dae2fd]">«Жарнама / Реклама»</strong> в начале или на самом изображении (Закон РК № 230-VII).
                  </li>
                  <li>
                    Указать наименование и БИН/ИИН рекламодателя либо ссылку на официальный сайт.
                  </li>
                  <li>
                    Обеспечить дублирование рекламного текста на государственном (казахском) языке (ст. 21 Закона о языках).
                  </li>
                  <li>
                    Исключить прямые ссылки на нелицензированные азартные игры и открытые персональные данные физлиц.
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => onOpenPdf(currentResult)}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#06b6d4] to-[#0566d9] text-[#001f26] font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md hover:opacity-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                  <span>Скачать отчет (PDF)</span>
                </button>
                <button
                  onClick={handleReset}
                  className="py-3 px-5 rounded-xl bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold border border-[#3d494c]/40 transition-colors"
                >
                  Проверить другой контент
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== RECENT USER CHECKS (REAL HISTORY) ==================== */}
      {history.length > 0 && !isAnalyzing && (
        <div className="mt-4 pt-6 border-t border-[#3d494c]/30 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-[#bcc9cd] uppercase tracking-wider">
              Ваши проверки в текущей сессии ({history.length}):
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectHistoryCase(item)}
                className={`p-3 rounded-xl bg-[#131b2e] border transition-all cursor-pointer flex flex-col justify-between gap-2 hover:border-[#4cd7f6]/60 ${
                  currentResult?.id === item.id ? 'border-[#4cd7f6]' : 'border-[#3d494c]/30'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-['Plus_Jakarta_Sans'] text-xs font-semibold text-[#dae2fd] truncate">
                    {item.title}
                  </span>
                  <span
                    className={`font-['JetBrains_Mono'] text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                      item.riskScore > 65
                        ? 'bg-[#ff6b6b]/20 text-[#ff6b6b]'
                        : item.riskScore > 35
                        ? 'bg-[#0566d9]/25 text-[#adc6ff]'
                        : 'bg-[#1bbd85]/20 text-[#4edea3]'
                    }`}
                  >
                    {item.riskScore}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-['JetBrains_Mono'] text-[#869397]">
                  <span>{item.referenceNumber}</span>
                  <span>{item.violations.length} проблем</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
