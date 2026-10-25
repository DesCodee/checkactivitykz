/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white border-t border-slate-200 py-4 sm:py-5 mt-auto text-slate-500 font-['Inter']">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-center sm:text-left">
          <span className="font-semibold text-slate-800">Check Activity KZ</span>
          <span>•</span>
          <span>Аудит законодательства РК и интернет-этики</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-['JetBrains_Mono'] text-slate-400">
          <span>Закон № 230-VII</span>
          <span>КоАП РК</span>
          <span>Цифровая культура</span>
        </div>
      </div>
    </footer>
  );
};
