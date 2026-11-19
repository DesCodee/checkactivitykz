/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Send,
  MessageCircle,
  QrCode,
  Smartphone,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../utils/i18n';
import { copyTextToClipboard } from '../utils/clipboard';

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
  isReport?: boolean;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: ShareData;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, data }) => {
  const { language, t } = useApp();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedText, setCopiedText] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  const currentUrl = data?.url || (typeof window !== 'undefined' ? window.location.href : 'https://checkactivity.kz');
  const shareTitle = data?.title || (language === 'kz' 
    ? 'CheckActivity KZ — Мазмұн мен құқық бұзушылықтардың AI-аудиті' 
    : 'CheckActivity KZ — AI-аудит контента и правонарушений');
  
  const defaultText = language === 'kz'
    ? 'ҚР заңнамасына (ӘҚБтК, Онлайн-платформалар және масс-медиа туралы заң) сәйкестікті және интернет-этиканы AI арқылы тексеру.'
    : 'Проверка контента на соответствие законодательству Казахстана (КоАП, Онлайн-платформы, Закон о масс-медиа) и цифровой этике.';

  const shareText = data?.text || defaultText;

  // Handle Web Share API (mobile devices, modern browsers)
  const canNativeShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

  const handleNativeShare = async () => {
    if (!canNativeShare) return;
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: currentUrl,
      });
    } catch {
      // User cancelled or share failed, fallback gracefully
    }
  };

  const handleCopyLink = async () => {
    const success = await copyTextToClipboard(currentUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyText = async () => {
    const fullMessage = `${shareTitle}\n\n${shareText}\n\n${currentUrl}`;
    const success = await copyTextToClipboard(fullMessage);
    if (success) {
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(`${shareTitle}\n\n${shareText}`)}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareTitle}\n${shareText}\n${currentUrl}`)}`;

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentUrl)}&margin=8`;

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6 shadow-2xl flex flex-col gap-5 text-zinc-900 dark:text-zinc-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
              <Share2 className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="font-['Inter'] font-semibold text-base text-zinc-950 dark:text-zinc-50">
                {language === 'kz' ? 'Бөлісу' : 'Поделиться'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {data?.isReport
                  ? (language === 'kz' ? 'Сараптамалық есеп қорытындысы' : 'Результаты экспертного аудита')
                  : (language === 'kz' ? 'Сервис сілтемесі' : 'Ссылка на сервис CheckActivity')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" strokeWidth={1.6} />
          </button>
        </div>

        {/* Link Copy Box */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {language === 'kz' ? 'Тікелей сілтеме' : 'Прямая ссылка'}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-zinc-50 dark:bg-zinc-950 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-['JetBrains_Mono'] text-zinc-600 dark:text-zinc-300 truncate select-all">
              {currentUrl}
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
                copiedLink
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
              }`}
            >
              {copiedLink ? (
                <>
                  <Check className="w-4 h-4 shrink-0" strokeWidth={2} />
                  <span>{language === 'kz' ? 'Көшірілді' : 'Скопировано'}</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" strokeWidth={1.6} />
                  <span>{language === 'kz' ? 'Көшіру' : 'Копировать'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Messengers & Fast Share Grid */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {language === 'kz' ? 'Мессенджерлер мен әлеуметтік желілер' : 'Мессенджеры и соцсети'}
          </span>
          <div className="grid grid-cols-2 gap-2">
            <a
              href={telegramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#24A1DE]/10 hover:bg-[#24A1DE]/20 text-[#24A1DE] border border-[#24A1DE]/20 text-xs font-medium transition-colors"
            >
              <Send className="w-4 h-4 shrink-0" strokeWidth={1.8} />
              <span>Telegram</span>
            </a>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/20 text-xs font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4 shrink-0" strokeWidth={1.8} />
              <span>WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Extended Tools: Native Share (if supported), Text Summary Copy, QR Code */}
        <div className="flex flex-col gap-2 pt-1">
          {canNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 text-xs font-medium transition-colors"
            >
              <Smartphone className="w-4 h-4 shrink-0" strokeWidth={1.6} />
              <span>{language === 'kz' ? 'Смартфонның жүйелік мәзірімен бөлісу' : 'Поделиться через меню телефона'}</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-medium transition-colors"
            >
              {copiedText ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {language === 'kz' ? 'Мәтін көшірілді!' : 'Текст скопирован!'}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>{language === 'kz' ? 'Қысқаша мәтінді көшіру' : 'Скопировать сводку'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                showQr
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent'
                  : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 shrink-0" />
              <span>QR-код</span>
            </button>
          </div>

          {/* QR Code expansion */}
          {showQr && (
            <div className="flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-in fade-in duration-150 mt-1">
              <div className="p-2 bg-white rounded-lg shadow-2xs">
                <img
                  src={qrImageUrl}
                  alt="QR Code"
                  width={150}
                  height={150}
                  className="rounded"
                />
              </div>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 text-center">
                {language === 'kz'
                  ? 'Камераны бағыттап, телефоннан ашыңыз'
                  : 'Наведите камеру смартфона для быстрого перехода'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
