/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModalityType = 'url' | 'screenshot' | 'photo' | 'audio';

export type ViolationSeverity = 'critical' | 'warning' | 'info';

export type ComplianceCategory = 'legal' | 'ethics';

export interface Violation {
  id: string;
  category: ComplianceCategory; // 'legal' (Закон РК) or 'ethics' (Интернет-этика)
  code: string; // e.g. "ст. 455 КоАП РК" or "Этика: Манипуляция (Dark Pattern)"
  title: string;
  severity: ViolationSeverity;
  basis: string; // Фактическое объяснение
  fineAmount?: string; // Штраф (для правовых нарушений) или репутационная санкция
  jurisdiction?: string; // МКИ РК, АФМ, либо "Медиа-этика / Кодекс контент-сообщества"
  recommendation?: string; // Конкретная инструкция по исправлению
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
  riskScore: number; // Общий индекс риска 0-100
  riskLevel: 'Низкий' | 'Средний' | 'Высокий' | 'Критический';
  legalScore?: number; // 0-100 (индекс правового риска)
  ethicsScore?: number; // 0-100 (индекс этического риска / токсичности)
  status: 'БЕЗОПАСНО' | 'ПРЕДУПРЕЖДЕНИЕ' | 'ТРЕБУЕТ МЕР' | 'БЛОКИРОВКА';
  summary?: string;
  ethicsSummary?: string;
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
  category: 'advertising' | 'criminal' | 'privacy' | 'ethics' | 'gambling' | 'language' | 'cyberbullying' | 'manipulation';
  type: ComplianceCategory; // 'legal' or 'ethics'
}
