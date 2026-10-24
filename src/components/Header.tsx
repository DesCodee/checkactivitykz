/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

interface HeaderProps {
  currentView: 'home' | 'scanner' | 'report' | 'archive';
  onNavigate: (view: 'home' | 'scanner' | 'report' | 'archive') => void;
  onSearchSelect?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onSearchSelect }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);

  const notifications = [
    {
      id: 1,
      title: 'Новое предписание МКИ РК',
      desc: 'Обновлены правила маркировки спонсорского контента по Закону № 230-VII',
      time: '12 мин назад',
      severity: 'warning',
    },
    {
      id: 2,
      title: 'Алерт мониторинга: @almaty_exclusive',
      desc: 'Детектирована публикация без плашки «Жарнама» (ст. 455 КоАП РК)',
      time: '34 мин назад',
      severity: 'critical',
    },
    {
      id: 3,
      title: 'Синхронизация с реестром АФМ',
      desc: 'Добавлено 48 доменов нелегальных онлайн-казино и финпирамид',
      time: '1 час назад',
      severity: 'info',
    },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearchSelect) onSearchSelect(searchQuery);
      setShowSearchModal(false);
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-[#060e20]/90 backdrop-blur-xl border-b border-[#3d494c]/40 shadow-[0_1px_12px_rgba(0,0,0,0.3)]">
        <div className="h-16 w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Brand Mark & Jurisdictional Cluster */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 text-left group transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#06b6d4] to-[#4cd7f6] flex items-center justify-center text-[#003640] shadow-[0_0_16px_rgba(76,215,246,0.35)] group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[22px] font-bold">verified_user</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg tracking-tight text-[#dae2fd]">
                    Check Activity
                  </span>
                  <span className="px-1.5 py-0.2 rounded bg-[#222a3d] text-[#4cd7f6] font-['JetBrains_Mono'] text-[10px] font-bold border border-[#4cd7f6]/30">
                    KZ
                  </span>
                </div>
                <span className="text-[10px] text-[#bcc9cd] font-['JetBrains_Mono'] tracking-wider uppercase">
                  Compliance & Legal AI
                </span>
              </div>
            </button>

            {/* Neural Engine Status Badge */}
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#171f33] border border-[#3d494c]/50">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4edea3] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4edea3]"></span>
              </span>
              <span className="font-['JetBrains_Mono'] text-[10px] font-semibold text-[#4edea3] uppercase tracking-wider">
                AI Engine: Online v4.2 [KZ-ASTANA]
              </span>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="flex-1 max-w-md mx-auto hidden lg:block">
            <div
              onClick={() => setShowSearchModal(true)}
              className="relative flex items-center w-full cursor-pointer bg-[#131b2e] hover:bg-[#171f33] pl-9 pr-3 py-1.5 rounded-lg border border-[#3d494c]/40 text-[#dae2fd] transition-all"
            >
              <span className="material-symbols-outlined absolute left-2.5 text-[#bcc9cd] text-[18px]">search</span>
              <span className="text-xs text-[#869397] font-['Inter']">
                Поиск по аудитам, делам, статьям КоАП РК, хешам SHA-256...
              </span>
              <span className="ml-auto px-1.5 py-0.5 rounded bg-[#222a3d] border border-[#3d494c]/60 font-['JetBrains_Mono'] text-[11px] text-[#bcc9cd]">
                ⌘K
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onNavigate('home')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                currentView === 'home'
                  ? 'bg-[#222a3d] text-[#4cd7f6] font-semibold shadow-inner'
                  : 'text-[#bcc9cd] hover:text-[#dae2fd] hover:bg-[#171f33]'
              }`}
            >
              Главная
            </button>
            <button
              onClick={() => onNavigate('scanner')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                currentView === 'scanner'
                  ? 'bg-[#222a3d] text-[#4cd7f6] font-semibold shadow-inner'
                  : 'text-[#bcc9cd] hover:text-[#dae2fd] hover:bg-[#171f33]'
              }`}
            >
              Сканер контента
            </button>
            <button
              onClick={() => onNavigate('report')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                currentView === 'report'
                  ? 'bg-[#222a3d] text-[#4cd7f6] font-semibold shadow-inner'
                  : 'text-[#bcc9cd] hover:text-[#dae2fd] hover:bg-[#171f33]'
              }`}
            >
              Экспертный отчет
            </button>
            <button
              onClick={() => onNavigate('archive')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                currentView === 'archive'
                  ? 'bg-[#222a3d] text-[#4cd7f6] font-semibold shadow-inner'
                  : 'text-[#bcc9cd] hover:text-[#dae2fd] hover:bg-[#171f33]'
              }`}
            >
              Архив и мониторинг
            </button>
          </nav>

          {/* Right Action Icons & User Profile */}
          <div className="flex items-center gap-3 shrink-0 relative">
            {/* Notifications Trigger */}
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg text-[#bcc9cd] hover:text-[#dae2fd] hover:bg-[#171f33] transition-colors"
              title="Уведомления комплаенса"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-[#ff6b6b] text-[#690005] font-['JetBrains_Mono'] text-[10px] font-bold leading-none">
                3
              </span>
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-xl bg-[#131b2e] border border-[#3d494c]/60 shadow-2xl p-3 z-50 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-2 border-b border-[#222a3d]">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#4cd7f6]">crisis_alert</span>
                    <span className="font-['Plus_Jakarta_Sans'] text-xs font-bold text-[#dae2fd]">
                      Алерты МКИ РК & Мониторинга
                    </span>
                  </div>
                  <span className="font-['JetBrains_Mono'] text-[10px] text-[#4edea3]">LIVE SYNC</span>
                </div>
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {notifications.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg bg-[#171f33] hover:bg-[#222a3d] transition-colors cursor-pointer flex flex-col gap-1 border-l-2 border-[#4cd7f6]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-[#dae2fd]">{item.title}</span>
                        <span className="font-['JetBrains_Mono'] text-[10px] text-[#869397]">{item.time}</span>
                      </div>
                      <p className="text-[11px] text-[#bcc9cd] leading-tight">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    setShowNotifications(false);
                    onNavigate('archive');
                  }}
                  className="w-full py-1.5 text-center text-xs font-semibold text-[#4cd7f6] hover:underline pt-2 border-t border-[#222a3d]"
                >
                  Перейти в журнал мониторинга →
                </button>
              </div>
            )}

            <div className="h-6 w-px bg-[#3d494c]/40 hidden sm:block"></div>

            {/* User Profile Info */}
            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0566d9] to-[#4cd7f6] flex items-center justify-center text-white font-bold text-xs ring-1 ring-[#4cd7f6]/40 shadow-sm">
                АК
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs text-[#dae2fd] leading-tight font-medium">Алексей Ковалев</span>
                <span className="font-['JetBrains_Mono'] text-[9px] text-[#4cd7f6] uppercase tracking-wider font-semibold">
                  Compliance Lead РК
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Global Quick Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-[#060e20]/80 backdrop-blur-md flex items-start justify-center pt-24 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-[#131b2e] border border-[#3d494c] p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-[#222a3d]">
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-[#dae2fd] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4cd7f6] text-lg">search</span>
                Быстрый реестровый поиск (Казахстан)
              </span>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded-md text-[#869397] hover:text-[#dae2fd] hover:bg-[#222a3d]"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Введите номер дела (#CHK-KZ...), статью КоАП РК, URL или ключевое слово..."
                className="w-full bg-[#171f33] pl-10 pr-20 py-2.5 rounded-lg text-sm text-[#dae2fd] placeholder:text-[#869397] border border-[#3d494c]/60 focus:border-[#4cd7f6] focus:outline-none"
              />
              <button
                type="submit"
                className="absolute right-2 px-3 py-1 rounded bg-[#06b6d4] text-[#003640] font-semibold text-xs hover:opacity-90"
              >
                Найти
              </button>
            </form>
            <div className="flex flex-col gap-1.5 pt-2">
              <span className="text-[11px] font-['JetBrains_Mono'] text-[#869397] uppercase">Частые запросы:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'ст. 455 КоАП РК (Маркировка рекламы)',
                  'ст. 456-2 КоАП РК (Фейки блогеров)',
                  'ст. 445-1 КоАП РК (Онлайн-казино)',
                  'Закон № 230-VII',
                  '#CHK-KZ-2024-9108',
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSearchQuery(tag);
                      if (onSearchSelect) onSearchSelect(tag);
                      setShowSearchModal(false);
                    }}
                    className="px-2.5 py-1 rounded-md bg-[#171f33] hover:bg-[#222a3d] text-xs text-[#bcc9cd] hover:text-[#4cd7f6] border border-[#3d494c]/40 font-['JetBrains_Mono'] transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
