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
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearchSelect) onSearchSelect(searchQuery);
      setShowSearchModal(false);
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white border-b border-slate-200 shadow-xs">
        <div className="h-16 w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Brand Mark & Jurisdictional Cluster */}
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center gap-2.5 text-left group transition-all"
            >
              <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-xs">
                <span className="material-symbols-outlined text-[20px]">shield</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-['Plus_Jakarta_Sans'] font-bold text-lg tracking-tight text-slate-900">
                    Check Activity
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-['JetBrains_Mono'] text-[10px] font-bold border border-sky-200">
                    KZ
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-['JetBrains_Mono'] uppercase tracking-wider">
                  Аудит онлайн-контента и рекламы
                </span>
              </div>
            </button>

            {/* Regulatory Status Badge */}
            <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200">
              <span className="relative flex h-2 w-2">
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-['JetBrains_Mono'] text-[10px] font-medium text-slate-700">
                Закон № 230-VII • ст. 455 КоАП РК
              </span>
            </div>
          </div>

          {/* Quick Search Bar */}
          <div className="flex-1 max-w-md mx-auto hidden lg:block">
            <div
              onClick={() => setShowSearchModal(true)}
              className="relative flex items-center w-full cursor-pointer bg-slate-50 hover:bg-slate-100 pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 transition-colors"
            >
              <span className="material-symbols-outlined absolute left-2.5 text-slate-400 text-[18px]">search</span>
              <span className="text-xs text-slate-500 font-['Inter']">
                Поиск по статьям КоАП РК, ссылкам, ключевым словам...
              </span>
              <span className="ml-auto px-1.5 py-0.5 rounded bg-white border border-slate-200 font-['JetBrains_Mono'] text-[11px] text-slate-500">
                ⌘K
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1">
            <button
              onClick={() => onNavigate('home')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                currentView === 'home' || currentView === 'scanner'
                  ? 'bg-slate-100 text-sky-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Аудит контента
            </button>
            <button
              onClick={() => onNavigate('report')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                currentView === 'report'
                  ? 'bg-slate-100 text-sky-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Экспертный отчет
            </button>
            <button
              onClick={() => onNavigate('archive')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                currentView === 'archive'
                  ? 'bg-slate-100 text-sky-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              Журнал проверок
            </button>
          </nav>

          {/* Right Action Icons & User Profile */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs border border-slate-300">
                АК
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs text-slate-900 font-medium">Compliance РК</span>
                <span className="font-['JetBrains_Mono'] text-[9px] text-slate-500 uppercase">
                  Профессиональный доступ
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Global Quick Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-start justify-center pt-24 px-4">
          <div className="w-full max-w-xl rounded-xl bg-white border border-slate-200 p-4 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sky-600 text-lg">search</span>
                Поиск по правовым нормам Казахстана
              </span>
              <button
                onClick={() => setShowSearchModal(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Статья КоАП (455, 445-1, 456-2), ссылка, текст..."
                className="w-full bg-slate-50 pl-10 pr-20 py-2.5 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200 focus:border-sky-500 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="absolute right-2 px-3 py-1 rounded bg-sky-600 text-white font-medium text-xs hover:bg-sky-700"
              >
                Найти
              </button>
            </form>
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-[11px] font-['JetBrains_Mono'] text-slate-400 uppercase">Быстрые запросы:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'ст. 455 КоАП (Маркировка «Жарнама»)',
                  'ст. 445-1 КоАП (Онлайн-казино)',
                  'ст. 456-2 КоАП (Фейки блогеров)',
                  'Закон РК «О языках»',
                  'ст. 79 КоАП (Персональные данные)',
                ].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      setSearchQuery(tag);
                      if (onSearchSelect) onSearchSelect(tag);
                      setShowSearchModal(false);
                    }}
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs text-slate-700 border border-slate-200 font-['JetBrains_Mono'] transition-colors"
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
