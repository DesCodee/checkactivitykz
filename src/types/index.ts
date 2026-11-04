/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ModalityType = 'url' | 'screenshot' | 'photo' | 'audio' | 'video' | 'text';

export type ViolationSeverity = 'critical' | 'warning' | 'info';

export type ComplianceCategory = 'legal' | 'ethics';

export interface EmojiItem {
  emoji: string;
  category: 'gambling' | 'profanity_insult' | 'dark_pattern' | 'sexual' | 'spam' | 'neutral';
  label: string;
  description: string;
  riskLevel: 'critical' | 'warning' | 'info';
}

export interface EmojiAnalysis {
  detectedEmojis: string[];
  flaggedEmojis: EmojiItem[];
  summary: string;
  totalRiskPoints: number;
}

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

export interface MediaFinding {
  timestamp: string; // Формат "ММ:СС"
  source: 'аудио' | 'изображение' | 'текст на экране';
  category: string;
  quote_or_description: string;
  confidence: 'низкая' | 'средняя' | 'высокая';
  reasoning: string;
}

export interface MediaAnalysisResult {
  summary: string;
  language: string; // "русский" | "казахский" | "смешанный"
  overall_risk: 'нет' | 'низкий' | 'средний' | 'высокий';
  findings: MediaFinding[];
  needs_human_review: boolean;
  limitations: string;
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
  extractedText?: string; // Текст, извлеченный с помощью OCR или парсинга страницы
  detectedActions?: string; // Описание распознанных визуальных действий и объектов
  metadata: {
    resolution?: string;
    duration?: string;
    fileSize?: string;
    engineConfidence: number;
    platform?: string;
  };
  transcript?: {
    time: string;
    speaker?: string;
    text: string;
    flagged?: boolean;
    flaggedText?: string;
    article?: string;
  }[];
  audioDataUrl?: string;
  audioDuration?: string;
  audioVoiceClarity?: number;
  videoFrames?: string[];
  videoUrl?: string;
  videoDataUrl?: string;
  videoDuration?: string;
  emojiAnalysis?: EmojiAnalysis;
  mediaAnalysis?: MediaAnalysisResult;
}

export interface MonitoredPost {
  id: string;
  date: string;
  type: 'post' | 'story' | 'reels' | 'comment' | 'audio_story';
  content: string;
  hasViolation: boolean;
  violationTitle?: string;
  lawCode?: string;
  fineRisk?: string;
  severity?: ViolationSeverity;
  mediaSnippetUrl?: string;
}

export interface MonitoringChannel {
  id: string;
  name: string;
  platform: 'telegram' | 'instagram' | 'tiktok' | 'web' | 'marketplace' | 'youtube';
  platformLabel: string;
  handleOrUrl: string;
  subscribersOrVolume: string;
  frequency: string;
  lastScan: string;
  violations24h: number;
  status: 'LIVE' | 'PAUSED' | 'ALERT';
  alertNote?: string;
  riskScore?: number;
  category?: string;
  recentPosts?: MonitoredPost[];
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
