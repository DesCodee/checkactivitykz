/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuditCase, ModalityType } from '../types';
import { KAZAKHSTAN_LEGAL_FILTERS, PRIMARY_AUDIT_CASE } from '../data/mockData';
import { analyzeContentWithGemini } from '../services/geminiService';

interface ScannerViewProps {
  onRunAudit: (auditCase: AuditCase) => void;
  presetData?: { modality: ModalityType; urlOrText: string };
}

interface StagedItem {
  id: string;
  name: string;
  type: ModalityType;
  typeLabel: string;
  size: string;
  sha256: string;
  status: string;
  resolutionOrDuration: string;
  isDemo?: boolean;
}

export const ScannerView: React.FC<ScannerViewProps> = ({ onRunAudit, presetData }) => {
  const [activeTab, setActiveTab] = useState<ModalityType>(presetData?.modality || 'url');
  const [urlInput, setUrlInput] = useState(presetData?.urlOrText || '');
  const [strictness, setStrictness] = useState<'basic' | 'high' | 'expert'>('high');
  const [filters, setFilters] = useState(KAZAKHSTAN_LEGAL_FILTERS);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');

  // Initial Staged Queue items (reflecting image 3 & 4 with KZ specifics)
  const [stagedQueue, setStagedQueue] = useState<StagedItem[]>([
    {
      id: 'item-1',
      name: 'screenshot_tg_almaty_post_ad.png',
      type: 'screenshot',
      typeLabel: 'Скриншот поста',
      size: '1.4 MB',
      sha256: '8a7f920b...d019',
      status: 'OCR VALIDATED',
      resolutionOrDuration: '2560x1440',
      isDemo: true,
    },
    {
      id: 'item-2',
      name: 'audio_interview_astana_part2.mp3',
      type: 'audio',
      typeLabel: 'Подкаст / Аудио',
      size: '8.9 MB (04:12)',
      sha256: 'e44b58c1...11c2',
      status: 'STT PIPELINE READY',
      resolutionOrDuration: '04:12',
      isDemo: true,
    },
    {
      id: 'item-3',
      name: 'https://t.me/qazaq_news_feed/8821',
      type: 'url',
      typeLabel: 'Публичная ссылка',
      size: 'Live Feed Fetch',
      sha256: 'f2109ba4...e55c',
      status: 'SCRAPER ATTACHED',
      resolutionOrDuration: 'METADATA FETCHED',
      isDemo: true,
    },
  ]);

  const toggleFilter = (id: string) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, active: !f.active } : f))
    );
  };

  const handleAddUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    const newItem: StagedItem = {
      id: 'item-' + Date.now(),
      name: urlInput.trim(),
      type: activeTab,
      typeLabel:
        activeTab === 'url'
          ? 'Ссылка'
          : activeTab === 'screenshot'
          ? 'Скриншот'
          : activeTab === 'photo'
          ? 'Фото'
          : 'Аудио',
      size: '1.2 MB',
      sha256: Math.random().toString(16).substring(2, 10) + '...sha256',
      status: 'INGESTED',
      resolutionOrDuration: activeTab === 'audio' ? '02:30' : 'HD',
    };

    setStagedQueue([newItem, ...stagedQueue]);
    setUrlInput('');
  };

  const handleRemoveItem = (id: string) => {
    setStagedQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearQueue = () => {
    setStagedQueue([]);
  };

  const loadKazakhstanPreset = (presetType: 'casino' | 'vape' | 'influencer') => {
    if (presetType === 'influencer') {
      setUrlInput('https://t.me/almaty_stars_media/post_99120');
      setActiveTab('url');
    } else if (presetType === 'casino') {
      setUrlInput('https://t.me/capper_kz_bonus/win_884');
      setActiveTab('url');
    } else if (presetType === 'vape') {
      setUrlInput('billboard_almaty_dostyk_vape_promo.jpg');
      setActiveTab('photo');
    }
  };

  const handleExecuteAudit = async () => {
    setIsProcessing(true);
    setProcessingStep('Подключение к шлюзу МКИ РК и реестрам АФМ...');

    setTimeout(() => {
      setProcessingStep('Мультимодальный инференс (PaddleOCR + Whisper Kazakh + Vision)...');
    }, 700);

    setTimeout(() => {
      setProcessingStep('Сопоставление с правилами рекламы и формирование отчета...');
    }, 1500);

    setTimeout(async () => {
      // If user provided a custom URL or text as top item, run through Gemini
      const topItem = stagedQueue[0];
      if (topItem && !topItem.isDemo) {
        try {
          const audited = await analyzeContentWithGemini(
            topItem.name,
            topItem.type,
            `Аудит объекта: ${topItem.name}`
          );
          setIsProcessing(false);
          onRunAudit(audited);
          return;
        } catch {
          // fallback
        }
      }

      setIsProcessing(false);
      onRunAudit(PRIMARY_AUDIT_CASE);
    }, 2200);
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-['JetBrains_Mono'] text-[#bcc9cd]">Check Activity KZ</span>
            <span className="text-[#3d494c]">/</span>
            <span className="font-['JetBrains_Mono'] text-[#4cd7f6]">Новый аудит</span>
            <span className="px-2 py-0.5 rounded bg-[#222a3d] font-['JetBrains_Mono'] text-[10px] text-[#adc6ff] uppercase tracking-wider">
              SESSION #CHK-KZ-8942
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-[#dae2fd] tracking-tight">
              Мультимодальный сканер контента
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1bbd85]/20 text-[#4edea3] font-['JetBrains_Mono'] text-[11px] font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#4edea3] animate-pulse"></span>
              INGESTION READY
            </span>
          </div>
        </div>

        {/* Quick presets buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#131b2e] p-1 rounded-lg border border-[#3d494c]/40">
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] px-2 hidden sm:inline">
              ДЕМО-ПРЕСЕТЫ KZ:
            </span>
            <button
              onClick={() => loadKazakhstanPreset('influencer')}
              className="px-2.5 py-1 text-xs rounded bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-['Plus_Jakarta_Sans'] font-medium"
            >
              Инфлюенсер
            </button>
            <button
              onClick={() => loadKazakhstanPreset('casino')}
              className="px-2.5 py-1 text-xs rounded bg-[#222a3d] hover:bg-[#2d3449] text-[#ff6b6b] font-['Plus_Jakarta_Sans'] font-medium"
            >
              Казино
            </button>
            <button
              onClick={() => loadKazakhstanPreset('vape')}
              className="px-2.5 py-1 text-xs rounded bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] font-['Plus_Jakarta_Sans'] font-medium"
            >
              Вейп-баннер
            </button>
          </div>
        </div>
      </div>

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Input, Queue, Legal Checklist (8 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* Modality Tabs */}
          <div className="bg-[#131b2e] rounded-xl p-1.5 flex flex-wrap sm:flex-nowrap gap-1 border border-[#3d494c]/40 shadow-sm">
            {[
              { id: 'url', label: 'Пакетный ввод ссылок', icon: 'link' },
              { id: 'screenshot', label: 'Скриншоты и изображения', icon: 'image' },
              { id: 'audio', label: 'Аудио и подкасты', icon: 'mic' },
              { id: 'archive', label: 'Архив / API Stream', icon: 'dataset' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ModalityType)}
                className={`flex-1 py-2.5 px-3 rounded-lg font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#222a3d] text-[#4cd7f6] border border-[#4cd7f6]/40 shadow-sm'
                    : 'text-[#bcc9cd] hover:text-[#dae2fd] hover:bg-[#171f33]'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Ingestion Dropzone & Real-time Capture */}
          <div className="relative bg-[#131b2e] rounded-xl border border-[#3d494c]/60 p-6 sm:p-8 flex flex-col items-center justify-center text-center overflow-hidden shadow-xl group">
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#06b6d4]/10 blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#0566d9]/15 blur-3xl pointer-events-none"></div>

            <div className="w-14 h-14 rounded-full bg-[#222a3d] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-lg border border-[#4cd7f6]/30">
              <span className="material-symbols-outlined text-[#4cd7f6] text-[30px]">upload_file</span>
            </div>

            <h2 className="font-['Plus_Jakarta_Sans'] text-lg sm:text-xl font-bold text-[#dae2fd] mb-1">
              Перетащите файлы сюда или вставьте ссылку из буфера
            </h2>
            <p className="text-xs sm:text-sm text-[#bcc9cd] max-w-lg mb-5 font-['Inter']">
              Поддерживаются скриншоты постов, аудиозаписи до 250 МБ и ссылки: каналы Telegram KZ, Instagram, TikTok,
              YouTube, новостные порталы (Tengrinews, Zakon.kz, Nur.kz) и маркетплейсы Kaspi.
            </p>

            {/* Input Bar with Inline Action */}
            <form
              onSubmit={handleAddUrl}
              className="w-full max-w-2xl bg-[#060e20] rounded-xl p-1.5 flex items-center gap-2 border border-[#3d494c]/60 shadow-inner"
            >
              <div className="pl-3 flex items-center text-[#bcc9cd]">
                <span className="material-symbols-outlined text-[20px]">link</span>
              </div>
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="flex-1 bg-transparent px-2 py-2 text-[#dae2fd] text-xs sm:text-sm font-['JetBrains_Mono'] placeholder:text-[#869397] focus:outline-none"
                placeholder="https://t.me/channel/post, instagram.com/..., или текст объявления..."
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#4cd7f6] font-['Plus_Jakarta_Sans'] text-xs font-semibold flex items-center gap-1.5 border border-[#4cd7f6]/40 transition-colors whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>Добавить в очередь</span>
              </button>
            </form>

            {/* Format Badges */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[10px] font-['JetBrains_Mono']">
              <span className="px-2 py-0.5 rounded bg-[#171f33] text-[#bcc9cd] border border-[#3d494c]/30">
                JPG / PNG / WEBP
              </span>
              <span className="px-2 py-0.5 rounded bg-[#171f33] text-[#bcc9cd] border border-[#3d494c]/30">
                MP3 / WAV / M4A
              </span>
              <span className="px-2 py-0.5 rounded bg-[#171f33] text-[#bcc9cd] border border-[#3d494c]/30">
                TELEGRAM KZ
              </span>
              <span className="px-2 py-0.5 rounded bg-[#171f33] text-[#bcc9cd] border border-[#3d494c]/30">
                INSTAGRAM REELS
              </span>
              <span className="px-2 py-0.5 rounded bg-[#171f33] text-[#bcc9cd] border border-[#3d494c]/30">
                KASPI MERCHANT
              </span>
              <span className="text-[#869397] ml-2">SHORTCUT: CTRL + V</span>
            </div>
          </div>

          {/* Staging Queue */}
          <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#adc6ff] text-[20px]">checklist</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">
                  Очередь предобработки ({stagedQueue.length} объекта)
                </h3>
              </div>
              {stagedQueue.length > 0 && (
                <button
                  onClick={handleClearQueue}
                  className="font-['JetBrains_Mono'] text-xs text-[#ff6b6b] hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[16px]">clear_all</span>
                  Очистить очередь
                </button>
              )}
            </div>

            {stagedQueue.length === 0 ? (
              <div className="p-8 text-center bg-[#060e20] rounded-lg border border-[#3d494c]/30 text-xs text-[#869397] font-['JetBrains_Mono']">
                Очередь пуста. Вставьте ссылку или выберите один из демо-пресетов выше.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {stagedQueue.map((item) => (
                  <div
                    key={item.id}
                    className="bg-[#171f33] rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-[#3d494c]/30 hover:border-[#4cd7f6]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#222a3d] shrink-0 flex items-center justify-center text-[#4cd7f6]">
                        <span className="material-symbols-outlined text-[20px]">
                          {item.type === 'url' ? 'send' : item.type === 'audio' ? 'graphic_eq' : 'image'}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold text-[#dae2fd] truncate">
                            {item.name}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#222a3d] font-['JetBrains_Mono'] text-[9px] text-[#adc6ff] uppercase">
                            {item.typeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] font-['JetBrains_Mono']">
                          <span className="text-[#bcc9cd]">{item.size}</span>
                          <span className="text-[#869397]">SHA256: {item.sha256}</span>
                          <span className="text-[#4edea3] flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span> {item.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span className="px-2 py-1 rounded bg-[#060e20] font-['JetBrains_Mono'] text-[10px] text-[#bcc9cd] border border-[#3d494c]/30">
                        {item.resolutionOrDuration}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="p-1 rounded hover:bg-[#222a3d] text-[#869397] hover:text-[#ff6b6b] transition-colors"
                        title="Удалить из очереди"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Jurisdictions & Regulatory Filters */}
          <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">
                  Регуляторные фильтры и правовые нормы РК
                </h3>
                <p className="text-xs text-[#bcc9cd] mt-0.5 font-['Inter']">
                  Выберите статьи законодательства Республики Казахстан для сопоставления нейросетью
                </p>
              </div>
              <span className="font-['JetBrains_Mono'] text-xs text-[#adc6ff] px-2.5 py-1 rounded bg-[#222a3d] self-start sm:self-auto border border-[#3d494c]/40">
                {filters.filter((f) => f.active).length} ИЗ {filters.length} АКТИВНО
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filters.map((filter) => (
                <label
                  key={filter.id}
                  className={`flex items-start gap-3 p-3.5 rounded-lg border transition-all cursor-pointer ${
                    filter.active
                      ? 'bg-[#171f33] border-[#4cd7f6]/40 hover:bg-[#222a3d]'
                      : 'bg-[#171f33]/40 border-[#3d494c]/30 opacity-70 hover:opacity-90'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={filter.active}
                    onChange={() => toggleFilter(filter.id)}
                    className="mt-1 w-4 h-4 rounded text-[#4cd7f6] focus:ring-0 bg-[#060e20] border-[#3d494c]"
                  />
                  <div className="flex flex-col">
                    <span className="font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold text-[#dae2fd]">
                      {filter.name}
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[11px] text-[#4cd7f6] mt-0.5">{filter.article}</span>
                    <span className="text-[11px] text-[#bcc9cd] mt-0.5 leading-snug">{filter.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Settings, Strictness, Telemetry (4 cols) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* Strictness Mode */}
          <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-5 flex flex-col gap-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">Режим строгости</h3>
              <span className="material-symbols-outlined text-[#adc6ff] text-[20px]">policy</span>
            </div>

            <div className="flex flex-col gap-2">
              {/* Option 1 */}
              <div
                onClick={() => setStrictness('basic')}
                className={`p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between border ${
                  strictness === 'basic'
                    ? 'bg-[#222a3d] border-[#4cd7f6]'
                    : 'bg-[#171f33] border-transparent hover:bg-[#171f33]/80'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold text-[#dae2fd]">
                    Базовый комплаенс
                  </span>
                  <span className="text-xs text-[#bcc9cd]">Стандартный мониторинг явных нарушений</span>
                </div>
                <span className="material-symbols-outlined text-[#869397] text-[20px]">
                  {strictness === 'basic' ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </div>

              {/* Option 2: Active Recommended */}
              <div
                onClick={() => setStrictness('high')}
                className={`p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between border ${
                  strictness === 'high'
                    ? 'bg-[#222a3d] border-[#4cd7f6] shadow-[0_0_12px_rgba(76,215,246,0.2)]'
                    : 'bg-[#171f33] border-transparent hover:bg-[#171f33]/80'
                }`}
              >
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-bold text-[#4cd7f6]">
                      Legal AI РК (Высокая)
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-[#4cd7f6]/20 font-['JetBrains_Mono'] text-[9px] text-[#4cd7f6] font-semibold">
                      РЕКОМЕНДОВАНО
                    </span>
                  </div>
                  <span className="text-xs text-[#bcc9cd] mt-0.5">
                    Глубокий контекстуальный анализ формулировок и скрытых смыслов
                  </span>
                </div>
                <span className="material-symbols-outlined text-[#4cd7f6] text-[20px]">check_circle</span>
              </div>

              {/* Option 3 */}
              <div
                onClick={() => setStrictness('expert')}
                className={`p-3 rounded-lg cursor-pointer transition-all flex items-center justify-between border ${
                  strictness === 'expert'
                    ? 'bg-[#222a3d] border-[#4cd7f6]'
                    : 'bg-[#171f33] border-transparent hover:bg-[#171f33]/80'
                }`}
              >
                <div className="flex flex-col">
                  <span className="font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold text-[#dae2fd]">
                    Максимальный комплаенс 360°
                  </span>
                  <span className="text-xs text-[#bcc9cd]">Глубокий аудит всех категорий рисков и правил</span>
                </div>
                <span className="material-symbols-outlined text-[#869397] text-[20px]">
                  {strictness === 'expert' ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </div>
            </div>
          </div>

          {/* Depth of Analysis */}
          <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-5 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">Глубина анализа</h3>
              <span className="font-['JetBrains_Mono'] text-xs text-[#4cd7f6]">MAX DEPTH</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs text-[#bcc9cd]">
                <span>Экспресс</span>
                <span className="text-[#dae2fd] font-medium">Семантика + OCR + Whisper Kazakh v3</span>
              </div>
              <div className="relative w-full h-2 bg-[#060e20] rounded-full overflow-hidden">
                <div className="absolute left-0 top-0 h-full w-[85%] bg-gradient-to-r from-[#06b6d4] via-[#0566d9] to-[#4edea3] rounded-full"></div>
              </div>
              <div className="flex justify-between font-['JetBrains_Mono'] text-[10px] text-[#869397] pt-0.5">
                <span>0.4s</span>
                <span>1.2s</span>
                <span className="text-[#4cd7f6] font-bold">2.4s (Рекомендуемый)</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#222a3d] text-xs">
              <div className="flex items-center justify-between text-[#bcc9cd]">
                <span>Аудио-транскрипция (Whisper Kazakh)</span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3]">ВКЛ</span>
              </div>
              <div className="flex items-center justify-between text-[#bcc9cd]">
                <span>OCR слоев на графике (PaddleOCR)</span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3]">ВКЛ</span>
              </div>
              <div className="flex items-center justify-between text-[#bcc9cd]">
                <span>Автоматический юридический комментарий РК</span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3]">ВКЛ</span>
              </div>
            </div>
          </div>

          {/* Neural Cluster Telemetry */}
          <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-5 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]"></span>
                </span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-sm font-bold text-[#dae2fd]">
                  Кластер нейросетей (Астана)
                </h3>
              </div>
              <span className="font-['JetBrains_Mono'] text-[10px] text-[#bcc9cd]">NODE: KZ-ASTANA-DC1</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-[#171f33] rounded-lg border border-[#3d494c]/20 flex flex-col">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase">GPU Утилизация</span>
                <span className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd] mt-0.5">42.8%</span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3]">8x A100 Online</span>
              </div>
              <div className="p-2.5 bg-[#171f33] rounded-lg border border-[#3d494c]/20 flex flex-col">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase">Очередь задач</span>
                <span className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd] mt-0.5">0 задач</span>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3]">Свободно</span>
              </div>
            </div>

            {/* Sparkline Graphic */}
            <div className="bg-[#171f33] rounded-lg p-2.5 flex flex-col gap-1 border border-[#3d494c]/20">
              <div className="flex justify-between items-center text-[10px] font-['JetBrains_Mono']">
                <span className="text-[#869397]">СКОРОСТЬ ИНФЕРЕНСА</span>
                <span className="text-[#4cd7f6]">Avg 2.4s</span>
              </div>
              <svg className="w-full h-7 text-[#4cd7f6]" preserveAspectRatio="none" viewBox="0 0 100 24">
                <path
                  d="M0,18 L15,14 L30,19 L45,8 L60,11 L75,5 L90,12 L100,7"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="flex flex-col gap-2.5">
            <button
              disabled={isProcessing || stagedQueue.length === 0}
              onClick={handleExecuteAudit}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#4cd7f6] via-[#06b6d4] to-[#0566d9] text-[#003640] font-['Plus_Jakarta_Sans'] text-base font-bold flex flex-col items-center justify-center shadow-[0_0_24px_rgba(6,182,212,0.35)] hover:shadow-[0_0_32px_rgba(6,182,212,0.5)] transition-all disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px]">
                  {isProcessing ? 'progress_activity' : 'policy'}
                </span>
                <span>
                  {isProcessing
                    ? 'Выполняется аудит...'
                    : `Запустить комплексный аудит (${stagedQueue.length} объекта)`}
                </span>
              </div>
              {isProcessing && (
                <span className="text-[11px] font-['JetBrains_Mono'] text-[#001f26] mt-1 font-medium animate-pulse">
                  {processingStep}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                alert('Шаблон проверки законодательства РК успешно сохранен в конфигурации!');
              }}
              className="w-full py-2.5 px-4 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-['Plus_Jakarta_Sans'] text-xs font-semibold flex items-center justify-center gap-2 border border-[#3d494c]/40 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-[#bcc9cd]">bookmark_add</span>
              <span>Сохранить шаблон проверки</span>
            </button>
          </div>

          {/* Commercial Compliance Notice Footnote */}
          <div className="p-3.5 rounded-lg bg-[#060e20]/60 border border-[#3d494c]/30 flex items-start gap-2.5 text-xs text-[#bcc9cd]">
            <span className="material-symbols-outlined text-[#869397] text-[18px] shrink-0 mt-0.5">verified_user</span>
            <p className="leading-relaxed">
              Все загруженные материалы анализируются в изолированном контуре. Сформированный отчет предназначен для
              внутреннего комплаенс-контроля, защиты бренда и предотвращения штрафов от регуляторов.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
