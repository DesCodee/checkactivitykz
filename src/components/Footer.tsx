/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white border-t border-slate-200 py-5 mt-auto text-slate-500 font-['Inter']">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-center sm:text-left">
          <span className="font-medium text-slate-700">Check Activity KZ</span>
          <span>•</span>
          <span>AI-аудит контента по законодательству Республики Казахстан</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-['JetBrains_Mono'] text-slate-400">
          <span>Закон № 230-VII</span>
          <span>ст. 455 КоАП РК</span>
          <span>МКИ РК / АФМ</span>
        </div>
      </div>
    </footer>
  );
};
