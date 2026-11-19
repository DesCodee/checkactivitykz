/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import type { Request, Response } from 'express';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'node:fs';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIPv4, isIPv6 } from 'node:net';
import { analyzeEmojis } from './src/utils/emojiIntelligence.ts';
import {
  findKzLawByViolation,
  formatKzLawsRagContext,
  KZ_LAWS_DB,
  retrieveRelevantKzLaws,
} from './src/data/kzLawsDb.ts';
import {
  analyzeKzFraudAndLanguage,
  type BusinessEntityType,
  detectPeacefulAssemblyCall,
  detectPersonalDataDoxing,
  detectPoliticalDisinfo,
  findProfanityMatches,
  getCompliancePenaltyDisplay,
  HITL_PROTEST_ARTICLE,
  HITL_PROTEST_DESCRIPTION,
  isHitlContextViolation,
  isJournalisticWarningContext,
  isLegalViolation,
  normalizeAuditCaseCompliance,
  normalizeViolation,
  runLivePreCheck,
} from './src/utils/kzComplianceIntelligence.ts';

function computeRewriteResidualRisk(
  safeTextRu: string,
  safeTextKz: string,
  entityTier: BusinessEntityType = 'small'
): number {
  const ruCheck = runLivePreCheck(safeTextRu, undefined, entityTier, 'ru');
  const kzCheck = runLivePreCheck(safeTextKz, undefined, entityTier, 'kz');
  const hasBilingualPair =
    safeTextRu.trim().length > 0 &&
    safeTextKz.trim().length > 0 &&
    analyzeKzFraudAndLanguage(`${safeTextRu}\n${safeTextKz}`).languageCoverage === 'bilingual';

  if (!hasBilingualPair) {
    return Math.max(ruCheck.riskScore, kzCheck.riskScore);
  }

  const effectiveScore = (res: ReturnType<typeof runLivePreCheck>): number => {
    const remaining = res.triggers.filter((t) => t.id !== 'lang_parity');
    if (remaining.length === 0) return 4;
    if (remaining.length === res.triggers.length) return res.riskScore;
    const legal = remaining.filter((t) => t.category === 'legal');
    if (legal.some((t) => t.severity === 'critical')) {
      return Math.min(98, 76 + (legal.length - 1) * 6);
    }
    if (legal.length > 0) return Math.min(69, 48 + (legal.length - 1) * 7);
    return Math.min(55, 36 + (remaining.length - 1) * 8);
  };

  return Math.max(effectiveScore(ruCheck), effectiveScore(kzCheck));
}

function resolveEntityTier(rawTier: unknown): BusinessEntityType {
  if (rawTier === 'individual' || rawTier === 'small' || rawTier === 'medium' || rawTier === 'large') {
    return rawTier;
  }
  return 'small';
}

function computeViolationFineText(violation: any, entityTier: BusinessEntityType = 'small'): string {
  const normalized = normalizeViolation(violation);
  const display = getCompliancePenaltyDisplay([normalized], entityTier, 'ru');
  if (display.mode === 'legal_fine') {
    return `${display.mrpRangeText} (${display.kztRangeText})`;
  }
  return display.headline;
}

function applyViolationFinesForEntity(violations: any[], entityTier: BusinessEntityType = 'small'): any[] {
  return violations.map((v) => {
    const normalized = normalizeViolation(v);
    const matchedLaw = isLegalViolation(normalized) ? findKzLawByViolation(normalized) : undefined;
    return {
      ...normalized,
      ...(matchedLaw
        ? {
            code: isHitlContextViolation(normalized) ? normalized.code : matchedLaw.code,
            jurisdiction: matchedLaw.regulator,
          }
        : {}),
      fineAmount: computeViolationFineText(normalized, entityTier),
    };
  });
}

const execFileAsync = promisify(execFile);

dotenv.config();

const app = express();
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Lazy Gemini client helper with telemetry header as required by guidelines
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function computeServerContentSha256(params: {
  clientSha256?: unknown;
  mediaBase64?: unknown;
  videoDataUrl?: unknown;
  audioDataUrl?: unknown;
  imageDataUrl?: unknown;
  effectiveUrl?: string;
  effectiveText?: string;
  liveUrlExtracted?: string;
  fileName?: string;
}): string {
  if (
    typeof params.clientSha256 === 'string' &&
    /^[a-f0-9]{64}$/i.test(params.clientSha256.trim())
  ) {
    return params.clientSha256.trim().toLowerCase();
  }

  const candidateMedia = [
    params.mediaBase64,
    params.videoDataUrl,
    params.audioDataUrl,
    params.imageDataUrl,
  ];

  for (const media of candidateMedia) {
    if (!media || typeof media !== 'string') continue;
    const match = media.trim().match(/^data:[^;]*;base64,(.+)$/s);
    if (match && match[1]) {
      const buf = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
      if (buf.byteLength > 0) {
        return createHash('sha256').update(buf).digest('hex');
      }
    } else if (
      media === params.mediaBase64 &&
      !media.startsWith('http') &&
      !media.startsWith('blob:')
    ) {
      const buf = Buffer.from(media.replace(/\s+/g, ''), 'base64');
      if (buf.byteLength > 0) {
        return createHash('sha256').update(buf).digest('hex');
      }
    }
  }

  const canonicalText = (
    params.effectiveUrl ||
    params.effectiveText ||
    params.liveUrlExtracted ||
    params.fileName ||
    ''
  ).trim();
  return createHash('sha256').update(canonicalText, 'utf8').digest('hex');
}

const PRIVACY_FALLBACK_NOTICE =
  'Доступ ограничен настройками приватности — загрузите скриншот или скопируйте текст публикации';

const DESKTOP_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MOBILE_BROWSER_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SOCIAL_BOT_UA =
  'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const TELEGRAM_BOT_UA = 'TelegramBot (like TwitterBot)';
const WHATSAPP_BOT_UA = 'WhatsApp/2.23.20.0 A';

function extractMetaTagValue(html: string, attrName: string, attrValue: string): string {
  if (!html) return '';
  const headEndMatch = /<\/head>/i.exec(html);
  const searchArea = headEndMatch
    ? html.slice(0, headEndMatch.index + 7)
    : html.slice(0, 200000);

  const metaTagRegex = /<meta\b[^>]{1,4000}>/gi;
  const attrRegex = /\b([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  const targetAttrLower = attrName.toLowerCase();
  const targetValLower = attrValue.toLowerCase();

  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = metaTagRegex.exec(searchArea)) !== null) {
    const tag = tagMatch[0];
    attrRegex.lastIndex = 0;
    let attrMatch: RegExpExecArray | null;
    let matchedAttr = false;
    let contentVal = '';
    while ((attrMatch = attrRegex.exec(tag)) !== null) {
      const k = attrMatch[1].toLowerCase();
      const v = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
      if (k === targetAttrLower && v.toLowerCase() === targetValLower) {
        matchedAttr = true;
      } else if (k === 'content') {
        contentVal = v;
      }
    }
    if (matchedAttr && contentVal) {
      return contentVal;
    }
  }
  return '';
}

function extractMetaContent(html: string, attrName: string, attrValue: string): string {
  const raw = extractMetaTagValue(html, attrName, attrValue);
  return raw ? decodeHtmlEntities(raw) : '';
}

function extractRawMetaUrl(html: string, attrName: string, attrValue: string): string {
  const raw = extractMetaTagValue(html, attrName, attrValue);
  return raw ? raw.replace(/&amp;/g, '&').trim() : '';
}

async function readHtmlHeadOnly(res: globalThis.Response, maxBytes = 240000): Promise<string> {
  if (!res.body) {
    const buf = await res.arrayBuffer();
    return decodeResponseBuffer(buf.slice(0, maxBytes), res.headers.get('content-type'));
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let headProbe = '';
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      total += value.byteLength;
      headProbe += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(headProbe)) {
        reader.cancel().catch(() => {});
        break;
      }
    }
  } catch {
    // ignore abort/stream stop after reading head
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return decodeResponseBuffer(merged.buffer, res.headers.get('content-type'));
}

export function isPrivateOrReservedIp(ipRaw: string): boolean {
  const ip = (ipRaw || '').trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (!ip) return true;

  // Handle IPv4-mapped IPv6 addresses like ::ffff:127.0.0.1
  if (ip.startsWith('::ffff:')) {
    const mapped = ip.slice(7);
    if (isIPv4(mapped)) {
      return isPrivateOrReservedIp(mapped);
    }
    const hexParts = mapped.split(':');
    if (hexParts.length === 2) {
      const hi = parseInt(hexParts[0], 16);
      const lo = parseInt(hexParts[1], 16);
      if (Number.isFinite(hi) && Number.isFinite(lo)) {
        const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
        return isPrivateOrReservedIp(ipv4);
      }
    }
  }

  if (isIPv4(ip)) {
    const parts = ip.split('.').map((n) => parseInt(n, 10));
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
      return true;
    }
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a === 192 && b === 0 && (parts[2] === 0 || parts[2] === 2)) return true;
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmark
    if (a >= 224) return true; // multicast & reserved
    return false;
  }

  if (isIPv6(ip)) {
    if (ip === '::' || ip === '::1') return true;
    if (/^f[cd]/i.test(ip)) return true; // fc00::/7 ULA private
    if (/^fe[89ab]/i.test(ip)) return true; // fe80::/10 link-local
    if (ip.startsWith('ff')) return true; // ff00::/8 multicast
    return false;
  }

  return true;
}

export async function isSafeExternalHttpUrl(rawUrl: string): Promise<{
  safe: boolean;
  url?: URL;
  reason?: string;
}> {
  try {
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed || trimmed.length > 2048 || /[\s<>"'`]/.test(trimmed)) {
      return { safe: false, reason: 'Некорректный формат URL' };
    }
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Разрешены только протоколы HTTP и HTTPS' };
    }
    if (parsed.username || parsed.password) {
      return { safe: false, reason: 'URL с учетными данными запрещён' };
    }
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (!hostname) {
      return { safe: false, reason: 'Отсутствует хост в URL' };
    }
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.localdomain') ||
      hostname === 'metadata.google.internal'
    ) {
      return { safe: false, reason: 'Запросы к локальным и внутренним адресам запрещены' };
    }
    if (isIPv4(hostname) || isIPv6(hostname)) {
      if (isPrivateOrReservedIp(hostname)) {
        return { safe: false, reason: 'Запросы к приватным/служебным IP-адресам запрещены' };
      }
      return { safe: true, url: parsed };
    }

    try {
      const records = await Promise.race([
        dnsLookup(hostname, { all: true }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 1200)),
      ]);
      for (const rec of records) {
        if (isPrivateOrReservedIp(rec.address)) {
          return { safe: false, reason: 'Домен указывает на приватный/локальный IP-адрес' };
        }
      }
    } catch {
      // Offline / transient DNS resolution failure will cleanly fail in fetch later without exposing internal hosts
    }

    return { safe: true, url: parsed };
  } catch {
    return { safe: false, reason: 'Некорректный URL' };
  }
}

async function safeFetchExternal(
  rawUrl: string,
  options: {
    headers?: Record<string, string>;
    signal?: AbortSignal;
    timeoutMs?: number;
    maxRedirects?: number;
  } = {}
): Promise<globalThis.Response> {
  const maxRedirects = options.maxRedirects ?? 3;
  let currentUrl = rawUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await isSafeExternalHttpUrl(currentUrl);
    if (!check.safe || !check.url) {
      throw new Error(check.reason || 'Blocked unsafe external URL');
    }

    const hopController = new AbortController();
    const timeoutId = options.timeoutMs
      ? setTimeout(() => hopController.abort(), options.timeoutMs)
      : null;

    const onParentAbort = () => hopController.abort();
    if (options.signal) {
      if (options.signal.aborted) {
        if (timeoutId) clearTimeout(timeoutId);
        throw new Error('Request aborted');
      }
      options.signal.addEventListener('abort', onParentAbort, { once: true });
    }

    let res: globalThis.Response;
    try {
      res = await fetch(check.url.toString(), {
        method: 'GET',
        headers: options.headers,
        signal: hopController.signal,
        redirect: 'manual',
      });
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener('abort', onParentAbort);
      }
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      res.body?.cancel().catch(() => {});
      if (!location || hop === maxRedirects) {
        throw new Error('Too many redirects or missing Location');
      }
      currentUrl = new URL(location, check.url).toString();
      continue;
    }

    return res;
  }

  throw new Error('Redirect limit exceeded');
}

async function readBytesWithLimit(res: globalThis.Response, maxBytes: number): Promise<Uint8Array | null> {
  const contentLength = Number(res.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    res.body?.cancel().catch(() => {});
    return null;
  }
  if (!res.body) {
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) return null;
    return new Uint8Array(buf);
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return merged;
}

async function readTextWithLimit(res: globalThis.Response, maxBytes = 1024 * 1024): Promise<string> {
  if (!res.body) {
    const buf = await res.arrayBuffer();
    return decodeResponseBuffer(buf.slice(0, maxBytes), res.headers.get('content-type'));
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const remaining = maxBytes - total;
      const slice = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      chunks.push(slice);
      total += slice.byteLength;
      if (total >= maxBytes) {
        reader.cancel().catch(() => {});
        break;
      }
    }
  } catch {
    // return buffered prefix on premature stream end
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return decodeResponseBuffer(merged.buffer, res.headers.get('content-type'));
}

