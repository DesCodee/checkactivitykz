/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ModalityType } from '../types';

interface HomeViewProps {
  onStartScanner: (preset?: { modality: ModalityType; urlOrText: string }) => void;
  onOpenReport: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onStartScanner, onOpenReport }) => {
  const [activeTab, setActiveTab] = useState<ModalityType>('url');
  const [inputValue, setInputValue] = useState('https://t.me/media_almaty/channel_post_89412');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    score: number;
    level: string;
    registryHit: string;
    adMarker: string;
    langCompliance: string;
  } | null>(null);

  const handleTabSwitch = (tab: ModalityType) => {
    setActiveTab(tab);
    if (tab === 'url') {
      setInputValue('https://t.me/media_almaty/channel_post_89412');
    } else if (tab === 'screenshot') {
      setInputValue('screenshot_instagram_ad_almaty.png');
    } else if (tab === 'photo') {
      setInputValue('banner_dostyk_plaza_vape_check.jpg');
    } else if (tab === 'audio') {
      setInputValue('podcast_business_fm_kz_04min.mp3');
    }
  };

  const handleExpressScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setScanResult({
        score: 98.2,
        level: 'Низкий риск',
        registryHit: 'CLEAR / 0 HITS',
        adMarker: 'FOUND («ЖАРНАМА»)',
        langCompliance: 'СОБЛЮДЕН (КАЗ / РУС)',
      });
    }, 1200);
  };

  return (
    <div className="w-full flex flex-col">
      {/* Hero Section */}
      <div className="relative w-full overflow-hidden bg-[#060e20] py-16 sm:py-24 border-b border-[#3d494c]/20">
        <div className="absolute inset-0 pointer-events-none opacity-25">
          <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#06b6d4] filter blur-[120px]"></div>
          <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-[#0566d9] filter blur-[140px]"></div>
          <div className="absolute -bottom-20 left-1/3 w-80 h-80 rounded-full bg-[#1bbd85] filter blur-[100px]"></div>
        </div>

        <div className="relative w-full px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col items-center text-center">
          {/* Badge: AI Guard Kazakhstan */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#222a3d] border border-[#4cd7f6]/40 shadow-sm mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4cd7f6] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4cd7f6]"></span>
            </span>
            <span className="font-['JetBrains_Mono'] text-xs text-[#4cd7f6] uppercase tracking-wider font-semibold">
              AI Guard v4.2 • Интеграция с реестрами МКИ РК, АФМ и Законом об онлайн-рекламе РК
            </span>
          </div>

          <h1 className="font-['Plus_Jakarta_Sans'] text-3xl sm:text-5xl lg:text-6xl text-[#dae2fd] max-w-5xl tracking-tight leading-tight font-bold">
            Мгновенный AI-аудит контента на <span className="text-[#4cd7f6]">правонарушения</span> и риски в Казахстане
          </h1>

          <p className="text-base sm:text-lg text-[#bcc9cd] max-w-3xl mt-4 mb-10 leading-relaxed font-['Inter']">
            Комплексный анализ ссылок, скриншотов, фото и аудио по нормам законодательства РК (Закон об онлайн-платформах и
            онлайн-рекламе № 230-VII, КоАП РК, УК РК, Закон о языках и защита персональных данных) за 2.4 секунды.
          </p>

          {/* Interactive Inspection Workspace Panel */}
          <div className="w-full max-w-5xl bg-[#131b2e]/95 rounded-2xl border border-[#3d494c]/60 shadow-[0_20px_50px_rgba(0,0,0,0.6)] p-5 sm:p-7 text-left backdrop-blur-xl">
            {/* Tab switch bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-5 bg-[#060e20]/70 p-1.5 rounded-xl border border-[#3d494c]/30">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'url', label: 'Ссылка / URL', icon: 'link' },
                  { id: 'screenshot', label: 'Скриншот', icon: 'screenshot_monitor' },
                  { id: 'photo', label: 'Фотография', icon: 'photo_camera' },
                  { id: 'audio', label: 'Аудиодорожка', icon: 'mic' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTabSwitch(t.id as ModalityType)}
                    className={`px-3.5 py-2 rounded-lg font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all ${
                      activeTab === t.id
                        ? 'bg-[#222a3d] text-[#4cd7f6] shadow-sm border border-[#4cd7f6]/30'
                        : 'text-[#bcc9cd] hover:text-[#dae2fd] hover:bg-[#171f33]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>

              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#222a3d] border border-[#3d494c]/40">
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#bcc9cd] uppercase">
                  JURISDICTION: KAZAKHSTAN (РК)
                </span>
              </div>
            </div>

            {/* Split layout: Inputs & Live Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Target Input & Law Matrix */}
              <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
                <div className="flex flex-col space-y-2">
                  <label className="font-['Plus_Jakarta_Sans'] text-sm font-semibold text-[#dae2fd] flex items-center justify-between">
                    <span>Объект инспекции в Казнете</span>
                    <span className="font-['JetBrains_Mono'] text-xs text-[#4cd7f6]">
                      {activeTab === 'url' && 'Deep-Link & Telegram KZ Parser active'}
                      {activeTab === 'screenshot' && 'Paddle-OCR Kazakh / Russian Cyrillic'}
                      {activeTab === 'photo' && 'Computer Vision + Qazpatent Trademark'}
                      {activeTab === 'audio' && 'Whisper-v3 Kazakh & Russian Diarization'}
                    </span>
                  </label>

                  {activeTab === 'url' ? (
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-[#4cd7f6] text-[20px]">
                        public
                      </span>
                      <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        className="w-full bg-[#060e20] pl-11 pr-4 py-3 rounded-lg text-[#dae2fd] font-['JetBrains_Mono'] text-xs sm:text-sm border border-[#3d494c]/60 focus:border-[#4cd7f6] focus:outline-none"
                        placeholder="https://t.me/channel, instagram.com/p/..., tengrinews..."
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => handleTabSwitch(activeTab)}
                      className="flex flex-col items-center justify-center p-6 rounded-lg bg-[#060e20] border border-dashed border-[#3d494c] hover:border-[#4cd7f6] transition-colors cursor-pointer group"
                    >
                      <span className="material-symbols-outlined text-[#4cd7f6] text-3xl mb-1 group-hover:scale-110 transition-transform">
                        cloud_upload
                      </span>
                      <span className="font-['Plus_Jakarta_Sans'] text-xs sm:text-sm font-semibold text-[#dae2fd]">
                        Загрузите {activeTab === 'audio' ? 'аудиодорожку (MP3, WAV)' : 'изображение (PNG, JPG)'}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[11px] text-[#869397] mt-0.5">
                        Выбран демо-файл: <span className="text-[#4cd7f6]">{inputValue}</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Legal Check Matrix (Kazakhstan) */}
                <div className="bg-[#171f33] p-3.5 rounded-xl border border-[#3d494c]/40 flex flex-col gap-2">
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase tracking-wider">
                    Активные правовые модули (Legal Check Matrix РК):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center gap-2 text-[#dae2fd] cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded text-[#4cd7f6] focus:ring-0 bg-[#060e20]" />
                      <span>Маркировка рекламы «Жарнама» (№ 230-VII)</span>
                    </label>
                    <label className="flex items-center gap-2 text-[#dae2fd] cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded text-[#4cd7f6] focus:ring-0 bg-[#060e20]" />
                      <span>Ложная информация и фейки (ст. 456-2 КоАП)</span>
                    </label>
                    <label className="flex items-center gap-2 text-[#dae2fd] cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded text-[#4cd7f6] focus:ring-0 bg-[#060e20]" />
                      <span>Запрет казино и ставок (ст. 445-1 КоАП)</span>
                    </label>
                    <label className="flex items-center gap-2 text-[#dae2fd] cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded text-[#4cd7f6] focus:ring-0 bg-[#060e20]" />
                      <span>Защита ПДн & ИИН (Закон РК № 94-V)</span>
                    </label>
                  </div>
                </div>

                {/* Express Scan Button */}
                <div className="flex gap-2">
                  <button
                    disabled={isScanning}
                    onClick={handleExpressScan}
                    className="flex-1 py-3 px-5 rounded-lg bg-gradient-to-r from-[#06b6d4] to-[#0566d9] hover:opacity-95 text-[#001f26] font-['Plus_Jakarta_Sans'] font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {isScanning ? 'progress_activity' : 'cases'}
                    </span>
                    <span>{isScanning ? 'Идет юридический анализ...' : 'Запустить экспресс-анализ'}</span>
                    <span className="font-['JetBrains_Mono'] text-[10px] uppercase px-2 py-0.5 rounded bg-[#060e20]/40 text-[#dae2fd] ml-1">
                      0.8s avg
                    </span>
                  </button>

                  <button
                    onClick={() => onStartScanner({ modality: activeTab, urlOrText: inputValue })}
                    className="px-4 py-3 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-['Plus_Jakarta_Sans'] text-xs font-semibold flex items-center gap-1.5 border border-[#3d494c]/60 transition-colors"
                    title="Перейти в расширенный мультимодальный сканер"
                  >
                    <span className="material-symbols-outlined text-sm text-[#4cd7f6]">tune</span>
                    <span className="hidden sm:inline">В сканер</span>
                  </button>
                </div>
              </div>

              {/* Right Column: Evidentiary Inspector Card */}
              <div className="lg:col-span-5 bg-[#060e20] rounded-xl border border-[#3d494c]/50 p-4 sm:p-5 flex flex-col justify-between min-h-[300px] shadow-inner">
                <div className="flex items-center justify-between pb-2 border-b border-[#222a3d]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#4edea3]"></span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#bcc9cd] uppercase tracking-wider">
                      EVIDENTIARY INSPECTOR KZ
                    </span>
                  </div>
                  <span
                    className={`font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded font-semibold ${
                      isScanning
                        ? 'bg-[#06b6d4]/20 text-[#4cd7f6] animate-pulse'
                        : scanResult
                        ? 'bg-[#1bbd85]/20 text-[#4edea3]'
                        : 'bg-[#222a3d] text-[#4edea3]'
                    }`}
                  >
                    {isScanning ? 'PARSING ENGINES...' : scanResult ? 'COMPLIANT / VERIFIED' : 'READY'}
                  </span>
                </div>

                <div className="flex-1 flex flex-col justify-center space-y-2.5 py-3">
                  {/* Safety Index Gauge */}
                  <div className="flex items-center justify-between bg-[#171f33] p-3 rounded-lg border border-[#3d494c]/30">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg bg-[#06b6d4]/20 flex items-center justify-center text-[#4cd7f6]">
                        <span className="material-symbols-outlined text-[20px]">verified_user</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="font-['Plus_Jakarta_Sans'] text-xs font-semibold text-[#dae2fd]">
                          Индекс безопасности
                        </span>
                        <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">
                          Юридическая чистота для РК
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#4edea3]">
                        {scanResult ? `${scanResult.score}%` : '98.2%'}
                      </span>
                      <span className="font-['JetBrains_Mono'] text-[10px] block text-[#4edea3]">
                        {scanResult ? scanResult.level : 'Низкий риск'}
                      </span>
                    </div>
                  </div>

                  {/* Checklist Items */}
                  <div className="bg-[#171f33] p-3 rounded-lg space-y-1.5 text-xs border border-[#3d494c]/30">
                    <div className="flex items-center justify-between">
                      <span className="text-[#bcc9cd] font-['Inter']">Реестры МКИ РК / АФМ:</span>
                      <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3] px-1.5 py-0.5 rounded bg-[#222a3d]">
                        {scanResult ? scanResult.registryHit : 'CLEAR / 0 HITS'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#bcc9cd] font-['Inter']">Маркировка «Жарнама»:</span>
                      <span className="font-['JetBrains_Mono'] text-[10px] text-[#adc6ff] px-1.5 py-0.5 rounded bg-[#222a3d]">
                        {scanResult ? scanResult.adMarker : 'FOUND (№ 230-VII)'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#bcc9cd] font-['Inter']">Баланс языков (Закон о языках):</span>
                      <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3] px-1.5 py-0.5 rounded bg-[#222a3d]">
                        {scanResult ? scanResult.langCompliance : 'СОБЛЮДЕН (КАЗ / РУС)'}
                      </span>
                    </div>
                  </div>

                  {/* Cryptographic Seal info */}
                  <div className="p-2 rounded bg-[#222a3d]/60 border border-[#3d494c]/40 flex items-center justify-between">
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] truncate max-w-[200px]">
                      SHA256: 7f83b1657ff1...d9
                    </span>
                    <span className="font-['JetBrains_Mono'] text-[10px] text-[#4cd7f6] font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px]">lock</span>
                      ЭЦП_НУЦ_РК
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#222a3d] flex items-center justify-between text-[#869397] font-['JetBrains_Mono'] text-xs">
                  <span>Готов протокол фиксации PDF</span>
                  <button onClick={onOpenReport} className="text-[#4cd7f6] hover:underline flex items-center gap-1">
                    <span>Открыть дело</span>
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="w-full bg-[#171f33] border-b border-[#3d494c]/30 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="flex flex-col items-center">
            <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl text-[#4cd7f6] font-bold">99.4%</span>
            <span className="text-xs sm:text-sm text-[#bcc9cd] mt-1 font-['Inter']">Точность детекции нарушений</span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] mt-0.5">F1-SCORE EVALUATED</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl text-[#4edea3] font-bold">&lt; 2.4 сек</span>
            <span className="text-xs sm:text-sm text-[#bcc9cd] mt-1 font-['Inter']">Время мультимодального чека</span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] mt-0.5">ASTANA GPU CLUSTER</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl text-[#adc6ff] font-bold">4 канала</span>
            <span className="text-xs sm:text-sm text-[#bcc9cd] mt-1 font-['Inter']">Мультимодальная верификация</span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] mt-0.5">TEXT, OCR, VISION, AUDIO</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl text-[#dae2fd] font-bold">40+ актов</span>
            <span className="text-xs sm:text-sm text-[#bcc9cd] mt-1 font-['Inter']">Правовая база Республики Казахстан</span>
            <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] mt-0.5">КОАП РК, 230-VII, 94-V, УК</span>
          </div>
        </div>
      </div>

      {/* 4 Multi-Modal Channels Section */}
      <div className="w-full bg-[#0b1326] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10">
            <div className="max-w-2xl">
              <span className="font-['JetBrains_Mono'] text-xs text-[#4cd7f6] uppercase tracking-wider font-semibold">
                МУЛЬТИМОДАЛЬНЫЙ АНАЛИЗ КАЗНЕТА
              </span>
              <h2 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl text-[#dae2fd] font-bold mt-1">
                Комплексный AI-контроль по всем типам цифровых активов
              </h2>
              <p className="text-sm text-[#bcc9cd] mt-2 font-['Inter']">
                Преобразование неструктурированного контента социальных сетей, медиа и рекламы в судебный протокол с
                доказательной силой для СМАП и МКИ РК.
              </p>
            </div>
            <div className="mt-4 md:mt-0">
              <span className="font-['JetBrains_Mono'] text-xs text-[#869397] px-3 py-1.5 rounded-lg bg-[#222a3d] border border-[#3d494c]/40">
                Pipeline: LLM + PaddleOCR + Whisper Kazakh + Vision
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Channel 1 */}
            <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-6 flex flex-col justify-between shadow-lg hover:border-[#4cd7f6]/40 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#06b6d4]/20 flex items-center justify-center text-[#4cd7f6]">
                    <span className="material-symbols-outlined text-[28px]">captive_portal</span>
                  </div>
                  <span className="font-['JetBrains_Mono'] text-xs text-[#4cd7f6] px-2 py-0.5 rounded bg-[#222a3d]">
                    CHANNEL 01 / URL
                  </span>
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#dae2fd] mb-2">
                  Анализ ссылок и веб-страниц
                </h3>
                <p className="text-xs sm:text-sm text-[#bcc9cd] mb-4">
                  Краулинг Telegram-каналов Казнета, страниц Instagram, TikTok, пабликов и сайтов. Определение
                  замаскированных ссылок на нелицензированные казино (1win, Pin-up), фишинга и финансовых пирамид из реестра
                  АФМ.
                </p>
                <div className="space-y-1.5 text-xs font-['JetBrains_Mono'] text-[#dae2fd]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Детекция нелегальных ставок и казино (ст. 445-1 КоАП РК)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Сверка с черным списком финансовых пирамид АФМ РК</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Фиксация удаляемых постов и архивация веб-следа</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-3 bg-[#060e20]/60 p-3 rounded-lg flex items-center justify-between text-[11px] font-['JetBrains_Mono']">
                <span className="text-[#869397]">Coverage: Telegram KZ, Instagram, TikTok, Kaspi, Web</span>
                <span className="text-[#4cd7f6] font-semibold uppercase">HEADLESS CHROMIUM V120</span>
              </div>
            </div>

            {/* Channel 2 */}
            <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-6 flex flex-col justify-between shadow-lg hover:border-[#adc6ff]/40 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#0566d9]/20 flex items-center justify-center text-[#adc6ff]">
                    <span className="material-symbols-outlined text-[28px]">crop_free</span>
                  </div>
                  <span className="font-['JetBrains_Mono'] text-xs text-[#adc6ff] px-2 py-0.5 rounded bg-[#222a3d]">
                    CHANNEL 02 / OCR
                  </span>
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#dae2fd] mb-2">
                  Оптический аудит скриншотов
                </h3>
                <p className="text-xs sm:text-sm text-[#bcc9cd] mb-4">
                  Распознавание наложенного текста на казахском и русском языках. Проверка наличия и читаемости отметки
                  «Жарнама» по Закону РК «Об онлайн-платформах и онлайн-рекламе», выявление скрытых дисклеймеров.
                </p>
                <div className="space-y-1.5 text-xs font-['JetBrains_Mono'] text-[#dae2fd]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Проверка маркировки «Жарнама» и данных заказчика (ст. 455 КоАП)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Контроль соблюдения Закона РК «О языках» (двуязычие в рекламе)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Идентификация поддельных чеков Kaspi Bank и фейковых переводов</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-3 bg-[#060e20]/60 p-3 rounded-lg flex items-center justify-between text-[11px] font-['JetBrains_Mono']">
                <span className="text-[#869397]">Resolution: Up to 8K, Kazakh & Russian Cyrillic</span>
                <span className="text-[#adc6ff] font-semibold uppercase">PADDLE-OCR LATIN/CYRILLIC</span>
              </div>
            </div>

            {/* Channel 3 */}
            <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-6 flex flex-col justify-between shadow-lg hover:border-[#4edea3]/40 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#1bbd85]/20 flex items-center justify-center text-[#4edea3]">
                    <span className="material-symbols-outlined text-[28px]">eye_tracking</span>
                  </div>
                  <span className="font-['JetBrains_Mono'] text-xs text-[#4edea3] px-2 py-0.5 rounded bg-[#222a3d]">
                    CHANNEL 03 / VISION
                  </span>
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#dae2fd] mb-2">
                  Компьютерное зрение для фото
                </h3>
                <p className="text-xs sm:text-sm text-[#bcc9cd] mb-4">
                  Детекция запрещенной продукции по законодательству Казахстана: выявление электронных сигарет (вейпов),
                  табачной продукции, кальянов, алкоголя и сопоставление товарных знаков с реестром Qazpatent.
                </p>
                <div className="space-y-1.5 text-xs font-['JetBrains_Mono'] text-[#dae2fd]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Детекция вейпов и жидкостей (полный запрет в РК с 2024 г.)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Защита правообладателей: сверка товарных знаков с базой Qazpatent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Классификация запрещенных сцен и экстремистской символики</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-3 bg-[#060e20]/60 p-3 rounded-lg flex items-center justify-between text-[11px] font-['JetBrains_Mono']">
                <span className="text-[#869397]">Model: ViT-H/14 Custom Regulatory Fine-tuned</span>
                <span className="text-[#4edea3] font-semibold uppercase">YOLOv8 + CLIP-EMBED</span>
              </div>
            </div>

            {/* Channel 4 */}
            <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-6 flex flex-col justify-between shadow-lg hover:border-[#4cd7f6]/40 transition-all">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[#06b6d4]/20 flex items-center justify-center text-[#4cd7f6]">
                    <span className="material-symbols-outlined text-[28px]">graphic_eq</span>
                  </div>
                  <span className="font-['JetBrains_Mono'] text-xs text-[#4cd7f6] px-2 py-0.5 rounded bg-[#222a3d]">
                    CHANNEL 04 / AUDIO
                  </span>
                </div>
                <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#dae2fd] mb-2">
                  Слуховой анализ аудиодорожек
                </h3>
                <p className="text-xs sm:text-sm text-[#bcc9cd] mb-4">
                  Преобразование казахской и русской речи из Reels, Shorts, голосовых заметок и подкастов в текст с точными
                  тайм-кодами. Семантический поиск признаков клеветы, оскорблений и разжигания розни.
                </p>
                <div className="space-y-1.5 text-xs font-['JetBrains_Mono'] text-[#dae2fd]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Транскрипция с разделением дикторов на казахском и русском языках</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Маркировка рисков по ст. 73-3 КоАП РК (Клевета) и ст. 73-4 (Оскорбление)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4edea3] text-[16px]">check_circle</span>
                    <span>Контроль высказываний на признаки разжигания розни (ст. 174 УК РК)</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 pt-3 bg-[#060e20]/60 p-3 rounded-lg flex items-center justify-between text-[11px] font-['JetBrains_Mono']">
                <span className="text-[#869397]">Whisper-Large v3 Kazakh Augmented</span>
                <span className="text-[#4cd7f6] font-semibold uppercase">WER &lt; 2.6%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regulatory Framework of Kazakhstan */}
      <div className="w-full bg-[#131b2e] py-16 border-t border-[#3d494c]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="font-['JetBrains_Mono'] text-xs text-[#4cd7f6] uppercase tracking-wider font-semibold">
              ПРАВОВОЙ КОНТУР И РЕЕСТРЫ РК
            </span>
            <h2 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-[#dae2fd] mt-1">
              Автоматическая сверка с регуляторной базой Казахстана
            </h2>
            <p className="text-sm text-[#bcc9cd] mt-2 font-['Inter']">
              Система обновляет законодательные базы, реестры предписаний МКИ РК и списки блокировок АФМ, предотвращая
              штрафы до 1 000 МРП (до 3 932 000 ₸) и блокировку медиаресурсов.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Box 1 */}
            <div className="bg-[#171f33] rounded-xl border border-[#3d494c]/40 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="material-symbols-outlined text-[#ff6b6b] text-[24px]">gavel</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">КоАП РК & УК РК</h3>
              </div>
              <p className="text-xs text-[#bcc9cd] mb-4 font-['Inter'] leading-relaxed">
                Анализ на распространение ложной информации (фейков), клевету, оскорбление чести, разжигание розни и призывы к
                участию в финпирамидах.
              </p>
              <div className="flex flex-wrap gap-1.5 font-['JetBrains_Mono'] text-[11px]">
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">ст. 456-2 КоАП РК</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">ст. 73-3 КоАП РК</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">ст. 174 УК РК</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">ст. 217-1 УК РК</span>
              </div>
            </div>

            {/* Box 2 */}
            <div className="bg-[#171f33] rounded-xl border border-[#3d494c]/40 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[24px]">ad_units</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">
                  Закон об онлайн-рекламе
                </h3>
              </div>
              <p className="text-xs text-[#bcc9cd] mb-4 font-['Inter'] leading-relaxed">
                Контроль выполнения Закона РК № 230-VII: обязательная плашка «Жарнама», указание ИИН/БИН заказчика,
                соблюдение запрета рекламы вейпов и табака.
              </p>
              <div className="flex flex-wrap gap-1.5 font-['JetBrains_Mono'] text-[11px]">
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">Закон № 230-VII</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">ст. 455 КоАП РК</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">МКИ РК контроль</span>
              </div>
            </div>

            {/* Box 3 */}
            <div className="bg-[#171f33] rounded-xl border border-[#3d494c]/40 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="material-symbols-outlined text-[#4edea3] text-[24px]">casino</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">
                  АФМ & Запрет казино
                </h3>
              </div>
              <p className="text-xs text-[#bcc9cd] mb-4 font-['Inter'] leading-relaxed">
                Синхронизация с реестром нелицензированных онлайн-казино, букмекеров без лицензии РК и списком финансовых
                пирамид Агентства по финмониторингу.
              </p>
              <div className="flex flex-wrap gap-1.5 font-['JetBrains_Mono'] text-[11px]">
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">ст. 445-1 КоАП РК</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">Реестр АФМ РК</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">CyberPol МВД</span>
              </div>
            </div>

            {/* Box 4 */}
            <div className="bg-[#171f33] rounded-xl border border-[#3d494c]/40 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="material-symbols-outlined text-[#adc6ff] text-[24px]">shield_person</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">
                  Защита ПДн (Закон № 94-V)
                </h3>
              </div>
              <p className="text-xs text-[#bcc9cd] mb-4 font-['Inter'] leading-relaxed">
                Автоматическое выявление и маскирование ИИН, номеров удостоверений личности, телефонов (+7 7...),
                банковских реквизитов и биометрии граждан РК.
              </p>
              <div className="flex flex-wrap gap-1.5 font-['JetBrains_Mono'] text-[11px]">
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">ст. 79 КоАП РК</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">МЦРИАП РК</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">KZ-CERT</span>
              </div>
            </div>

            {/* Box 5 */}
            <div className="bg-[#171f33] rounded-xl border border-[#3d494c]/40 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="material-symbols-outlined text-[#4cd7f6] text-[24px]">translate</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">Закон РК «О языках»</h3>
              </div>
              <p className="text-xs text-[#bcc9cd] mb-4 font-['Inter'] leading-relaxed">
                Проверка обязательного дублирования рекламного сообщения на государственном (казахском) языке, контроль
                размера шрифта и смыслового соответствия (ст. 21).
              </p>
              <div className="flex flex-wrap gap-1.5 font-['JetBrains_Mono'] text-[11px]">
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">ст. 21 Закона о языках</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">Казахский / Русский</span>
              </div>
            </div>

            {/* Box 6 */}
            <div className="bg-[#171f33] rounded-xl border border-[#3d494c]/40 p-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-3">
                <span className="material-symbols-outlined text-[#4edea3] text-[24px]">verified</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-base font-bold text-[#dae2fd]">ЭЦП НУЦ РК & Экспертиза</h3>
              </div>
              <p className="text-xs text-[#bcc9cd] mb-4 font-['Inter'] leading-relaxed">
                Формирование доказательного протокола осмотра интернет-страниц с метками времени TSA и электронной подписью по
                стандарту ГОСТ 34.310-2004 для судов РК.
              </p>
              <div className="flex flex-wrap gap-1.5 font-['JetBrains_Mono'] text-[11px]">
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">ГПК РК (доказательства)</span>
                <span className="px-2 py-0.5 rounded bg-[#222a3d] text-[#dae2fd]">НУЦ РК ГОСТ</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing in KZT */}
      <div className="w-full bg-[#0b1326] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="font-['JetBrains_Mono'] text-xs text-[#4cd7f6] uppercase tracking-wider font-semibold">
              ТАРИФНЫЕ ПЛАНЫ ДЛЯ БИЗНЕСА И МЕДИА В РК
            </span>
            <h2 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-[#dae2fd] mt-1">
              Гибкие тарифы под масштаб вашей организации в Казахстане
            </h2>
            <p className="text-sm text-[#bcc9cd] mt-2 font-['Inter']">
              От проверки рекламных постов инфлюенсеров до высоконагруженной модерации витрин Kaspi и миллионов объявлений.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Plan 1 */}
            <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-6 flex flex-col justify-between shadow-sm">
              <div>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397] uppercase">ИНФЛЮЕНСЕРЫ & БЛОГЕРЫ</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#dae2fd] mt-1">Creator Start</h3>
                <p className="text-xs text-[#bcc9cd] mt-1 mb-4">
                  Для блогеров, SMM-агентств и каналов до 100 тыс. подписчиков в РК.
                </p>
                <div className="mb-4">
                  <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#dae2fd]">49 000 ₸</span>
                  <span className="text-xs text-[#869397]"> / месяц</span>
                </div>
                <div className="space-y-2 text-xs font-['JetBrains_Mono'] text-[#dae2fd] mb-6">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>До 250 аудитов в месяц</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>Контроль плашки «Жарнама»</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>Telegram-бот экспресс-чека</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>1 рабочее место</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onStartScanner()}
                className="w-full py-2.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-['Plus_Jakarta_Sans'] text-sm font-semibold transition-colors"
              >
                Подключить
              </button>
            </div>

            {/* Plan 2: Legal Pro (Popular) */}
            <div className="bg-[#131b2e] rounded-xl border-2 border-[#4cd7f6] p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#4cd7f6] text-[#003640] px-3 py-1 font-['JetBrains_Mono'] text-[10px] uppercase rounded-bl-lg font-bold">
                ПОПУЛЯРНЫЙ В РК
              </div>
              <div>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#4cd7f6] uppercase font-semibold">
                  ЮРИДИЧЕСКИЕ ДЕПАРТАМЕНТЫ
                </span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#dae2fd] mt-1">Legal Pro</h3>
                <p className="text-xs text-[#bcc9cd] mt-1 mb-4">
                  Для инхаус-юристов, комплаенс-отделов и консалтинговых бюро РК.
                </p>
                <div className="mb-4">
                  <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#dae2fd]">189 000 ₸</span>
                  <span className="text-xs text-[#869397]"> / месяц</span>
                </div>
                <div className="space-y-2 text-xs font-['JetBrains_Mono'] text-[#dae2fd] mb-6">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>До 2 000 аудитов в месяц</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>Экспертные протоколы с ЭЦП НУЦ РК</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>Все 4 мультимодальных канала</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>До 5 рабочих мест</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onStartScanner()}
                className="w-full py-2.5 rounded-lg bg-[#4cd7f6] hover:bg-[#06b6d4] text-[#003640] font-['Plus_Jakarta_Sans'] text-sm font-bold transition-colors shadow-md"
              >
                Выбрать Legal Pro
              </button>
            </div>

            {/* Plan 3 */}
            <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-6 flex flex-col justify-between shadow-sm">
              <div>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#adc6ff] uppercase">МАРКЕТПЛЕЙСЫ & E-COM</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#dae2fd] mt-1">Commerce Scale</h3>
                <p className="text-xs text-[#bcc9cd] mt-1 mb-4">
                  Модерация карточек товаров Kaspi, Wildberries KZ и Ozon.
                </p>
                <div className="mb-4">
                  <span className="font-['Plus_Jakarta_Sans'] text-3xl font-bold text-[#dae2fd]">490 000 ₸</span>
                  <span className="text-xs text-[#869397]"> / месяц</span>
                </div>
                <div className="space-y-2 text-xs font-['JetBrains_Mono'] text-[#dae2fd] mb-6">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>До 25 000 аудитов в месяц</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>Автопоиск контрафакта (Qazpatent)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>REST API & Webhooks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>Неограниченно пользователей</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onStartScanner()}
                className="w-full py-2.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-['Plus_Jakarta_Sans'] text-sm font-semibold transition-colors"
              >
                Подключить
              </button>
            </div>

            {/* Plan 4 */}
            <div className="bg-[#131b2e] rounded-xl border border-[#3d494c]/40 p-6 flex flex-col justify-between shadow-sm">
              <div>
                <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3] uppercase">БАНКИ & КОРПОРАЦИИ</span>
                <h3 className="font-['Plus_Jakarta_Sans'] text-xl font-bold text-[#dae2fd] mt-1">On-Premise API</h3>
                <p className="text-xs text-[#bcc9cd] mt-1 mb-4">
                  Развертывание в закрытом контуре безопасности компании в ЦОД Казахстана.
                </p>
                <div className="mb-4">
                  <span className="font-['Plus_Jakarta_Sans'] text-2xl font-bold text-[#dae2fd]">Индивидуально</span>
                  <span className="text-xs text-[#869397] block font-['JetBrains_Mono']">SLA 99.95%</span>
                </div>
                <div className="space-y-2 text-xs font-['JetBrains_Mono'] text-[#dae2fd] mb-6">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>Безлимитный объем проверок</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>Локальный сервер (Air-gapped)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>Сертификат СТ РК</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#4cd7f6] text-base">check</span>
                    <span>Выделенный юрист и инженер в Алматы/Астане</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onStartScanner()}
                className="w-full py-2.5 rounded-lg bg-[#222a3d] hover:bg-[#2d3449] text-[#dae2fd] font-['Plus_Jakarta_Sans'] text-sm font-semibold transition-colors"
              >
                Запросить расчет
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Call to action Banner */}
      <div className="w-full bg-[#060e20] py-16 border-t border-[#3d494c]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl bg-gradient-to-r from-[#222a3d] via-[#131b2e] to-[#222a3d] border border-[#3d494c]/60 p-8 sm:p-12 overflow-hidden shadow-2xl">
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6 text-center lg:text-left">
              <div className="max-w-2xl">
                <span className="font-['JetBrains_Mono'] text-xs text-[#4edea3] uppercase tracking-wider font-semibold">
                  БЕЗОПАСНЫЙ СТАРТ ЗА 1 МИНУТУ
                </span>
                <h2 className="font-['Plus_Jakarta_Sans'] text-2xl sm:text-3xl font-bold text-[#dae2fd] mt-1">
                  Защитите ваш бренд от штрафов МКИ РК и судебных исков
                </h2>
                <p className="text-sm text-[#bcc9cd] mt-2 font-['Inter']">
                  Бесплатный тестовый пакет включает 15 полных мультимодальных аудитов любого контента в Казнете.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                <button
                  onClick={() => onStartScanner()}
                  className="w-full sm:w-auto px-6 py-3 rounded-lg bg-[#4cd7f6] hover:bg-[#06b6d4] text-[#003640] font-['Plus_Jakarta_Sans'] text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-all"
                >
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                  <span>Попробовать бесплатно</span>
                </button>
                <button
                  onClick={onOpenReport}
                  className="w-full sm:w-auto px-5 py-3 rounded-lg bg-[#171f33] hover:bg-[#222a3d] text-[#dae2fd] font-['Plus_Jakarta_Sans'] text-sm font-semibold flex items-center justify-center gap-2 border border-[#3d494c]/60 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">description</span>
                  <span>Посмотреть готовое заключение</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
