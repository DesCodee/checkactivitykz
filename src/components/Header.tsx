/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Layers,
  ScanSearch,
  History,
  Scale,
  Search,
  Sun,
  Moon,
  X,
} from 'lucide-react';
import { useApp } from '../utils/i18n';

export type AppViewType = 'home' | 'scanner' | 'report' | 'archive' | 'sandbox';

interface HeaderProps {
  currentView: AppViewType;
  onNavigate: (view: AppViewType) => void;
  onSearchSelect?: (query: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onSearchSelect }) => {
  const { language, setLanguage, theme, toggleTheme, t } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        setShowSearchModal(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (onSearchSelect) onSearchSelect(searchQuery);
      setShowSearchModal(false);
    }
  };

  const navItems: {
    id: AppViewType;
    label: string;
    mobileLabel: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    isActive: boolean;
  }[] = [
    {
      id: 'home',
      label: t('navScanner'),
      mobileLabel: language === 'kz' ? 'Сканер' : 'Сканер',
      icon: ScanSearch,
      isActive: currentView === 'home' || currentView === 'scanner',
    },
    {
      id: 'sandbox',
      label: t('navSandbox'),
      mobileLabel: language === 'kz' ? 'Симулятор' : 'Песочница',
      icon: Scale,
      isActive: currentView === 'sandbox',
    },
    {
      id: 'archive',
      label: t('navArchive'),
      mobileLabel: language === 'kz' ? 'Журнал' : 'Журнал',
      icon: History,
      isActive: currentView === 'archive',
    },
  ];

  const getPageTitle = () => {
    if (currentView === 'home' || currentView === 'scanner') {
      return 'CheckActivity';
    }
    if (currentView === 'sandbox') {
      return language === 'kz' ? 'Симулятор, Пакеттік аудит және НҚА' : 'Песочница, Пакетный аудит и НПА РК';
    }
    if (currentView === 'report') {
      return language === 'kz' ? 'Сараптамалық есеп' : 'Экспертный отчёт';
    }
    return language === 'kz' ? 'Тексеру журналы' : 'Журнал проверок';
  };

  return (
    <>
      {/* Desktop Left Sidebar (EthicOS minimal style) */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-60 z-40 flex-col justify-between bg-white dark:bg-zinc-900 border-r border-zinc-200/80 dark:border-zinc-800 transition-colors">
        <div className="p-5 flex flex-col gap-7">
          {/* Brand Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2.5 px-2 text-left group focus:outline-none"
          >
            <Layers className="w-5 h-5 text-zinc-900 dark:text-zinc-100 shrink-0" strokeWidth={1.6} />
            <span className="font-['Inter'] font-semibold text-[16px] tracking-tight text-zinc-900 dark:text-zinc-50 whitespace-nowrap">
              Check Activity
            </span>
          </button>

          {/* Vertical Navigation */}
          <nav className="flex flex-col gap-1" aria-label="Primary Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[13.5px] transition-colors whitespace-nowrap ${
                    item.isActive
                      ? 'bg-zinc-100/90 dark:bg-zinc-800/80 text-zinc-950 dark:text-zinc-50 font-medium'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 font-normal'
                  }`}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-[17px] h-[17px] shrink-0 ${
                        item.isActive
                          ? 'text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-400 dark:text-zinc-500'
                      }`}
                      strokeWidth={1.5}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 shrink-0" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Sidebar Controls: Language + Theme + Quick Law Reference */}
        <div className="p-4 border-t border-zinc-200/70 dark:border-zinc-800 flex flex-col gap-3">
          {/* Language & Theme Compact Bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-['JetBrains_Mono']">
              <button
                type="button"
                onClick={() => setLanguage('kz')}
                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                  language === 'kz'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                ҚАЗ
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ru')}
                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                  language === 'ru'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                РУС
              </button>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
              title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
              aria-label="Переключить тему оформления"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" strokeWidth={1.6} />
              ) : (
                <Moon className="w-4 h-4" strokeWidth={1.6} />
              )}
            </button>
          </div>

          <div className="px-1 flex items-center justify-between text-[11px] text-zinc-400 dark:text-zinc-500 font-['JetBrains_Mono']">
            <span>{language === 'kz' ? 'Қазақстан' : 'Казахстан'}</span>
            <span>№ 230-VII</span>
          </div>
        </div>
      </aside>

      {/* Top Workspace Header (Inside main column on desktop, full width on mobile) */}
      <header className="sticky top-0 z-30 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-zinc-200/70 dark:border-zinc-800/80 transition-colors">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 h-16 md:h-[72px] flex items-center justify-between gap-4">
          {/* Left: Page Title + Live Subtitle (matches screenshot) */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="md:hidden flex items-center gap-2 text-zinc-900 dark:text-zinc-100 shrink-0"
              aria-label="На главную"
            >
              <Layers className="w-5 h-5" strokeWidth={1.6} />
            </button>
            <div className="flex flex-col min-w-0">
              <h1 className="font-['Inter'] font-semibold text-base sm:text-xl tracking-tight text-zinc-950 dark:text-zinc-50 truncate">
                {getPageTitle()}
              </h1>
              <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span className="truncate">
                  {language === 'kz' ? 'ҚР ӘҚБтК және Цифрлық этика' : 'КоАП РК · Закон № 230-VII · Этика'}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Clean Search trigger + Mobile quick switches + Profile Avatar */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setShowSearchModal(true)}
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/90 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
              title="Поиск (⌘K)"
              aria-label="Поиск по нормам и этике"
            >
              <Search className="w-4 h-4" strokeWidth={1.6} />
              <span className="hidden lg:inline text-xs text-zinc-500 dark:text-zinc-400">
                {language === 'kz' ? 'Бап немесе норма...' : 'Поиск норм...'}
              </span>
              <span className="hidden sm:inline font-['JetBrains_Mono'] text-[10px] text-zinc-400 dark:text-zinc-500 pl-1">
                ⌘K
              </span>
            </button>

            {/* Mobile Language & Theme Switch */}
            <div className="flex md:hidden items-center gap-1.5">
              <button
                type="button"
                onClick={() => setLanguage(language === 'kz' ? 'ru' : 'kz')}
                className="px-2 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-['JetBrains_Mono'] text-[11px] font-semibold text-zinc-700 dark:text-zinc-200"
              >
                {language === 'kz' ? 'ҚАЗ' : 'РУС'}
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                className="p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300"
                aria-label="Переключить тему"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4" strokeWidth={1.6} />
                ) : (
                  <Moon className="w-4 h-4" strokeWidth={1.6} />
                )}
              </button>
            </div>

            {/* Minimal Circular Profile Badge */}
            <div
              className="w-8 h-8 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center font-['JetBrains_Mono'] font-semibold text-[11px] shrink-0"
              title="Compliance & Ethics KZ"
            >
              KZ
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 md:hidden flex items-center justify-around py-1.5 px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center flex-1 py-1 rounded-lg transition-colors ${
                item.isActive
                  ? 'text-zinc-950 dark:text-white font-semibold'
                  : 'text-zinc-400 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
              <span className="text-[10px] mt-0.5 whitespace-nowrap">{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Global Quick Search Modal (⌘K) */}
      {showSearchModal && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 px-3 sm:px-4"
          onClick={() => setShowSearchModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Search className="w-4 h-4 text-zinc-500" strokeWidth={1.6} />
                {language === 'kz' ? 'Іздеу: ҚР заңнамасы және этика' : 'Поиск: Законодательство РК и Этика'}
              </span>
              <button
                type="button"
                onClick={() => setShowSearchModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.6} />
              </button>
            </div>

            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5" strokeWidth={1.6} />
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Статья КоАП, кибербуллинг, Dark Pattern, ссылка..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 pl-10 pr-24 py-2.5 rounded-xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none"
              />
              <button
                type="submit"
                className="absolute right-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium text-xs hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                {language === 'kz' ? 'Табу' : 'Найти'}
              </button>
            </form>

            <div className="flex flex-col gap-3 pt-1">
              <div>
                <span className="text-[11px] font-['JetBrains_Mono'] text-zinc-400 dark:text-zinc-500 font-medium">
                  {language === 'kz' ? 'Қазақстан заңдары' : 'Законы Казахстана'}
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    'ст. 455 КоАП (Маркировка «Жарнама»)',
                    'ст. 445-1 КоАП (Онлайн-казино)',
                    'ст. 456-2 КоАП (Фейки блогеров)',
                    'Закон РК «О языках»',
                    'ст. 79 КоАП (Персональные данные)',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSearchQuery(tag);
                        if (onSearchSelect) onSearchSelect(tag);
                        setShowSearchModal(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-800 font-['JetBrains_Mono'] transition-colors text-left"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-['JetBrains_Mono'] text-zinc-400 dark:text-zinc-500 font-medium">
                  {language === 'kz' ? 'Интернет-этика және мәдениет' : 'Интернет-этика и культура'}
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    'Кибербуллинг и оскорбления',
                    'Манипулятивный маркетинг (Dark Pattern / FOMO)',
                    'Скрытая реклама (без спонсорства)',
                    'Ненормативная лексика и токсичность',
                    'Язык вражды (Hate Speech)',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSearchQuery(tag);
                        if (onSearchSelect) onSearchSelect(tag);
                        setShowSearchModal(false);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-800 transition-colors text-left"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