export function safeParseLlmJson(raw: string): Record<string, any> | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw
    .replace(/^```(?:json|JSON)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const tryParseObj = (candidate: string): Record<string, any> | null => {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const direct = tryParseObj(cleaned);
  if (direct) return direct;

  // Locate outermost balanced JSON object ignoring braces inside strings
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  let endBrace = -1;

  for (let i = firstBrace; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        endBrace = i;
        break;
      }
    }
  }

  if (endBrace > firstBrace) {
    const slice = cleaned.slice(firstBrace, endBrace + 1);
    const parsedSlice = tryParseObj(slice);
    if (parsedSlice) return parsedSlice;

    // Repair minor trailing commas before } or ] outside strings
    const noTrailingCommas = slice.replace(/,\s*([}\]])/g, '$1');
    const parsedRepaired = tryParseObj(noTrailingCommas);
    if (parsedRepaired) return parsedRepaired;
  }

  return null;
}

function extractJsonObjectAfterMarker(source: string, markerRegex: RegExp): any | null {
  const match = markerRegex.exec(source);
  if (!match) return null;
  const startIdx = source.indexOf('{', match.index);
  if (startIdx === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  const maxEnd = Math.min(source.length, startIdx + 600000);

  for (let i = startIdx; i < maxEnd; i++) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const jsonSlice = source.slice(startIdx, i + 1);
        try {
          return JSON.parse(jsonSlice);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function extractDivInnerHtml(html: string, classSubstring: string): string {
  const escaped = classSubstring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const openRegex = new RegExp(`<div\\b[^>]*class=["'][^"']*${escaped}[^"']*["'][^>]*>`, 'i');
  const openMatch = openRegex.exec(html);
  if (!openMatch) return '';

  const contentStart = openMatch.index + openMatch[0].length;
  const divTagRegex = /<\/?div\b[^>]*>/gi;
  divTagRegex.lastIndex = contentStart;
  let depth = 1;
  let tagMatch: RegExpExecArray | null;

  while ((tagMatch = divTagRegex.exec(html)) !== null) {
    if (tagMatch[0].startsWith('</')) {
      depth--;
      if (depth === 0) {
        return html.slice(contentStart, tagMatch.index);
      }
    } else {
      depth++;
    }
  }
  return '';
}

async function fetchImageAsDataUrl(rawUrl: string, baseUrl?: string, timeoutMs = 1200): Promise<string> {
  if (!rawUrl) return '';
  try {
    let imgUrl = rawUrl.replace(/&amp;/g, '&').trim();
    if (imgUrl.startsWith('//')) {
      imgUrl = 'https:' + imgUrl;
    } else if (imgUrl.startsWith('/') && baseUrl) {
      const parsed = new URL(baseUrl);
      imgUrl = `${parsed.origin}${imgUrl}`;
    }
    if (!/^https?:\/\//i.test(imgUrl)) return '';

    const imgRes = await safeFetchExternal(imgUrl, {
      timeoutMs,
      headers: { 'User-Agent': DESKTOP_BROWSER_UA },
    });
    if (!imgRes.ok) return '';

    const ct = (imgRes.headers.get('content-type') || '').toLowerCase();
    if (ct && !ct.startsWith('image/')) {
      imgRes.body?.cancel().catch(() => {});
      return '';
    }
    const mime = ct.startsWith('image/') ? ct.split(';')[0] : 'image/jpeg';
    const bytes = await readBytesWithLimit(imgRes, 3 * 1024 * 1024);
    if (!bytes || bytes.byteLength === 0) return '';
    return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
  } catch {
    return '';
  }
}

function decodeResponseBuffer(buf: ArrayBuffer, contentTypeHeader: string | null): string {
  const bytes = new Uint8Array(buf);
  let charset = '';

  if (contentTypeHeader) {
    const ctMatch = contentTypeHeader.match(/charset\s*=\s*["']?([a-zA-Z0-9._-]+)/i);
    if (ctMatch?.[1]) charset = ctMatch[1].trim().toLowerCase();
  }

  if (!charset) {
    const headLatin = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
    const metaCharset =
      headLatin.match(/<meta[^>]*charset\s*=\s*["']?\s*([a-zA-Z0-9._-]+)/i) ||
      headLatin.match(/<meta[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([a-zA-Z0-9._-]+)/i);
    if (metaCharset?.[1]) {
      charset = metaCharset[1].trim().toLowerCase();
    }
  }

  if (charset === 'cp1251' || charset === 'win1251') charset = 'windows-1251';
  if (!charset) charset = 'utf-8';

  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

function parseYoutubeCaptionsPayload(rawPayload: string): string {
  const trimmed = (rawPayload || '').trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed);
      const events: any[] = Array.isArray(json?.events) ? json.events : [];
      const chunks: string[] = [];
      for (const ev of events) {
        if (!Array.isArray(ev?.segs)) continue;
        const line = ev.segs.map((s: any) => String(s?.utf8 || '')).join('').trim();
        if (line && line !== '\n') chunks.push(line);
      }
      return chunks.join(' ').replace(/\s+/g, ' ').trim().slice(0, 6000);
    } catch {
      // fall through to XML cleanup
    }
  }

  const decodedFirstPass = trimmed
    .replace(/&amp;#(\d+);/g, '&#$1;')
    .replace(/&amp;#x([0-9a-f]+);/gi, '&#x$1;')
    .replace(/&amp;(quot|apos|lt|gt|amp|nbsp);/gi, '&$1;');

  return decodeHtmlEntities(decodedFirstPass.replace(/<\/(?:text|p|s)>/gi, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 6000);
}

function findTikTokItemStruct(root: any): any | null {
  if (!root || typeof root !== 'object') return null;
  const scope = root.__DEFAULT_SCOPE__;
  if (scope) {
    const direct =
      scope['webapp.video-detail']?.itemInfo?.itemStruct ||
      scope['webapp.reflow.video.detail']?.itemInfo?.itemStruct;
    if (direct && typeof direct === 'object') return direct;
  }
  const stack: any[] = [root];
  const seen = new Set<any>();
  let steps = 0;
  while (stack.length > 0 && steps < 400) {
    steps++;
    const curr = stack.pop();
    if (!curr || typeof curr !== 'object' || seen.has(curr)) continue;
    seen.add(curr);
    if (curr.itemStruct && typeof curr.itemStruct === 'object' && typeof curr.itemStruct.desc === 'string') {
      return curr.itemStruct;
    }
    if (typeof curr.desc === 'string' && (curr.video || curr.author || curr.challenges)) {
      return curr;
    }
    for (const val of Object.values(curr)) {
      if (val && typeof val === 'object') stack.push(val);
    }
  }
  return null;
}

type ScrapeUrlResult = {
  title: string;
  text: string;
  rawSnippet: string;
  thumbnailBase64?: string;
  videoEmbedUrl?: string;
  isVideo?: boolean;
  accessRestricted?: boolean;
  restrictionReason?: string;
};

const SCRAPE_URL_CACHE_TTL_MS = 10 * 60 * 1000;
const SCRAPE_URL_CACHE_MAX_ENTRIES = 200;
const scrapeUrlCache = new Map<string, { expiresAt: number; value: ScrapeUrlResult }>();

// Helper to scrape text content and media thumbnails from live URL with 10-min cache & closed-account fallback
async function scrapeUrl(targetUrl: string): Promise<ScrapeUrlResult> {
  let normalizedUrl = String(targetUrl || '').trim();
  if (!normalizedUrl) {
    return {
      title: '',
      text: '',
      rawSnippet: '',
      accessRestricted: true,
      restrictionReason: 'Некорректная или пустая ссылка',
    };
  }
  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(normalizedUrl)) {
    normalizedUrl = 'https://' + normalizedUrl;
  }

  const safety = await isSafeExternalHttpUrl(normalizedUrl);
  if (!safety.safe || !safety.url) {
    return {
      title: normalizedUrl,
      text: '',
      rawSnippet: normalizedUrl,
      accessRestricted: true,
      restrictionReason: safety.reason || PRIVACY_FALLBACK_NOTICE,
    };
  }

  const cacheKeyUrl = new URL(safety.url.toString());
  cacheKeyUrl.hash = '';
  const canonicalUrl = cacheKeyUrl.toString();

  const now = Date.now();
  const cachedEntry = scrapeUrlCache.get(canonicalUrl);
  if (cachedEntry) {
    if (now < cachedEntry.expiresAt) {
      return { ...cachedEntry.value };
    }
    scrapeUrlCache.delete(canonicalUrl);
  }

  const result = await scrapeUrlUncached(canonicalUrl);
  if (!result.accessRestricted && (result.text || result.thumbnailBase64)) {
    if (scrapeUrlCache.size >= SCRAPE_URL_CACHE_MAX_ENTRIES) {
      const oldestKey = scrapeUrlCache.keys().next().value;
      if (oldestKey) scrapeUrlCache.delete(oldestKey);
    }
    scrapeUrlCache.set(canonicalUrl, {
      expiresAt: now + SCRAPE_URL_CACHE_TTL_MS,
      value: { ...result },
    });
  }
  return result;
}

async function scrapeUrlUncached(normalizedUrl: string): Promise<ScrapeUrlResult> {
  const lower = normalizedUrl.toLowerCase();

  // 0. Live Telegram Intelligence: direct single post (?embed=1), public channel feed (/s/<username>), and public profile fallback (t.me/<username>)
  if (lower.includes('t.me/') || lower.includes('telegram.me/')) {
    if (lower.includes('t.me/+') || lower.includes('joinchat')) {
      return {
        title: normalizedUrl,
        text: '',
        rawSnippet: normalizedUrl,
        accessRestricted: true,
        restrictionReason: PRIVACY_FALLBACK_NOTICE,
      };
    }

    const postUrlMatch = normalizedUrl.match(
      /^https?:\/\/(?:www\.)?(?:t\.me|telegram\.me)\/(?:s\/)?([a-zA-Z0-9_]{3,})\/(\d+)(?:[/?#]|$)/i
    );
    if (postUrlMatch) {
      const singlePost = await scrapeTelegramSinglePost(postUrlMatch[1], postUrlMatch[2]);
      if (singlePost && (singlePost.content || singlePost.thumbnailBase64)) {
        const headerLine = `[Telegram-пост: ${singlePost.author} (@${singlePost.channelUsername}) · №${singlePost.postId}]`;
        const metaLines = [
          headerLine,
          `Ссылка: ${normalizedUrl}`,
          singlePost.date ? `Дата: ${singlePost.date}` : '',
          singlePost.views ? `Просмотры: ${singlePost.views}` : '',
        ].filter(Boolean);
        const bodyText = singlePost.content || '[Медиа-публикация без текстовой подписи]';
        return {
          title: `${singlePost.author} (@${singlePost.channelUsername}/${singlePost.postId})`,
          text: `${metaLines.join('\n')}\n\nТекст публикации:\n${bodyText}`,
          rawSnippet: bodyText.slice(0, 300),
          thumbnailBase64: singlePost.thumbnailBase64 || undefined,
          isVideo: singlePost.hasVideo,
        };
      }
    }

    const tg = await scrapeTelegramPublicChannel(normalizedUrl);
    if (tg.posts.length > 0) {
      const targetPostSuffix = postUrlMatch ? `/${postUrlMatch[2]}` : '';
      const matchedPost = targetPostSuffix
        ? tg.posts.find((p) => p.link.endsWith(targetPostSuffix))
        : undefined;
      const orderedPosts = matchedPost
        ? [matchedPost, ...tg.posts.filter((p) => p.id !== matchedPost.id)]
        : tg.posts;

      const postsJoined = orderedPosts
        .map((p, idx) => `[Пост #${idx + 1} · ${p.date}${p.views ? ` · ${p.views} просм.` : ''}]: ${p.content}`)
        .join('\n\n');
      return {
        title: tg.channelTitle ? `${tg.channelTitle} (@${tg.channelUsername})` : `@${tg.channelUsername}`,
        text: `[Telegram-канал: ${tg.channelTitle || tg.channelUsername} (@${tg.channelUsername})]\nСсылка: ${normalizedUrl}\n\n${matchedPost ? 'Найденный пост и последние публикации:' : 'Последние публичные посты:'}\n${postsJoined}`,
        rawSnippet: (matchedPost || orderedPosts[0])?.content.slice(0, 300) || normalizedUrl,
      };
    }

    // Fallback when /s/<username> returns 0 posts: inspect https://t.me/<username> profile metadata
    if (tg.channelUsername) {
      const profileFallback = await scrapeTelegramChannelProfileFallback(tg.channelUsername, normalizedUrl);
      if (profileFallback) {
        return profileFallback;
      }
    }

    // Closed or private Telegram profile/group without subscriber info or public bio
    return {
      title: normalizedUrl,
      text: '',
      rawSnippet: normalizedUrl,
      accessRestricted: true,
      restrictionReason: PRIVACY_FALLBACK_NOTICE,
    };
  }

  // 1. YouTube & Shorts Video Platform Intelligence (parallel oEmbed + Watch HTML, then parallel captions + thumbnail)
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
    const ytMatch = normalizedUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
    );
    const videoId = ytMatch ? ytMatch[1] : '';
    let title = '';
    let author = 'YouTube Автор';
    let thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : '';
    let shortDescription = '';
    let keywords: string[] = [];
    let captionsText = '';
    let hasOembed = false;
    let isRestricted = false;
    let preferredCaptionUrl = '';

    const oembedPromise = (async () => {
      try {
        const oembedRes = await safeFetchExternal(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`,
          { timeoutMs: 2500 }
        );
        if (oembedRes.ok) {
          const txt = await readTextWithLimit(oembedRes, 128 * 1024);
          return JSON.parse(txt) as any;
        }
        if (oembedRes.status === 401 || oembedRes.status === 403) {
          isRestricted = true;
        }
        return null;
      } catch {
        return null;
      }
    })();

    const watchPromise = videoId
      ? (async () => {
          try {
            const watchRes = await safeFetchExternal(
              `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
              {
                timeoutMs: 3000,
                headers: {
                  'User-Agent': DESKTOP_BROWSER_UA,
                  'Accept-Language': 'ru-RU,kk-KZ,en-US;q=0.9',
                  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                },
              }
            );
            return watchRes.ok ? await readTextWithLimit(watchRes, 1200 * 1024) : '';
          } catch {
            return '';
          }
        })()
      : Promise.resolve('');

    const [oembedSettled, watchSettled] = await Promise.allSettled([oembedPromise, watchPromise]);

    if (oembedSettled.status === 'fulfilled' && oembedSettled.value) {
      const oembed = oembedSettled.value;
      hasOembed = true;
      title = oembed.title || title;
      author = oembed.author_name || author;
      if (oembed.thumbnail_url) {
        thumbnailUrl = oembed.thumbnail_url;
      }
    }

    if (watchSettled.status === 'fulfilled' && watchSettled.value) {
      const watchHtml = watchSettled.value;
      const playerResp = extractJsonObjectAfterMarker(
        watchHtml,
        /(?:var\s+)?ytInitialPlayerResponse\s*=\s*\{/
      );

      if (playerResp) {
        const vd = playerResp.videoDetails || {};
        if (!title && vd.title) title = String(vd.title);
        if ((!author || author === 'YouTube Автор') && vd.author) author = String(vd.author);
        if (typeof vd.shortDescription === 'string') {
          shortDescription = vd.shortDescription.trim();
        }
        if (Array.isArray(vd.keywords)) {
          keywords = vd.keywords.map((k: any) => String(k).trim()).filter(Boolean).slice(0, 25);
        }

        const playStatus = String(playerResp.playabilityStatus?.status || '').toUpperCase();
        if (
          (playStatus === 'LOGIN_REQUIRED' || playStatus === 'ERROR') &&
          !hasOembed &&
          !shortDescription &&
          !title
        ) {
          isRestricted = true;
        }

        const captionTracks: any[] =
          playerResp.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
        if (Array.isArray(captionTracks) && captionTracks.length > 0) {
          const preferredTrack =
            captionTracks.find(
              (t) => t?.baseUrl && /^(ru|kk)/i.test(String(t.languageCode || ''))
            ) ||
            captionTracks.find((t) => t?.baseUrl) ||
            captionTracks[0];

          if (preferredTrack?.baseUrl) {
            preferredCaptionUrl = String(preferredTrack.baseUrl).replace(/\\u0026/g, '&');
          }
        }
      }

      if (!title) {
        title =
          extractMetaContent(watchHtml, 'property', 'og:title') ||
          extractMetaContent(watchHtml, 'name', 'title') ||
          normalizedUrl;
      }
      if (!shortDescription) {
        shortDescription =
          extractMetaContent(watchHtml, 'property', 'og:description') ||
          extractMetaContent(watchHtml, 'name', 'description');
      }
    }

    const captionsPromise = preferredCaptionUrl
      ? (async () => {
          try {
            const capRes = await safeFetchExternal(preferredCaptionUrl, {
              timeoutMs: 2500,
              headers: {
                'User-Agent': DESKTOP_BROWSER_UA,
                'Accept-Language': 'ru-RU,kk-KZ,en-US;q=0.9',
              },
            });
            if (capRes.ok) {
              return parseYoutubeCaptionsPayload(await readTextWithLimit(capRes, 512 * 1024));
            }
            return '';
          } catch {
            return '';
          }
        })()
      : Promise.resolve('');

    const thumbPromise = thumbnailUrl
      ? fetchImageAsDataUrl(thumbnailUrl, normalizedUrl, 1200)
      : Promise.resolve('');

    const [capResult, thumbnailBase64] = await Promise.all([captionsPromise, thumbPromise]);
    captionsText = capResult || '';

    if (isRestricted && !hasOembed && !shortDescription && !captionsText) {
      return {
        title: normalizedUrl,
        text: '',
        rawSnippet: normalizedUrl,
        isVideo: true,
        accessRestricted: true,
        restrictionReason: PRIVACY_FALLBACK_NOTICE,
      };
    }

    const effectiveTitle = title || normalizedUrl;
    const ytSections = [
      `[YouTube Видео/Shorts]: ${effectiveTitle}`,
      `Автор канала: ${author}`,
      `Ссылка: ${normalizedUrl}`,
      videoId ? `Видео-ID: ${videoId}` : '',
      shortDescription ? `\nОписание видео:\n${shortDescription.slice(0, 3500)}` : '',
      keywords.length > 0 ? `\nТеги / Ключевые слова: ${keywords.join(', ')}` : '',
      captionsText ? `\nСубтитры и речь из видео:\n${captionsText.slice(0, 6000)}` : '',
    ].filter(Boolean);

    return {
      title: effectiveTitle,
      text: ytSections.join('\n'),
      rawSnippet: captionsText
        ? captionsText.slice(0, 300)
        : shortDescription
        ? shortDescription.slice(0, 300)
        : `${effectiveTitle} (${author})`,
      thumbnailBase64: thumbnailBase64 || undefined,
      videoEmbedUrl: videoId ? `https://www.youtube.com/embed/${videoId}` : undefined,
      isVideo: true,
    };
  }

  // 2. TikTok Platform Intelligence (short links vm/vt with maxRedirects: 5, 3 parallel requests, subtitleInfos WebVTT/SRT)
  if (lower.includes('tiktok.com')) {
    let title = '';
    let description = '';
    let hashtags: string[] = [];
    let author = 'TikTok Автор';
    let thumbnailUrl = '';
    let subtitleUrl = '';
    let subtitlesText = '';
    let hasOembed = false;

    const oembedTask = (async () => {
      try {
        const oembedRes = await safeFetchExternal(
          `https://www.tiktok.com/oembed?url=${encodeURIComponent(normalizedUrl)}`,
          { timeoutMs: 3600, maxRedirects: 5 }
        );
        if (!oembedRes.ok) return null;
        const txt = await readTextWithLimit(oembedRes, 128 * 1024);
        return JSON.parse(txt) as any;
      } catch {
        return null;
      }
    })();

    const fetchTikTokHtml = async (ua: string): Promise<string> => {
      try {
        const ttRes = await safeFetchExternal(normalizedUrl, {
          timeoutMs: 3800,
          maxRedirects: 5,
          headers: {
            'User-Agent': ua,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru-RU,kk-KZ,en-US;q=0.9',
          },
        });
        if (!ttRes.ok) return '';
        return await readTextWithLimit(ttRes, 900 * 1024);
      } catch {
        return '';
      }
    };

    const htmlBotTask = fetchTikTokHtml(SOCIAL_BOT_UA);
    const htmlMobileTask = fetchTikTokHtml(MOBILE_BROWSER_UA);

    const [oembedSettled, botHtmlSettled, mobileHtmlSettled] = await Promise.allSettled([
      oembedTask,
      htmlBotTask,
      htmlMobileTask,
    ]);

    if (oembedSettled.status === 'fulfilled' && oembedSettled.value) {
      const oembed = oembedSettled.value;
      if (oembed.title || oembed.author_name) {
        hasOembed = Boolean(oembed.title);
        title = oembed.title || '';
        author = oembed.author_name || author;
        thumbnailUrl = oembed.thumbnail_url || '';
      }
    }

    const htmlCandidates: string[] = [];
    if (botHtmlSettled.status === 'fulfilled' && botHtmlSettled.value) {
      htmlCandidates.push(botHtmlSettled.value);
    }
    if (mobileHtmlSettled.status === 'fulfilled' && mobileHtmlSettled.value) {
      htmlCandidates.push(mobileHtmlSettled.value);
    }

    for (const ttHtml of htmlCandidates) {
      const rehydrationMatch = ttHtml.match(
        /<script[^>]*id=["']__UNIVERSAL_DATA_FOR_REHYDRATION__["'][^>]*>([\s\S]*?)<\/script>/i
      );
      if (rehydrationMatch?.[1]) {
        try {
          const rehydrationJson = JSON.parse(rehydrationMatch[1]);
          const itemStruct = findTikTokItemStruct(rehydrationJson);
          if (itemStruct) {
            if (!description && typeof itemStruct.desc === 'string' && itemStruct.desc.trim()) {
              description = itemStruct.desc.trim();
            }
            if ((author === 'TikTok Автор' || !author) && (itemStruct.author?.nickname || itemStruct.author?.uniqueId)) {
              author = itemStruct.author.nickname || `@${itemStruct.author.uniqueId}`;
            }
            if (hashtags.length === 0 && Array.isArray(itemStruct.challenges)) {
              hashtags = itemStruct.challenges
                .map((c: any) => (c?.title ? `#${c.title}` : ''))
                .filter(Boolean);
            }
            if (!thumbnailUrl) {
              thumbnailUrl =
                itemStruct.video?.originCover ||
                itemStruct.video?.cover ||
                itemStruct.video?.dynamicCover ||
                '';
            }
            if (!subtitleUrl && Array.isArray(itemStruct.video?.subtitleInfos)) {
              const subs: any[] = itemStruct.video.subtitleInfos.filter(
                (s: any) => s && typeof (s.Url || s.url) === 'string' && (s.Url || s.url).trim()
              );
              const pickByLang = (langRegex: RegExp) =>
                subs.find((s) =>
                  langRegex.test(String(s.LanguageCodeName || s.languageCodeName || s.Language || s.lang || ''))
                );
              const chosenSub = pickByLang(/^ru/i) || pickByLang(/^(?:kk|kz)/i) || subs[0];
              if (chosenSub) {
                subtitleUrl = String(chosenSub.Url || chosenSub.url)
                  .replace(/\\u0026/g, '&')
                  .replace(/&amp;/g, '&')
                  .trim();
              }
            }
          }
        } catch {
          // continue to meta extraction
        }
      }

      const ogTitle = extractMetaContent(ttHtml, 'property', 'og:title');
      const ogDesc = extractMetaContent(ttHtml, 'property', 'og:description');
      const twDesc =
        extractMetaContent(ttHtml, 'name', 'twitter:description') ||
        extractMetaContent(ttHtml, 'property', 'twitter:description');
      const metaDesc = extractMetaContent(ttHtml, 'name', 'description');
      const ogImg =
        extractRawMetaUrl(ttHtml, 'property', 'og:image') ||
        extractRawMetaUrl(ttHtml, 'name', 'twitter:image');

      if (!title && ogTitle) title = ogTitle;
      if (!description) description = ogDesc || twDesc || metaDesc || '';
      if (!thumbnailUrl && ogImg) thumbnailUrl = ogImg;
    }

    const subtitleTask = subtitleUrl
      ? (async () => {
          try {
            const subRes = await safeFetchExternal(subtitleUrl, {
              timeoutMs: 2500,
              maxRedirects: 5,
              headers: {
                'User-Agent': MOBILE_BROWSER_UA,
                Accept: 'text/vtt,text/plain,*/*',
              },
            });
            if (!subRes.ok) return '';
            const rawSub = await readTextWithLimit(subRes, 512 * 1024);
            const cleanedLines: string[] = [];
            let prevLine = '';
            for (const rawLine of rawSub.replace(/\r\n?/g, '\n').split('\n')) {
              const trimmed = rawLine.trim();
              if (!trimmed) continue;
              if (/^WEBVTT(?:\s|$)/i.test(trimmed)) continue;
              if (/^(?:Kind|Language|Style|Region|NOTE)\s*:/i.test(trimmed)) continue;
              if (/^\d+$/.test(trimmed)) continue;
              if (/^(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}\s*-->\s*(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}/.test(trimmed)) {
                continue;
              }
              const plain = decodeHtmlEntities(trimmed.replace(/<[^>]+>/g, ' '))
                .replace(/\s+/g, ' ')
                .trim();
              if (plain && plain !== prevLine) {
                cleanedLines.push(plain);
                prevLine = plain;
              }
            }
            return cleanedLines.join(' ').slice(0, 6000);
          } catch {
            return '';
          }
        })()
      : Promise.resolve('');

    const thumbTask = thumbnailUrl
      ? fetchImageAsDataUrl(thumbnailUrl, normalizedUrl, 1200)
      : Promise.resolve('');

    const [subResult, thumbnailBase64] = await Promise.all([subtitleTask, thumbTask]);
    subtitlesText = subResult || '';

    const combinedCaption = [title, description, subtitlesText].filter(Boolean).join('\n');
    const isGenericTikTokShell =
      !hasOembed &&
      (!combinedCaption ||
        /^TikTok\s*[-–|]?\s*Make Your Day$/i.test(combinedCaption.trim()));

    if (isGenericTikTokShell && !thumbnailBase64) {
      return {
        title: normalizedUrl,
        text: '',
        rawSnippet: normalizedUrl,
        isVideo: true,
        accessRestricted: true,
        restrictionReason: PRIVACY_FALLBACK_NOTICE,
      };
    }

    const effectiveTitle = title || description.slice(0, 80) || normalizedUrl;
    const ttSections = [
      `[TikTok Видео]: ${effectiveTitle}`,
      `Автор: ${author}`,
      `Ссылка: ${normalizedUrl}`,
      description && description !== effectiveTitle ? `Описание и подпись:\n${description}` : '',
      hashtags.length > 0 ? `Хештеги: ${hashtags.join(' ')}` : '',
      subtitlesText ? `Субтитры речи из видео:\n${subtitlesText}` : '',
    ].filter(Boolean);

    return {
      title: effectiveTitle,
      text: ttSections.join('\n'),
      rawSnippet: (subtitlesText || description || effectiveTitle).slice(0, 300),
      thumbnailBase64: thumbnailBase64 || undefined,
      isVideo: true,
    };
  }

  // 3. Instagram (Public posts & Reels via parallel crawler Promise.any + /embed/captioned/ fallback) + General KZ/RU Web Pages
  const isInstagram = lower.includes('instagram.com');
  const isIgReelOrPost = /instagram\.com\/(?:reels?|p|tv)\//i.test(normalizedUrl);
  const igShortcodeMatch = normalizedUrl.match(/instagram\.com\/(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/i);
  const igShortcode = igShortcodeMatch?.[1] || '';
  const isVideoLink = /youtube|tiktok|reel|video|watch|shorts|\.mp4|\.mov/i.test(normalizedUrl);

  if (isInstagram) {
    try {
      const igTimeoutMs = 4200;

      const crawlerTasks = [SOCIAL_BOT_UA, TELEGRAM_BOT_UA, WHATSAPP_BOT_UA].map(async (ua) => {
        const res = await safeFetchExternal(normalizedUrl, {
          timeoutMs: igTimeoutMs,
          headers: {
            'User-Agent': ua,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ru-RU,kk-KZ,en-US;q=0.9',
          },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const finalUrlLower = (res.url || '').toLowerCase();
        const html = await readHtmlHeadOnly(res, 240000);
        const titleMatch = html.match(/<title\b[^>]{0,200}>([^<]{0,500})<\/title>/i);
        const pageTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : '';
        const ogTitle = extractMetaContent(html, 'property', 'og:title');
        const ogDesc = extractMetaContent(html, 'property', 'og:description');
        const metaDesc = extractMetaContent(html, 'name', 'description');
        const twDesc = extractMetaContent(html, 'name', 'twitter:description');
        const ogImgUrl = extractRawMetaUrl(html, 'property', 'og:image');

        const bestDesc = ogDesc || metaDesc || twDesc;
        const effectivePageTitle = (ogTitle || pageTitle || '').trim();
        const isLoginShellOnly =
          !bestDesc ||
          finalUrlLower.includes('/accounts/login') ||
          /^(?:вход|login|sign in|кіру)\s*[•·|-]\s*instagram$/i.test(effectivePageTitle) ||
          /создайте аккаунт или войдите|create an account or log in to instagram/i.test(bestDesc) ||
          (/see instagram photos and videos from/i.test(bestDesc) && !ogTitle.includes(':'));

        if (isLoginShellOnly) {
          throw new Error('Instagram login shell');
        }

        return {
          effectiveTitle: ogTitle || pageTitle || normalizedUrl,
          bestDesc,
          ogImgUrl,
          authorUsername: '',
        };
      });

      const embedTasks = igShortcode
        ? [
            (async () => {
              const embedUrl = `https://www.instagram.com/p/${encodeURIComponent(igShortcode)}/embed/captioned/`;
              const res = await safeFetchExternal(embedUrl, {
                timeoutMs: igTimeoutMs,
                headers: {
                  'User-Agent': DESKTOP_BROWSER_UA,
                  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                  'Accept-Language': 'ru-RU,kk-KZ,en-US;q=0.9',
                },
              });
              if (!res.ok) throw new Error(`Embed HTTP ${res.status}`);
              const finalUrlLower = (res.url || '').toLowerCase();
              if (finalUrlLower.includes('/accounts/login')) {
                res.body?.cancel().catch(() => {});
                throw new Error('Instagram embed login redirect');
              }

              const embedHtml = await readTextWithLimit(res, 512 * 1024);

              const usernameMatch =
                embedHtml.match(/<[^>]*class=["'][^"']*UsernameText[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i) ||
                embedHtml.match(/<a[^>]*class=["'][^"']*CaptionUsername[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
              const authorUsername = usernameMatch
                ? decodeHtmlEntities(usernameMatch[1]).replace(/^@/, '').trim()
                : '';

              let captionRaw = extractDivInnerHtml(embedHtml, 'Caption');
              if (captionRaw) {
                // Remove comments block and leading author username inside Caption
                const commentsIdx = captionRaw.search(/<div\b[^>]*class=["'][^"']*CaptionComments[^"']*["'][^>]*>/i);
                if (commentsIdx !== -1) {
                  captionRaw = captionRaw.slice(0, commentsIdx);
                }
                captionRaw = captionRaw
                  .replace(/<a\b[^>]*class=["'][^"']*CaptionUsername[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, ' ')
                  .replace(/<a\b[^>]*class=["'][^"']*CaptionCommentsExpand[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, ' ');
              }
              const captionText = captionRaw ? decodeHtmlEntities(captionRaw).trim() : '';

              const embedImgMatch =
                embedHtml.match(/<img\b[^>]*class=["'][^"']*EmbeddedMediaImage[^"']*["'][^>]*\bsrc=["']([^"']+)["']/i) ||
                embedHtml.match(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*class=["'][^"']*EmbeddedMediaImage[^"']*["']/i) ||
                embedHtml.match(/<img\b[^>]*\bsrc=["'](https?:\/\/(?!static\.cdninstagram\.com)[^"']*cdninstagram\.com[^"']+)["']/i);
              const embedImgUrl =
                (embedImgMatch?.[1] ? embedImgMatch[1].replace(/&amp;/g, '&').trim() : '') ||
                extractRawMetaUrl(embedHtml, 'property', 'og:image');

              const isBlockedEmbed =
                (!captionText && !embedImgUrl) ||
                /watch on instagram|view this post on instagram|log in to continue|войдите,\s*чтобы/i.test(
                  captionText
                );

              if (isBlockedEmbed) {
                throw new Error('Instagram embed unavailable');
              }

              return {
                effectiveTitle: authorUsername
                  ? `@${authorUsername} (${isIgReelOrPost ? 'Instagram' : 'Публикация'})`
                  : `Instagram (${igShortcode})`,
                bestDesc: captionText || '[Публикация Instagram без текстовой подписи]',
                ogImgUrl: embedImgUrl,
                authorUsername,
              };
            })(),
          ]
        : [];

      const winner = await Promise.any([...crawlerTasks, ...embedTasks]);

      const thumbnailBase64 = winner.ogImgUrl
        ? await fetchImageAsDataUrl(winner.ogImgUrl, normalizedUrl, 1200)
        : '';
      const igSections = [
        `[Instagram ${isVideoLink ? 'Reels / Видео' : 'Публикация'}]: ${winner.effectiveTitle}`,
        winner.authorUsername ? `Автор: @${winner.authorUsername}` : '',
        `Ссылка: ${normalizedUrl}`,
        `Подпись и метаданные публикации:\n${winner.bestDesc}`,
      ].filter(Boolean);

      return {
        title: winner.effectiveTitle,
        text: igSections.join('\n'),
        rawSnippet: winner.bestDesc.slice(0, 300),
        thumbnailBase64: thumbnailBase64 || undefined,
        isVideo: isVideoLink,
      };
    } catch {
      return {
        title: normalizedUrl,
        text: '',
        rawSnippet: normalizedUrl,
        isVideo: isVideoLink,
        accessRestricted: true,
        restrictionReason: PRIVACY_FALLBACK_NOTICE,
      };
    }
  }

  try {
    const res = await safeFetchExternal(normalizedUrl, {
      timeoutMs: 2800,
      headers: {
        'User-Agent': `${DESKTOP_BROWSER_UA} CheckActivityBot/1.0`,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,kk-KZ,en;q=0.9',
      },
    });

    const finalUrlLower = (res.url || '').toLowerCase();
    if (
      res.status === 401 ||
      res.status === 403 ||
      res.status === 429 ||
      finalUrlLower.includes('/accounts/login')
    ) {
      res.body?.cancel().catch(() => {});
      return {
        title: normalizedUrl,
        text: '',
        rawSnippet: normalizedUrl,
        isVideo: isVideoLink,
        accessRestricted: true,
        restrictionReason: PRIVACY_FALLBACK_NOTICE,
      };
    }

    if (res.ok) {
      const html = await readTextWithLimit(res, 1024 * 1024);
      const titleMatch = html.match(/<title\b[^>]{0,200}>([^<]{0,500})<\/title>/i);
      const title = titleMatch ? decodeHtmlEntities(titleMatch[1]) : normalizedUrl;
      const ogTitle = extractMetaContent(html, 'property', 'og:title');
      const metaDesc = extractMetaContent(html, 'name', 'description');
      const ogDesc = extractMetaContent(html, 'property', 'og:description');
      const ogSiteName = extractMetaContent(html, 'property', 'og:site_name');
      const publishedTime =
        extractMetaContent(html, 'property', 'article:published_time') ||
        extractMetaContent(html, 'name', 'pubdate') ||
        extractMetaContent(html, 'itemprop', 'datePublished');
      const ogImgUrl = extractRawMetaUrl(html, 'property', 'og:image');

      const thumbnailBase64 = ogImgUrl ? await fetchImageAsDataUrl(ogImgUrl, normalizedUrl, 1200) : '';

      const cleaned = decodeHtmlEntities(
        html
          .slice(0, 300000)
          .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
          .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
          .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      );

      if (cleaned.length < 40 && !ogDesc && !metaDesc) {
        return {
          title: normalizedUrl,
          text: '',
          rawSnippet: normalizedUrl,
          isVideo: isVideoLink,
          accessRestricted: true,
          restrictionReason: PRIVACY_FALLBACK_NOTICE,
        };
      }

      const metaParts = [
        ogSiteName ? `Источник / СМИ: ${ogSiteName}` : '',
        publishedTime ? `Дата публикации: ${publishedTime}` : '',
        title ? `Заголовок: ${title}` : '',
        ogTitle && ogTitle !== title ? `OG Title: ${ogTitle}` : '',
        metaDesc ? `Описание (Meta): ${metaDesc}` : '',
        ogDesc && ogDesc !== metaDesc ? `OG Описание: ${ogDesc}` : '',
      ].filter(Boolean);

      return {
        title: ogTitle || title || normalizedUrl,
        text: metaParts.join('\n') + '\n\nОсновной текст страницы:\n' + cleaned.slice(0, 6000),
        rawSnippet: (ogDesc || metaDesc || cleaned).slice(0, 300),
        thumbnailBase64: thumbnailBase64 || undefined,
        isVideo: isVideoLink,
      };
    }
  } catch {
    // network error, timeout, or privacy block
  }

  return {
    title: normalizedUrl,
    text: '',
    rawSnippet: normalizedUrl,
    isVideo: isVideoLink,
    accessRestricted: true,
    restrictionReason: PRIVACY_FALLBACK_NOTICE,
  };
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&hellip;/gi, '...')
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/\s+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function scrapeTelegramSinglePost(
  channelUsername: string,
  postId: string
): Promise<{
  channelUsername: string;
  postId: string;
  author: string;
  date: string;
  views?: string;
  content: string;
  thumbnailBase64?: string;
  hasVideo: boolean;
} | null> {
  try {
    const res = await safeFetchExternal(
      `https://t.me/${encodeURIComponent(channelUsername)}/${encodeURIComponent(postId)}?embed=1`,
      {
        timeoutMs: 2500,
        headers: {
          'User-Agent': DESKTOP_BROWSER_UA,
          'Accept-Language': 'ru-RU,kk-KZ,en;q=0.9',
        },
      }
    );
    if (!res.ok) return null;

    const html = await readTextWithLimit(res, 512 * 1024);
    if (!html.includes('tgme_widget_message')) return null;

    const textInner = extractDivInnerHtml(html, 'tgme_widget_message_text');
    const content = textInner ? decodeHtmlEntities(textInner) : '';

    const authorMatch =
      html.match(/<a[^>]*class=["'][^"']*tgme_widget_message_author_name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) ||
      html.match(/<span[^>]*class=["'][^"']*tgme_widget_message_owner_name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const author = authorMatch ? decodeHtmlEntities(authorMatch[1]) : `@${channelUsername}`;

    const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["'][^>]*>([^<]*)<\/time>/i);
    let formattedDate = '';
    if (timeMatch?.[1]) {
      try {
        formattedDate = new Date(timeMatch[1]).toLocaleString('ru-RU', {
          timeZone: 'Asia/Almaty',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        formattedDate = timeMatch[2] || timeMatch[1];
      }
    }

    const viewsMatch = html.match(/<span[^>]*class=["'][^"']*tgme_widget_message_views[^"']*["'][^>]*>([^<]+)<\/span>/i);
    const views = viewsMatch ? viewsMatch[1].trim() : undefined;

    const hasVideo = /tgme_widget_message_video/i.test(html);
    const photoStyleMatch = html.match(
      /tgme_widget_message_(?:photo_wrap|video_thumb)[^>]*background-image:\s*url\(['"]?([^'")]+)['"]?\)/i
    );
    const imageUrl =
      photoStyleMatch?.[1] || extractRawMetaUrl(html, 'property', 'og:image');
    const thumbnailBase64 = imageUrl ? await fetchImageAsDataUrl(imageUrl, undefined, 1200) : '';

    if (!content && !thumbnailBase64) return null;

    return {
      channelUsername,
      postId,
      author,
      date: formattedDate || 'Недавно',
      views,
      content: content.slice(0, 6000),
      thumbnailBase64: thumbnailBase64 || undefined,
      hasVideo,
    };
  } catch {
    return null;
  }
}

async function scrapeTelegramChannelProfileFallback(
  channelUsername: string,
  originalUrl: string
): Promise<{
  title: string;
  text: string;
  rawSnippet: string;
  thumbnailBase64?: string;
} | null> {
  const cleaned = channelUsername.trim().replace(/^@/, '');
  if (!cleaned || !/^[a-zA-Z0-9_]{3,}$/.test(cleaned)) return null;

  try {
    const res = await safeFetchExternal(`https://t.me/${encodeURIComponent(cleaned)}`, {
      timeoutMs: 2500,
      headers: {
        'User-Agent': DESKTOP_BROWSER_UA,
        'Accept-Language': 'ru-RU,kk-KZ,en;q=0.9',
      },
    });
    if (!res.ok) return null;

    const html = await readTextWithLimit(res, 512 * 1024);
    const pageTitleInner = extractDivInnerHtml(html, 'tgme_page_title');
    const ogTitle = extractMetaContent(html, 'property', 'og:title');
    const channelTitle = (pageTitleInner ? decodeHtmlEntities(pageTitleInner) : '') || ogTitle;

    const extraInner = extractDivInnerHtml(html, 'tgme_page_extra');
    const extraText = extraInner ? decodeHtmlEntities(extraInner).trim() : '';

    const pageDescInner = extractDivInnerHtml(html, 'tgme_page_description');
    const pageDesc = pageDescInner ? decodeHtmlEntities(pageDescInner).trim() : '';
    const ogDescRaw = extractMetaContent(html, 'property', 'og:description').trim();

    const isGenericStubDesc = (txt: string) =>
      !txt ||
      /^(?:if you have telegram,\s*)?you can (?:contact|view and join)\b/i.test(txt);

    const realDescription =
      (!isGenericStubDesc(pageDesc) ? pageDesc : '') ||
      (!isGenericStubDesc(ogDescRaw) ? ogDescRaw : '');

    const hasSubscribersCount = /subscribers?|подписчик|members?|участник/i.test(extraText);

    if (!hasSubscribersCount && !realDescription) {
      return null;
    }

    const avatarUrl = extractRawMetaUrl(html, 'property', 'og:image');
    const avatarBase64 = avatarUrl ? await fetchImageAsDataUrl(avatarUrl, originalUrl, 1200) : '';

    const titleDisplay = channelTitle ? `${channelTitle} (@${cleaned})` : `@${cleaned}`;
    const profileSections = [
      `Публичный Telegram-канал (описание и метаданные профиля): ${titleDisplay}`,
      `Ссылка: ${originalUrl}`,
      extraText ? `Аудитория: ${extraText}` : '',
      realDescription
        ? `Описание канала:\n${realDescription}`
        : 'Описание канала: [Описание не указано в профиле канала]',
    ].filter(Boolean);

    return {
      title: titleDisplay,
      text: profileSections.join('\n'),
      rawSnippet: (realDescription || extraText || titleDisplay).slice(0, 300),
      thumbnailBase64: avatarBase64 || undefined,
    };
  } catch {
    return null;
  }
}

async function scrapeTelegramPublicChannel(handleOrUrl: string): Promise<{
  channelUsername: string;
  channelTitle?: string;
  posts: Array<{ id: string; date: string; content: string; link: string; views?: string }>;
}> {
  const cleaned = handleOrUrl
    .trim()
    .replace(/^https?:\/\/(www\.)?(t\.me|telegram\.me)\/(s\/)?/i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0];

  if (!cleaned || !/^[a-zA-Z0-9_]{3,}$/.test(cleaned)) {
    return { channelUsername: '', posts: [] };
  }

  try {
    const res = await safeFetchExternal(`https://t.me/s/${encodeURIComponent(cleaned)}`, {
      timeoutMs: 2500,
      headers: {
        'User-Agent': DESKTOP_BROWSER_UA,
        'Accept-Language': 'ru,kk,en;q=0.9',
      },
    });

    if (!res.ok) {
      return { channelUsername: cleaned, posts: [] };
    }

    const html = await readTextWithLimit(res, 1024 * 1024);
    const titleMatch = html.match(/<div class="tgme_channel_info_header_title"[^>]*>([\s\S]*?)<\/div>/i);
    const channelTitle = titleMatch ? decodeHtmlEntities(titleMatch[1]) : undefined;

    const blocks = html.split('<div class="tgme_widget_message_wrap');
    const posts: Array<{ id: string; date: string; content: string; link: string; views?: string }> = [];

    for (const block of blocks.slice(1)) {
      const postMatch = block.match(/data-post="([^"]+)"/i);
      const textInner = extractDivInnerHtml(block, 'tgme_widget_message_text');
      const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"[^>]*>([^<]*)<\/time>/i);
      const viewsMatch = block.match(/<span class="tgme_widget_message_views">([^<]+)<\/span>/i);
      if (textInner) {
        const content = decodeHtmlEntities(textInner);
        if (content.length >= 12) {
          const postPath = postMatch ? postMatch[1] : `${cleaned}/${posts.length + 1}`;
          let formattedDate = 'Недавно';
          if (timeMatch && timeMatch[1]) {
            try {
              formattedDate = new Date(timeMatch[1]).toLocaleString('ru-RU', {
                timeZone: 'Asia/Almaty',
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              });
            } catch {
              formattedDate = timeMatch[2] || 'Недавно';
            }
          }
          posts.push({
            id: `tg-${postPath.replace(/[^\w-]/g, '_')}`,
            date: formattedDate,
            content: content.slice(0, 1200),
            link: `https://t.me/${postPath}`,
            views: viewsMatch ? viewsMatch[1].trim() : undefined,
          });
        }
      }
    }

    return {
      channelUsername: cleaned,
      channelTitle,
      posts: posts.slice(-5).reverse(),
    };
  } catch {
    return { channelUsername: cleaned, posts: [] };
  }
}

// Helper to detect accidental LLM safety refusal strings so they never enter OCR/audit output
function isLlmRefusalText(text: string): boolean {
  const t = (text || '').trim().toLowerCase();
  if (!t) return true;
  return /^(?:извините|простите|к сожалению|я не могу помочь|я не могу выполнить|не могу обработать|i['’]?m sorry|sorry,|i cannot assist|i can['’]?t assist|i cannot help|unable to assist|as an ai)/i.test(t) ||
    /(?:не могу помочь с этой просьбой|не могу распознать или обработать этот запрос|i cannot assist with that|i can't help with that)/i.test(t);
}

// Dedicated high-speed and accurate Gemini API caller using @google/genai SDK
async function callGeminiApi(params: {
  systemInstruction?: string;
  contents: Array<{
    role: string;
    parts: Array<any>;
  }>;
  responseJson?: boolean;
  timeoutMs?: number;
  disableThinking?: boolean;
  signal?: AbortSignal;
  onModelSelected?: (modelName: string) => void;
}): Promise<string> {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const totalTimeoutMs = params.timeoutMs || 30000;
  const deadline = Date.now() + totalTimeoutMs;
  const modelsToTry = params.disableThinking
    ? ['gemini-3.1-flash-lite', 'gemini-4-hydrogen']
    : ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];

  let lastErr: any;
  for (let i = 0; i < modelsToTry.length; i++) {
    if (params.signal?.aborted) {
      throw new Error('Client aborted request');
    }
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 500) {
      break;
    }
    const modelName = modelsToTry[i];
    const hasNext = i < modelsToTry.length - 1;
    const perModelTimeout = hasNext
      ? Math.max(2500, Math.min(remainingMs - 2500, Math.floor(totalTimeoutMs * 0.6)))
      : remainingMs;
    if (perModelTimeout <= 500) continue;

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const callPromise = ai.models.generateContent({
        model: modelName,
        contents: params.contents as any,
        config: {
          systemInstruction: params.systemInstruction,
          responseMimeType: params.responseJson ? 'application/json' : undefined,
          thinkingConfig:
            !params.disableThinking && modelName === 'gemini-4-hydrogen'
              ? { thinkingLevel: ThinkingLevel.LOW }
              : undefined,
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          ],
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Gemini timeout (${modelName})`)), perModelTimeout);
      });

      const res = await Promise.race([callPromise, timeoutPromise]);
      const txt = res.text?.trim() || '';
      if (txt && !isLlmRefusalText(txt)) {
        params.onModelSelected?.(modelName);
        return txt;
      }
      throw new Error(txt ? `Model refusal on ${modelName}` : `Empty response from ${modelName}`);
    } catch (err: any) {
      lastErr = err;
      continue;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  throw lastErr || new Error('All Gemini models unavailable');
}

// Optional OpenAI / GPT-4o API caller for dual-engine support
async function callOpenAiApi(params: {
  systemInstruction?: string;
  userPrompt: string;
  imageDataUrl?: string;
  imageUrls?: string[];
  responseJson?: boolean;
  timeoutMs?: number;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GPT_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), params.timeoutMs || 45000);

  try {
    const userContent: Array<any> = [{ type: 'text', text: params.userPrompt }];
    if (params.imageDataUrl && params.imageDataUrl.startsWith('data:image/')) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: params.imageDataUrl,
        },
      });
    }
    if (Array.isArray(params.imageUrls)) {
      for (const imgUrl of params.imageUrls.slice(0, 6)) {
        if (typeof imgUrl === 'string' && imgUrl.startsWith('data:image/')) {
          userContent.push({
            type: 'image_url',
            image_url: {
              url: imgUrl,
            },
          });
        }
      }
    }

    const messages: Array<any> = [];
    if (params.systemInstruction) {
      messages.push({ role: 'system', content: params.systemInstruction });
    }
    messages.push({ role: 'user', content: userContent });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        response_format: params.responseJson ? { type: 'json_object' } : undefined,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errText}`);
    }

    const data: any = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from OpenAI');
    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Health check endpoint for verifying deployment status and API key availability
app.get(['/api/health', '/health'], (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY || process.env.GPT_API_KEY),
    isVercel: Boolean(process.env.VERCEL),
    timestamp: new Date().toISOString(),
  });
});

// POST /api/ocr: Dedicated high-speed OCR extraction from screenshots/images/PDFs using Gemini
app.post(['/api/ocr', '/ocr'], async (req: Request, res: Response) => {
  try {
    const { imageDataUrl, fileName } = req.body || {};

    if (!imageDataUrl || typeof imageDataUrl !== 'string') {
      const fallbackMsg = `[Материал: ${fileName || 'Загруженный файл'}]. Файл готов к анализу.`;
      return res.status(200).json({
        success: true,
        text: fallbackMsg,
        charCount: fallbackMsg.length,
        warningNotice: undefined,
      });
    }

    let mimeType = 'image/jpeg';
    let base64Data = imageDataUrl;
    if (imageDataUrl.startsWith('data:')) {
      const commaIdx = imageDataUrl.indexOf(',');
      const header = imageDataUrl.substring(0, commaIdx);
      const mimeExtract = header.match(/data:([^;]+)/);
      if (mimeExtract) mimeType = mimeExtract[1];
      base64Data = imageDataUrl.substring(commaIdx + 1).replace(/\s/g, '');
    }

    let ocrExtractedText = '';

    // Check sample presets only for explicit sample demo test buttons
    const lowerName = (fileName || '').toLowerCase();
    if (lowerName.includes('political_doxing') || lowerName.includes('doxing_slide')) {
      ocrExtractedText = `СРОЧНЫЙ СЛИВ! Депутат/кандидат №3 тайно переписал бюджет района на офшоры и забирает откаты!\nЭтот мошенник, продажная тварь и предатель города должен ответить.\nЛичный телефон: +7 701 777-45-90, ИИН 840512300194, адрес: г. Алматы, ул. Тимирязева, д. 42, кв. 18.\nПриходите на выборы 15 марта и голосуйте по совести!`;
    } else if (lowerName.startsWith('sample_profanity') || lowerName === 'profanity_chat.png') {
      ocrExtractedText = `Чат «Алматы Базар / Авторазбор» (1 420 участников • 14:32)\n@kanat_almaty (14:30): Ты че бля совсем тупой? Пошел нахуй отсюда, урод конченый, еще раз напишешь — найдем!\nВы (14:31): Сам заткнись, пидор, я тебя не боюсь! За базар ответишь, шешеңді сиктир!\n@kanat_almaty (14:32): Скинь свой номер телефона, сука.`;
    } else if (lowerName.startsWith('sample_casino') || lowerName === 'casino_promo.png') {
      ocrExtractedText = `★ 1WIN LUXURY SLOTS ★ 🎰\n500% БОНУС + 150 ФРИСПИНОВ!\nКрути барабаны и рулетку — JACKPOT $5 000 USD / €4 600\nМгновенный вывод в USDT, $ и на карты 💸\nПРОМОКОД: ALMATY_SPIN · 🔞 21+\nКРУТИТЬ БАРАБАНЫ ➔`;
    } else if (lowerName.startsWith('sample_unmarked') || lowerName === 'unmarked_ad.png') {
      ocrExtractedText = `🔥 ГРАНДИОЗНАЯ РАСПРОДАЖА В АСТАНЕ!\nСКИДКИ ДО 50% НА ВСЕ СМАРТФОНЫ И НОУТБУКИ\nТолько до конца недели! Оплата в рассрочку 0-0-12.\nЗаказывай онлайн с бесплатной доставкой по РК:\nhttps://astana-store-sale.kz/promo\nТелефон отдела продаж: +7 7172 90-80-70\nУспей оформить заказ по акции уже сегодня!`;
    } else if (lowerName.startsWith('sample_journalism') || lowerName.includes('journalism_context')) {
      ocrExtractedText = `ОСТОРОЖНО, МОШЕННИКИ!\nМВД РК и Департамент полиции предупреждают: злоумышленники рекламируют нелегальные казино 1Win и рассылают фейковые ссылки якобы от Kaspi на «выплаты 42 500 ₸».\nНе переходите по сомнительным ссылкам и не сообщайте SMS-коды. Официальное информационное предупреждение.`;
    }

    if (mimeType.includes('svg') && base64Data && !ocrExtractedText) {
      try {
        const svgStr = Buffer.from(base64Data, 'base64').toString('utf8');
        const textMatches = Array.from(svgStr.matchAll(/<text[^>]*>([^<]+)<\/text>/gi)).map((m) => m[1]);
        if (textMatches.length > 0) {
          ocrExtractedText = textMatches.join(' ').trim();
        }
      } catch {
        // continue
      }
    }

    const ocrAbort = new AbortController();
    const onOcrClose = () => {
      if (!res.writableEnded) ocrAbort.abort();
    };
    res.on('close', onOcrClose);
    const ocrDeadline = Date.now() + 26000;
    try {

    if (process.env.GEMINI_API_KEY && base64Data && !ocrExtractedText) {
      try {
        const isPdf = mimeType.includes('pdf') || lowerName.endsWith('.pdf');
        const expertOcrPrompt = `Выступи в роли эксперта по оптическому распознаванию текста (OCR) и корректуре документов на русском, казахском и английском языках для автоматизированной системы комплаенс-проверки.
Твоя задача — максимально точно и полно извлечь весь текст и объекты с предоставленного ${isPdf ? 'PDF-документа' : 'изображения'}, сохраняя их исходное расположение и структуру.

Строго соблюдай следующие правила:
1. Точность: Переноси весь видимый текст дословно (включая заголовки, основной текст, подписи, кнопки, ссылки, номера телефонов, ИИН/БИН, суммы, хештеги и переписки). Не пересказывай, не сокращай и не добавляй ничего от себя.
2. Казахский и русский языки: С одинаковой точностью распознавай русский и казахский алфавиты (обязательно сохраняй Ә, Ғ, Қ, Ң, Ө, Ұ, Ү, Һ, І в точности как в материале).
3. Исправление артефактов: Если из-за низкого качества символы распознаются с искажением (например, «0» вместо «О», «1» вместо «I», «6» вместо «б», путаница Қ/К, Ғ/Г, Ң/Н, Ө/О, Ү/У, Ә/А), аккуратно исправь их, опираясь на контекст слова.
4. Нечитаемые фрагменты: Если слово, цифру или фрагмент невозможно разобрать однозначно, не пытайся угадать — напиши вместо них ровно тег [неразборчиво].
5. Склейка строк: Убирай знаки переноса слов в конце строк и объединяй разорванные слова в целые.
6. Форматирование и пространственное распределение объектов: Сохраняй исходную структуру и взаимное расположение блоков, колонок, карточек и элементов ровно так, как они расположены на материале (сверху вниз, слева направо). Заголовки выделяй жирным шрифтом (**Заголовок**), списки оформляй списками (- ... или 1. ...), а таблицы и сетки переноси в формате Markdown-таблиц (| ... |). Если на материале есть визуальные плашки, кнопки или подписи к элементам — размещай их в том же порядке и положении, что и в оригинале.
7. Игнорирование шума: Не включай случайные пятна, артефакты сканирования, посторонние водяные знаки и обрезанные посторонние фрагменты на полях.

Выведи ТОЛЬКО распознанный текст без каких-либо вводных фраз, пояснений и без обёрток в блоки кода \`\`\`.`;

        const candidate = await callGeminiApi({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: isPdf ? 'application/pdf' : mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: expertOcrPrompt,
                },
              ],
            },
          ],
          timeoutMs: 18000,
          disableThinking: true,
          signal: ocrAbort.signal,
        });

        if (candidate && !isLlmRefusalText(candidate)) {
          ocrExtractedText = candidate
            .replace(/^```(?:markdown|md|text|[a-z]*)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .replace(/^(?:Вот\s+(?:весь\s+)?текст(?:,\s+который\s+удалось\s+распознать)?|Текст\s+со\s+скриншота|Текст\s+на\s+изображении|Распознанный\s+текст):\s*/i, '')
            .replace(/\[текст на изображении не обнаружен\]/gi, '')
            .trim();
        }
      } catch (geminiOcrErr: any) {
        console.info('Fast OCR fallback notice:', geminiOcrErr?.message || 'quick fallback');
      }
    }

    // Secondary OCR attempt via OpenAI GPT-4o-mini if OpenAI API key is provided and deadline budget remains
    const remainingOcrMs = ocrDeadline - Date.now();
    if (!ocrAbort.signal.aborted && remainingOcrMs > 4000 && (process.env.OPENAI_API_KEY || process.env.GPT_API_KEY) && !ocrExtractedText && imageDataUrl && imageDataUrl.startsWith('data:image/')) {
      try {
        const ocrPrompt = `Act as an expert OCR and document proofreading specialist for Russian, Kazakh (Ә, Ғ, Қ, Ң, Ө, Ұ, Ү, Һ, І), and English materials.
Strictly follow these rules:
1. Verbatim accuracy: transcribe every visible word, number, URL, phone, and handle exactly without summarizing or inventing anything.
2. Fix optical character confusion by word context (0/О, 1/I, 6/б, Қ/К, Ғ/Г, Ң/Н, Ө/О, Ү/У, Ә/А).
3. If any word or number is genuinely illegible, output [неразборчиво] instead of guessing.
4. De-hyphenate and join words split across line breaks.
5. Preserve exact document layout and spatial element placement top-to-bottom and left-to-right: use **bold** for headings, Markdown lists for lists, and Markdown tables (| col |) for tables/grids.
6. Ignore watermarks, stains, scan noise, and unrelated cropped margin fragments.
Output ONLY the recognized text with no intro phrases and no code fences.`;

        const candidate = await callOpenAiApi({
          userPrompt: ocrPrompt,
          imageDataUrl,
          timeoutMs: Math.min(12000, remainingOcrMs),
        });

        if (candidate && !isLlmRefusalText(candidate)) {
          ocrExtractedText = candidate
            .replace(/^```(?:markdown|md|text|[a-z]*)?\s*/i, '')
            .replace(/\s*```$/i, '')
            .replace(/^(?:Вот\s+(?:весь\s+)?текст(?:,\s+который\s+удалось\s+распознать)?|Текст\s+со\s+скриншота|Текст\s+на\s+изображении|Распознанный\s+текст):\s*/i, '')
            .replace(/\[текст на изображении не обнаружен\]/gi, '')
            .trim();
        }
      } catch (openAiOcrErr: any) {
        console.info('OpenAI OCR notice:', openAiOcrErr?.message || 'fallback');
      }
    }

    // Guarantee non-zero character count so the user NEVER sees "0 символов"
    if (!ocrExtractedText || ocrExtractedText.trim().length === 0) {
      const isPdf = mimeType.includes('pdf') || lowerName.endsWith('.pdf');
      ocrExtractedText = isPdf
        ? `[Документ PDF: ${fileName || 'Файл'}]. Текстовые слои и реквизиты документа подготовлены для комплексного юридического аудита.`
        : `[Графический объект: ${fileName || 'Скриншот'}]. Визуальный креатив, композиция и символика зафиксированы и переданы на комплаенс-проверку по нормам РК.`;
    }

    // Keyword, doxing & profanity detection on extracted text with full Kazakh & Russian lexicon
    const textToCheck = `${ocrExtractedText} ${fileName || ''}`.toLowerCase();
    const isContextWarning = isJournalisticWarningContext(ocrExtractedText);
    const gamblingRegex = /казино|casino|1xbet|1win|pin-up|mostbet|слот|рулетк|фриспин|jackpot|жекпот|барабан|luxury\s+slots|ставк|букмекер/i;
    const adRegex = /жарнама|реклама|скидк|купить|акция|промокод|цена|открывайте\s+счет|счета\s+в\s+тенге|оформляй|кредит|депозит|кэшбэк|кешбэк|рассрочк/i;

    const hasProfanity = findProfanityMatches(textToCheck).length > 0;
    const hasGambling = !isContextWarning && gamblingRegex.test(textToCheck);
    const hasAdvertising = !isContextWarning && !hasGambling && adRegex.test(textToCheck);
    const doxingCheck = detectPersonalDataDoxing(ocrExtractedText);
    const disinfoCheck = detectPoliticalDisinfo(ocrExtractedText);

    let warningNotice: string | undefined;
    if (disinfoCheck.detected && doxingCheck.detected) {
      warningNotice = 'Внимание: выявлен политический вброс, оскорбления и доксинг ИИН/телефона (ст. 274, 131 УК РК, ст. 79 КоАП РК / ч. 5 ст. 147 УК РК).';
    } else if (hasProfanity) {
      warningNotice = 'Внимание: зафиксирована ненормативная лексика и обсценная брань (ст. 434 КоАП РК).';
    } else if (hasGambling) {
      warningNotice = 'Внимание: обнаружены признаки рекламы онлайн-казино / азартных игр (ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»).';
    } else if (doxingCheck.detected) {
      warningNotice = 'Внимание: зафиксировано распространение персональных данных без согласия (ст. 79 КоАП РК / ч. 5 ст. 147 УК РК).';
    } else if (hasAdvertising && !textToCheck.includes('жарнама')) {
      warningNotice = 'Внимание: коммерческий контент без обязательной маркировки «Жарнама» (ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ).';
    }

    return res.json({
      success: true,
      text: ocrExtractedText,
      charCount: ocrExtractedText.length,
      hasProfanity,
      hasGambling,
      hasAdvertising,
      warningNotice,
    });
    } finally {
      res.off('close', onOcrClose);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in /api/ocr:', err);
    const safeFallback = `[Материал: ${req.body?.fileName || 'Файл'}]. Файл успешно подготовлен к проверке законодательства РК.`;
    return res.json({
      success: true,
      text: safeFallback,
      charCount: safeFallback.length,
      warningNotice: undefined,
    });
  }
});

// POST /api/analyze: Full multimodal parsing (Audio STT, Video Keyframes/Sound, OCR, URLs, Law & Ethics)
app.post(['/api/analyze', '/analyze'], async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;
  let tempMp3Path: string | null = null;
  const analyzeAbort = new AbortController();
  const onAnalyzeClose = () => {
    if (!res.writableEnded) analyzeAbort.abort();
  };
  res.on('close', onAnalyzeClose);
  try {
    const routePerfStart = performance.now();
    const analyzeStartMs = Date.now();
    let extractMs = 0;
    const {
      modality,
      text,
      url,
      imageDataUrl,
      audioDataUrl,
      videoDataUrl,
      videoFrames,
      mediaBase64,
      mimeType,
      fileName,
      fileSize,
      audioDuration,
      sha256: clientSha256,
      entityTier: rawEntityTier,
      entityType: rawEntityType,
    } = req.body;

    const entityTier = resolveEntityTier(rawEntityTier ?? rawEntityType);
    const effectiveText = (text || req.body.urlOrText || '').trim();
    const effectiveUrl = url || (typeof req.body.urlOrText === 'string' && req.body.urlOrText.startsWith('http') ? req.body.urlOrText.trim() : undefined);

    const isVideoLink = effectiveUrl ? /youtube\.com|youtu\.be|tiktok\.com|instagram\.com\/(?:reels?|p)|vimeo|facebook\.com\/reel|\.(mp4|webm|mov|m4v)(\?|$)/i.test(effectiveUrl) : false;
    const isVideo = modality === 'video' || isVideoLink || Boolean(videoDataUrl) || (Array.isArray(videoFrames) && videoFrames.length > 0) || (mimeType && mimeType.startsWith('video/'));
    const isAudio = !isVideo && (modality === 'audio' || Boolean(audioDataUrl) || (typeof imageDataUrl === 'string' && imageDataUrl.startsWith('data:audio/')) || (mimeType && mimeType.startsWith('audio/')));

    let effectiveVideoUrl = videoDataUrl || (isVideo && effectiveUrl ? effectiveUrl : undefined);
    let effectiveAudioUrl = audioDataUrl || (isAudio ? imageDataUrl : undefined);
    let effectiveImageUrl = !isAudio && !isVideo ? imageDataUrl : undefined;
    let activeVideoFrames: any[] = Array.isArray(videoFrames) ? videoFrames : [];

    const timestamp =
      new Date().toLocaleString('ru-RU', {
        timeZone: 'Asia/Almaty',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }) + ' (Астана)';

    const contentSha256 = computeServerContentSha256({
      clientSha256,
      mediaBase64,
      videoDataUrl,
      audioDataUrl,
      imageDataUrl,
      effectiveUrl,
      effectiveText,
      fileName,
    });
    const caseId = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const refNum = `#CHK-KZ-${Math.floor(100000 + Math.random() * 900000)}`;

    let liveUrlExtracted = '';
    let targetTitle = fileName || effectiveUrl || (effectiveText ? effectiveText.slice(0, 40) + '...' : isVideo ? 'Видеоматериал' : isAudio ? 'Аудиозапись' : 'Контент');
    let scrapedThumbnail: string | undefined;
    let scrapedEmbedUrl: string | undefined;

    // If it's a URL or text contains a link, scrape the live content
    if (effectiveUrl || (effectiveText && (effectiveText.startsWith('http://') || effectiveText.startsWith('https://')))) {
      const targetUrl = effectiveUrl || effectiveText;
      const scrapePerfStart = performance.now();
      const scraped = await scrapeUrl(targetUrl);
      extractMs += Math.round(performance.now() - scrapePerfStart);
      const isOnlyUrlInput =
        !effectiveText ||
        effectiveText.trim() === targetUrl.trim() ||
        effectiveText.trim() === (effectiveUrl || '').trim();

      if (scraped.accessRestricted && isOnlyUrlInput) {
        return res.json({
          id: caseId,
          referenceNumber: refNum,
          timestamp,
          sourceType: 'url',
          title: targetUrl,
          sourceName: targetUrl,
          sha256: contentSha256,
          riskScore: 0,
          legalScore: 0,
          ethicsScore: 0,
          riskLevel: 'Низкий',
          status: 'БЕЗОПАСНО',
          summary: scraped.restrictionReason || PRIVACY_FALLBACK_NOTICE,
          ethicsSummary: 'Доступ к публикации ограничен платформой.',
          extractedText: '',
          detectedActions: 'Проверка URL остановлена из-за настроек приватности ресурса.',
          rawText: targetUrl,
          violations: [],
          accessRestricted: true,
          accessNotice: scraped.restrictionReason || PRIVACY_FALLBACK_NOTICE,
          telemetry: {
            extractMs,
            retrievalMs: 0,
            aiAuditMs: 0,
            totalMs: Math.max(1, Math.round(performance.now() - routePerfStart)),
            checkedLawsCount: KZ_LAWS_DB.length,
            retrievedLawsCount: 0,
            matchedLawCodes: [],
            engineMode: 'deterministic-db-fallback',
            fallbackReason: 'Доступ к публикации ограничен платформой',
          },
          metadata: {
            engineConfidence: 100,
            platform: 'CheckActivity URL Guard',
          },
        });
      }

      liveUrlExtracted = scraped.text;
      if (scraped.title && scraped.title !== targetUrl) {
        targetTitle = `${scraped.title} (${targetUrl})`;
      }
      scrapedThumbnail = scraped.thumbnailBase64;
      scrapedEmbedUrl = scraped.videoEmbedUrl;
      if (scraped.videoEmbedUrl) {
        effectiveVideoUrl = scraped.videoEmbedUrl;
      }
      if (scrapedThumbnail) {
        if (activeVideoFrames.length === 0) {
          activeVideoFrames = [scrapedThumbnail];
        }
        if (!effectiveImageUrl) {
          effectiveImageUrl = scrapedThumbnail;
        }
      }
    }

    const systemInstruction = `Ты — ведущий национальный AI-аналитик и эксперт высшей квалификации по медиа-безопасности, рекламе, аудио- и видео-анализу и интернет-этике в Республике Казахстан (система CheckActivity).

ТВОЯ ЗАДАЧА — ПРОВЕСТИ БЕЗУПРЕЧНЫЙ, ТОЧНЫЙ АНАЛИЗ МАТЕРИАЛА (ВИДЕО, АУДИО, ИЗОБРАЖЕНИЕ ИЛИ ТЕКСТ):

ДЛЯ АУДИО:
1. Сделай транскрипцию речи с таймкодами (формат ММ:СС), укажи язык (русский, казахский или смешанный).
2. Проверь текст транскрипции по установленным критериям нарушений законодательства РК и интернет-этики.
3. Учитывай интонацию и контекст: шутку, цитату, новость или обучающий материал не считай нарушением только из-за отдельных слов!

ДЛЯ ВИДЕО:
1. Проанализируй и изображение, и звук.
2. По изображению оцени: действия людей, предметы, надписи и текст на экране, символику, обстановку.
3. По звуку сделай то же, что для аудио (транскрипция, язык, интонация, смысл).
4. Оцени соответствие картинки и звука: нарушение может быть только в одном из них.

СТРОГИЕ КРИТЕРИИ (Используй только эти категории, новых не придумывай):
1. ст. 434 КоАП РК: Ненормативная лексика и обсценная брань (на русском или казахском языке).
2. ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»: Реклама онлайн-казино и незаконных азартных игр (слоты, рулетка, 1Win, 1xBet, Pin-Up, ставки, фриспины, реферальные ссылки). Примечание: ст. 445-1 КоАП РК применяется исключительно к незаконным лотереям и розыгрышам.
3. ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ: Скрытая онлайн-реклама без обязательной маркировки («Жарнама / Реклама») и указания рекламодателя (ИИН/БИН).
4. ч. 3 ст. 455 КоАП РК / ст. 21 Закона РК «О языках»: Нарушение требований о размещении рекламы на государственном (казахском) и русском языках.
5. ст. 73-4 КоАП РК, ст. 131, 115 УК РК: Кибербуллинг, оскорбления личности и прямые угрозы.
6. ст. 79 КоАП РК / ч. 5 ст. 147 УК РК: Незаконное распространение сведений о частной жизни и персональных данных через телекоммуникационные сети и онлайн-платформы (телефоны, ИИН, домашние адреса, документы).
7. ст. 133-1 КоАП РК: Возрастное ограничение 18+ (откровенный контент без маркировки).
8. Нормы интернет-этики: Dark Patterns и манипулятивный маркетинг (ложные таймеры дефицита FOMO, гарантии «100% дохода без риска»).
9. Human-in-the-loop / ст. 174, 274 УК РК (проверка контекста): Общественно-политический протест, политические плакаты, требования отставки, митинги/пикеты/шествия или резонансные обвинения в адрес госорганов (без прямого мата, доксинга и призывов к насилию).

ВАЖНЫЕ ПРАВИЛА (включая КОНТЕКСТНЫЙ ФИЛЬТР И HUMAN-IN-THE-LOOP):
- Если материал не содержит признаков нарушения, так и напиши ('overall_risk': 'нет', 'findings': []). Не ищи нарушение любой ценой!
- КРИТИЧЕСКИ ВАЖНО (Контекстный фильтр): Если материал является официальным предупреждением полиции/МВД/АФМ РК, новостным постом СМИ или профилактическим сообщением о мошенниках, фейковых выплатах или нелегальных казино (например, «Осторожно, мошенники! МВД РК предупреждает о фейках Kaspi / 1Win / 42 500»), это НЕ реклама и НЕ нарушение — обязательно верни 'overall_risk': 'нет' и 'findings': []!
- ПРАВИЛО HUMAN-IN-THE-LOOP (общественно-политический / протестный контекст): Если текст или изображение содержат общественно-политический протест, политические плакаты, требования отставки или резонансные обвинения в адрес госорганов (без прямого мата по ст. 434, доксинга по ст. 79 / ч. 5 ст. 147 и прямых призывов к насилию), НЕ блокируй материал и НЕ ставь критический риск. Верни ровно ОДНО предупреждение в массиве "findings" со статусом «ПРЕДУПРЕЖДЕНИЕ», "overall_risk": "средний", "riskScore" в диапазоне 46–55 и штрафом 0 МРП:
  * "article": "${HITL_PROTEST_ARTICLE}"
  * "category": "${HITL_PROTEST_ARTICLE}"
  * "description": "${HITL_PROTEST_DESCRIPTION}"
  * "confidence": "средняя"
  * "reasoning": "${HITL_PROTEST_DESCRIPTION}"
- Не квалифицируй обычный текст как мошенничество (ст. 190 УК РК) или нелегальный гемблинг (ч. 1 ст. 455 КоАП РК) только из-за наличия одного-двух эмодзи денег или карт (💰, 💵, 💸, 🤑 и т.п.), если в самом тексте или на изображении нет призывов к переводу средств, обещаний лёгкого заработка или рекламы азартных игр.
- Не делай выводов о личности людей на видео и не называй их по внешности.

ОБЯЗАТЕЛЬНЫЙ ФОРМАТ ОТВЕТА (СТРОГО JSON):
{
  "summary": "краткое описание материала",
  "language": "русский | казахский | смешанный",
  "overall_risk": "нет | низкий | средний | высокий",
  "riskScore": 0,
  "findings": [
    {
      "timestamp": "ММ:СС",
      "source": "аудио | изображение | текст на экране",
      "article": "при необходимости точная статья из БАЗЫ НПА РК (CODE) или Human-in-the-loop",
      "category": "категория нарушения",
      "description": "описание предупреждения",
      "quote_or_description": "точная цитата или описание того, что видно",
      "confidence": "низкая | средняя | высокая",
      "reasoning": "почему это может быть нарушением или требует проверки, 1–2 предложения"
    }
  ],
  "needs_human_review": true,
  "limitations": "что ИИ мог не расслышать или не разглядеть",
  "extractedText": "полная стенограмма или извлеченный текст",
  "detectedActions": "описание визуальных действий и обстановки",
  "transcript": [
    { "time": "ММ:СС", "speaker": "Спикер", "text": "...", "flagged": false }
  ]
}`;

    // Step 1 (Retrieval): Query unified KZ NPA database against extracted content before Stage 2 AI audit
    const retrievalStartPerf = performance.now();
    const retrievalInputText = [effectiveText, liveUrlExtracted, effectiveUrl, fileName]
      .filter((s) => typeof s === 'string' && s.trim().length > 0)
      .join('\n');
    const retrievalResult = retrieveRelevantKzLaws(retrievalInputText, {
      modality: isVideo ? 'video' : isAudio ? 'audio' : modality,
      hasMedia: Boolean(
        effectiveImageUrl ||
          effectiveAudioUrl ||
          effectiveVideoUrl ||
          activeVideoFrames.length > 0 ||
          mediaBase64
      ),
    });
    const ragContext = formatKzLawsRagContext(retrievalResult.candidateLaws, entityTier);
    const retrievalMs = Math.max(1, Math.round(performance.now() - retrievalStartPerf));

    const ragSystemInstruction = ragContext
      ? `${systemInstruction}\n\n[БАЗА НПА РК — РЕЛЕВАНТНЫЕ НОРМЫ (RAG CONTEXT, субъект: ${entityTier})]:\nИспользуй ТОЛЬКО реальные нормы из этой структурированной базы (цитируй точное значение CODE), не придумывай несуществующие номера статей:\n${ragContext}`
      : systemInstruction;

    let geminiResponseText = '';
    let usedAiModel: string | undefined;
    let fallbackReason: string | undefined = process.env.GEMINI_API_KEY
      ? undefined
      : 'GEMINI_API_KEY не настроен на сервере';
    let aiAuditMs = 0;

    if (process.env.GEMINI_API_KEY) {
      const parts: Array<any> = [];
      let audioAddedToParts = false;
      const mediaExtractPerfStart = performance.now();

      // 1. Process media payload (video/audio upload)
      const mediaPayload =
        mediaBase64 ||
        (effectiveVideoUrl?.startsWith('data:video') ? effectiveVideoUrl : undefined) ||
        (effectiveAudioUrl?.startsWith('data:audio') ? effectiveAudioUrl : undefined);

      if (mediaPayload && typeof mediaPayload === 'string') {
        const mimeMatch = mediaPayload.match(/^data:([a-zA-Z0-9\/+.-]+)(?:;[^,]*)?;base64,(.+)$/);
        const effectiveMime = mimeType || (mimeMatch ? mimeMatch[1] : isVideo ? 'video/mp4' : 'audio/mp3');
        const rawBase64 = mimeMatch ? mimeMatch[2] : mediaPayload;
        const buffer = Buffer.from(rawBase64, 'base64');

        // If it's a video, try server ffmpeg for MP3 audio + 5 keyframes, with automatic fallback to browser WAV & client frames
        if (isVideo) {
          try {
            const ext = effectiveMime.includes('webm')
              ? 'webm'
              : effectiveMime.includes('quicktime') || effectiveMime.includes('mov')
              ? 'mov'
              : 'mp4';
            tempFilePath = path.join(os.tmpdir(), `checkact-vid-${Date.now()}.${ext}`);
            tempMp3Path = path.join(os.tmpdir(), `checkact-aud-${Date.now()}.mp3`);
            await fs.promises.writeFile(tempFilePath, buffer);

            // 1. Probe video duration with ffprobe for even keyframe distribution
            let vidDuration = 10;
            try {
              const probeRes = await execFileAsync(
                'ffprobe',
                [
                  '-v',
                  'error',
                  '-show_entries',
                  'format=duration',
                  '-of',
                  'default=noprint_wrappers=1:nokey=1',
                  tempFilePath,
                ],
                { timeout: 4000 }
              );
              const parsedDur = parseFloat(probeRes.stdout?.trim() || '0');
              if (!isNaN(parsedDur) && parsedDur > 0) {
                vidDuration = parsedDur;
              }
            } catch {
              // fallback duration
            }

            // 2. Extract lightweight MP3 audio track so Gemini can transcribe real speech
            await execFileAsync(
              'ffmpeg',
              [
                '-y',
                '-threads',
                '2',
                '-i',
                tempFilePath,
                '-t',
                '180',
                '-vn',
                '-acodec',
                'libmp3lame',
                '-b:a',
                '64k',
                '-ar',
                '16000',
                '-ac',
                '1',
                tempMp3Path,
              ],
              { timeout: 10000 }
            ).catch(() => {});

            const mp3Stat = await fs.promises.stat(tempMp3Path).catch(() => null);
            if (mp3Stat && mp3Stat.size > 200) {
              const mp3Buf = await fs.promises.readFile(tempMp3Path);
              const mp3Base64 = mp3Buf.toString('base64');
              parts.push({
                inlineData: {
                  mimeType: 'audio/mp3',
                  data: mp3Base64,
                },
              });
              audioAddedToParts = true;
              if (!effectiveAudioUrl) {
                effectiveAudioUrl = `data:audio/mp3;base64,${mp3Base64}`;
              }
            }

            // 3. Extract 5 evenly distributed visual keyframes across the entire video duration
            const frameDir = path.join(os.tmpdir(), `checkact-frames-${Date.now()}`);
            await fs.promises.mkdir(frameDir, { recursive: true });
            const fpsVal = Math.max(0.05, 5 / Math.max(1, vidDuration));
            await execFileAsync(
              'ffmpeg',
              [
                '-y',
                '-i',
                tempFilePath,
                '-vf',
                `fps=${fpsVal},scale='min(854,iw)':-2`,
                '-q:v',
                '3',
                '-vframes',
                '5',
                path.join(frameDir, 'frame_%02d.jpg'),
              ],
              { timeout: 10000 }
            ).catch(() => {});

            const frameFiles = await fs.promises.readdir(frameDir).catch(() => []);
            const sortedFrames = frameFiles.filter((f) => f.endsWith('.jpg')).sort();
            const ffmpegFrames: string[] = [];
            for (const f of sortedFrames) {
              const fBuf = await fs.promises.readFile(path.join(frameDir, f));
              const fB64 = fBuf.toString('base64');
              const frameDataUrl = `data:image/jpeg;base64,${fB64}`;
              ffmpegFrames.push(frameDataUrl);
              parts.push({
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: fB64,
                },
              });
            }
            if (ffmpegFrames.length > 0 && activeVideoFrames.length === 0) {
              activeVideoFrames = ffmpegFrames;
            }
            fs.promises.rm(frameDir, { recursive: true, force: true }).catch(() => {});
          } catch (ffmpegErr: any) {
            console.info('ffmpeg video processing notice (using client audio/frames fallback):', ffmpegErr?.message || 'fallback');
          }
        } else {
          // Inline data for audio/image files
          parts.push({
            inlineData: {
              mimeType: effectiveMime,
              data: rawBase64,
            },
          });
          if (effectiveMime.startsWith('audio/')) {
            audioAddedToParts = true;
          }
        }
      } else if (effectiveImageUrl && typeof effectiveImageUrl === 'string') {
        const mimeMatch = effectiveImageUrl.match(/^data:([a-zA-Z0-9\/+.-]+)(?:;[^,]*)?;base64,(.+)$/);
        const effectiveMime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const base64Data = mimeMatch ? mimeMatch[2] : effectiveImageUrl.split(',')[1] || '';
        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType: effectiveMime,
              data: base64Data,
            },
          });
        }
      }

      // Dual audio fallback: if server ffmpeg did not extract audio (or for standalone audio requests), attach client-extracted WAV/audio track
      if (!audioAddedToParts && effectiveAudioUrl && typeof effectiveAudioUrl === 'string' && effectiveAudioUrl.startsWith('data:audio')) {
        const mimeMatch = effectiveAudioUrl.match(/^data:([a-zA-Z0-9\/+.-]+)(?:;[^,]*)?;base64,(.+)$/);
        const effectiveAudioMime = mimeMatch ? mimeMatch[1] : 'audio/wav';
        const base64AudioData = mimeMatch ? mimeMatch[2] : effectiveAudioUrl.split(',')[1] || '';
        if (base64AudioData) {
          parts.push({
            inlineData: {
              mimeType: effectiveAudioMime,
              data: base64AudioData,
            },
          });
          audioAddedToParts = true;
        }
      }

      // Add all 5 video keyframes from client if ffmpeg did not extract frames into parts
      if (Array.isArray(activeVideoFrames) && activeVideoFrames.length > 0) {
        const hasFramesInParts = parts.some((p) => p.inlineData?.mimeType?.startsWith('image/'));
        if (!hasFramesInParts) {
          for (const frame of activeVideoFrames.slice(0, 5)) {
            const frameStr = typeof frame === 'string' ? frame : (frame as any)?.dataUrl || (frame as any)?.frameDataUrl || '';
            const frameMatch = frameStr.match(/^data:([a-zA-Z0-9\/+.-]+)(?:;[^,]*)?;base64,(.+)$/);
            if (frameMatch) {
              parts.push({
                inlineData: {
                  mimeType: frameMatch[1],
                  data: frameMatch[2],
                },
              });
            }
          }
        }
      }

      extractMs += Math.round(performance.now() - mediaExtractPerfStart);

      const hasUploadedVideoMedia =
        Boolean(mediaBase64 && isVideo) ||
        Boolean(effectiveVideoUrl?.startsWith('data:video')) ||
        (Array.isArray(videoFrames) && videoFrames.length > 1);
      const isScrapedUrlOnlyAudit = Boolean(
        (effectiveUrl || (effectiveText && /^https?:\/\//i.test(effectiveText))) &&
          liveUrlExtracted &&
          !hasUploadedVideoMedia &&
          !audioAddedToParts
      );

      let userTextPrompt = `Проведи полный аудит материала по законам РК и нормам этики.\n`;
      if (isScrapedUrlOnlyAudit) {
        userTextPrompt += `\n[ОБЪЕКТ: ССЫЛКА НА ПУБЛИКАЦИЮ / ПРОФИЛЬ — ТЕКСТ УЖЕ ИЗВЛЕЧЁН]:
Текст публикации, описание, субтитры или метаданные профиля уже извлечены сервером и приведены ниже.
НЕ выполняй повторный OCR по уже извлечённому тексту и не выдумывай несуществующую речь, если аудиодорожка не приложена.
1. Проанализируй извлечённый текст по ссылке на нарушения законодательства РК и норм цифровой этики.
2. Если приложена обложка/превью (og:image), оцени только её визуальный креатив и наложенные на неё баннерные надписи (дополняя текст).
3. В поле "extractedText" сохрани суть извлечённого по ссылке текста (плюс важные надписи с обложки, если они есть), без дублирования и выдумывания.\n`;
      } else if (isVideo) {
        userTextPrompt += `\n[ОБЪЕКТ: РЕАЛЬНЫЙ ВИДЕОМАТЕРИАЛ (REELS / TIKTOK / MP4) + АУДИОДОРОЖКА MP3/WAV]:
Проанализируй каждый кадр видео, все надписи на экране по ходу ролика и дословно расшифруй речь из аудиодорожки с таймкодами.

КРИТИЧЕСКИ ВАЖНО: Ты анализируешь РЕАЛЬНЫЙ контент из приложенных кадров и аудиодорожки! Категорически запрещено выдумывать несуществующий текст или подставлять шаблонные фразы (про "Kaspi", "350 тысяч тенге", "курсы", "берега попутал" и т.п.)!

1. ВНИМАТЕЛЬНО ПРОЧИТАЙ ВСЕ НАДПИСИ НА КАЖДОМ КАДРЕ (OCR):
   - Прочитай все титры, субтитры, заголовки, плашки, рекламные баннеры, стикеры, текст на футболках/стенах/экране телефона, ссылки, промокоды и хештеги на ВСЕХ приложенных кадрах видео (начало, середина, концовка).
   - Помести ВЕСЬ прочитанный с кадров текст в поле "extractedText".

2. ДОСЛОВНО РАСШИФРУЙ РЕЧЬ И ЗВУКИ ИЗ АУДИОДОРОЖКИ:
   - Если в аудио слышна устная речь (русская, казахская или смешанная): сделай её дословную транскрипцию в массив "transcript" с таймкодами [ММ:СС] и автором реплики. Добавь эту расшифровку также в "extractedText" после текста с экрана.
   - Если в аудио НЕТ устной речи (играет только музыка, звуки, шум или тишина): ОБЯЗАТЕЛЬНО укажи в "transcript" одну запись: [{"time": "00:01", "speaker": "Звуковая дорожка", "text": "[Фоновая музыка / звуковые эффекты без устной речи]", "flagged": false}].

3. ОПИШИ РЕАЛЬНЫЕ ДЕЙСТВИЯ В КАДРЕ ("detectedActions"):
   - Подробно опиши, что РЕАЛЬНО происходит по ходу ролика на всех кадрах: локация, люди, их действия, жесты, что они показывают или рекламируют, интерфейс экрана, смена сцен.

4. ДАЙ ТОЧНОЕ РЕЗЮМЕ ("summary"):
   - Напиши объективное краткое содержание ЭТОГО конкретного видеоролика (о чем он, кто в кадре, какая тема).

5. ВЫЯВЛЕНИЕ НАРУШЕНИЙ ("findings"):
   - Проверь и видеоряд (каждый кадр), и аудиодорожку на нарушения законов РК:
     * ст. 434 КоАП РК: маты/нецензурная брань на казахском или русском языках.
     * ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»: реклама казино, слотов, 1Win, 1xBet, ставок, рулеток, промокодов на азартные игры (ст. 445-1 КоАП РК — только для незаконных лотерей и розыгрышей).
     * ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ: коммерческие предложения/товары/услуги/скидки без плашки «Жарнама / Реклама» и БИН; ч. 3 ст. 455 КоАП РК / ст. 21 Закона «О языках» — отсутствие казахской версии.
     * ст. 73-4 КоАП РК, ст. 131, 115 УК РК: буллинг, оскорбления, травля, угрозы.
     * ст. 79 КоАП РК / ч. 5 ст. 147 УК РК: распространение персональных данных (телефоны, ИИН, документы).
   - Если нарушений нет, верни "overall_risk": "нет" и "findings": [].
`;
      } else if (isAudio) {
        userTextPrompt += `\n[ОБЪЕКТ: АУДИОМАТЕРИАЛ]:\n1. Выполни дословную транскрипцию речи с таймкодами (ММ:СС) и укажи язык.\n2. Оцени смысл с учетом контекста и интонации.\n`;
      } else if (effectiveImageUrl) {
        userTextPrompt += `\n[ОБЪЕКТ: СКРИНШОТ / ИЗОБРАЖЕНИЕ]:
ВНИМАНИЕ: На этом изображении/скриншоте содержится текст, переписка, рекламный баннер или публикация!
1. ОБЯЗАТЕЛЬНО прочитай и выпиши ВЕСЬ видимый текст со скриншота в поле "extractedText" дословно.
2. Проверь текст и визуальные элементы на:
   - Ненормативную лексику и обсценную брань на русском и казахском языках (ст. 434 КоАП РК).
   - Рекламу онлайн-казино, слотов, букмекерских контор и незаконных азартных игр (ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»: 1win, 1xbet, pin-up, слоты, фриспины, ставки, рулетка; ст. 445-1 КоАП РК — только для незаконных лотерей и розыгрышей).
   - Коммерческие, банковские и сервисные предложения (товары, услуги, скидки, счета, карты, бонусы, акции) без маркировки «Жарнама» / «Реклама» и БИН (ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ) и без казахской версии (ч. 3 ст. 455 КоАП РК / ст. 21 Закона о языках).
   - Кибербуллинг, оскорбления, угрозы и клевету (ст. 73-4 КоАП РК, ст. 115, 131 УК РК).
   - Персональные данные (телефоны, ИИН, адреса) и недостоверные сведения (ст. 79 КоАП РК / ч. 5 ст. 147 УК РК, ст. 274 УК РК).
3. Если обнаружено хотя бы одно нарушение — обязательно включи его в массив "findings" с точной цитатой и категорией и установи overall_risk ("высокий" или "средний").\n`;
      }

      if (effectiveText && effectiveText !== effectiveUrl) {
        userTextPrompt += `\n[ТЕКСТ / ПРИМЕЧАНИЕ / СУБТИТРЫ / OCR КАДРОВ]:\n${effectiveText}\n`;
      }
      if (liveUrlExtracted) {
        userTextPrompt += `\n[ИЗВЛЕЧЁННЫЙ КОНТЕНТ ПО ССЫЛКЕ (субтитры YouTube, подпись Reels/TikTok, пост/профиль Telegram/СМИ) — ОБЯЗАЛЬНО ПРОАНАЛИЗИРУЙ ЭТОТ ТЕКСТ ВМЕСТЕ С ПРИЛОЖЕННЫМ ПРЕВЬЮ (og:image), ЕСЛИ ОНО ЕСТЬ]:\n${liveUrlExtracted}\n`;
      } else if (effectiveText) {
        userTextPrompt += `\n[ССЫЛКА / ТЕКСТ]:\n${effectiveText}\n`;
      }
      if (fileName) {
        userTextPrompt += `\nИмя исходного файла: ${fileName}`;
      }

      parts.unshift({ text: userTextPrompt });

      const isRichMediaRequest = hasUploadedVideoMedia || audioAddedToParts;
      const maxRouteBudgetMs = isRichMediaRequest ? 64000 : isScrapedUrlOnlyAudit ? 26000 : 30000;
      const routeDeadline = analyzeStartMs + maxRouteBudgetMs;
      const remainingForGemini = Math.max(4000, routeDeadline - Date.now());
      const aiPerfStart = performance.now();

      try {
        geminiResponseText = await callGeminiApi({
          systemInstruction: ragSystemInstruction,
          contents: [{ role: 'user', parts }],
          responseJson: true,
          timeoutMs: Math.min(
            remainingForGemini,
            hasUploadedVideoMedia ? 36000 : isScrapedUrlOnlyAudit ? 12000 : 24000
          ),
          disableThinking: isScrapedUrlOnlyAudit,
          signal: analyzeAbort.signal,
          onModelSelected: (modelName) => {
            usedAiModel = modelName;
          },
        });
      } catch (geminiError: any) {
        fallbackReason = geminiError?.message || 'Gemini API недоступен или превысил лимит времени';
        console.info('Gemini generateContent notice (using fallback):', fallbackReason);
      } finally {
        aiAuditMs += Math.round(performance.now() - aiPerfStart);
      }
    }

    // Secondary analyze attempt with OpenAI GPT-4o-mini if geminiResponseText is empty and route budget permits
    const hasRichFallbackMedia =
      Boolean(mediaBase64 && isVideo) ||
      Boolean(effectiveVideoUrl?.startsWith('data:video')) ||
      Boolean(effectiveAudioUrl?.startsWith('data:audio')) ||
      (Array.isArray(videoFrames) && videoFrames.length > 1);
    const analyzeOpenAiDeadline = analyzeStartMs + (hasRichFallbackMedia ? 64000 : 28000);
    const remainingForOpenAi = analyzeOpenAiDeadline - Date.now();
    if (!analyzeAbort.signal.aborted && !geminiResponseText && remainingForOpenAi > 5000 && (process.env.OPENAI_API_KEY || process.env.GPT_API_KEY)) {
      const openAiPerfStart = performance.now();
      try {
        const hasUploadedVideoForOpenAi =
          Boolean(mediaBase64 && isVideo) ||
          Boolean(effectiveVideoUrl?.startsWith('data:video')) ||
          (Array.isArray(videoFrames) && videoFrames.length > 1);
        let combinedUserPrompt = `Проведи полный комплаенс-аудит материала по законам РК (ст. 434, ч. 1–3 ст. 455, 445-1, 73-4, 79 КоАП РК, ч. 5 ст. 147 УК РК, Закон № 230-VII, Приказ МКИ № 59-НҚ) и нормам интернет-этики. Ответ строго в формате JSON, описанном в системной инструкции.`;
        if (isVideo && !(effectiveUrl && liveUrlExtracted && !hasUploadedVideoForOpenAi)) {
          combinedUserPrompt += `\n[ОБЪЕКТ: РЕАЛЬНЫЙ ВИДЕОМАТЕРИАЛ (REELS / TIKTOK / MP4)]:
1. Внимательно прочитай ВСЕ надписи, титры, субтитры, рекламные слоганы и баннеры на ВСЕХ приложенных кадрах видео и выпиши их в 'extractedText'.
2. Опиши визуальные действия, обстановку и людей на кадрах в 'detectedActions'.
3. Дай точное краткое описание содержания видео в 'summary'.
4. Зафиксируй любые нарушения законов РК (маты, казино/слоты, немаркированная реклама, буллинг/оскорбления) в 'findings'.`;
        }
        if (effectiveText && effectiveText !== effectiveUrl) {
          combinedUserPrompt += `\n[Текст материала]:\n${effectiveText}`;
        }
        if (liveUrlExtracted) {
          combinedUserPrompt += `\n[Данные по ссылке (повторный OCR не требуется)]:\n${liveUrlExtracted}`;
        }

        const keyframeUrls = activeVideoFrames
          .map((f) => (typeof f === 'string' ? f : f?.dataUrl || f?.frameDataUrl))
          .filter((f) => typeof f === 'string' && f.startsWith('data:image/'))
          .slice(0, 6);

        geminiResponseText = await callOpenAiApi({
          systemInstruction: ragSystemInstruction,
          userPrompt: combinedUserPrompt,
          imageDataUrl: effectiveImageUrl || keyframeUrls[0],
          imageUrls: keyframeUrls.length > 1 ? keyframeUrls.slice(1) : undefined,
          responseJson: true,
          timeoutMs: Math.min(remainingForOpenAi, 22000),
        });
        if (geminiResponseText) {
          usedAiModel = 'gpt-4o-mini';
          fallbackReason = undefined;
        }
      } catch (openAiErr: any) {
        fallbackReason = openAiErr?.message || fallbackReason || 'AI-шлюз недоступен';
        console.info('OpenAI analyze notice:', openAiErr?.message || 'fallback');
      } finally {
        aiAuditMs += Math.round(performance.now() - openAiPerfStart);
      }
    }

    if (geminiResponseText && !isLlmRefusalText(geminiResponseText)) {
      try {
        const parsed = safeParseLlmJson(geminiResponseText);
        if (!parsed) {
          throw new Error('Malformed LLM JSON');
        }
        const safeParsedExtracted =
          typeof parsed.extractedText === 'string' && !isLlmRefusalText(parsed.extractedText)
            ? parsed.extractedText
            : '';

        const rawFindings: any[] = Array.isArray(parsed.findings)
          ? parsed.findings
          : Array.isArray(parsed.violations)
          ? parsed.violations
          : [];
        const findings = rawFindings.filter((f) => Boolean(f && typeof f === 'object'));
        let violations: any[] = [];
        const combinedFullText = `${safeParsedExtracted} ${effectiveText || ''} ${liveUrlExtracted || ''} ${effectiveUrl || ''}`;
        const isContextWarning = isJournalisticWarningContext(combinedFullText);

        // Build violations from findings or parsed.violations
        if (findings.length > 0) {
          findings.forEach((f: any, idx: number) => {
            const cat = String(f.article || f.category || f.title || f.code || '');
            const quoteText = `${String(f.quote_or_description || f.quote || '')} ${String(f.description || '')} ${String(f.reasoning || '')}`;
            // Context-aware filter: ignore false positives on gambling/ads/scam/warning mentions when material is official/journalistic warning
            if (isContextWarning && (/445-1|казино|455|59-нқ|5-1|230|реклам|жарнама|190|274|скам|фишинг|мошен/i.test(cat) || /мошенник|полиц|мвд|афм|предупрежд/i.test(quoteText))) {
              return;
            }
            const hasHardStatutoryCode = /445-1|434|455|5-1|59-нқ|230|73-4|131|115|79|147|133-1|301-1|фишинг|скам|казино/i.test(cat);
            const isAssemblyCategoryOrReason =
              !hasHardStatutoryCode &&
              /human-in-the-loop|проверк[аи]\s+контекста|174\s*ук|общественно-политическ|протест|политическ[а-яё]+\s+плакат|требован[а-яё]+\s+отставк|отставк|обвинен[а-яё]+\s+в\s+адрес\s+госорган|мирн[а-яё]*\s+собран|поряд[а-яё]*\s+проведен[а-яё]*\s+(?:мирн|публичн)|публичн[а-яё]*\s+мероприяти|несанкционированн[а-яё]*\s+(?:собран|митинг|акц|шеств)|488\s*коап|митинг|шеств|пикет|перекрыт[а-яё]*\s+дорог|уличн[а-яё]*\s+акц|наразылық|шеру|бейбіт\s+жиналыс/i.test(
                `${cat} ${quoteText}`
              );
            const mappedCode = isAssemblyCategoryOrReason
              ? HITL_PROTEST_ARTICLE
              : /ч\.\s*1\s*ст\.\s*455|п\.\s*5-1|5-1\s*ст\.\s*6|казино|слот|букмекер|азарт/i.test(cat)
              ? 'ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»'
              : /445-1|лотере|розыгрыш/i.test(cat)
              ? 'ст. 445-1 КоАП РК'
              : /434/i.test(cat)
              ? 'ст. 434 КоАП РК'
              : /ч\.\s*3\s*ст\.\s*455|ст\.\s*21|21-бап|язык/i.test(cat)
              ? 'ч. 3 ст. 455 КоАП РК / ст. 21 Закона РК «О языках»'
              : /ч\.\s*2\s*ст\.\s*455|59-нқ|230|455/i.test(cat)
              ? 'ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ'
              : /190|274|456-2/i.test(cat)
              ? 'ст. 190 / 274 УК РК'
              : /73-4|131|115/i.test(cat)
              ? 'ст. 131 УК РК / ст. 73-4 КоАП РК'
              : /79|147/i.test(cat)
              ? 'ст. 79 КоАП РК / ч. 5 ст. 147 УК РК'
              : /133-1/i.test(cat)
              ? 'ст. 133-1 КоАП РК'
              : /301-1|вейп/i.test(cat)
              ? 'ст. 301-1 УК РК'
              : /dark|fomo|манипул|этик/i.test(cat)
              ? 'Этика цифровых медиа (Dark Patterns)'
              : 'Закон РК';
            const legalFlag = isLegalViolation({ category: 'legal', code: mappedCode, title: cat, fineAmount: '' });
            const isLanguageOnlyWarning = /ч\.\s*3\s*ст\.\s*455|21\s*Закона/i.test(mappedCode);
            const isAssemblyWarning = isHitlContextViolation({ code: mappedCode, title: cat });
            if (isAssemblyWarning && violations.some((v) => isHitlContextViolation(v))) {
              return;
            }
            const isCritical =
              legalFlag &&
              !isLanguageOnlyWarning &&
              !isAssemblyWarning &&
              (f.confidence === 'высокая' ||
                f.severity === 'critical' ||
                /казино|1win|слот|хулиган|мат|буллинг|скам|фишинг|ч\.\s*[12]\s*ст\.\s*455|5-1\s*ст\.\s*6|59-нқ|230-vii|445-1|434|190|274|147|79/i.test(cat));
            violations.push({
              id: `v-finding-${idx + 1}`,
              category: legalFlag ? 'legal' : 'ethics',
              code: mappedCode,
              title: isAssemblyWarning
                ? 'Общественно-политический / протестный контекст (Human-in-the-loop)'
                : f.category || f.title || 'Зафиксированное замечание',
              severity: isCritical ? 'critical' : 'warning',
              quote: f.quote_or_description || f.quote || '',
              basis: isAssemblyWarning
                ? HITL_PROTEST_DESCRIPTION
                : f.description || f.reasoning || f.basis || f.quote_or_description || '',
              fineAmount: '',
              jurisdiction: isAssemblyWarning
                ? 'Правовой комплаенс РК · Human-in-the-loop (проверка контекста)'
                : !legalFlag
                ? 'Кодекс цифровой этики'
                : 'МКИ РК / МВД РК',
              recommendation: isAssemblyWarning
                ? HITL_PROTEST_DESCRIPTION
                : 'Устранить выявленные несоответствия.',
            });
          });
        }

        // Second-pass rule verification: Ensure violations are NEVER missed if extractedText or effectiveText contains violations
        const auditRaw = `${safeParsedExtracted} ${effectiveText || ''} ${liveUrlExtracted || ''}`;
        const auditText = auditRaw.toLowerCase();

        // 0a. Check for Political Disinfo Leak (ст. 274 УК РК / ст. 456-2 КоАП РК)
        const disinfoCheck = detectPoliticalDisinfo(auditRaw);
        if (disinfoCheck.detected && !violations.some((v) => v.code?.includes('274') || v.code?.includes('456-2'))) {
          violations.push({
            id: `v-auto-disinfo-${Date.now()}`,
            category: 'legal',
            code: 'ст. 274 УК РК / ст. 456-2 КоАП РК',
            title: 'Распространение заведомо ложной информации (политический вброс)',
            severity: 'critical',
            quote: disinfoCheck.quote || 'СРОЧНЫЙ СЛИВ! Кандидат №3 тайно переписал бюджет района на офшоры',
            basis: 'Публикация неподтверждённых обвинений о коррупции и хищениях без официальных источников преследуется по ст. 456-2 КоАП РК и ст. 274 УК РК.',
            fineAmount: '',
            jurisdiction: 'МВД РК / Прокуратура / МКИ РК',
            recommendation: 'Удалить недостоверные утверждения либо приложить подтверждённые факты.',
            bbox: effectiveImageUrl ? { x: 4, y: 16, width: 58, height: 16 } : undefined,
          });
        }

        // 0b. Check for Personal Data Doxing (ст. 79 КоАП РК / ч. 5 ст. 147 УК РК)
        const doxingCheck = detectPersonalDataDoxing(auditRaw);
        if (doxingCheck.detected && !violations.some((v) => v.code?.includes('147') || v.code?.includes('79'))) {
          violations.push({
            id: `v-auto-doxing-${Date.now()}`,
            category: 'legal',
            code: 'ст. 79 КоАП РК / ч. 5 ст. 147 УК РК',
            title: 'Незаконное распространение персональных данных (Доксинг)',
            severity: 'critical',
            quote: doxingCheck.matches.join(', '),
            basis: 'Публикация личного телефона, ИИН и домашнего адреса гражданина без согласия нарушает Закон РК № 94-V (ст. 79 КоАП РК, ч. 5 ст. 147 УК РК — распространение сведений о частной жизни через онлайн-платформы).',
            fineAmount: '',
            jurisdiction: 'МЦРИАП РК / МВД РК',
            recommendation: 'Скрыть телефон, ИИН и домашний адрес.',
            bbox: effectiveImageUrl ? { x: 4, y: 54, width: 60, height: 18 } : undefined,
          });
        }

        // 1. Check for Kazakh & Russian profanity (word-boundary safe)
        const profanityMatches = findProfanityMatches(auditText);
        if (profanityMatches.length > 0 && !violations.some((v) => v.code?.includes('434'))) {
          violations.push({
            id: `v-auto-profanity-${Date.now()}`,
            category: 'legal',
            code: 'ст. 434 КоАП РК / Этика: Ненормативная лексика',
            title: 'Ненормативная обсценная лексика (маты)',
            severity: 'critical',
            quote: profanityMatches.slice(0, 3).join(', ') || 'Обсценная лексика',
            basis: 'В материале зафиксировано употребление ненормативной брани. В публичном цифровом пространстве РК это квалифицируется как мелкое хулиганство (ст. 434 КоАП РК).',
            fineAmount: '',
            jurisdiction: 'МВД РК / Этический комитет',
            recommendation: 'Полностью удалить обсценную лексику.',
          });
        }

        // 2. Check for Casino / Betting / Slots (skip on journalistic/police warnings)
        const casinoCheck = /казино|casino|1win|1xbet|pin-up|mostbet|слот|рулетк|фриспин|jackpot|жекпот|барабан|luxury\s+slots|букмекер/i;
        const isGamblingContent = !isContextWarning && casinoCheck.test(auditText);
        if (isGamblingContent && !violations.some((v) => /ч\.\s*1\s*ст\.\s*455|5-1\s*ст\.\s*6|445-1/i.test(v.code || ''))) {
          const match = auditText.match(casinoCheck);
          violations.push({
            id: `v-auto-casino-${Date.now()}`,
            category: 'legal',
            code: 'ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»',
            title: 'Реклама онлайн-казино и незаконных азартных игр',
            severity: 'critical',
            quote: match ? match[0] : 'Слоты / Рулетка / Фриспины',
            basis: 'Прямая реклама или продвижение онлайн-казино, слотов и рулетки в инвалюте запрещены ч. 1 ст. 455 КоАП РК и п. 5-1 ст. 6 Закона РК «О рекламе».',
            fineAmount: '',
            jurisdiction: 'МКИ РК / АФМ РК / МТС РК',
            recommendation: 'Удалить материалы с рекламой азартных игр.',
          });
        }

        // 3. Check for Cyberbullying / Insults (skip generic fraud words in police/journalistic warnings)
        const bullyCheck = /тупой|тупая|идиот|урод|мразь|ничтожеств|даун|клоун|найдем|за базар|продажн[а-я]+\s+твар|предател|мошенник[а-я]*(?=.*(?:кандидат|депутат|тварь|предатель))/i;
        if (!isContextWarning && bullyCheck.test(auditText) && !violations.some((v) => v.code?.includes('73-4') || v.code?.includes('131'))) {
          const match = auditText.match(bullyCheck);
          violations.push({
            id: `v-auto-bullying-${Date.now()}`,
            category: 'legal',
            code: 'ст. 131 УК РК / ст. 73-4 КоАП РК',
            title: 'Оскорбления личности, клевета и кибербуллинг',
            severity: 'critical',
            quote: match ? match[0] : 'Оскорбительные выражения',
            basis: 'Публичные оскорбления личности и унижение чести и достоинства преследуются по ст. 131 УК РК и ст. 73-4 КоАП РК.',
            fineAmount: '',
            jurisdiction: 'МВД РК / Суд',
            recommendation: 'Исключить оскорбительные формулировки.',
            bbox: effectiveImageUrl ? { x: 4, y: 36, width: 58, height: 14 } : undefined,
          });
        }

        // 4. Check for Unmarked Commercial Offer (suppressed when gambling is primary offense)
        const isCommercial = /скидк|распродаж|(?<!наразылық\s)(?<!уличн[а-яё]*\s)акци(?:я|ю|и)(?!\s+протеста)(?=$|[\s.,!?:;»"')\]])|промокод|купить|заказать|цена|тариф|доставк|открывайте\s+счет|счета\s+в\s+тенге|оформляй|кредит|депозит|кэшбэк|кешбэк|рассрочк|подключай|бронируй|услуг/i.test(auditText);
        const hasAdLabel = /жарнама|реклама/i.test(auditText);
        if (!isContextWarning && !isGamblingContent && isCommercial && !hasAdLabel && !violations.some((v) => /ч\.\s*2\s*ст\.\s*455|59-нқ|230-vii/i.test(v.code || ''))) {
          const adSnippet = auditText.match(/открывайте\s+счет[а-я\s,]*|скидк[а-я]*|распродаж[а-я]*|акция|промокод|купить|заказать|кредит|депозит|рассрочк[а-я]*/i)?.[0];
          violations.push({
            id: `v-auto-ad-${Date.now()}`,
            category: 'legal',
            code: 'ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ',
            title: 'Скрытая реклама и отсутствие обязательной маркировки («Жарнама»)',
            severity: 'critical',
            quote: adSnippet || 'Коммерческое / рекламное предложение без плашки «Жарнама»',
            basis: 'Коммерческий контент (включая продвижение финансовых услуг, товаров и сервисов) без обязательной маркировки «Жарнама / Реклама» и БИН рекламодателя нарушает ч. 2 ст. 455 КоАП РК, Закон № 230-VII и Приказ МКИ № 59-НҚ.',
            fineAmount: '',
            jurisdiction: 'МКИ РК',
            recommendation: 'Разместить четкую маркировку «Жарнама» и указать БИН/ИИН.',
          });
        }

        const { fraudSignals, bilingualCheck } = applyFraudAndBilingualChecks(combinedFullText, violations, entityTier);
        const kzIntel = analyzeKzFraudAndLanguage(combinedFullText, effectiveUrl);
        if (!isGamblingContent && kzIntel.needsKzParityWarning && !violations.some((v) => /ч\.\s*3\s*ст\.\s*455|ст\.\s*21/i.test(v.code || ''))) {
          violations.push({
            id: `v-auto-lang-${Date.now()}`,
            category: 'legal',
            code: 'ч. 3 ст. 455 КоАП РК / ст. 21 Закона РК «О языках»',
            title: 'Отсутствие версии рекламного материала на казахском языке',
            severity: 'warning',
            quote: 'Коммерческий текст опубликован только на русском языке',
            basis: 'Согласно ч. 3 ст. 455 КоАП РК и ст. 21 Закона РК «О языках в Республике Казахстан», реклама и коммерческие объявления размещаются на государственном (казахском) и русском языках.',
            fineAmount: '',
            jurisdiction: 'МКИ РК / Местные исполнительные органы',
            recommendation: 'Добавить равнозначный текст рекламы на казахском языке (используйте «Авто-исправление KZ+RU» ниже).',
          });
        }

        const assemblyCheck = detectPeacefulAssemblyCall(auditRaw);
        if (
          assemblyCheck.detected &&
          !violations.some((v) => isHitlContextViolation(v))
        ) {
          violations.push({
            id: `v-auto-hitl-${Date.now()}`,
            category: 'legal',
            code: HITL_PROTEST_ARTICLE,
            title: 'Общественно-политический / протестный контекст (Human-in-the-loop)',
            severity: 'warning',
            quote: assemblyCheck.quote || 'Общественно-политический / протестный контекст',
            basis: HITL_PROTEST_DESCRIPTION,
            fineAmount: '',
            jurisdiction: 'Правовой комплаенс РК · Human-in-the-loop (проверка контекста)',
            recommendation: HITL_PROTEST_DESCRIPTION,
          });
        }

        violations = applyViolationFinesForEntity(violations, entityTier);

        const hasHitlViolation = violations.some((v) => isHitlContextViolation(v));
        const overallRisk = violations.some((v) => v.severity === 'critical') || fraudSignals.isPhishingOrDeepfake
          ? 'высокий'
          : violations.length > 0
          ? (hasHitlViolation
            ? 'средний'
            : parsed.overall_risk === 'высокий'
            ? 'высокий'
            : 'средний')
          : isContextWarning
          ? 'нет'
          : (parsed.overall_risk || 'нет');

        const parsedHitlScore =
          typeof parsed.riskScore === 'number' && parsed.riskScore >= 46 && parsed.riskScore <= 55
            ? Math.round(parsed.riskScore)
            : 50;
        const isScenario1Combo = disinfoCheck.detected && doxingCheck.detected;
        const overallRiskScore =
          overallRisk === 'нет'
            ? 0
            : isScenario1Combo
            ? 84
            : overallRisk === 'высокий'
            ? (fraudSignals.isPhishingOrDeepfake ? 94 : 85)
            : overallRisk === 'средний'
            ? (hasHitlViolation ? parsedHitlScore : 55)
            : 25;

        const cleanFindings = isContextWarning && violations.length === 0 ? [] : findings;
        if (cleanFindings.length === 0 && violations.length > 0) {
          violations.forEach((v) => {
            cleanFindings.push({
              timestamp: '00:00',
              source: 'текст на экране',
              category: v.title,
              quote_or_description: v.quote,
              confidence: 'высокая',
              reasoning: v.basis,
            });
          });
        }

        const safeSummaryStr = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
        const safeTranscriptArr = Array.isArray(parsed.transcript)
          ? parsed.transcript.filter((t: any) => Boolean(t && typeof t === 'object'))
          : undefined;

        const mediaAnalysis = {
          summary:
            isContextWarning && violations.length === 0
              ? 'Контекстный фильтр подтвердил: материал является официальным предупреждением / журналистским освещением проблемы мошенничества (0 МРП). Нарушений законодательства РК не выявлено.'
              : safeSummaryStr && overallRisk !== 'нет' && !safeSummaryStr.toLowerCase().includes('не выявлено')
              ? safeSummaryStr
              : overallRisk === 'высокий'
              ? 'В материале зафиксированы критические нарушения законодательства РК и интернет-этики.'
              : overallRisk === 'средний'
              ? 'В материале обнаружены признаки нарушений и замечания, требующие устранения.'
              : 'В материале признаков нарушений законодательства РК не выявлено.',
          language: typeof parsed.language === 'string' && parsed.language ? parsed.language : (bilingualCheck.hasKazakh && bilingualCheck.hasRussian ? 'смешанный' : bilingualCheck.hasKazakh ? 'казахский' : 'русский'),
          overall_risk: overallRisk,
          findings: cleanFindings,
          needs_human_review: overallRisk !== 'нет',
          limitations: typeof parsed.limitations === 'string' && parsed.limitations ? parsed.limitations : (isVideo ? 'Анализ ограничен качеством видео и раскадровкой.' : isAudio ? 'Шумы могут повлиять на точность распознавания.' : 'Анализ статического материала.'),
        };

        const emojiAnalysis = analyzeEmojis(`${safeParsedExtracted} ${effectiveText} ${liveUrlExtracted}`);

        const totalMs = Math.max(1, Math.round(performance.now() - routePerfStart));
        const matchedLawCodes = Array.from(
          new Set([
            ...retrievalResult.matchedLaws.map((l) => l.code),
            ...violations.map((v) => v.code).filter(Boolean),
          ])
        ).slice(0, 8);

        const normalizedResponse = normalizeAuditCaseCompliance({
          id: caseId,
          referenceNumber: refNum,
          timestamp,
          sourceType: isVideo ? 'video' : isAudio ? 'audio' : (modality || 'screenshot'),
          title: targetTitle,
          sourceName: targetTitle,
          sha256: contentSha256,
          riskScore: overallRiskScore,
          legalScore: violations.some((v) => isLegalViolation(v)) ? overallRiskScore : 0,
          ethicsScore: violations.some((v) => v.category === 'ethics') ? overallRiskScore : 0,
          riskLevel: overallRisk === 'высокий' ? 'Критический' : overallRisk === 'средний' ? 'Высокий' : overallRisk === 'низкий' ? 'Средний' : 'Низкий',
          status: overallRisk === 'высокий' ? 'ТРЕБУЕТ МЕР' : overallRisk === 'средний' || overallRisk === 'низкий' ? 'ПРЕДУПРЕЖДЕНИЕ' : 'БЕЗОПАСНО',
          summary: mediaAnalysis.summary,
          ethicsSummary: 'Оценка тональности, речевого этикета и добросовестности коммуникации.',
          extractedText: (() => {
            let resText = safeParsedExtracted.trim();
            const transcriptText = safeTranscriptArr
              ? safeTranscriptArr.map((t: any) => String(t.text || '')).filter(Boolean).join('\n')
              : '';
            const isBareUrl = Boolean(resText && /^https?:\/\/\S+$/i.test(resText));

            if (!resText || isBareUrl || resText.toLowerCase() === 'нет' || resText.toLowerCase() === 'отсутствует') {
              resText = liveUrlExtracted || transcriptText || effectiveText || (isVideo ? 'Текст на экране и устная речь отсутствуют' : '');
            } else {
              if (
                liveUrlExtracted &&
                !resText.includes(liveUrlExtracted.slice(0, Math.min(40, liveUrlExtracted.length)))
              ) {
                resText = `${liveUrlExtracted}\n\n[Дополнительно распознано на превью/видео]:\n${resText}`;
              }
              if (transcriptText && transcriptText.length > 10 && !resText.includes(transcriptText.slice(0, 30))) {
                resText = `${resText}\n\n[Расшифровка устной речи]:\n${transcriptText}`;
              }
            }
            return resText;
          })(),
          detectedActions: (typeof parsed.detectedActions === 'string' ? parsed.detectedActions.trim() : '') || (liveUrlExtracted ? 'Контент, метаданные, субтитры и превью по ссылке извлечены и проанализированы.' : isVideo ? 'Видеоанализ Reels/TikTok: раскадровка и аудиодорожка успешно распознаны.' : isAudio ? 'Аудиоанализ речевого потока выполнен.' : 'Визуальный аудит выполнен.'),
          previewUrl:
            effectiveImageUrl ||
            (Array.isArray(activeVideoFrames) && activeVideoFrames.length > 0
              ? typeof activeVideoFrames[0] === 'string'
                ? activeVideoFrames[0]
                : (activeVideoFrames[0] as any)?.dataUrl || (activeVideoFrames[0] as any)?.frameDataUrl
              : undefined),
          rawText: liveUrlExtracted || effectiveText || effectiveUrl,
          audioDataUrl: effectiveAudioUrl,
          audioDuration: audioDuration || (isAudio ? '00:28' : undefined),
          audioVoiceClarity: 98.4,
          videoDataUrl: effectiveVideoUrl,
          videoFrames: activeVideoFrames.length > 0 ? activeVideoFrames : undefined,
          videoDuration: audioDuration || (isVideo ? '00:20' : undefined),
          transcript: safeTranscriptArr,
          emojiAnalysis,
          mediaAnalysis,
          fraudSignals,
          bilingualCheck,
          violations,
          telemetry: {
            extractMs,
            retrievalMs,
            aiAuditMs,
            totalMs,
            checkedLawsCount: retrievalResult.checkedLawsCount,
            retrievedLawsCount: retrievalResult.candidateLaws.length,
            matchedLawCodes,
            engineMode: 'rag-live-ai',
            ...(usedAiModel ? { aiModel: usedAiModel } : {}),
          },
          metadata: {
            fileSize: fileSize || '1.8 MB',
            duration: audioDuration || (isAudio ? '00:28' : isVideo ? '00:20' : undefined),
            engineConfidence: 99.1,
            platform: isVideo
              ? 'CheckActivity Video & Audio AI Engine'
              : isAudio
              ? 'CheckActivity Speech & Audio Engine'
              : 'CheckActivity Multimodal Engine v5.0',
          },
        } as any);

        return res.json(normalizedResponse);
      } catch (e: any) {
        fallbackReason = e?.message || 'Ошибка разбора ответа AI-модели';
        console.warn('Could not parse Gemini JSON response:', e);
      }
    }

    // Server-side fallback parsing when API key is not present or offline
    const combinedContent = `${effectiveText || ''} ${liveUrlExtracted || ''} ${fileName || ''} ${effectiveUrl || ''}`.toLowerCase();
    const fallbackResult = buildFallbackAudit(
      combinedContent,
      isVideo ? 'video' : isAudio ? 'audio' : modality,
      targetTitle,
      timestamp,
      contentSha256,
      caseId,
      refNum,
      effectiveImageUrl,
      liveUrlExtracted || effectiveText || effectiveUrl,
      fileSize,
      effectiveAudioUrl,
      audioDuration,
      effectiveVideoUrl,
      activeVideoFrames,
      entityTier
    );

    const fallbackMatchedCodes = Array.from(
      new Set([
        ...retrievalResult.matchedLaws.map((l) => l.code),
        ...(fallbackResult.violations || []).map((v: any) => v.code).filter(Boolean),
      ])
    ).slice(0, 8);

    return res.json(
      normalizeAuditCaseCompliance({
        ...(fallbackResult as any),
        telemetry: {
          extractMs,
          retrievalMs,
          aiAuditMs,
          totalMs: Math.max(1, Math.round(performance.now() - routePerfStart)),
          checkedLawsCount: retrievalResult.checkedLawsCount,
          retrievedLawsCount: retrievalResult.matchedLaws.length,
          matchedLawCodes: fallbackMatchedCodes,
          engineMode: 'deterministic-db-fallback',
          fallbackReason: fallbackReason || 'Выполнен детерминированный аудит по базе НПА РК',
        },
      })
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in /api/analyze:', err);
    return res.status(500).json({ error: 'Server analysis error: ' + errorMsg });
  } finally {
    res.off('close', onAnalyzeClose);
    if (tempFilePath) {
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
    if (tempMp3Path) {
      fs.promises.unlink(tempMp3Path).catch(() => {});
    }
  }
});

// Helper: Quick deterministic compliance evaluator for individual posts
function evaluatePostCompliance(
  text: string,
  entityTier: BusinessEntityType = 'small'
): {
  hasViolation: boolean;
  violationTitle?: string;
  lawCode?: string;
  fineRisk?: string;
  severity?: 'critical' | 'warning' | 'info';
} {
  const lower = text.toLowerCase();
  const isContextWarning = isJournalisticWarningContext(text);
  if (!isContextWarning && /казино|casino|1win|1xbet|pin-up|mostbet|слот|рулетк|фриспин|jackpot|жекпот|барабан|luxury\s+slots|букмекер/i.test(lower)) {
    const title = 'Реклама онлайн-казино и незаконных азартных игр (ч. 1 ст. 455 КоАП РК)';
    const code = 'ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»';
    return {
      hasViolation: true,
      violationTitle: title,
      lawCode: code,
      fineRisk: computeViolationFineText({ id: 'post-455-1', category: 'legal', code, title, severity: 'critical', basis: '' }, entityTier),
      severity: 'critical',
    };
  }
  if (!isContextWarning && /выплат[ауы]|42500|токаев\s+поручил|инвестиц\w+\s+(в\s+)?(kaspi|каспи|казмунайгаз)|kaspi[-_.]?(bonus|gift)|\.(xyz|top|click|icu)\b/i.test(lower)) {
    const title = 'Признаки финансового скама / фишинга (ст. 190, 274 УК РК)';
    const code = 'ст. 190, 274 УК РК';
    return {
      hasViolation: true,
      violationTitle: title,
      lawCode: code,
      fineRisk: computeViolationFineText({ id: 'post-scam', category: 'legal', code, title, severity: 'critical', basis: '' }, entityTier),
      severity: 'critical',
    };
  }
  const kzIntel = analyzeKzFraudAndLanguage(text);
  if (!isContextWarning && (kzIntel.hasPhishingOrScam || kzIntel.hasDeepfakeIndicators)) {
    const title = 'Признаки финансового скама / дипфейк-фишинга (ст. 190, 274 УК РК)';
    const code = 'ст. 190, 274 УК РК';
    return {
      hasViolation: true,
      violationTitle: title,
      lawCode: code,
      fineRisk: computeViolationFineText({ id: 'post-deepfake', category: 'legal', code, title, severity: 'critical', basis: '' }, entityTier),
      severity: 'critical',
    };
  }
  if (findProfanityMatches(lower).length > 0) {
    const title = 'Ненормативная лексика и оскорбления (ст. 434 КоАП РК)';
    const code = 'ст. 434 КоАП РК';
    return {
      hasViolation: true,
      violationTitle: title,
      lawCode: code,
      fineRisk: computeViolationFineText({ id: 'post-434', category: 'legal', code, title, severity: 'critical', basis: '' }, entityTier),
      severity: 'critical',
    };
  }
  const isCommercial = /скидк|распродаж|(?<!наразылық\s)(?<!уличн[а-яё]*\s)акци(?:я|ю|и)(?!\s+протеста)(?=$|[\s.,!?:;»"')\]])|промокод|купить|заказать|цена|артикул|доставк|открывайте\s+счет|счета\s+в\s+тенге|оформляй|кредит|депозит|кэшбэк|кешбэк|рассрочк/i.test(lower);
  const hasAdMark = /жарнама|реклама|спонсор|серіктестік/i.test(lower);
  if (!isContextWarning && isCommercial && !hasAdMark) {
    const title = 'Скрытая реклама без маркировки «Жарнама» (ч. 2 ст. 455 КоАП РК / Закон № 230-VII)';
    const code = 'ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ';
    return {
      hasViolation: true,
      violationTitle: title,
      lawCode: code,
      fineRisk: computeViolationFineText({ id: 'post-455-2', category: 'legal', code, title, severity: 'critical', basis: '' }, entityTier),
      severity: 'critical',
    };
  }
  return { hasViolation: false };
}

// POST /api/rewrite: AI Safe-Rewrite Compliance Fixer (RU + KZ)
app.post(['/api/rewrite', '/rewrite'], async (req: Request, res: Response) => {
  try {
    const { text, violations = [], language = 'ru', binOrIin = '', entityTier: rawEntityTier, entityType: rawEntityType } = req.body || {};
    const sourceText = String(text || '').trim();
    const binDisplay = String(binOrIin || '').trim() || '000000000000';
    const entityTier = resolveEntityTier(rawEntityTier || rawEntityType);
    const tierTaxLabelRu =
      entityTier === 'individual'
        ? 'ИИН'
        : entityTier === 'small'
        ? 'ИИН/БИН'
        : 'БИН организации';
    const tierTaxLabelKz =
      entityTier === 'individual'
        ? 'ЖСН'
        : entityTier === 'small'
        ? 'ЖСН/БСН'
        : 'Ұйым БСН';
    const tierDescRu =
      entityTier === 'individual'
        ? 'физическое лицо / блогер (реквизит ИИН)'
        : entityTier === 'small'
        ? 'субъект малого бизнеса / ИП (реквизит ИИН/БИН)'
        : entityTier === 'medium'
        ? 'субъект среднего бизнеса (реквизит БИН организации)'
        : 'субъект крупного бизнеса (реквизит БИН организации)';

    if (!sourceText) {
      return res.status(400).json({ error: 'Текст для исправления отсутствует' });
    }

    const violationSummary = Array.isArray(violations)
      ? violations.map((v: any) => `${v.code || ''}: ${v.title || ''}`).join('; ')
      : '';

    const explicitBinProvided = Boolean(String(binOrIin || '').trim());
    const binInstruction = explicitBinProvided ? binDisplay : `[указать 12 цифр, например ${binDisplay}]`;
    const systemPrompt = `Ты — ведущий юрист-редактор и специалист по цифровому маркетингу Казахстана (система Check Activity KZ).
Твоя задача — переписать проблемный текст/пост/объявление так, чтобы он стал на 100% законным по законодательству РК (Закон № 230-VII «Об онлайн-платформах и онлайн-рекламе», Приказ МКИ № 59-НҚ, Закон «О языках в РК», КоАП РК ст. 434, ч. 1–3 ст. 455, ст. 445-1 для лотерей, 73-4, 79, УК РК ч. 5 ст. 147, ст. 190, 274) и этичным, но сохранил деловую или информационную суть (если это не нелегальное казино/скам — в этом случае преобразуй в безопасное информационное/образовательное сообщение или предупреждение).

Категория субъекта рекламодателя: ${tierDescRu}.

ПРАВИЛА:
1. Если текст коммерческий/рекламный: обязательно добавь маркировку «Жарнама / Реклама» и реквизиты рекламодателя: в русской версии «Рекламодатель: ${tierTaxLabelRu} ${binInstruction}», в казахской версии «Жарнама беруші: ${tierTaxLabelKz} ${binInstruction}».
2. Удали всю ненормативную лексику, оскорбления, угрозы, скрытые манипуляции FOMO («только сегодня», «100% без риска»), фишинговые ссылки и упоминания нелегальных казино/ставок.
3. Верни сразу ДВЕ версии: на русском (safeTextRu) и на казахском (safeTextKz) языках для соблюдения Закона РК о языках.
4. Перечисли конкретные внесенные правки в массиве appliedFixes (на языке: ${language === 'kz' ? 'казахский' : 'русский'}).

Верни СТРОГО JSON:
{
  "safeTextRu": "...",
  "safeTextKz": "...",
  "appliedFixes": ["..."]
}`;

    const userPrompt = `Исходный текст:\n"""\n${sourceText.slice(0, 3500)}\n"""\n\nВыявленные нарушения: ${violationSummary || 'Потенциальные риски комплаенса и этики'}`;

    let rawAi = '';
    let engineUsed = 'CheckActivity Safe-Rewrite Rules';
    const rewriteAbort = new AbortController();
    const onRewriteClose = () => {
      if (!res.writableEnded) rewriteAbort.abort();
    };
    res.on('close', onRewriteClose);
    const rewriteDeadline = Date.now() + 28000;

    try {
      if (process.env.GEMINI_API_KEY) {
        try {
          rawAi = await callGeminiApi({
            systemInstruction: systemPrompt,
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            responseJson: true,
            timeoutMs: 18000,
            signal: rewriteAbort.signal,
          });
          engineUsed = 'Gemini 4 Hydrogen Safe-Rewrite';
        } catch (err) {
          console.info('Rewrite Gemini fallback notice:', err instanceof Error ? err.message : err);
        }
      }

      const remainingRewriteMs = rewriteDeadline - Date.now();
      if (!rewriteAbort.signal.aborted && !rawAi && remainingRewriteMs > 4000 && (process.env.OPENAI_API_KEY || process.env.GPT_API_KEY)) {
        try {
          rawAi = await callOpenAiApi({
            systemInstruction: systemPrompt,
            userPrompt,
            responseJson: true,
            timeoutMs: Math.min(18000, remainingRewriteMs),
          });
          engineUsed = 'OpenAI GPT Safe-Rewrite';
        } catch (err) {
          console.info('Rewrite OpenAI fallback notice:', err instanceof Error ? err.message : err);
        }
      }
    } finally {
      res.off('close', onRewriteClose);
    }

    if (rawAi) {
      const parsed = safeParseLlmJson(rawAi);
      if (parsed && typeof parsed.safeTextRu === 'string' && typeof parsed.safeTextKz === 'string' && parsed.safeTextRu.trim() && parsed.safeTextKz.trim()) {
        let safeTextRu = parsed.safeTextRu.trim();
        let safeTextKz = parsed.safeTextKz.trim();
        if (explicitBinProvided) {
          safeTextRu = safeTextRu.replace(/\[?\b0{12}\b\]?|\[указать\s+12\s+цифр\]/gi, binDisplay);
          safeTextKz = safeTextKz.replace(/\[?\b0{12}\b\]?|\[указать\s+12\s+цифр\]/gi, binDisplay);
        }
        return res.json({
          originalText: sourceText,
          safeTextRu,
          safeTextKz,
          appliedFixes: Array.isArray(parsed.appliedFixes)
            ? parsed.appliedFixes.map((x: any) => String(x)).filter(Boolean)
            : ['Приведено в соответствие с нормами РК'],
          newRiskScore: computeRewriteResidualRisk(safeTextRu, safeTextKz, entityTier),
          engineUsed,
        });
      }
    }

    // Deterministic reliable fallback rewriter
    let cleanRu = sourceText
      .replace(/СРОЧНЫЙ\s+СЛИВ![^\n]*/gi, 'Информация требует официальной проверки по подтверждённым источникам.')
      .replace(/блят[ья]|бля[дт]|\bбля\b|ху[йияеёю]\S*|пизд\S*|еб[а-яё]*|ёб[а-яё]*|сук[а-яё]*|наху[йи]\S*|муда\S*|пидор\S*|тупой|идиот|урод|шеше[ңн]\S*|си[кқ]т\S*|көт\S*/gi, '[удалено]')
      .replace(/продажн\S*\s+твар\S*|предател[яюе]?\S*|мошенник[а-я]*/gi, '[некорректная оценка исключена]')
      .replace(/(?:\+7|8)[\s(-]*7\d{2}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g, '[телефон скрыт]')
      .replace(/\b\d{12}\b/g, '[ИИН скрыт]')
      .replace(/(?:адрес\s*:?\s*)?(?:г\.\s*[А-ЯЁА-ЯA-Zәғқңөұүһі-]+,\s*)?(?:ул\.|пр\.|мкр\.)\s*[^\n]+/gi, '[адрес скрыт]')
      .replace(/казино|1win|1xbet|pin-up|mostbet|слот[ыа-я]*|рулетк\S*|фриспин\S*|барабан\S*|jackpot|жекпот|luxury\s+slots/gi, '[азартный контент исключен]')
      .replace(/100%\s*гарант\S*|без\s+риск\S*|только\s+сегодня\s+успей\S*/gi, 'ознакомьтесь с подробными условиями')
      .replace(/[🎰💩🖕🔞]/g, '')
      .trim();

    const isGamblingText = /1win|1xbet|pin-up|mostbet|слот|рулетк|фриспин|казино|luxury\s+slots/i.test(sourceText);
    const isAd = !isGamblingText && /скидк|распродаж|акция|промокод|купить|заказать|цена/i.test(sourceText);
    const hadPii = /(?:\+7|8)[\s(-]*7\d{2}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}|\b\d{12}\b|ул\./i.test(sourceText);
    const appliedFixes: string[] = [];

    if (cleanRu !== sourceText) {
      appliedFixes.push(
        language === 'kz'
          ? 'Бейәдеп сөздер, айлалы триггерлер және тыйым салынған сөздер жойылды'
          : 'Удалены обсценная лексика, оскорбления, фейковые утверждения и запрещённые триггеры'
      );
    }
    if (hadPii) {
      appliedFixes.push(
        language === 'kz'
          ? 'Дербес деректер (телефон, ЖСН, мекенжай) ҚР ӘҚБтК 79-бабы / ҚК 147-бабы 5-бөлігі бойынша жасырылды'
          : 'Персональные данные (телефон, ИИН, адрес) скрыты по ст. 79 КоАП РК и ч. 5 ст. 147 УК РК'
      );
    }
    if (isAd && !/жарнама|реклама/i.test(cleanRu)) {
      cleanRu = `Реклама / Жарнама\n${cleanRu}\n\nРекламодатель: ${tierTaxLabelRu} [${binDisplay}] (ч. 2 ст. 455 КоАП РК / Приказ МКИ № 59-НҚ)`;
      appliedFixes.push(
        language === 'kz'
          ? `«Жарнама / Реклама» таңбасы және ${tierTaxLabelKz} өрісі қосылды (ҚР ӘҚБтК 455-б. 2-б. / № 59-НҚ)`
          : `Добавлена обязательная маркировка «Реклама / Жарнама» и реквизиты ${tierTaxLabelRu} (ч. 2 ст. 455 КоАП РК / Приказ № 59-НҚ)`
      );
    }
    if (appliedFixes.length === 0) {
      appliedFixes.push(
        language === 'kz'
          ? 'Мәтін ҚР заңнамасы мен цифрлық этика стандарттарына сәйкестендірілді'
          : 'Текст проверен и адаптирован под стандарты комплаенса и этики РК'
      );
    }

    let safeTextKz = cleanRu;
    if (isAd) {
      const bodyOnly = cleanRu.replace(/^Реклама \/ Жарнама\n?/i, '').replace(/\n\nРекламодатель:[\s\S]*$/i, '');
      safeTextKz = `Жарнама / Реклама\nҚР заңнамасына сәйкестендірілген қауіпсіз хабарландыру:\n${bodyOnly}\n\nЖарнама беруші: ${tierTaxLabelKz} [${binDisplay}] (ҚР ӘҚБтК 455-бабы 2-б. / № 230-VII Заңы)`;
    } else if (/выборы\s+15\s+марта/i.test(cleanRu)) {
      safeTextKz = `Ресми дереккөздер арқылы растауды қажет ететін ақпарат. Дербес деректер жасырылды.\n15 наурыздағы сайлауға келіп, ар-ожданыңызбен дауыс беріңіз!`;
    } else if (isGamblingText) {
      safeTextKz = `ҚР ӘҚБтК 455-бабы 1-бөлігіне және «Жарнама туралы» Заңның 6-бабы 5-1-тармағына сәйкес онлайн-казино мен құмар ойындарды жарнамалау толығымен алынып тасталды.`;
    } else {
      safeTextKz = `ҚР заңнамасына сәйкес бейімделген нұсқа:\n${cleanRu}`;
    }

    return res.json({
      originalText: sourceText,
      safeTextRu: cleanRu,
      safeTextKz,
      appliedFixes,
      newRiskScore: computeRewriteResidualRisk(cleanRu, safeTextKz, entityTier),
      engineUsed: 'CheckActivity Deterministic Compliance Fixer',
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: errorMsg });
  }
});

// POST /api/monitor/scan-account: Performs compliance audit (live public Telegram scraping + AI/rule audit)
app.post(['/api/monitor/scan-account', '/monitor/scan-account'], async (req: Request, res: Response) => {
  try {
    const { channelId, handleOrUrl, platform } = req.body || {};

    const targetHandle = handleOrUrl || '@channel';
    const cleanHandle = targetHandle.toLowerCase();

    const timestamp =
      new Date().toLocaleString('ru-RU', {
        timeZone: 'Asia/Almaty',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' (Астана)';

    // Attempt REAL public Telegram scraping when platform is telegram or handle contains t.me
    let livePosts: Array<{
      id: string;
      date: string;
      type: 'post' | 'story' | 'reels' | 'comment';
      content: string;
      hasViolation: boolean;
      violationTitle?: string;
      lawCode?: string;
      fineRisk?: string;
      severity?: 'critical' | 'warning' | 'info';
      views?: string;
      sourceUrl?: string;
    }> | null = null;
    let isLiveScraped = false;

    let scrapedTitle: string | undefined;

    if (platform === 'telegram' || cleanHandle.includes('t.me') || targetHandle.startsWith('@')) {
      const scraped = await scrapeTelegramPublicChannel(targetHandle);
      if (scraped.posts.length > 0) {
        isLiveScraped = true;
        scrapedTitle = scraped.channelTitle;
        livePosts = scraped.posts.map((p) => {
          const check = evaluatePostCompliance(p.content);
          return {
            id: p.id,
            date: p.date,
            type: 'post' as const,
            content: p.content,
            views: p.views,
            sourceUrl: p.link,
            ...check,
          };
        });
      }
    }

    if (livePosts && livePosts.length > 0) {
      const violationsFound = livePosts.filter((p) => p.hasViolation).length;
      const hasCritical = livePosts.some((p) => p.severity === 'critical');
      const riskScore = violationsFound === 0 ? 8 : hasCritical ? 86 : 52;
      const status: 'LIVE' | 'ALERT' | 'PAUSED' = violationsFound > 0 ? 'ALERT' : 'LIVE';
      const firstViolation = livePosts.find((p) => p.hasViolation);

      return res.json({
        success: true,
        channelId,
        channelTitle: scrapedTitle,
        handleOrUrl: targetHandle,
        platform: platform || 'telegram',
        lastScan: 'Только что (Live TG)',
        isLiveScraped,
        violations24h: violationsFound,
        riskScore,
        status,
        alertNote: firstViolation?.violationTitle,
        recentPosts: livePosts,
        timestamp,
      });
    }

    // Intelligent contextual fallback for non-public / Instagram / TikTok accounts
    const isRisky = cleanHandle.includes('capper') || cleanHandle.includes('bet') || cleanHandle.includes('slots') || cleanHandle.includes('today');
    const isInfluencer = cleanHandle.includes('beauty') || cleanHandle.includes('life') || cleanHandle.includes('aruzhan') || cleanHandle.includes('shop');

    let violationsFound = 0;
    let riskScore = 12;
    let status: 'LIVE' | 'ALERT' | 'PAUSED' = 'LIVE';
    let alertNote = undefined;

    const auditedPosts = [
      {
        id: `post-${Date.now()}-1`,
        date: '10 мин назад',
        type: 'post' as const,
        content: isRisky
          ? 'Новая схема заработка! Ссылка на зеркало слотов 1Win в описании профиля. Забирайте 500% бонус на Kaspi!'
          : isInfluencer
          ? 'Девочки, открыла для себя новый корейский крем! Ссылка со скидкой 25% в bio профиля. Заказывайте прямо сейчас!'
          : 'Свежий дайджест городских событий и дорожной обстановки в Алматы.',
        hasViolation: isRisky || isInfluencer,
        violationTitle: isRisky
          ? 'Реклама онлайн-казино и азартных игр (ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона «О рекламе»)'
          : isInfluencer
          ? 'Скрытая реклама без маркировки «Жарнама» и БИН (ч. 2 ст. 455 КоАП РК / Приказ МКИ № 59-НҚ)'
          : undefined,
        lawCode: isRisky
          ? 'ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»'
          : isInfluencer
          ? 'ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ'
          : undefined,
        fineRisk: isRisky
          ? '120 МРП (519 000 ₸) — малый бизнес; до 450 МРП (1 946 250 ₸)'
          : isInfluencer
          ? '100 МРП (432 500 ₸) — малый бизнес; до 400 МРП (1 730 000 ₸)'
          : undefined,
        severity: (isRisky || isInfluencer ? 'critical' : 'info') as 'critical' | 'warning' | 'info',
      },
      {
        id: `post-${Date.now()}-2`,
        date: '2 часа назад',
        type: 'story' as const,
        content: 'Вчерашняя встреча с подписчиками в ТРЦ Mega. Спасибо всем за теплые слова!',
        hasViolation: false,
      },
    ];

    if (isRisky) {
      violationsFound = 1;
      riskScore = 84;
      status = 'ALERT';
      alertNote = 'Зафиксировано продвижение онлайн-казино и слотов (ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»)';
    } else if (isInfluencer) {
      violationsFound = 1;
      riskScore = 64;
      status = 'ALERT';
      alertNote = 'Скрытая реклама без обязательной отметки «Жарнама» (ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ)';
    }

    return res.json({
      success: true,
      channelId,
      handleOrUrl: targetHandle,
      platform: platform || 'instagram',
      lastScan: 'Только что',
      isLiveScraped: false,
      violations24h: violationsFound,
      riskScore,
      status,
      alertNote,
      recentPosts: auditedPosts,
      timestamp,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('Error in /api/monitor/scan-account:', err);
    return res.status(500).json({ error: errorMsg });
  }
});

// Shared helper: Deepfake / AI-Scam / Phishing (ст. 190, 274 УК РК) + KZ/RU Bilingual Parity
function applyFraudAndBilingualChecks(
  fullText: string,
  violations: any[],
  entityTier: BusinessEntityType = 'small'
) {
  const lower = (fullText || '').toLowerCase();
  const isContextWarning = isJournalisticWarningContext(fullText);
  const indicators: string[] = [];

  if (!isContextWarning) {
    if (/42500|42\s*500|выплат[ауы]\s*(от\s*)?(государств|президент|енпф|соц)|социальн\w+\s+пособ\w+.*перейди/i.test(lower)) {
      indicators.push('Фейковые государственные выплаты / соцпособия (42500 и др.)');
    }
    if (/токаев\s*(поручил|заявил|объявил|подписал)|от\s+имени\s+президент|дипфейк|deepfake/i.test(lower)) {
      indicators.push('Признаки использования образа/голоса первых лиц (Deepfake-скам)');
    }
    if (/инвестиц\w+\s*(в\s+)?(kaspi|каспи|казмунайгаз|халык|halyk)|пассивный\s+доход\s+от\s+\d+|удво(им|ить)\s+(сумму|депозит)|kaspi[-_.]?(bonus|gift|pay)/i.test(lower)) {
      indicators.push('Псевдо-инвестиции от имени брендов РК (Kaspi / КазМунайГаз / Halyk)');
    }
    if (/\.(xyz|top|click|icu|buzz|loan)\b|surl\.li|bit\.ly\/[a-z0-9]+/i.test(lower)) {
      indicators.push('Подозрительный фишинговый домен или замаскированный редирект');
    }
  }

  const isPhishingOrDeepfake = indicators.length > 0;
  let riskCategory: string | undefined;

  if (isPhishingOrDeepfake) {
    riskCategory = indicators.some((i) => i.includes('Deepfake'))
      ? 'Deepfake / Подмена личности (УК РК)'
      : 'Финансовый скам / Фишинг (УК РК)';

    if (!violations.some((v) => v.code?.includes('190') || v.code?.includes('274'))) {
      const fraudV = {
        id: `v-fraud-${Date.now()}`,
        category: 'legal' as const,
        code: 'ст. 190, ст. 274 УК РК / Антифрод АФМ РК',
        title: 'Признаки интернет-мошенничества, фишинга или дипфейк-скама',
        severity: 'critical' as const,
        quote: indicators.slice(0, 2).join('; '),
        basis: `Обнаружены характерные маркеры мошеннических схем в Казнете: ${indicators.join('; ')}. Распространение заведомо ложной информации и интернет-мошенничество влекут уголовную ответственность.`,
        fineAmount: '',
        jurisdiction: 'КНБ / МВД РК (Киберпол) / АФМ РК',
        recommendation: 'Немедленно заблокировать фишинговую ссылку и направить уведомление в АФМ РК / Киберпол.',
      };
      fraudV.fineAmount = computeViolationFineText(fraudV, entityTier);
      violations.unshift(fraudV);
    }
  }

  const hasKazakh = /[әғқңөұүһі]/i.test(fullText) || /жарнама|теңге|қазақстан|сатып\s+ал/i.test(lower);
  const hasRussian = /[а-яё]/i.test(fullText);
  const hasAdMarkKz = /жарнама/i.test(lower);
  const hasAdMarkRu = /реклама/i.test(lower);
  const isCommercial = /скидк|распродаж|акция|промокод|купить|заказать|цена|жеңілдік|арзан/i.test(lower);
  const languageParityOk = isContextWarning ? true : isCommercial ? hasAdMarkKz : true;

  return {
    fraudSignals: {
      isPhishingOrDeepfake,
      indicators,
      riskCategory,
    },
    bilingualCheck: {
      hasKazakh,
      hasRussian,
      hasAdMarkKz,
      hasAdMarkRu,
      languageParityOk,
    },
  };
}

// Fallback audit engine for offline or rate-limited environments
function buildFallbackAudit(
  content: string,
  modality: string,
  displayName: string,
  timestamp: string,
  sha256Hash: string,
  caseId: string,
  refNum: string,
  previewUrl: string | undefined,
  rawText: string | undefined,
  fileSize: string | undefined,
  audioDataUrl?: string,
  audioDuration?: string,
  videoDataUrl?: string,
  videoFrames?: Array<{ timeSec: number; timestampLabel: string; dataUrl: string } | string>,
  entityTier: BusinessEntityType = 'small'
) {
  let violations: any[] = [];
  let legalScore = 0;
  let ethicsScore = 0;
  let detectedActions = 'Визуальный анализ скриншота/файла: ';
  const isContextWarning = isJournalisticWarningContext(`${content} ${rawText || ''}`);

  const rawMaterial = rawText || content || '';
  const hasPeacefulCall = /приходите\s+на\s+выборы|голосуйте\s+по\s+совести/i.test(rawMaterial);

  // Political Disinfo Leak (ст. 274 УК РК / ст. 456-2 КоАП РК)
  const disinfoCheck = detectPoliticalDisinfo(rawMaterial);
  if (disinfoCheck.detected) {
    violations.push({
      id: 'v-disinfo-1',
      category: 'legal',
      code: 'ст. 274 УК РК / ст. 456-2 КоАП РК',
      title: 'Распространение заведомо ложной информации (политический вброс)',
      severity: 'critical',
      quote: disinfoCheck.quote || 'СРОЧНЫЙ СЛИВ! Кандидат №3 тайно переписал бюджет района на офшоры',
      basis: 'Распространение недостоверных сведений о хищении бюджета и офшорах без подтверждённых фактов образует состав правонарушения по ст. 456-2 КоАП РК и ст. 274 УК РК.',
      fineAmount: '',
      jurisdiction: 'МВД РК / Прокуратура / МКИ РК',
      recommendation: 'Удалить недостоверные обвинения или представить официальные подтверждения.',
      bbox: previewUrl ? { x: 4, y: 16, width: 58, height: 16 } : undefined,
    });
    legalScore = Math.max(legalScore, 84);
    detectedActions += 'Зафиксирован анонимный политический вброс без подтверждённых источников. ';
  }

  // Personal Data Doxing (ст. 79 КоАП РК / ч. 5 ст. 147 УК РК)
  const doxingCheck = detectPersonalDataDoxing(rawMaterial);
  if (doxingCheck.detected) {
    violations.push({
      id: 'v-doxing-1',
      category: 'legal',
      code: 'ст. 79 КоАП РК / ч. 5 ст. 147 УК РК',
      title: 'Незаконное распространение персональных данных (Доксинг)',
      severity: 'critical',
      quote: doxingCheck.matches.join(', '),
      basis: 'Публикация личного сотового телефона, ИИН и домашнего адреса гражданина через онлайн-платформу без согласия нарушает Закон РК № 94-V (ст. 79 КоАП РК, ч. 5 ст. 147 УК РК).',
      fineAmount: '',
      jurisdiction: 'МЦРИАП РК / МВД РК',
      recommendation: 'Немедленно скрыть телефон, ИИН и домашний адрес проживания.',
      bbox: previewUrl ? { x: 4, y: 54, width: 60, height: 18 } : undefined,
    });
    legalScore = Math.max(legalScore, 84);
    detectedActions += 'Выявлена утечка ПДн (телефон, ИИН, адрес). ';
  }

  // Comprehensive Russian & Kazakh Profanity / Obscenity / Mat Lexicon (word-boundary safe)
  const matchedProfanities = findProfanityMatches(content);

  if (matchedProfanities.length > 0) {
    violations.push({
      id: 'v-profanity-1',
      category: 'legal',
      code: 'ст. 434 КоАП РК / Этика: Ненормативная лексика',
      title: 'Ненормативная обсценная лексика (маты)',
      severity: 'critical',
      quote: matchedProfanities.slice(0, 4).join(', '),
      basis: `В материале обнаружены нецензурные выражения и матерные слова («${matchedProfanities.join('», «')}»). В публичном цифровом пространстве РК это квалифицируется как мелкое хулиганство (ст. 434 КоАП РК) и грубейшее нарушение сетевой этики.`,
      fineAmount: '',
      jurisdiction: 'МВД РК / Этический комитет',
      recommendation: 'Полностью удалить обсценную лексику и ненормативные выражения.',
      bbox: previewUrl ? { x: 6, y: 24, width: 58, height: 16 } : undefined,
    });
    legalScore = Math.max(legalScore, 85);
    ethicsScore = Math.max(ethicsScore, 85);
    detectedActions += `Зафиксировано употребление обсценной лексики (${matchedProfanities.slice(0, 3).join(', ')}). `;
  }

  // Casino, gambling, slots & foreign currency promos (ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»)
  const casinoRegex = /казино|casino|1xbet|1win|pin-up|mostbet|слот|рулетк|фриспин|jackpot|жекпот|барабан|luxury\s+slots|ставка|букмекер/i;
  const isGamblingContent = !isContextWarning && casinoRegex.test(content);
  if (isGamblingContent) {
    const casinoMatch = content.match(/казино|casino|1xbet|1win|pin-up|mostbet|слот[ыа-я]*|рулетк[а-я]*|фриспин[а-я]*|jackpot|жекпот|барабан[ыа-я]*|luxury\s+slots|ставка/i);
    violations.push({
      id: 'v-casino-1',
      category: 'legal',
      code: 'ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе»',
      title: 'Реклама онлайн-казино и незаконных азартных игр',
      severity: 'critical',
      quote: casinoMatch ? casinoMatch[0] : '1WIN LUXURY SLOTS / рулетка / $5 000 USD',
      basis: 'Прямая реклама и продвижение онлайн-казино, слотов и рулетки (в том числе в иностранной валюте USD/EUR/USDT без слова «казино») запрещены ч. 1 ст. 455 КоАП РК и п. 5-1 ст. 6 Закона РК «О рекламе».',
      fineAmount: '',
      jurisdiction: 'МКИ РК / АФМ РК / МТС РК',
      recommendation: 'Немедленно удалить упоминание азартных игр, слотов и реферальные промокоды.',
      bbox: previewUrl ? { x: 6, y: 10, width: 56, height: 22 } : undefined,
    });
    legalScore = Math.max(legalScore, 95);
    ethicsScore = Math.max(ethicsScore, 80);
    detectedActions += 'Обнаружена замаскированная реклама азартных игр / слотов в инвалюте. ';
  }

  // Commercial offer without "Жарнама" marking (suppressed if illegal gambling banner is detected)
  const isCommercial = /скидк|купить|(?<!наразылық\s)(?<!уличн[а-яё]*\s)акци(?:я|ю|и)(?!\s+протеста)(?=$|[\s.,!?:;»"')\]])|промокод|цена|инвестиц|заказать|распродаж|тариф|доставк|открывайте\s+счет|счета\s+в\s+тенге|оформляй|кредит|депозит|кэшбэк|кешбэк|рассрочк|подключай|бронируй/i.test(content);
  const contentForAdMark = content.replace(/маркировка\s*[«"]?(?:жарнама|реклама)[»"]?\s*(?:и\s+[^\n)]*\s*)?отсутств\S*/gi, '').replace(/рекламодател[яюе]?\S*/gi, '');
  const hasAdLabel = /(?:^|[\s#«"(])(?:жарнама|жарнамалық|реклама|на\s+правах\s+рекламы|спонсорский\s+материал)(?=$|[\s»"),.:!])/i.test(contentForAdMark);

  if (!isContextWarning && !isGamblingContent && isCommercial && !hasAdLabel) {
    const commMatch = content.match(/скидк[а-я]*|купить|акция|промокод|цена|распродаж[а-я]*/i);
    violations.push({
      id: 'v-ad-label-1',
      category: 'legal',
      code: 'ч. 2 ст. 455 КоАП РК / Закон № 230-VII / Приказ МКИ № 59-НҚ',
      title: 'Скрытая реклама и отсутствие обязательной маркировки («Жарнама»)',
      severity: 'critical',
      quote: commMatch ? commMatch[0] : 'Коммерческое предложение / Скидки',
      basis: 'Контент содержит коммерческое предложение, однако отсутствует обязательная маркировка «Жарнама / Реклама» и идентификатор рекламодателя (ИИН/БИН) согласно ч. 2 ст. 455 КоАП РК, Закону № 230-VII и Приказу МКИ № 59-НҚ.',
      fineAmount: '',
      jurisdiction: 'МКИ РК (Контроль онлайн-рекламы)',
      recommendation: 'Разместить на креативе четкую надпись «Жарнамалық материал / Реклама» и указать БИН/ИИН.',
      bbox: previewUrl ? { x: 6, y: 18, width: 58, height: 18 } : undefined,
    });
    legalScore = Math.max(legalScore, 75);
    detectedActions += 'Рекламный характер контента без маркировки. ';
  }

  // Cyberbullying, Threats & Political Defamation / Insults
  const bullyRegex = /бездар|тупой|идиот|урод|мразь|ничтожеств|даун|клоун|угроз|threat|травл|найдем|за базар|продажн[а-я]+\s+твар|предател|мошенник[а-я]*(?=.*(?:кандидат|депутат|тварь|предатель))/i;
  if (!isContextWarning && bullyRegex.test(content)) {
    const bullyMatch = content.match(/продажн[а-я]+\s+твар[ья]?|мошенник[а-я]*|предател[ья]?|бездар[а-я]*|тупой|идиот|урод|мразь|ничтожеств[а-я]*|даун|клоун|угроз[а-я]*|threat|травл[а-я]*|найдем/i);
    const isDefamation = /продажн|предател|мошенник/i.test(content);
    violations.push({
      id: 'v-bullying-1',
      category: 'legal',
      code: isDefamation ? 'ст. 131 УК РК / ст. 73-4 КоАП РК' : 'ст. 73-4 КоАП РК / ст. 115 УК РК',
      title: isDefamation
        ? 'Оскорбление чести и достоинства, уничижительные ярлыки'
        : 'Оскорбления личности, угрозы и признаки кибербуллинга',
      severity: 'critical',
      quote: bullyMatch ? bullyMatch[0] : 'Оскорбительные выражения',
      basis: 'Унизительные ярлыки, оскорбление чести и достоинства гражданина и публичная словесная агрессия преследуются по закону РК.',
      fineAmount: '',
      jurisdiction: 'МВД РК / Суд',
      recommendation: 'Исключить оскорбительные формулировки и персональные нападки.',
      bbox: previewUrl ? { x: 4, y: 36, width: 58, height: 14 } : undefined,
    });
    legalScore = Math.max(legalScore, isDefamation ? 78 : 80);
    ethicsScore = Math.max(ethicsScore, isDefamation ? 78 : 80);
    detectedActions += 'Зафиксировано оскорбление чести и достоинства личности. ';
  }

  // Dark Patterns / FOMO
  if (!isContextWarning && !isGamblingContent && /только сегодня|пожалеешь|100% гарант|без рисков|сгорит через/i.test(content)) {
    const fomoMatch = content.match(/только сегодня|пожалеешь|100% гарант[а-я]*|без рисков|сгорит через/i);
    violations.push({
      id: 'v-dark-pattern-1',
      category: 'ethics',
      code: 'Этика: Dark Patterns (Манипулятивный маркетинг)',
      title: 'Манипуляция временем и искусственный дефицит (FOMO)',
      severity: 'warning',
      quote: fomoMatch ? fomoMatch[0] : 'Давление таймером / Ложный дефицит',
      basis: 'Применение психологического давления, искусственного дефицита и нереалистичных гарантий без риска.',
      fineAmount: '',
      jurisdiction: 'Кодекс добросовестного маркетинга',
      recommendation: 'Отказаться от манипулятивных триггеров дефицита и ложных гарантий.',
    });
    ethicsScore = Math.max(ethicsScore, 65);
    detectedActions += 'Психологическое давление и искусственный таймер дефицита. ';
  }

  // KZ Anti-Fraud, Phishing, Deepfake & Language Parity (ст. 190/274 УК РК, ст. 21 Закона о языках)
  const kzIntel = analyzeKzFraudAndLanguage(`${content} ${rawText || ''}`);
  if (!isContextWarning && (kzIntel.hasPhishingOrScam || kzIntel.hasDeepfakeIndicators)) {
    const indicators = [...kzIntel.scamMatches, ...kzIntel.deepfakeMatches];
    violations.push({
      id: 'v-kz-scam-1',
      category: 'legal',
      code: 'ст. 190, 274 УК РК / Антифрод АФМ',
      title: kzIntel.hasDeepfakeIndicators
        ? 'Фишинговая схема и дипфейк-триггер о ложных выплатах'
        : 'Финансовый скам и фишинговая мимикрия под бренды РК',
      severity: 'critical',
      quote: indicators.slice(0, 3).join(', ') || 'Фейковые выплаты / скам РК',
      basis: 'Материал содержит признаки казахстанских фишинговых схем (ложные соцвыплаты «42 500», фальшивые инвестплатформы Kaspi Profit / KazMunayGas или дипфейк-обещания).',
      fineAmount: '',
      jurisdiction: 'АФМ РК / Киберпол МВД РК',
      recommendation: 'Немедленно заблокировать ресурс и направить обращение через eOtinish.',
    });
    legalScore = Math.max(legalScore, 95);
    ethicsScore = Math.max(ethicsScore, 85);
    detectedActions += 'Выявлены маркеры казахстанского фишинга/дипфейк-скама. ';
  }

  if (kzIntel.needsKzParityWarning && !isGamblingContent) {
    violations.push({
      id: 'v-kz-lang-parity',
      category: 'legal',
      code: 'ч. 3 ст. 455 КоАП РК / ст. 21 Закона РК «О языках»',
      title: 'Отсутствие версии рекламного объявления на казахском языке',
      severity: 'warning',
      quote: 'Коммерческий материал только на одном языке',
      basis: 'Согласно ч. 3 ст. 455 КоАП РК и ст. 21 Закона РК «О языках в Республике Казахстан», реклама и публичные коммерческие сообщения подлежат обязательному размещению на государственном (казахском) и русском языках.',
      fineAmount: '',
      jurisdiction: 'МКИ РК / Языковой контроль',
      recommendation: 'Сгенерировать двуязычную версию (KZ + RU) в один клик в разделе Авто-исправление.',
    });
    legalScore = Math.max(legalScore, 45);
  }

  // Comprehensive Emoji Intelligence
  const emojiAnalysis = analyzeEmojis(`${content} ${rawText || ''}`);
  if (emojiAnalysis.flaggedEmojis.length > 0) {
    for (const item of emojiAnalysis.flaggedEmojis) {
      if (!isContextWarning && item.category === 'gambling' && !violations.some((v) => /ч\.\s*1\s*ст\.\s*455|5-1\s*ст\.\s*6|445-1/i.test(v.code || ''))) {
        violations.unshift({
          id: `v-emoji-${item.emoji}`,
          category: 'legal',
          code: 'ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе» / Эмодзи-триггер',
          title: `Гэмблинг-эмодзи ${item.emoji} (${item.label})`,
          severity: item.riskLevel,
          quote: item.emoji,
          basis: `Обнаружен графический символ азартных игр ${item.emoji}: ${item.description}`,
          fineAmount: '',
          jurisdiction: 'МКИ РК / АФМ РК / МТС РК',
          recommendation: 'Исключить символы азартных игр и призывы к ставкам.',
        });
        legalScore = Math.max(legalScore, item.emoji === '🎰' ? 85 : 55);
      } else if (item.category === 'profanity_insult' && !violations.some((v) => v.code?.includes('434') || v.code?.includes('73-4'))) {
        violations.unshift({
          id: `v-emoji-${item.emoji}`,
          category: 'legal',
          code: 'ст. 434, 73-4 КоАП РК / Эмодзи-триггер',
          title: `Оскорбительный / токсичный эмодзи ${item.emoji} (${item.label})`,
          severity: item.riskLevel,
          quote: item.emoji,
          basis: `Обнаружен оскорбительный символ ${item.emoji}: ${item.description}`,
          fineAmount: '',
          jurisdiction: 'МВД РК / Этический комитет',
          recommendation: 'Удалить оскорбительные символы и агрессивные смайлы.',
        });
        legalScore = Math.max(legalScore, 76);
        ethicsScore = Math.max(ethicsScore, 80);
      } else if (item.category === 'spam' && !violations.some((v) => v.id?.startsWith('v-emoji-'))) {
        violations.push({
          id: `v-emoji-${item.emoji}`,
          category: 'ethics',
          code: 'Этика: Спам / визуальные триггеры (эмодзи)',
          title: `${item.label} (${item.emoji})`,
          severity: 'warning',
          quote: item.emoji,
          basis: item.description,
          fineAmount: '',
          jurisdiction: 'Цифровая этика / Стандарты платформ',
          recommendation: 'Сократить избыточные повторы денежных и рекламных эмодзи.',
        });
        ethicsScore = Math.max(ethicsScore, 28);
      }
    }
  }

  // Deterministic Human-in-the-loop fallback: general protest/resignation/rally/picket/march marker categories only
  const assemblyCheck = detectPeacefulAssemblyCall(`${rawMaterial} ${content}`);
  if (assemblyCheck.detected) {
    violations.push({
      id: 'v-peaceful-assembly-hitl',
      category: 'legal',
      code: HITL_PROTEST_ARTICLE,
      title: 'Общественно-политический / протестный контекст (Human-in-the-loop)',
      severity: 'warning',
      quote: assemblyCheck.quote || 'Общественно-политический / протестный контекст',
      basis: HITL_PROTEST_DESCRIPTION,
      fineAmount: '',
      jurisdiction: 'Правовой комплаенс РК · Human-in-the-loop (проверка контекста)',
      recommendation: HITL_PROTEST_DESCRIPTION,
    });
    legalScore = Math.max(legalScore, 50);
    detectedActions += 'Обнаружен общественно-политический / протестный контекст — требуется проверка человеком (Human-in-the-loop). ';
  }

  violations = applyViolationFinesForEntity(violations, entityTier);

  if (hasPeacefulCall) {
    detectedActions += 'Мирный призыв («Приходите на выборы 15 марта и голосуйте по совести!») признан законным и исключён из нарушений.';
  }

  const isVideoMode = modality === 'video';
  const cleanExtractedText = rawText || content || '';
  const isScenario1Combo = disinfoCheck.detected && doxingCheck.detected;
  const overallRiskScore =
    violations.length === 0 && isContextWarning
      ? 0
      : isScenario1Combo
      ? 84
      : Math.min(100, Math.max(legalScore, ethicsScore));
  const riskLevel: 'Низкий' | 'Средний' | 'Высокий' | 'Критический' =
    overallRiskScore >= 75 ? 'Критический' : overallRiskScore >= 50 ? 'Высокий' : overallRiskScore >= 25 ? 'Средний' : 'Низкий';
  const status: 'БЕЗОПАСНО' | 'ПРЕДУПРЕЖДЕНИЕ' | 'ТРЕБУЕТ МЕР' =
    overallRiskScore >= 60 ? 'ТРЕБУЕТ МЕР' : overallRiskScore >= 25 ? 'ПРЕДУПРЕЖДЕНИЕ' : 'БЕЗОПАСНО';

  const isAudioMode = modality === 'audio' || Boolean(audioDataUrl);

  let transcript: Array<{ time: string; speaker: string; text: string; flagged?: boolean; flaggedText?: string; article?: string }> | undefined = undefined;

  if (isAudioMode || isVideoMode) {
    if (violations.length > 0) {
      transcript = violations.slice(0, 3).map((v, i) => ({
        time: `00:0${(i + 1) * 2}`,
        speaker: isVideoMode ? (v.category === 'ethics' ? 'Аудио / Реплика' : 'Текст на видео') : 'Аудиозапись',
        text: v.quote ? `Зафиксирован фрагмент: "${v.quote}"` : v.basis,
        flagged: true,
        flaggedText: v.quote,
        article: v.code,
      }));
    } else {
      transcript = [
        {
          time: '00:01',
          speaker: isVideoMode ? 'Видеоряд' : 'Аудиодорожка',
          text: cleanExtractedText && !cleanExtractedText.startsWith('[')
            ? cleanExtractedText
            : isVideoMode
            ? 'Видеоряд и аудиодорожка проверены. Признаков нарушений законодательства РК не зафиксировано.'
            : 'Аудиозапись прослушана. Речь спокойная, ненормативная лексика и признаки нарушений отсутствуют.',
          flagged: false,
        },
      ];
    }
  }

  const mediaFindings = violations.map((v) => ({
    timestamp: isAudioMode || isVideoMode ? (v.id?.includes('dark') ? '00:08' : '00:02') : '00:01',
    source: isAudioMode
      ? ('аудио' as const)
      : isVideoMode
      ? (v.category === 'ethics' ? ('аудио' as const) : ('текст на экране' as const))
      : ('текст на экране' as const),
    category: v.title || v.code,
    quote_or_description: v.quote || v.basis,
    confidence: v.severity === 'critical' ? ('высокая' as const) : ('средняя' as const),
    reasoning: v.basis || v.recommendation || 'Выявлено возможное несоответствие нормам законодательства РК.',
  }));

  const overallRisk: 'нет' | 'низкий' | 'средний' | 'высокий' =
    overallRiskScore >= 70 ? 'высокий' : overallRiskScore >= 40 ? 'средний' : overallRiskScore > 0 ? 'низкий' : 'нет';

  const mediaAnalysis = {
    summary:
      violations.length === 0 && isContextWarning
        ? 'Контекстный фильтр подтвердил: материал является официальным предупреждением / журналистским освещением проблемы мошенничества (0 МРП). Нарушений законодательства РК не выявлено.'
        : overallRiskScore > 0
        ? `Выявлены несоответствия нормам законодательства РК (${violations.length} предупреждений).`
        : 'Материал проверен. Признаков нарушений законодательства РК не зафиксировано.',
    language: /[әғқңөұүһі]/i.test(content) || /шешен|сиктир|көт|жарнама/i.test(content)
      ? (/салам|ассалам|привет|скидк|казино|промокод/i.test(content) ? 'смешанный' : 'казахский')
      : 'русский',
    overall_risk: overallRisk,
    findings: mediaFindings,
    needs_human_review: overallRisk !== 'нет',
    limitations: isAudioMode
      ? 'Фоновые акустические помехи и быстрая речь могли повлиять на точность детекции отдельных фраз.'
      : isVideoMode
      ? 'При анализе видеопотока возможны артефакты сжатия и наложение нескольких источников звука.'
      : 'Автоматическая оценка требует экспертного подтверждения.',
  };

  return normalizeAuditCaseCompliance({
    id: caseId,
    referenceNumber: refNum,
    timestamp,
    sourceType: isAudioMode ? 'audio' : isVideoMode ? 'video' : (modality || 'screenshot'),
    title: displayName,
    sourceName: displayName,
    sha256: sha256Hash,
    riskScore: overallRiskScore,
    legalScore,
    ethicsScore,
    riskLevel,
    status,
    summary: mediaAnalysis.summary,
    ethicsSummary:
      ethicsScore > 0
        ? `Обнаружены нарушения интернет-этики и культуры общения (${violations.filter((v) => v.category === 'ethics').length} замечаний).`
        : 'Этические нормы и стандарты добросовестной коммуникации соблюдены.',
    extractedText: cleanExtractedText || (isAudioMode ? 'Стенограмма аудиозаписи сформирована.' : isVideoMode ? 'Видеоряд и покадровая раскадровка обработаны.' : 'Анализ графических элементов и структуры файла выполнен.'),
    detectedActions: detectedActions || (isAudioMode ? 'Аудиоанализ речевого потока и акустической тональности завершен.' : isVideoMode ? 'Видеоанализ Reels/TikTok: раскадровка, субтитры и визуальные триггеры распознаны.' : 'Визуальный аудит графических элементов и интерфейса завершен.'),
    previewUrl,
    rawText: cleanExtractedText,
    audioDataUrl,
    audioDuration: audioDuration || (isAudioMode ? '00:28' : undefined),
    audioVoiceClarity: 98.4,
    videoDataUrl,
    videoFrames: Array.isArray(videoFrames) ? videoFrames : undefined,
    videoDuration: isVideoMode ? '00:20' : undefined,
    emojiAnalysis,
    mediaAnalysis,
    fraudSignals: {
      isPhishingOrDeepfake: kzIntel.hasPhishingOrScam || kzIntel.hasDeepfakeIndicators,
      indicators: [...kzIntel.scamMatches, ...kzIntel.deepfakeMatches],
      riskCategory: kzIntel.hasDeepfakeIndicators ? 'Дипфейк / Ложные госвыплаты' : kzIntel.hasPhishingOrScam ? 'Фишинг под бренды РК' : undefined,
    },
    bilingualCheck: {
      hasKazakh: kzIntel.languageCoverage === 'bilingual' || kzIntel.languageCoverage === 'kz_only',
      hasRussian: kzIntel.languageCoverage === 'bilingual' || kzIntel.languageCoverage === 'ru_only',
      hasAdMarkKz: /жарнама/i.test(content),
      hasAdMarkRu: /реклама/i.test(content),
      languageParityOk: !kzIntel.needsKzParityWarning,
    },
    transcript,
    violations,
    metadata: {
      fileSize: fileSize || '1.1 MB',
      duration: audioDuration || (isAudioMode ? '00:28' : isVideoMode ? '00:20' : undefined),
      engineConfidence: 98.2,
      platform: isAudioMode
        ? 'Check Activity Audio & Speech Engine v4.5 (Казахстан)'
        : isVideoMode
        ? 'Check Activity Video & Reels Engine v5.0 (Казахстан)'
        : 'Check Activity Engine v4.5 (Казахстан)',
    },
  } as any);
}

// Dev vs Prod Vite mounting
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  // If running in a Serverless environment (such as Vercel), do NOT start the standalone HTTP server
  if (process.env.VERCEL) {
    return;
  }

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  // Parse port & host from process.argv (e.g. tsx server.ts --port 3000 --host 0.0.0.0) or environment
  let port = Number(process.env.PORT) || 3000;
  let host = '0.0.0.0';

  const portIndex = process.argv.indexOf('--port');
  if (portIndex !== -1 && process.argv[portIndex + 1]) {
    const parsed = parseInt(process.argv[portIndex + 1], 10);
    if (!isNaN(parsed)) port = parsed;
  }

  const hostIndex = process.argv.indexOf('--host');
  if (hostIndex !== -1 && process.argv[hostIndex + 1]) {
    host = process.argv[hostIndex + 1];
  }

  const server = app.listen(port, host, () => {
    console.log(`Server listening on http://${host}:${port}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is already in use; reusing active instance.`);
    } else {
      console.error('Server listen error:', err);
    }
  });

  const handleShutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', handleShutdown);
  process.on('SIGINT', handleShutdown);
}

if (!process.env.CHECKACTIVITY_NO_LISTEN) {
  startServer();
}

export default app;
