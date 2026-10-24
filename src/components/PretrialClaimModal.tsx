/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuditCase } from '../types';

interface PretrialClaimModalProps {
  auditCase: AuditCase;
  onClose: () => void;
}

export const PretrialClaimModal: React.FC<PretrialClaimModalProps> = ({ auditCase, onClose }) => {
  const [copied, setCopied] = useState(false);

  const claimText = `ДОСУДЕБНАЯ ПРЕТЕНЗИЯ
о прекращении распространения недостоверных и ненадлежащих рекламных сведений
в сети Интернет (согласно законодательству Республики Казахстан)

Кому: Администратору / Владельцу информационного ресурса (${auditCase.sourceName})
От: Представителя заявителя (Юридический департамент комплаенса)
Дата составления: ${auditCase.timestamp}
Регистрационный номер аудита: ${auditCase.referenceNumber}
Хеш цифровой фиксации доказательств (SHA-256): ${auditCase.sha256}

1. ОБСТОЯТЕЛЬСТВА И ФАКТИЧЕСКИЕ ОСНОВАНИЯ:
В ходе автоматизированного цифрового аудита программно-аппаратным комплексом Check Activity AI зафиксирован факт публикации и распространения контента, содержащего грубые нарушения законодательства Республики Казахстан:

${auditCase.violations
  .map(
    (v, idx) =>
      `${idx + 1}. ${v.title} (${v.code}):\n   ${v.basis}\n   Санкция: ${v.fineAmount} (Подведомственность: ${v.jurisdiction})`
  )
  .join('\n\n')}

2. ПРАВОВОЕ ОБОСНОВАНИЕ:
- Статья 143 Гражданского кодекса Республики Казахстан (Защита чести, достоинства и деловой репутации).
- Закон Республики Казахстан «Об онлайн-платформах и онлайн-рекламе» (№ 230-VII от 10.07.2023 г.), обязывающий маркировать рекламу («Жарнама») и запрещающий распространение ложной информации.
- Статьи 73-3, 455, 456-2 Кодекса Республики Казахстан об административных правонарушениях.
- Закон Республики Казахстан «О персональных данных и их защите» (№ 94-V).

3. ТРЕБОВАНИЯ ЗАЯВИТЕЛЯ:
На основании вышеизложенного, руководствуясь нормами Гражданского процессуального кодекса РК (досудебное урегулирование спора), ТРЕБУЕМ:
1. В течение 24 (двадцати четырех) часов с момента получения настоящей претензии прекратить распространение и удалить вышеуказанный ненадлежащий контент из публичного доступа.
2. В случае распространения порочащих деловую репутацию сведений — опубликовать официальное опровержение тем же шрифтом и в том же источнике.
3. Предоставить письменный ответ об исполнении требований по адресу электронной почты заявителя.

В случае неисполнения указанных требований в добровольном порядке, заявитель оставляет за собой право:
- Направить мотивированное заявление в Министерство культуры и информации Республики Казахстан (МКИ РК) и Агентство по финансовому мониторингу (АФМ) для блокировки информационного ресурса;
- Обратиться в Специализированный межрайонный суд по административным правонарушениям и суд общей юрисдикции с исковым заявлением о взыскании убытков и компенсации морального вреда.

Приложение: Юридический протокол фиксации цифровых доказательств Check Activity (СТ РК ГОСТ 34.310-2004, ЭЦП НУЦ РК).`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(claimText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#060e20]/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-[#131b2e] border border-[#3d494c] p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-3 border-b border-[#222a3d]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ff6b6b] text-[24px]">gavel</span>
            <h3 className="font-['Plus_Jakarta_Sans'] text-lg font-bold text-[#dae2fd]">
              Досудебная претензия по праву Республики Казахстан
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-[#869397] hover:text-[#dae2fd]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="text-xs text-[#bcc9cd] font-['Inter']">
          Документ сформирован автоматически с соблюдением требований ГПК РК, статей КоАП РК и Закона «Об онлайн-платформах
          и онлайн-рекламе» № 230-VII.
        </p>

        <div className="flex-1 overflow-y-auto bg-[#060e20] p-4 rounded-xl border border-[#3d494c]/40 font-['JetBrains_Mono'] text-xs text-[#dae2fd] whitespace-pre-wrap leading-relaxed select-text">
          {claimText}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-[#222a3d]">
          <span className="text-[11px] font-['JetBrains_Mono'] text-[#4edea3]">
            ✓ Юридически выверено для судов РК
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-[#bcc9cd] hover:text-[#dae2fd] font-medium"
            >
              Закрыть
            </button>
            <button
              onClick={handleCopy}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#06b6d4] to-[#0566d9] text-[#001f26] font-['Plus_Jakarta_Sans'] text-xs font-bold flex items-center gap-1.5 shadow-md"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              <span>{copied ? 'Скопировано в буфер!' : 'Копировать претензию'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
