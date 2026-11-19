/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { jsPDF } from 'jspdf';
import type { AuditCase } from '../types';
import { calculateRiskDistribution } from './riskAnalytics';
import {
  getCompliancePenaltyDisplay,
  getLocalizedRiskLevel,
  getLocalizedStatus,
  isLegalViolation,
  MRP_2026_KZT,
  normalizeAuditCaseCompliance,
  type BusinessEntityType,
} from './kzComplianceIntelligence';

export interface GeneratedPdfResult {
  blob: Blob;
  file: File;
  fileName: string;
  pageCount: number;
}

const PAGE_W = 1588; // A4 @ 192 DPI
const PAGE_H = 2246;
const PAD_X = 84;
const CONTENT_W = PAGE_W - PAD_X * 2;
const FOOTER_RESERVE = 104;
const MAX_Y = PAGE_H - FOOTER_RESERVE;

const FONT_HEADING = "'Plus Jakarta Sans', 'Inter', system-ui, -apple-system, sans-serif";
const FONT_BODY = "'Inter', system-ui, -apple-system, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines?: number
): string[] {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const paragraphs = normalized.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
      }
      continue;
    }
    const words = trimmed.split(/\s+/);
    let current = '';

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) {
          lines.push(current);
          current = '';
        }
        // Break oversized single tokens (URLs, SHA hashes) cleanly
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }

  if (maxLines && lines.length > maxLines) {
    const sliced = lines.slice(0, maxLines);
    const last = sliced[maxLines - 1];
    sliced[maxLines - 1] = last.length > 3 ? `${last.slice(0, Math.max(0, last.length - 2)).trimEnd()}…` : '…';
    return sliced;
  }
  return lines;
}

function drawLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number
): number {
  let y = startY;
  for (const line of lines) {
    if (line) {
      ctx.fillText(line, x, y);
    }
    y += lineHeight;
  }
  return y;
}

function getEntityTierLabel(tier: BusinessEntityType, lang: 'ru' | 'kz'): string {
  if (lang === 'kz') {
    if (tier === 'individual') return 'Жеке тұлға';
    if (tier === 'small') return 'Шағын бизнес / ЖК';
    if (tier === 'medium') return 'Орта бизнес';
    return 'Ірі бизнес';
  }
  if (tier === 'individual') return 'Физическое лицо';
  if (tier === 'small') return 'Малый бизнес / ИП';
  if (tier === 'medium') return 'Средний бизнес';
  return 'Крупный бизнес';
}

