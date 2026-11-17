/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../utils/i18n';

export const Footer: React.FC = () => {
  const { t, language, setLanguage, theme, toggleTheme } = useApp();

  return (
    <footer className="w-full border-t border-zinc-200/70 dark:border-zinc-800/80 py-5 mt-auto text-zinc-500 dark:text-zinc-400 font-['Inter'] transition-colors">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-center sm:text-left">
          <span className="font-semibold text-zinc-800 dark:text-zinc-200">Check Activity KZ</span>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span>{t('footerRights')}</span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-[11px] font-['JetBrains_Mono'] text-zinc-400 dark:text-zinc-500">
            <span>{language === 'kz' ? '№ 230-VII Заңы' : 'Закон № 230-VII'}</span>
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>{language === 'kz' ? 'ҚР ӘҚБтК' : 'КоАП РК'}</span>
            <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">·</span>
            <span>{language === 'kz' ? 'Сандық мәдениет' : 'Цифровая культура'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-['JetBrains_Mono']">
              <button
                type="button"
                onClick={() => setLanguage('kz')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  language === 'kz'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                ҚАЗ
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ru')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  language === 'ru'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                РУС
              </button>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
            >
              {theme === 'dark'
                ? (language === 'kz' ? 'Жарық' : 'Светлая')
                : (language === 'kz' ? 'Қараңғы' : 'Тёмная')}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
