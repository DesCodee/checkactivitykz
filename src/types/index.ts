/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModalityType = 'url' | 'screenshot' | 'photo' | 'audio';

export type ViolationSeverity = 'critical' | 'warning' | 'info';

export interface Violation {
  id: string;
  code: string; // e.g. "ст. 455 КоАП РК"
  title: string;
  severity: ViolationSeverity;
  basis: string; // Фактическое основание
  fineAmount: string; // e.g. "от 50 до 200 МРП (196 600 — 786 400 ₸)"
  jurisdiction: string; // e.g. "МКИ РК"
  recommendation?: string;
  quote?: string;
  timecode?: string;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface AuditCase {
  id: string;
  referenceNumber: string;
  timestamp: string;
  sourceType: ModalityType;
  title: string;
  sourceName: string;
  sha256: string;
  riskScore: number; // 0-100
  riskLevel: 'Низкий' | 'Средний' | 'Высокий' | 'Критический';
  status: 'БЕЗОПАСНО' | 'ПРЕДУПРЕЖДЕНИЕ' | 'ТРЕБУЕТ МЕР' | 'БЛОКИРОВКА';
  violations: Violation[];
  previewUrl?: string;
  rawText?: string;
  metadata: {
    resolution?: string;
    duration?: string;
    fileSize?: string;
    engineConfidence: number;
    platform?: string;
  };
  transcript?: {
    time: string;
    text: string;
    flagged?: boolean;
    flaggedText?: string;
    article?: string;
  }[];
}

export interface MonitoringChannel {
  id: string;
  name: string;
  platform: 'telegram' | 'instagram' | 'tiktok' | 'web' | 'marketplace';
  platformLabel: string;
  handleOrUrl: string;
  subscribersOrVolume: string;
  frequency: string;
  lastScan: string;
  violations24h: number;
  status: 'LIVE' | 'PAUSED' | 'ALERT';
  alertNote?: string;
}

export interface LegalFilter {
  id: string;
  name: string;
  article: string;
  description: string;
  active: boolean;
  category: 'advertising' | 'criminal' | 'privacy' | 'ethics' | 'gambling' | 'language';
}