export async function generateStyledAuditPdf(
  rawAuditCase: AuditCase,
  options?: { entityTier?: BusinessEntityType; language?: 'ru' | 'kz' }
): Promise<GeneratedPdfResult> {
  const language: 'ru' | 'kz' = options?.language === 'kz' ? 'kz' : 'ru';
  const entityTier: BusinessEntityType = options?.entityTier || 'small';
  const auditCase = normalizeAuditCaseCompliance(rawAuditCase);

  // Wait briefly for Google Fonts so Cyrillic/Kazakh typography renders cleanly
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 600)),
    ]);
  }

  const penaltyDisplay = getCompliancePenaltyDisplay(auditCase.violations, entityTier, language);
  const localizedStatus = getLocalizedStatus(auditCase.status, language);
  const localizedRiskLevel = getLocalizedRiskLevel(auditCase.riskLevel, language);
  const riskAnalytics = calculateRiskDistribution(auditCase.violations, language);
  const safeSha = typeof auditCase.sha256 === 'string' && auditCase.sha256 ? auditCase.sha256 : 'sha256-verified';

  const pages: HTMLCanvasElement[] = [];

  const createPage = (isContinuation: boolean) => {
    const canvas = document.createElement('canvas');
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    ctx.textBaseline = 'top';
    pages.push(canvas);

    if (isContinuation) {
      ctx.fillStyle = '#f4f4f5';
      drawRoundedRect(ctx, PAD_X, 46, CONTENT_W, 56, 12);
      ctx.fill();
      ctx.font = `700 17px ${FONT_MONO}`;
      ctx.fillStyle = '#18181b';
      ctx.fillText('CHECK ACTIVITY · KZ', PAD_X + 20, 64);
      ctx.font = `500 17px ${FONT_MONO}`;
      ctx.fillStyle = '#52525b';
      const contLabel =
        language === 'kz'
          ? `${auditCase.referenceNumber} · Сараптамалық есептің жалғасы`
          : `${auditCase.referenceNumber} · Продолжение экспертного отчёта`;
      const tw = ctx.measureText(contLabel).width;
      ctx.fillText(contLabel, PAD_X + CONTENT_W - 20 - tw, 64);
      return { ctx, y: 126 };
    }
    return { ctx, y: 64 };
  };

  let { ctx, y } = createPage(false);

  const ensureSpace = (neededH: number) => {
    if (y + neededH > MAX_Y) {
      const next = createPage(true);
      ctx = next.ctx;
      y = next.y;
    }
  };

  // =========================================================================
  // 1. TOP DARK HERO HEADER CARD
  // =========================================================================
  const heroH = 148;
  ctx.fillStyle = '#09090b';
  drawRoundedRect(ctx, PAD_X, y, CONTENT_W, heroH, 22);
  ctx.fill();

  // Accent stripe along bottom of hero
  ctx.fillStyle =
    auditCase.status === 'ТРЕБУЕТ МЕР' || auditCase.status === 'БЛОКИРОВКА'
      ? '#e11d48'
      : auditCase.status === 'ПРЕДУПРЕЖДЕНИЕ'
      ? '#f59e0b'
      : '#10b981';
  ctx.fillRect(PAD_X + 28, y + heroH - 6, 180, 6);

  // Brand pill
  ctx.fillStyle = '#27272a';
  drawRoundedRect(ctx, PAD_X + 32, y + 28, 52, 52, 14);
  ctx.fill();
  ctx.font = `800 22px ${FONT_MONO}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('CA', PAD_X + 41, y + 41);

  ctx.font = `800 32px ${FONT_HEADING}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('CHECK ACTIVITY', PAD_X + 102, y + 26);

  ctx.font = `600 17px ${FONT_MONO}`;
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText(
    language === 'kz'
      ? 'РЕСМИ КОМПЛАЕНС-ЕСЕП · ҚР ӘҚБтК / № 230-VII'
      : 'ОФИЦИАЛЬНЫЙ КОМПЛАЕНС-ОТЧЁТ · КоАП РК / № 230-VII',
    PAD_X + 102,
    y + 68
  );

  // Right metadata block
  ctx.font = `700 20px ${FONT_MONO}`;
  const refBadgeText = auditCase.referenceNumber;
  const refW = ctx.measureText(refBadgeText).width + 30;
  ctx.fillStyle = '#18181b';
  drawRoundedRect(ctx, PAD_X + CONTENT_W - 32 - refW, y + 26, refW, 38, 10);
  ctx.fill();
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fafafa';
  ctx.fillText(refBadgeText, PAD_X + CONTENT_W - 32 - refW + 15, y + 34);

  ctx.font = `500 17px ${FONT_MONO}`;
  ctx.fillStyle = '#d4d4d8';
  const dateText = auditCase.timestamp || '';
  const dateW = ctx.measureText(dateText).width;
  ctx.fillText(dateText, PAD_X + CONTENT_W - 32 - dateW, y + 76);

  ctx.font = `500 15px ${FONT_MONO}`;
  ctx.fillStyle = '#a1a1aa';
  const mrpInfo = `1 ${language === 'kz' ? 'АЕК' : 'МРП'} = ${MRP_2026_KZT.toLocaleString('ru-RU')} ₸ · ${getEntityTierLabel(entityTier, language)}`;
  const mrpInfoW = ctx.measureText(mrpInfo).width;
  ctx.fillText(mrpInfo, PAD_X + CONTENT_W - 32 - mrpInfoW, y + 104);

  y += heroH + 28;

  // =========================================================================
  // 2. EXECUTIVE VERDICT & SANCTION KPI STRIP
  // =========================================================================
  const isCritical = auditCase.status === 'ТРЕБУЕТ МЕР' || auditCase.status === 'БЛОКИРОВКА';
  const isWarn = auditCase.status === 'ПРЕДУПРЕЖДЕНИЕ';
  const accentColor = isCritical ? '#be123c' : isWarn ? '#b45309' : '#047857';
  const tintBg = isCritical ? '#fff1f2' : isWarn ? '#fffbeb' : '#ecfdf5';
  const borderColor = isCritical ? '#fda4af' : isWarn ? '#fcd34d' : '#6ee7b7';
  const statusBg = isCritical ? '#be123c' : isWarn ? '#f59e0b' : '#059669';
  const statusFg = isWarn ? '#09090b' : '#ffffff';

  const summaryRaw = auditCase.summary || penaltyDisplay.subline;
  ctx.font = `500 20px ${FONT_BODY}`;
  const summaryLines = wrapTextLines(ctx, summaryRaw, CONTENT_W - 430, 4);
  const verdictH = Math.max(196, 126 + summaryLines.length * 29);

  ctx.fillStyle = tintBg;
  drawRoundedRect(ctx, PAD_X, y, CONTENT_W, verdictH, 20);
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Left solid color bar
  ctx.fillStyle = accentColor;
  drawRoundedRect(ctx, PAD_X, y, 12, verdictH, 6);
  ctx.fill();

  // Status badge
  ctx.font = `800 18px ${FONT_MONO}`;
  const statusLabel = localizedStatus.toUpperCase();
  const statusPillW = ctx.measureText(statusLabel).width + 32;
  ctx.fillStyle = statusBg;
  drawRoundedRect(ctx, PAD_X + 34, y + 26, statusPillW, 38, 10);
  ctx.fill();
  ctx.fillStyle = statusFg;
  ctx.fillText(statusLabel, PAD_X + 50, y + 34);

  // Risk score text
  ctx.font = `800 26px ${FONT_HEADING}`;
  ctx.fillStyle = '#09090b';
  const riskHeader = `${language === 'kz' ? 'ТӘУЕКЕЛ:' : 'ИНДЕКС РИСКА:'} ${auditCase.riskScore} / 100 · ${localizedRiskLevel}`;
  ctx.fillText(riskHeader, PAD_X + 34 + statusPillW + 18, y + 30);

  // Risk progress gauge
  const barX = PAD_X + 34;
  const barY = y + 78;
  const barW = CONTENT_W - 440;
  ctx.fillStyle = '#e4e4e7';
  drawRoundedRect(ctx, barX, barY, barW, 10, 5);
  ctx.fill();
  ctx.fillStyle = accentColor;
  const fillBarW = Math.max(12, Math.round((barW * Math.max(0, Math.min(100, auditCase.riskScore))) / 100));
  drawRoundedRect(ctx, barX, barY, fillBarW, 10, 5);
  ctx.fill();

  // Executive summary
  ctx.font = `500 20px ${FONT_BODY}`;
  ctx.fillStyle = '#18181b';
  drawLines(ctx, summaryLines, PAD_X + 34, y + 104, 29);

  // Right KPI Financial Box
  const kpiW = 356;
  const kpiX = PAD_X + CONTENT_W - kpiW - 24;
  const kpiY = y + 24;
  const kpiH = verdictH - 48;
  ctx.fillStyle = '#ffffff';
  drawRoundedRect(ctx, kpiX, kpiY, kpiW, kpiH, 16);
  ctx.fill();
  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.font = `700 15px ${FONT_MONO}`;
  ctx.fillStyle = '#52525b';
  ctx.fillText(
    language === 'kz' ? 'ЕСЕПТІК АЙЫППҰЛ ҚР' : 'РАСЧЁТНЫЙ ШТРАФ РК',
    kpiX + 22,
    kpiY + 20
  );

  ctx.font = `800 25px ${FONT_HEADING}`;
  ctx.fillStyle =
    penaltyDisplay.mode === 'legal_fine'
      ? '#be123c'
      : penaltyDisplay.mode === 'ethics_only'
      ? '#b45309'
      : '#047857';
  const headlineLines = wrapTextLines(ctx, penaltyDisplay.headline, kpiW - 44, 2);
  const afterHeadlineY = drawLines(ctx, headlineLines, kpiX + 22, kpiY + 52, 32);

  ctx.font = `700 17px ${FONT_MONO}`;
  ctx.fillStyle = '#27272a';
  ctx.fillText(penaltyDisplay.mrpRangeText, kpiX + 22, Math.min(kpiY + kpiH - 34, afterHeadlineY + 6));

  y += verdictH + 24;

  // =========================================================================
  // 3. 4-TILE METADATA & SCORES ROW
  // =========================================================================
  const tileGap = 18;
  const tileW = (CONTENT_W - tileGap * 3) / 4;
  const tileH = 114;
  const tiles = [
    {
      label: language === 'kz' ? 'ТЕКСЕРУ НЫСАНЫ' : 'ОБЪЕКТ ПРОВЕРКИ',
      value: auditCase.title || 'Материал',
      mono: false,
    },
    {
      label: language === 'kz' ? 'ДЕРЕККӨЗ / ФАЙЛ' : 'ИСТОЧНИК / ФАЙЛ',
      value: auditCase.sourceName || auditCase.sourceType || '—',
      mono: true,
    },
    {
      label: language === 'kz' ? 'ҚҰҚЫҚТЫҚ ИНДЕКС' : 'ПРАВОВОЙ ИНДЕКС',
      value: `${auditCase.legalScore ?? 0} / 100`,
      mono: true,
    },
    {
      label: language === 'kz' ? 'ЭТИКА ИНДЕКСІ' : 'ЭТИЧЕСКИЙ ИНДЕКС',
      value: `${auditCase.ethicsScore ?? 0} / 100`,
      mono: true,
    },
  ];

  tiles.forEach((tile, idx) => {
    const tx = PAD_X + idx * (tileW + tileGap);
    ctx.fillStyle = '#fafafa';
    drawRoundedRect(ctx, tx, y, tileW, tileH, 14);
    ctx.fill();
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `700 14px ${FONT_MONO}`;
    ctx.fillStyle = '#71717a';
    ctx.fillText(tile.label, tx + 18, y + 18);

    ctx.font = tile.mono ? `700 20px ${FONT_MONO}` : `700 19px ${FONT_BODY}`;
    ctx.fillStyle = '#09090b';
    const valLines = wrapTextLines(ctx, tile.value, tileW - 36, 2);
    drawLines(ctx, valLines, tx + 18, y + 48, 26);
  });

  y += tileH + 24;

  // =========================================================================
  // 4. RISK DOMAINS DISTRIBUTION BAR
  // =========================================================================
  const distCols = riskAnalytics.coreCategories;
  const distH = 148;
  ensureSpace(distH + 24);

  ctx.fillStyle = '#f4f4f5';
  drawRoundedRect(ctx, PAD_X, y, CONTENT_W, distH, 16);
  ctx.fill();
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = `700 16px ${FONT_MONO}`;
  ctx.fillStyle = '#18181b';
  ctx.fillText(
    language === 'kz' ? 'ТӘУЕКЕЛ ДОМЕНДЕРІ БОЙЫНША БӨЛУ' : 'РАСПРЕДЕЛЕНИЕ ПО ДОМЕНАМ РИСКА',
    PAD_X + 22,
    y + 18
  );

  const chipGap = 14;
  const chipCount = Math.min(5, distCols.length);
  const chipW = (CONTENT_W - 44 - chipGap * (chipCount - 1)) / Math.max(1, chipCount);
  distCols.slice(0, 5).forEach((cat, idx) => {
    const cx = PAD_X + 22 + idx * (chipW + chipGap);
    const cy = y + 50;
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, cx, cy, chipW, 76, 12);
    ctx.fill();
    ctx.strokeStyle = cat.count > 0 ? cat.color : '#e4e4e7';
    ctx.lineWidth = cat.count > 0 ? 2.5 : 1.5;
    ctx.stroke();

    ctx.font = `600 15px ${FONT_BODY}`;
    ctx.fillStyle = '#18181b';
    const catLines = wrapTextLines(ctx, cat.name, chipW - 22, 1);
    ctx.fillText(catLines[0] || cat.name, cx + 11, cy + 14);

    ctx.font = `800 22px ${FONT_MONO}`;
    ctx.fillStyle = cat.count > 0 ? cat.color : '#71717a';
    ctx.fillText(`${cat.percentage}%`, cx + 11, cy + 40);
  });

  y += distH + 28;

  // =========================================================================
  // 5. VIOLATIONS LIST
  // =========================================================================
  ensureSpace(90);
  ctx.font = `800 22px ${FONT_HEADING}`;
  ctx.fillStyle = '#09090b';
  ctx.fillText(
    language === 'kz'
      ? `АНЫҚТАЛҒАН ЕСКЕРТУЛЕР МЕН БАПТАР (${auditCase.violations.length})`
      : `ВЫЯВЛЕННЫЕ НАРУШЕНИЯ И СТАТЬИ (${auditCase.violations.length})`,
    PAD_X,
    y
  );
  y += 40;

  if (auditCase.violations.length === 0) {
    ensureSpace(110);
    ctx.fillStyle = '#ecfdf5';
    drawRoundedRect(ctx, PAD_X, y, CONTENT_W, 92, 16);
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.font = `700 21px ${FONT_BODY}`;
    ctx.fillStyle = '#065f46';
    ctx.fillText(
      language === 'kz'
        ? '0 ₸ · ҚР заңнамасы мен цифрлық этика нормаларын бұзушылықтар анықталған жоқ.'
        : '0 ₸ · Нарушений законодательства РК и норм цифровой этики не зафиксировано.',
      PAD_X + 26,
      y + 33
    );
    y += 116;
  } else {
    for (let i = 0; i < auditCase.violations.length; i++) {
      const v = auditCase.violations[i];
      const isEthicsOnly = !isLegalViolation(v);
      const cardPenalty = getCompliancePenaltyDisplay([v], entityTier, language);
      const cardFine =
        cardPenalty.mode === 'legal_fine'
          ? `${cardPenalty.mrpRangeText} (${cardPenalty.kztRangeText})`
          : cardPenalty.headline;

      // Measure card lines dynamically
      ctx.font = `700 22px ${FONT_HEADING}`;
      const titleLines = wrapTextLines(ctx, `#${i + 1} · ${v.title}`, CONTENT_W - 220, 2);
      ctx.font = `500 18px ${FONT_BODY}`;
      const quoteLines = v.quote ? wrapTextLines(ctx, `«${v.quote}»`, CONTENT_W - 76, 3) : [];
      ctx.font = `400 19px ${FONT_BODY}`;
      const basisLines = wrapTextLines(ctx, v.basis || '', CONTENT_W - 48, 5);
      ctx.font = `500 18px ${FONT_BODY}`;
      const recLines = v.recommendation
        ? wrapTextLines(
            ctx,
            `${language === 'kz' ? 'Ұсыныс:' : 'Рекомендация:'} ${v.recommendation}`,
            CONTENT_W - 72,
            3
          )
        : [];

      const headerH = 52;
      const titleH = titleLines.length * 30 + 10;
      const quoteH = quoteLines.length > 0 ? quoteLines.length * 26 + 22 : 0;
      const basisH = basisLines.length > 0 ? basisLines.length * 27 + 12 : 0;
      const recH = recLines.length > 0 ? recLines.length * 26 + 24 : 0;
      const footerH = 44;
      const cardH = headerH + titleH + quoteH + basisH + recH + footerH + 22;

      ensureSpace(cardH + 18);

      // Card container
      ctx.fillStyle = '#ffffff';
      drawRoundedRect(ctx, PAD_X, y, CONTENT_W, cardH, 16);
      ctx.fill();
      ctx.strokeStyle = isEthicsOnly ? '#c4b5fd' : '#d4d4d8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Header strip inside card
      ctx.fillStyle = isEthicsOnly ? '#f5f3ff' : '#fafafa';
      drawRoundedRect(ctx, PAD_X + 2, y + 2, CONTENT_W - 4, headerH, 14);
      ctx.fill();

      // Code badge
      ctx.font = `700 17px ${FONT_MONO}`;
      ctx.fillStyle = isEthicsOnly ? '#6d28d9' : '#be123c';
      const codeTrimmed = v.code.length > 68 ? `${v.code.slice(0, 66)}…` : v.code;
      ctx.fillText(codeTrimmed, PAD_X + 24, y + 18);

      // Fine badge on right
      ctx.font = `700 17px ${FONT_MONO}`;
      const fineW = ctx.measureText(cardFine).width;
      ctx.fillStyle = isEthicsOnly ? '#92400e' : '#9f1239';
      ctx.fillText(cardFine, PAD_X + CONTENT_W - 24 - fineW, y + 18);

      let cy = y + headerH + 16;

      // Title
      ctx.font = `700 22px ${FONT_HEADING}`;
      ctx.fillStyle = '#09090b';
      cy = drawLines(ctx, titleLines, PAD_X + 24, cy, 30) + 6;

      // Quote block
      if (quoteLines.length > 0) {
        const qBoxH = quoteLines.length * 26 + 16;
        ctx.fillStyle = '#f4f4f5';
        drawRoundedRect(ctx, PAD_X + 24, cy, CONTENT_W - 48, qBoxH, 10);
        ctx.fill();
        ctx.fillStyle = isEthicsOnly ? '#8b5cf6' : '#e11d48';
        ctx.fillRect(PAD_X + 24, cy + 4, 5, qBoxH - 8);
        ctx.font = `500 18px ${FONT_BODY}`;
        ctx.fillStyle = '#27272a';
        drawLines(ctx, quoteLines, PAD_X + 42, cy + 9, 26);
        cy += qBoxH + 10;
      }

      // Basis
      if (basisLines.length > 0) {
        ctx.font = `400 19px ${FONT_BODY}`;
        ctx.fillStyle = '#3f3f46';
        cy = drawLines(ctx, basisLines, PAD_X + 24, cy, 27) + 8;
      }

      // Recommendation box
      if (recLines.length > 0) {
        const rBoxH = recLines.length * 26 + 16;
        ctx.fillStyle = '#f8fafc';
        drawRoundedRect(ctx, PAD_X + 24, cy, CONTENT_W - 48, rBoxH, 10);
        ctx.fill();
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = `500 18px ${FONT_BODY}`;
        ctx.fillStyle = '#0f172a';
        drawLines(ctx, recLines, PAD_X + 38, cy + 9, 26);
        cy += rBoxH + 10;
      }

      // Bottom jurisdiction line
      ctx.strokeStyle = '#f4f4f5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(PAD_X + 24, y + cardH - 42);
      ctx.lineTo(PAD_X + CONTENT_W - 24, y + cardH - 42);
      ctx.stroke();

      ctx.font = `600 15px ${FONT_MONO}`;
      ctx.fillStyle = '#71717a';
      ctx.fillText(
        `${language === 'kz' ? 'РЕТТЕУШІ / ОРГАН:' : 'РЕГУЛЯТОР / ОРГАН:'} ${v.jurisdiction || 'МКИ РК'}`,
        PAD_X + 24,
        y + cardH - 30
      );

      y += cardH + 20;
    }
  }

  // =========================================================================
  // 6. EXTRACTED TEXT / TRANSCRIPT EXCERPT (if available)
  // =========================================================================
  const rawExtract = (auditCase.extractedText || auditCase.rawText || '').trim();
  if (rawExtract && rawExtract.length > 4) {
    const excerpt = rawExtract.length > 900 ? `${rawExtract.slice(0, 897)}…` : rawExtract;
    ctx.font = `400 18px ${FONT_BODY}`;
    const excerptLines = wrapTextLines(ctx, excerpt, CONTENT_W - 56, 12);
    const boxH = 54 + excerptLines.length * 26 + 20;
    ensureSpace(boxH + 24);

    ctx.fillStyle = '#fafafa';
    drawRoundedRect(ctx, PAD_X, y, CONTENT_W, boxH, 16);
    ctx.fill();
    ctx.strokeStyle = '#e4e4e7';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = `700 16px ${FONT_MONO}`;
    ctx.fillStyle = '#3f3f46';
    ctx.fillText(
      language === 'kz' ? 'ТАНЫЛҒАН МӘТІН / СТЕНОГРАММА' : 'РАСПОЗНАННЫЙ ТЕКСТ / СТЕНОГРАММА',
      PAD_X + 24,
      y + 18
    );

    ctx.font = `400 18px ${FONT_BODY}`;
    ctx.fillStyle = '#18181b';
    drawLines(ctx, excerptLines, PAD_X + 24, y + 50, 26);

    y += boxH + 24;
  }

  // =========================================================================
  // 7. EXPERT ACTION CHECKLIST
  // =========================================================================
  const recItems = Array.from(
    new Set(auditCase.violations.map((v) => v.recommendation).filter((r): r is string => Boolean(r && r.trim())))
  ).slice(0, 5);
  if (recItems.length === 0) {
    recItems.push(
      language === 'kz'
        ? 'Материал ҚР заңнамасына сәйкес келеді. Қосымша түзетулер қажет емес.'
        : 'Материал соответствует действующему законодательству РК и стандартам этики. Правки не требуются.'
    );
  }

  ctx.font = `500 18px ${FONT_BODY}`;
  const recWrapped: string[] = [];
  recItems.forEach((item, idx) => {
    const wrapped = wrapTextLines(ctx, `${idx + 1}. ${item}`, CONTENT_W - 60, 2);
    recWrapped.push(...wrapped);
  });
  const checklistH = 56 + recWrapped.length * 27 + 18;
  ensureSpace(checklistH + 20);

  ctx.fillStyle = '#18181b';
  drawRoundedRect(ctx, PAD_X, y, CONTENT_W, checklistH, 16);
  ctx.fill();

  ctx.font = `700 17px ${FONT_MONO}`;
  ctx.fillStyle = '#fafafa';
  ctx.fillText(
    language === 'kz' ? 'ҚОРЫТЫНДЫ ҰСЫНЫСТАР' : 'ИТОГОВЫЕ РЕКОМЕНДАЦИИ ЭКСПЕРТА',
    PAD_X + 24,
    y + 20
  );

  ctx.font = `500 18px ${FONT_BODY}`;
  ctx.fillStyle = '#e4e4e7';
  drawLines(ctx, recWrapped, PAD_X + 24, y + 54, 27);

  // =========================================================================
  // STAMP FOOTERS ON ALL PAGES
  // =========================================================================
  const totalPages = pages.length;
  pages.forEach((pageCanvas, pageIdx) => {
    const pCtx = pageCanvas.getContext('2d')!;
    const fy = PAGE_H - 70;
    pCtx.strokeStyle = '#e4e4e7';
    pCtx.lineWidth = 2;
    pCtx.beginPath();
    pCtx.moveTo(PAD_X, fy - 16);
    pCtx.lineTo(PAD_X + CONTENT_W, fy - 16);
    pCtx.stroke();

    pCtx.font = `600 15px ${FONT_MONO}`;
    pCtx.fillStyle = '#52525b';
    pCtx.fillText(`Check Activity KZ · ${auditCase.referenceNumber}`, PAD_X, fy);

    const shaLabel = `SHA-256: ${safeSha.slice(0, 24)}…`;
    const shaW = pCtx.measureText(shaLabel).width;
    pCtx.fillText(shaLabel, PAD_X + (CONTENT_W - shaW) / 2, fy);

    const pageStr =
      language === 'kz'
        ? `Бет ${pageIdx + 1} / ${totalPages}`
        : `Стр. ${pageIdx + 1} / ${totalPages}`;
    const pW = pCtx.measureText(pageStr).width;
    pCtx.fillText(pageStr, PAD_X + CONTENT_W - pW, fy);
  });

  // =========================================================================
  // ASSEMBLE REAL A4 PDF VIA jsPDF
  // =========================================================================
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((pageCanvas, idx) => {
    if (idx > 0) pdf.addPage('a4', 'portrait');
    const imgData = pageCanvas.toDataURL('image/jpeg', 0.94);
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  });

  const cleanRef = (auditCase.referenceNumber || 'REPORT').replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `CheckActivity_KZ_${cleanRef}.pdf`;
  const blob = pdf.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  return {
    blob,
    file,
    fileName,
    pageCount: totalPages,
  };
}

export function downloadPdfBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 1500);
}

export function canNativeSharePdfFile(file: File): boolean {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}
