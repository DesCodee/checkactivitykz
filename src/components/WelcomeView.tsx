import React from 'react';
import { ArrowRight, Layers, Moon, Sun } from 'lucide-react';
import { useApp } from '../utils/i18n';

interface WelcomeViewProps {
  onEnter: (targetView?: 'home' | 'sandbox' | 'archive') => void;
}

const COPY = {
  ru: {
    title: 'CheckActivity',
    subtitle: 'Проверка контента и рекламы на соответствие законам РК и этике',
    cta: 'Войти',
    audienceTitle: 'Подойдёт для всех, кто публикует и проверяет материалы',
    audienceDesc:
      'Для блогеров, редакций и СМИ, маркетологов, предпринимателей, комплаенс-специалистов и обычных пользователей. Платформа проверяет скриншоты, документы, ссылки, видео и аудио по КоАП РК, УК РК, Закону № 230-VII и нормам цифровой этики до публикации.',
  },
  kz: {
    title: 'CheckActivity',
    subtitle: 'Контент пен жарнаманы ҚР заңнамасы мен этикаға сәйкестігін тексеру',
    cta: 'Кіру',
    audienceTitle: 'Материал жариялайтын және тексеретін барлық адамдарға арналған',
    audienceDesc:
      'Блогерлерге, редакциялар мен БАҚ-қа, маркетологтарға, кәсіпкерлерге, заңгерлерге және қарапайым қолданушыларға ыңғайлы. Жүйе скриншоттарды, құжаттарды, сілтемелерді, бейне мен аудионы ҚР ӘҚБтК, ҚК, № 230-VII Заңы және цифрлық этика бойынша жариялауға дейін тексереді.',
  },
};

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onEnter }) => {
  const { language, setLanguage, theme, toggleTheme } = useApp();
  const c = COPY[language];

  return (
    <div className="min-h-screen flex flex-col justify-between bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-['Inter'] transition-colors">
      <header className="w-full">
        <div className="max-w-[960px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 select-none">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" strokeWidth={1.6} />
            </div>
            <span className="font-semibold text-[15px] tracking-tight text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
              CheckActivity
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5"
              role="group"
              aria-label="Language"
            >
              <button
                type="button"
                onClick={() => setLanguage('kz')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  language === 'kz'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                ҚАЗ
              </button>
              <button
                type="button"
                onClick={() => setLanguage('ru')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  language === 'ru'
                    ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100'
                }`}
              >
                РУС
              </button>
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}
              className="w-9 h-9 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" strokeWidth={1.6} />
              ) : (
                <Moon className="w-4 h-4" strokeWidth={1.6} />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[580px] text-center">
          <h1 className="font-semibold tracking-tight text-3xl sm:text-4xl text-zinc-950 dark:text-zinc-50">
            {c.title}
          </h1>

          <p className="mt-3 text-sm sm:text-base text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {c.subtitle}
          </p>

          <div className="mt-7 flex justify-center">
            <button
              type="button"
              onClick={() => onEnter('home')}
              className="inline-flex items-center gap-2.5 px-8 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-950 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>{c.cta}</span>
              <ArrowRight className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="mt-10 pt-6 border-t border-zinc-200/70 dark:border-zinc-800/70 text-center">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {c.audienceTitle}
            </p>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed">
              {c.audienceDesc}
            </p>
          </div>
        </div>
      </main>

      <div className="h-8" aria-hidden="true" />
    </div>
  );
};
