/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-[#060e20] border-t border-[#3d494c]/30 py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-center md:text-left">
          <span className="font-['JetBrains_Mono'] text-xs text-[#bcc9cd]">
            © 2025 Check Activity AI Systems (Республика Казахстан). Все права защищены.
          </span>
          <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-[#171f33] text-[#869397] border border-[#3d494c]/30">
            ISO/IEC 27001 COMPLIANT
          </span>
          <span className="font-['JetBrains_Mono'] text-[10px] px-2 py-0.5 rounded bg-[#1bbd85]/15 text-[#4edea3] border border-[#4edea3]/30">
            COMPLIANCE ENGINE // KZ
          </span>
        </div>
        <div className="flex items-center gap-6 font-['JetBrains_Mono'] text-xs">
          <span className="text-[#bcc9cd] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4edea3]"></span>
            Latency: 22ms (Astana DC)
          </span>
          <span className="text-[#4cd7f6] flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">lock</span>
            Evidentiary SHA-256 Validated
          </span>
        </div>
      </div>
    </footer>
  );
};
