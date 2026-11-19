/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AuditCase, ModalityType } from '../types';
import {
  ALL_COMPLIANCE_FILTERS,
} from '../data/mockData';
import {
  analyzeContentWithGemini,
  ContentPayload,
  extractTextWithOcr,
} from '../services/geminiService';
import {
  generateSampleScreenshot,
  getSampleText,
  SampleCaseType,
} from '../utils/sampleScreenshots';
import { analyzeEmojis, EMOJI_DICTIONARY } from '../utils/emojiIntelligence';
import { useApp } from '../utils/i18n';
import {
  parseUploadedFileUniversal,
  ParsedFileResult,
  extractVideoPreview,
  extractVideoAudioAsWavDataUrl,
  extractOcrAcrossFrames,
  VIDEO_SAMPLE_PERCENTAGES,
  MAX_INLINE_MEDIA_BYTES,
  MAX_SERVER_PAYLOAD_BYTES,
} from '../utils/fileParser';
import { runLivePreCheck } from '../utils/kzComplianceIntelligence';
import {
  computeFileSha256,
  computeSha256FromBuffer,
  dataUrlToUint8Array,
} from '../utils/cryptoHash';
import { copyTextToClipboard } from '../utils/clipboard';
import {
  FileUp,
  Video,
  Mic,
  Link2,
  FileText,
  Zap,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  X,
  AlertCircle,
  Play,
  Pause,
  Square,
  ShieldCheck,
  Loader2,
  ScanText,
  Sparkles,
  CheckCircle2,
  Circle,
  ChevronDown,
  SlidersHorizontal,
  ArrowRight,
  Lock,
} from 'lucide-react';

interface ScannerViewProps {
  onRunAudit: (auditCase: AuditCase) => void;
  presetData?: { modality: ModalityType; urlOrText: string };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}



export const ScannerView: React.FC<ScannerViewProps> = ({ onRunAudit, presetData }) => {
  const { t, language } = useApp();
  const [activeTab, setActiveTab] = useState<'file' | 'url' | 'text' | 'media'>(
    presetData?.modality === 'video' || presetData?.modality === 'audio'
      ? 'media'
      : presetData?.modality === 'url'
      ? 'url'
      : presetData?.modality === 'text'
      ? 'text'
      : 'file'
  );
  const [mediaSubMode, setMediaSubMode] = useState<'video' | 'audio'>(
    presetData?.modality === 'audio' ? 'audio' : 'video'
  );

  // Input states
  const [urlInput, setUrlInput] = useState(
    presetData?.modality === 'url' ? presetData?.urlOrText || '' : ''
  );
  const [textInput, setTextInput] = useState(
    presetData?.modality === 'text' ? presetData?.urlOrText || '' : ''
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileTextNote, setFileTextNote] = useState('');
  const [fileSha256, setFileSha256] = useState<string | null>(null);

  // Video & Reels states
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [videoPlayableUrl, setVideoPlayableUrl] = useState<string | null>(null);
  const [videoMediaBase64, setVideoMediaBase64] = useState<string | null>(null);
  const [videoAudioDataUrl, setVideoAudioDataUrl] = useState<string | null>(null);
  const [videoCaption, setVideoCaption] = useState<string>('');
  const [videoFrameOcrText, setVideoFrameOcrText] = useState<string>('');
  const [videoDuration, setVideoDuration] = useState<string>('00:00');
  const [videoFileSha256, setVideoFileSha256] = useState<string | null>(null);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [videoPrepStage, setVideoPrepStage] = useState<'idle' | 'extracting_media' | 'ocr_frames' | 'ready'>('idle');
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Audio & Microphone states
  const [audioMode, setAudioMode] = useState<'record' | 'upload'>('record');
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [audioMediaBase64, setAudioMediaBase64] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<string>('00:00');
  const [audioFileSha256, setAudioFileSha256] = useState<string | null>(null);
  const [audioTranscriptPreview, setAudioTranscriptPreview] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Global upload alert, universal file parsing, and collapsed advanced options
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [parsedFileInfo, setParsedFileInfo] = useState<ParsedFileResult | null>(null);
  const [autoAuditOnUpload, setAutoAuditOnUpload] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const recordingSecondsRef = useRef<number>(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // OCR Recognition states
  const [ocrText, setOcrText] = useState('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const [ocrCharCount, setOcrCharCount] = useState(0);
  const [copiedOcr, setCopiedOcr] = useState(false);

  // Loading & URL fallback states
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [processingStepIndex, setProcessingStepIndex] = useState<1 | 2 | 3 | 4>(1);
  const [processingModality, setProcessingModality] = useState<ModalityType | null>(null);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [restrictedUrlNotice, setRestrictedUrlNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeOcrPromiseRef = useRef<Promise<any> | null>(null);
  const activeVideoOcrPromiseRef = useRef<Promise<{ text: string; warningNotice?: string } | null> | null>(null);
  const lastPayloadRef = useRef<ContentPayload | null>(null);
  const textInputDirtyRef = useRef<boolean>(Boolean(presetData?.modality === 'text' && presetData?.urlOrText));

  // Lifecycle, blob URL tracking & async race-condition guards
  const isMountedRef = useRef<boolean>(true);
  const activeFileBlobUrlRef = useRef<string | null>(null);
  const activeAudioBlobUrlRef = useRef<string | null>(null);
  const activeVideoBlobUrlRef = useRef<string | null>(null);
  const handedOffBlobUrlsRef = useRef<Set<string>>(new Set());
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileOpIdRef = useRef<number>(0);
  const audioOpIdRef = useRef<number>(0);
  const videoOpIdRef = useRef<number>(0);
  const ocrOpIdRef = useRef<number>(0);
  const auditOpIdRef = useRef<number>(0);
  const autoAuditTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyOcrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const slowNetworkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleFileSelectRef = useRef<(file: File) => void>(() => {});

  const revokeIfNotHandedOff = (url: string | null | undefined) => {
    if (url && url.startsWith('blob:') && !handedOffBlobUrlsRef.current.has(url)) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore revoke errors
      }
    }
  };

  const clearProgressTimers = () => {
    for (const timer of progressTimersRef.current) {
      clearTimeout(timer);
    }
    progressTimersRef.current = [];
    if (slowNetworkTimerRef.current) {
      clearTimeout(slowNetworkTimerRef.current);
      slowNetworkTimerRef.current = null;
    }
    setIsSlowNetwork(false);
  };

  const applyExtractedTextToInputs = (rawText: string) => {
    const clean = (rawText || '').replace(/\[текст на изображении не обнаружен\]/gi, '').trim();
    if (!clean) return;
    const isPlaceholder = /^\[(?:Графический объект|Материал|Скриншот|Документ PDF|Документ Word|Видеоматериал|Аудиозапись)/i.test(clean);
    setOcrText(clean);
    setOcrCharCount(clean.length);
    if (!isPlaceholder && !textInputDirtyRef.current) {
      setTextInput(clean);
    }
  };

  // Sync presetData when triggered from search modal (⌘K) or shortcuts
  useEffect(() => {
    if (!presetData) return;
    if (presetData.modality === 'video' || presetData.modality === 'audio') {
      setActiveTab('media');
      setMediaSubMode(presetData.modality);
    } else if (presetData.modality === 'url' || /^https?:\/\//i.test(presetData.urlOrText || '')) {
      setActiveTab('url');
      if (presetData.urlOrText) {
        setUrlInput(presetData.urlOrText);
      }
    } else if (presetData.modality === 'text') {
      setActiveTab('text');
      if (presetData.urlOrText) {
        setTextInput(presetData.urlOrText);
      }
    } else {
      setActiveTab('file');
    }
  }, [presetData]);

  // Clean up audio recorder, media tracks, timers, and unused blob URLs on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (autoAuditTimerRef.current) clearTimeout(autoAuditTimerRef.current);
      if (copyOcrTimerRef.current) clearTimeout(copyOcrTimerRef.current);
      clearProgressTimers();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      revokeIfNotHandedOff(activeFileBlobUrlRef.current);
      revokeIfNotHandedOff(activeAudioBlobUrlRef.current);
      revokeIfNotHandedOff(activeVideoBlobUrlRef.current);
    };
  }, []);

  // Audio handlers
  const handleStartRecording = async () => {
    setUploadError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setUploadError(
          language === 'kz'
            ? 'Браузер микрофонға қол жеткізуді қолдамайды. Аудиофайлды жүктеңіз.'
            : 'Ваш браузер не поддерживает доступ к микрофону. Вы можете загрузить готовый аудиофайл.'
        );
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isMountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (mediaStreamRef.current === stream) {
          mediaStreamRef.current = null;
        }
        if (!isMountedRef.current) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioBlob
          .arrayBuffer()
          .then(computeSha256FromBuffer)
          .then((hash) => {
            if (isMountedRef.current) setAudioFileSha256(hash);
          })
          .catch(() => {});
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (!isMountedRef.current) return;
          const dataUrl = ev.target?.result as string;
          revokeIfNotHandedOff(activeAudioBlobUrlRef.current);
          activeAudioBlobUrlRef.current = null;
          setAudioDataUrl(dataUrl);
          setAudioMediaBase64(dataUrl);
          setAudioFileName(`voice_record_${Date.now()}.webm`);
          const totalSecs = recordingSecondsRef.current || 1;
          const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
          const secs = (totalSecs % 60).toString().padStart(2, '0');
          setAudioDuration(`${mins}:${secs}`);
          setAudioTranscriptPreview(
            language === 'kz'
              ? 'Құрылғы микрофонынан дауыстық жазба алынды. Сөзді транскрибациялау және ҚР нормалары бойынша тексеру үшін «Аудитті бастау» батырмасын басыңыз.'
              : 'Голосовая аудиозапись зафиксирована с микрофона устройства. Нажмите «Запустить аудит» для транскрибации речи и проверки на нормы РК.'
          );
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start(250);
      setIsRecording(true);
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
        if (recordingSecondsRef.current >= 60) {
          handleStopRecording();
        }
      }, 1000);
    } catch (err) {
      console.warn('Microphone error:', err);
      if (isMountedRef.current) {
        setUploadError(
          language === 'kz'
            ? 'Микрофон қолжетімсіз. Аудиофайлды құрылғыдан жүктей аласыз.'
            : 'Микрофон недоступен. Вы можете переключиться на загрузку аудиофайла с устройства.'
        );
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const handleAudioFileSelect = async (file: File) => {
    setUploadError(null);
    setAuditError(null);
    if (file.size === 0) {
      setUploadError(
        language === 'kz'
          ? 'Таңдалған аудиофайл бос (0 байт). Жарамды аудиофайлды таңдаңыз.'
          : 'Выбранный аудиофайл пуст (0 байт). Загрузите корректную аудиозапись.'
      );
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setUploadError(
        language === 'kz'
          ? 'Аудиофайл тым үлкен (> 100 МБ). Жылдам өңдеу үшін қысқарақ үзіндіні (50 МБ дейін) жүктеңіз.'
          : 'Аудиофайл слишком большой (> 100 МБ). Пожалуйста, загрузите фрагмент короче (рекомендуется до 5–10 минут или до 50 МБ) для быстрой обработки.'
      );
      return;
    }

    const opId = ++audioOpIdRef.current;
    const canInlineMedia = file.size <= MAX_INLINE_MEDIA_BYTES;
    const [inlineDataUrl, computedHash] = await Promise.all([
      canInlineMedia ? readFileAsBase64(file) : Promise.resolve(null),
      computeFileSha256(file).catch(() => null),
    ]);
    if (!isMountedRef.current || opId !== audioOpIdRef.current) return;

    revokeIfNotHandedOff(activeAudioBlobUrlRef.current);
    const playbackUrl = inlineDataUrl || URL.createObjectURL(file);
    activeAudioBlobUrlRef.current = playbackUrl.startsWith('blob:') ? playbackUrl : null;
    setAudioDataUrl(playbackUrl);
    setAudioMediaBase64(inlineDataUrl);
    setAudioFileName(file.name);
    setAudioDuration('00:30');
    setAudioFileSha256(computedHash);
    setAudioTranscriptPreview(
      language === 'kz'
        ? 'Аудиожазба жүктелді. Таймкодтармен (ММ:СС) транскрибацияға және комплаенс-тексеруге дайын.'
        : 'Аудиозапись загружена. Готова к транскрипции с таймкодами (ММ:СС) и комплаенс-проверке.'
    );
  };

  const handleVideoFileSelect = async (file: File) => {
    setUploadError(null);
    setAuditError(null);
    setVideoFrameOcrText('');
    setVideoAudioDataUrl(null);
    if (file.size === 0) {
      setUploadError(
        language === 'kz'
          ? 'Таңдалған бейнефайл бос (0 байт). Жарамды MP4/MOV файлын жүктеңіз.'
          : 'Выбранный видеофайл пуст (0 байт). Пожалуйста, выберите корректный видеофайл.'
      );
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setUploadError(
        language === 'kz'
          ? 'Бейнефайл тым үлкен (> 100 МБ). Жылдам және дәл өңдеу үшін қысқарақ үзіндіні (50 МБ дейін) жүктеңіз.'
          : 'Файл видео слишком большой (> 100 МБ). Пожалуйста, загрузите фрагмент короче (рекомендуется до 1–2 минут или до 50 МБ) для быстрой и точной обработки.'
      );
      return;
    }

    const opId = ++videoOpIdRef.current;
    revokeIfNotHandedOff(activeVideoBlobUrlRef.current);
    activeVideoBlobUrlRef.current = null;

    setVideoFile(file);
    setVideoCaption(file.name);
    setIsExtractingFrames(true);
    setVideoPrepStage('extracting_media');

    const canInlineMedia = file.size <= MAX_INLINE_MEDIA_BYTES;

    // Parallel execution: extract 5 keyframes (8s timeout), extract 16kHz mono WAV audio, optionally read base64 (<= 50 MB), and compute SHA-256
    const [framesResult, extractedAudioWav, b64, computedHash] = await Promise.all([
      extractVideoPreview(file, { keepPlayableUrl: true }),
      extractVideoAudioAsWavDataUrl(file, 90),
      canInlineMedia ? readFileAsBase64(file) : Promise.resolve(null),
      computeFileSha256(file).catch(() => null),
    ]);

    if (!isMountedRef.current || opId !== videoOpIdRef.current) {
      if (framesResult.playableUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(framesResult.playableUrl);
      }
      return;
    }

    setIsExtractingFrames(false);
    const { videoFrames: frames, durationStr: durationLabel, playableUrl } = framesResult;

    if (frames.length > 0) {
      setVideoFrames(frames);
      setFilePreviewUrl(frames[0]);
      setVideoPrepStage('ocr_frames');
      // Recognize visible text across ALL extracted keyframes so captions/ads in middle or end frames are never missed
      const ocrPromise = extractOcrAcrossFrames(frames, file.name, extractTextWithOcr)
        .then((ocrRes) => {
          if (!isMountedRef.current || opId !== videoOpIdRef.current) return null;
          if (ocrRes.text) {
            setVideoFrameOcrText(ocrRes.text);
          }
          if (ocrRes.warningNotice) {
            setOcrWarning(ocrRes.warningNotice);
          }
          return ocrRes;
        })
        .catch(() => null)
        .finally(() => {
          if (opId === videoOpIdRef.current) {
            activeVideoOcrPromiseRef.current = null;
            if (isMountedRef.current) {
              setVideoPrepStage('ready');
            }
          }
        });
      activeVideoOcrPromiseRef.current = ocrPromise;
    } else {
      activeVideoOcrPromiseRef.current = null;
      setVideoPrepStage(b64 || extractedAudioWav ? 'ready' : 'idle');
      if (!b64 && !extractedAudioWav) {
        setUploadError(
          language === 'kz'
            ? 'Бейнефайл зақымдалған немесе браузер кодекті оқи алмады. MP4/H.264 файлын таңдап көріңіз.'
            : 'Не удалось декодировать видеофайл (файл повреждён или неподдерживаемый кодек). Попробуйте MP4/H.264.'
        );
      }
    }

    const finalPlayableUrl = playableUrl || URL.createObjectURL(file);
    activeVideoBlobUrlRef.current = finalPlayableUrl.startsWith('blob:') ? finalPlayableUrl : null;
    setVideoPlayableUrl(finalPlayableUrl);
    setVideoDuration(durationLabel);
    setVideoMediaBase64(b64);
    setVideoAudioDataUrl(extractedAudioWav || null);
    setVideoFileSha256(computedHash);
  };

  const handleClearVideo = () => {
    videoOpIdRef.current += 1;
    revokeIfNotHandedOff(activeVideoBlobUrlRef.current);
    activeVideoBlobUrlRef.current = null;
    setVideoFile(null);
    setVideoFrames([]);
    setVideoPlayableUrl(null);
    setVideoMediaBase64(null);
    setVideoAudioDataUrl(null);
    setVideoCaption('');
    setVideoFrameOcrText('');
    setVideoDuration('00:00');
    setVideoFileSha256(null);
    setIsExtractingFrames(false);
    setVideoPrepStage('idle');
    activeVideoOcrPromiseRef.current = null;
    if (videoFileInputRef.current) videoFileInputRef.current.value = '';
  };

  const handleTogglePlayAudio = () => {
    if (!audioElementRef.current) return;
    if (isPlayingAudio) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioElementRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => setIsPlayingAudio(false));
    }
  };

  const handleClearAudio = () => {
    audioOpIdRef.current += 1;
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    revokeIfNotHandedOff(activeAudioBlobUrlRef.current);
    activeAudioBlobUrlRef.current = null;
    setAudioDataUrl(null);
    setAudioMediaBase64(null);
    setAudioFileName('');
    setAudioDuration('00:00');
    setAudioFileSha256(null);
    setAudioTranscriptPreview('');
    setIsPlayingAudio(false);
    if (audioFileInputRef.current) audioFileInputRef.current.value = '';
  };

  // OCR Execution handler for images, scanned PDFs, and video frames
  const triggerOcr = (dataUrl: string, fileName?: string) => {
    if (!dataUrl) return Promise.resolve(null);
    const opId = ++ocrOpIdRef.current;
    setIsOcrLoading(true);
    const promise = extractTextWithOcr(dataUrl, fileName)
      .then((res) => {
        if (!isMountedRef.current || opId !== ocrOpIdRef.current) return null;
        if (res.text && res.text.trim().length > 0) {
          const cleanText = res.text.replace(/\[текст на изображении не обнаружен\]/gi, '').trim();
          const isPlaceholder = /^\[(?:Графический объект|Материал|Скриншот)/i.test(cleanText);
          if (cleanText.length > 0 && (!isPlaceholder || !ocrText.trim())) {
            applyExtractedTextToInputs(cleanText);
          }
        }
        setOcrSuccess(true);
        if (res.warningNotice) {
          setOcrWarning(res.warningNotice);
        }
        return res;
      })
      .catch((err) => {
        console.warn('OCR processing error:', err);
        if (isMountedRef.current && opId === ocrOpIdRef.current) {
          setOcrSuccess(true);
        }
        return null;
      })
      .finally(() => {
        if (isMountedRef.current && opId === ocrOpIdRef.current) {
          setIsOcrLoading(false);
        }
      });

    activeOcrPromiseRef.current = promise;
    return promise;
  };

  const executeDirectPayload = async (payload: ContentPayload) => {
    const opId = ++auditOpIdRef.current;
    clearProgressTimers();
    setIsProcessing(true);
    setProcessingModality(payload.modality);
    setIsSlowNetwork(false);
    setAuditError(null);
    setRestrictedUrlNotice(null);
    lastPayloadRef.current = payload;

    const isVideoPayload = payload.modality === 'video';
    setProcessingStepIndex(1);
    setProcessingStep(
      isVideoPayload
        ? language === 'kz'
          ? '1. 5 негізгі кадр мен аудионы шығару...'
          : '1. Извлечение 5 кадров и аудиодорожки...'
        : language === 'kz'
        ? '1. Мәтінді (KZ/RU OCR) және метадеректерді шығару'
        : '1. Извлечение текста (KZ/RU OCR) и метаданных'
    );

    const t1 = setTimeout(() => {
      if (!isMountedRef.current || opId !== auditOpIdRef.current) return;
      setProcessingStepIndex(2);
      setProcessingStep(
        isVideoPayload
          ? language === 'kz'
            ? '2. Кадрлардан мәтінді (OCR) және сөзді тану...'
            : '2. Распознавание текста (OCR) и речи на кадрах...'
          : language === 'kz'
          ? '2. Бейне / аудио / суретті мультимодальды талдау (Vision AI)'
          : '2. Мультимодальный анализ изображения / видео / аудио (Vision AI)'
      );
    }, isVideoPayload ? 750 : 550);

    const t2 = setTimeout(() => {
      if (!isMountedRef.current || opId !== auditOpIdRef.current) return;
      setProcessingStepIndex(3);
      setProcessingStep(
        language === 'kz'
          ? '3. ҚР ӘҚБтК, ҚК және № 230-VII Заңы бойынша заңдық AI-аудит...'
          : '3. Юридический AI-аудит РК (КоАП, УК и Закон № 230-VII)...'
      );
    }, isVideoPayload ? 1800 : 1200);

    const t3 = setTimeout(() => {
      if (!isMountedRef.current || opId !== auditOpIdRef.current) return;
      setProcessingStepIndex(4);
      setProcessingStep(
        language === 'kz'
          ? '4. Контексті, этиканы тексеру және SHA-256 есебін жасау'
          : '4. Проверка контекста, этики и формирование SHA-256 отчёта'
      );
    }, isVideoPayload ? 3200 : 2000);

    progressTimersRef.current = [t1, t2, t3];
    slowNetworkTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && opId === auditOpIdRef.current) {
        setIsSlowNetwork(true);
      }
    }, 8000);

    try {
      const audited = await analyzeContentWithGemini(payload);
      clearProgressTimers();
      if (!isMountedRef.current || opId !== auditOpIdRef.current) return;
      setIsProcessing(false);

      if (audited.accessRestricted) {
        setActiveTab('url');
        setRestrictedUrlNotice(
          audited.accessNotice ||
            (language === 'kz'
              ? 'Қолжетімділік құпиялылық параметрлерімен шектелген — скриншотты жүктеңіз немесе жарияланым мәтінін көшіріп қойыңыз'
              : 'Доступ ограничен настройками приватности — загрузите скриншот или скопируйте текст публикации')
        );
        return;
      }

      if (audited.videoDataUrl?.startsWith('blob:')) {
        handedOffBlobUrlsRef.current.add(audited.videoDataUrl);
      }
      if (audited.audioDataUrl?.startsWith('blob:')) {
        handedOffBlobUrlsRef.current.add(audited.audioDataUrl);
      }
      if (payload.videoDataUrl?.startsWith('blob:')) {
        handedOffBlobUrlsRef.current.add(payload.videoDataUrl);
      }
      if (payload.audioDataUrl?.startsWith('blob:')) {
        handedOffBlobUrlsRef.current.add(payload.audioDataUrl);
      }

      onRunAudit(audited);
    } catch (err) {
      clearProgressTimers();
      console.warn('Analysis error:', err);
      if (!isMountedRef.current || opId !== auditOpIdRef.current) return;
      setIsProcessing(false);
      const detail = err instanceof Error && err.message ? err.message : '';
      setAuditError(
        language === 'kz'
          ? `Материалды тексеру кезінде қате туындады${detail ? `: ${detail}` : ''}. Қайталап көріңіз.`
          : `Не удалось завершить аудит материала${detail ? `: ${detail}` : ''}. Проверьте данные и нажмите «Повторить».`
      );
    }
  };

  const handleFileSelect = async (file: File) => {
    if (autoAuditTimerRef.current) {
      clearTimeout(autoAuditTimerRef.current);
      autoAuditTimerRef.current = null;
    }
    setUploadError(null);
    setAuditError(null);

    if (file.size === 0) {
      setUploadedFile(null);
      setParsedFileInfo(null);
      setUploadError(
        language === 'kz'
          ? 'Таңдалған файл бос (0 байт). Жарамды құжат, сурет немесе медиафайл жүктеңіз.'
          : 'Выбранный файл пуст (0 байт). Пожалуйста, загрузите корректный документ, изображение или медиафайл.'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const opId = ++fileOpIdRef.current;
    ocrOpIdRef.current += 1;
    revokeIfNotHandedOff(activeFileBlobUrlRef.current);
    activeFileBlobUrlRef.current = null;

    setUploadedFile(file);
    setParsedFileInfo(null);
    setFilePreviewUrl(null);
    setFileSha256(null);
    setOcrText('');
    setOcrCharCount(0);
    setOcrWarning(null);
    setOcrSuccess(false);
    setIsOcrLoading(true);

    try {
      const [parsed, computedHash] = await Promise.all([
        parseUploadedFileUniversal(file, (dataUrl, fname) => triggerOcr(dataUrl, fname)),
        computeFileSha256(file).catch(() => null),
      ]);

      if (!isMountedRef.current || opId !== fileOpIdRef.current) {
        if (parsed.dataUrl?.startsWith('blob:')) URL.revokeObjectURL(parsed.dataUrl);
        if (parsed.audioDataUrl?.startsWith('blob:')) URL.revokeObjectURL(parsed.audioDataUrl);
        return;
      }

      if (parsed.fileType === 'image' && !parsed.dataUrl && !parsed.previewUrl) {
        setUploadedFile(null);
        setParsedFileInfo(null);
        setFilePreviewUrl(null);
        setIsOcrLoading(false);
        setUploadError(
          language === 'kz'
            ? 'Сурет зақымдалған немесе форматы қате (файл кеңейтімін тексеріңіз).'
            : 'Изображение повреждено или не распознаётся браузером (проверьте корректность формата файла).'
        );
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      if (parsed.dataUrl?.startsWith('blob:')) {
        activeFileBlobUrlRef.current = parsed.dataUrl;
      } else if (parsed.audioDataUrl?.startsWith('blob:')) {
        activeFileBlobUrlRef.current = parsed.audioDataUrl;
      }

      if (computedHash) {
        setFileSha256(computedHash);
      }
      setParsedFileInfo(parsed);
      setFilePreviewUrl(parsed.previewUrl || (parsed.fileType === 'pdf' ? undefined : parsed.dataUrl) || null);
      applyExtractedTextToInputs(parsed.text);
      setOcrSuccess(true);
      if (parsed.warningNotice) {
        setOcrWarning(parsed.warningNotice);
      }
      setIsOcrLoading(false);

      if (parsed.videoFrames && parsed.videoFrames.length > 0) {
        setVideoFrames(parsed.videoFrames);
      }

      // Auto-check immediately if autoAuditOnUpload is enabled by user
      if (autoAuditOnUpload) {
        const payload: ContentPayload = {
          modality: parsed.fileType === 'video' ? 'video' : parsed.fileType === 'audio' ? 'audio' : 'screenshot',
          fileName: parsed.fileName,
          fileSize: parsed.fileSizeStr,
          imageDataUrl: parsed.previewUrl || (parsed.fileType === 'pdf' ? undefined : parsed.dataUrl) || undefined,
          audioDataUrl: parsed.fileType === 'audio' ? parsed.dataUrl : parsed.audioDataUrl || undefined,
          videoDataUrl:
            parsed.fileType === 'video' && parsed.dataUrl?.startsWith('blob:')
              ? parsed.dataUrl
              : undefined,
          mediaBase64:
            (parsed.fileType === 'video' || parsed.fileType === 'audio') && parsed.dataUrl?.startsWith('data:')
              ? parsed.dataUrl
              : undefined,
          videoFrames: parsed.videoFrames,
          mimeType: parsed.mimeType,
          text: parsed.text,
          sha256: computedHash || undefined,
        };
        autoAuditTimerRef.current = setTimeout(() => {
          if (isMountedRef.current && opId === fileOpIdRef.current) {
            executeDirectPayload(payload);
          }
        }, 800);
      }
    } catch (err) {
      console.warn('Universal file parse error:', err);
      if (!isMountedRef.current || opId !== fileOpIdRef.current) return;
      const fallbackText =
        language === 'kz'
          ? `[Файл: ${file.name}]. ҚР заңнамасы бойынша комплаенс-тексеру үшін жүктелді.`
          : `[Файл: ${file.name}]. Загружен для комплаенс-проверки по законам РК.`;
      setOcrText(fallbackText);
      setOcrCharCount(fallbackText.length);
      setOcrSuccess(true);
      setIsOcrLoading(false);
    }
  };

  handleFileSelectRef.current = handleFileSelect;

  // Support instant Ctrl+V screenshot paste anywhere in scanner
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          setActiveTab('file');
          handleFileSelectRef.current(file);
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setActiveTab('file');
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleClearFile = () => {
    fileOpIdRef.current += 1;
    ocrOpIdRef.current += 1;
    if (autoAuditTimerRef.current) {
      clearTimeout(autoAuditTimerRef.current);
      autoAuditTimerRef.current = null;
    }
    revokeIfNotHandedOff(activeFileBlobUrlRef.current);
    activeFileBlobUrlRef.current = null;
    setUploadedFile(null);
    setParsedFileInfo(null);
    setFilePreviewUrl(null);
    setFileSha256(null);
    setFileTextNote('');
    setOcrText('');
    setOcrWarning(null);
    setOcrSuccess(false);
    setIsOcrLoading(false);
    setOcrCharCount(0);
    if (!textInputDirtyRef.current) {
      setTextInput('');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Instant Sample Screenshot Loader for immediate OCR testing
  const handleLoadSampleScreenshot = (type: SampleCaseType) => {
    if (autoAuditTimerRef.current) {
      clearTimeout(autoAuditTimerRef.current);
      autoAuditTimerRef.current = null;
    }
    fileOpIdRef.current += 1;
    revokeIfNotHandedOff(activeFileBlobUrlRef.current);
    activeFileBlobUrlRef.current = null;
    setUploadError(null);
    setAuditError(null);
    setFileSha256(null);
    const sample = generateSampleScreenshot(type);
    const sampleText = getSampleText(type);
    const sampleBytes = dataUrlToUint8Array(sample.dataUrl);
    if (sampleBytes) {
      computeSha256FromBuffer(sampleBytes)
        .then((hash) => {
          if (isMountedRef.current) setFileSha256(hash);
        })
        .catch(() => {});
    }
    setUploadedFile(new File([], sample.fileName, { type: 'image/png' }));
    setParsedFileInfo(null);
    setFilePreviewUrl(sample.dataUrl);
    setFileTextNote('');
    // Instantly set text and warning so user never waits and never sees empty state
    applyExtractedTextToInputs(sampleText);
    setOcrSuccess(true);
    if (type === 'political_doxing') {
      setOcrWarning(
        language === 'kz'
          ? 'Назар аударыңыз: саяси жалған ақпарат, жария қорлау және ЖСН/телефон доксингі тіркелді (ҚР ҚК 274, 131, 147-бап 5-б.).'
          : 'Внимание: зафиксирован политический вброс, публичное оскорбление и доксинг ИИН/телефона (ст. 274, 131, ч. 5 ст. 147 УК РК).'
      );
    } else if (type === 'profanity_chat') {
      setOcrWarning(
        language === 'kz'
          ? 'Назар аударыңыз: бейәдеп сөздер мен былапыт сөз тіркестері анықталды (ҚР ӘҚБтК 434-бабы).'
          : 'Внимание: зафиксирована ненормативная лексика и обсценная брань (ст. 434 КоАП РК).'
      );
    } else if (type === 'casino_banner') {
      setOcrWarning(
        language === 'kz'
          ? 'Назар аударыңыз: слоттар / рулетка / $ USD / USDT анықталды (ҚР ӘҚБтК 455-б. 1-б. / «Жарнама туралы» Заң 6-б. 5-1-т.).'
          : 'Внимание: выявлены слоты / рулетка / $ USD / USDT (ч. 1 ст. 455 КоАП РК / п. 5-1 ст. 6 Закона РК «О рекламе» — даже без слова «казино»).'
      );
    } else if (type === 'scam_phishing') {
      setOcrWarning(
        language === 'kz'
          ? 'Назар аударыңыз: ҚР брендтері атынан фишинг / дипфейк-скам және 42 500 ₸ жалған төлемдері анықталды (ҚР ҚК 190, 274-баптары).'
          : 'Внимание: выявлен фишинг / дипфейк-скам под бренды РК и ложные выплаты 42 500 ₸ (ст. 190, 274 УК РК).'
      );
    } else if (type === 'journalism_context') {
      setOcrWarning(null);
    } else {
      setOcrWarning(
        language === 'kz'
          ? 'Назар аударыңыз: міндетті «Жарнама» белгісі және жарнама берушінің деректері жоқ (ҚР ӘҚБтК 455-б. 2-б. / № 230-VII / № 59-НҚ).'
          : 'Внимание: отсутствуют обязательная маркировка «Жарнама» и данные рекламодателя (ч. 2 ст. 455 КоАП РК / Приказ МКИ № 59-НҚ).'
      );
    }
    triggerOcr(sample.dataUrl, sample.fileName);
  };

  const handleExecute = async () => {
    if (isProcessing) return;
    setUploadError(null);
    setAuditError(null);
    let payload: ContentPayload;

    if (activeTab === 'file') {
      if (!uploadedFile && !filePreviewUrl && !parsedFileInfo) {
        setUploadError(
          language === 'kz'
            ? 'Тексеру үшін файлды таңдаңыз немесе төмендегі сынақ кейсін басыңыз.'
            : 'Пожалуйста, перетащите файл, вставьте скриншот (Ctrl+V) или выберите один из тестовых кейсов ниже.'
        );
        return;
      }

      // If OCR is still in progress, wait and capture its fresh result directly (avoids stale closure)
      let awaitedOcrText = '';
      if (isOcrLoading && activeOcrPromiseRef.current) {
        setIsProcessing(true);
        setProcessingStep(language === 'kz' ? 'Оптикалық мәтінді тану аяқталуда (OCR)...' : 'Завершение оптического считывания надписей (OCR)...');
        try {
          const ocrRes = await activeOcrPromiseRef.current;
          if (ocrRes?.text && typeof ocrRes.text === 'string') {
            awaitedOcrText = ocrRes.text.replace(/\[текст на изображении не обнаружен\]/gi, '').trim();
          }
        } catch {
          // continue
        }
      }

      const resolvedFileSha256 =
        fileSha256 ||
        (uploadedFile && uploadedFile.size > 0
          ? await computeFileSha256(uploadedFile).catch(() => undefined)
          : undefined);

      const resolvedOcrText =
        (awaitedOcrText && !/^\[(?:Графический объект|Материал|Скриншот)/i.test(awaitedOcrText)
          ? awaitedOcrText
          : '') || ocrText.trim();

      const combinedText = [resolvedOcrText, fileTextNote.trim()]
        .filter(Boolean)
        .join('\n\n[Дополнительное примечание]: ');

      if (parsedFileInfo) {
        payload = {
          modality: parsedFileInfo.fileType === 'video' ? 'video' : parsedFileInfo.fileType === 'audio' ? 'audio' : 'screenshot',
          fileName: parsedFileInfo.fileName,
          fileSize: parsedFileInfo.fileSizeStr,
          imageDataUrl: parsedFileInfo.previewUrl || (parsedFileInfo.fileType === 'pdf' ? undefined : parsedFileInfo.dataUrl) || undefined,
          audioDataUrl: parsedFileInfo.fileType === 'audio' ? parsedFileInfo.dataUrl : parsedFileInfo.audioDataUrl || undefined,
          videoDataUrl:
            parsedFileInfo.fileType === 'video' && parsedFileInfo.dataUrl?.startsWith('blob:')
              ? parsedFileInfo.dataUrl
              : undefined,
          mediaBase64:
            (parsedFileInfo.fileType === 'video' || parsedFileInfo.fileType === 'audio') && parsedFileInfo.dataUrl?.startsWith('data:')
              ? parsedFileInfo.dataUrl
              : undefined,
          videoFrames: parsedFileInfo.videoFrames,
          mimeType: parsedFileInfo.mimeType,
          text: combinedText || parsedFileInfo.text,
          sha256: resolvedFileSha256,
        };
      } else {
        const isImage = (uploadedFile && uploadedFile.type.startsWith('image/')) || !!filePreviewUrl;
        const isVideo = uploadedFile ? uploadedFile.type.startsWith('video/') : false;

        if (isVideo) {
          payload = {
            modality: 'video',
            fileName: uploadedFile?.name || 'video_clip.mp4',
            fileSize:
              uploadedFile && uploadedFile.size > 0
                ? `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`
                : '2.5 MB',
            imageDataUrl: filePreviewUrl || undefined,
            videoFrames: videoFrames.length > 0 ? videoFrames : filePreviewUrl ? [filePreviewUrl] : undefined,
            videoDataUrl: videoPlayableUrl || undefined,
            audioDataUrl: videoAudioDataUrl || undefined,
            mediaBase64: videoMediaBase64 || undefined,
            mimeType: uploadedFile?.type || 'video/mp4',
            audioDuration: videoDuration || '00:15',
            text: combinedText || '',
            sha256: resolvedFileSha256,
          };
        } else {
          payload = {
            modality: isImage ? 'screenshot' : 'audio',
            fileName: uploadedFile?.name || 'screenshot.png',
            fileSize:
              uploadedFile && uploadedFile.size > 0
                ? `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`
                : `${Math.round(ocrCharCount * 1.5 + 120)} KB`,
            imageDataUrl: filePreviewUrl || undefined,
            videoFrames: undefined,
            text: combinedText || '',
            sha256: resolvedFileSha256,
          };
        }
      }
    } else if (activeTab === 'media') {
      if (mediaSubMode === 'video') {
        const hasUploadedVideo = videoFile || videoPlayableUrl || videoFrames.length > 0;
        if (!hasUploadedVideo) {
          setUploadError(
            language === 'kz'
              ? 'Талдау үшін бейнефайлды (MP4/MOV) жүктеңіз.'
              : 'Пожалуйста, загрузите видеофайл (MP4, MOV, WebM) для покадрового и аудио-анализа.'
          );
          return;
        }
        let awaitedFrameOcr = videoFrameOcrText.trim();
        if (!awaitedFrameOcr && activeVideoOcrPromiseRef.current) {
          setIsProcessing(true);
          setProcessingModality('video');
          setProcessingStepIndex(2);
          setProcessingStep(
            language === 'kz'
              ? '2. Кадрлардан мәтінді (OCR) тану аяқталуда...'
              : '2. Завершение распознавания текста (OCR) по 5 кадрам...'
          );
          try {
            const res = await activeVideoOcrPromiseRef.current;
            if (res?.text) {
              awaitedFrameOcr = res.text.trim();
            }
          } catch {
            // continue
          }
        }
        const resolvedVideoSha256 =
          videoFileSha256 ||
          (videoFile && videoFile.size > 0
            ? await computeFileSha256(videoFile).catch(() => undefined)
            : undefined);
        const frames = videoFrames.length > 0 ? videoFrames : filePreviewUrl ? [filePreviewUrl] : [];
        const combinedVideoText = [videoCaption.trim(), awaitedFrameOcr]
          .filter(Boolean)
          .join('\n\n');
        payload = {
          modality: 'video',
          fileName: videoFile?.name || 'video_clip.mp4',
          fileSize: videoFile && videoFile.size > 0 ? `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB` : '3.8 MB',
          imageDataUrl: frames[0] || undefined,
          videoFrames: frames,
          videoDataUrl: videoPlayableUrl || undefined,
          audioDataUrl: videoAudioDataUrl || undefined,
          mediaBase64: videoMediaBase64 || undefined,
          mimeType: videoFile?.type || 'video/mp4',
          audioDuration: videoDuration || '00:20',
          text: combinedVideoText || videoFile?.name || 'Видеоматериал для проверки',
          sha256: resolvedVideoSha256,
        };
      } else {
        if (!audioDataUrl && !audioTranscriptPreview.trim()) {
          setUploadError(
            language === 'kz'
              ? 'Микрофоннан аудио жазыңыз немесе аудиофайлды таңдаңыз.'
              : 'Пожалуйста, запишите речь с микрофона или загрузите аудиофайл.'
          );
          return;
        }
        payload = {
          modality: 'audio',
          fileName: audioFileName || 'voice_recording.m4a',
          fileSize: audioDataUrl ? `${Math.round((audioDataUrl.length * 3) / 4 / 1024)} KB` : '420 KB',
          audioDataUrl: audioDataUrl || undefined,
          mediaBase64: audioMediaBase64 || audioDataUrl || undefined,
          mimeType: audioDataUrl?.startsWith('data:') ? audioDataUrl.slice(5, audioDataUrl.indexOf(';')) : 'audio/mp3',
          audioDuration: audioDuration || '00:28',
          text: audioTranscriptPreview || audioFileName,
          sha256: audioFileSha256 || undefined,
        };
      }
    } else if (activeTab === 'url') {
      const trimmedUrl = urlInput.trim();
      if (!trimmedUrl) {
        setUploadError(
          language === 'kz'
            ? 'Тексеру үшін веб-сілтемені көрсетіңіз (Telegram, YouTube, сайт).'
            : 'Пожалуйста, вставьте ссылку для проверки (сайт, Telegram-канал, YouTube или TikTok).'
        );
        return;
      }
      const isVideoLink = /youtube\.com|youtu\.be|tiktok\.com|instagram\.com\/reel|instagram\.com\/p|\.mp4|\.mov/i.test(trimmedUrl);
      payload = {
        modality: isVideoLink ? 'video' : 'url',
        url: trimmedUrl,
        text: trimmedUrl,
      };
    } else {
      if (!textInput.trim()) {
        setUploadError(
          language === 'kz' ? 'Тексеру үшін мәтінді енгізіңіз.' : 'Пожалуйста, введите текст материала для проверки.'
        );
        return;
      }
      payload = {
        modality: 'text',
        text: textInput.trim(),
      };
    }

    // Guard against exceeding Express 200 MB JSON body limit (allows raw media up to 50 MB + keyframes + WAV audio)
    try {
      const payloadBytes = new TextEncoder().encode(JSON.stringify(payload)).length;
      if (payloadBytes > MAX_SERVER_PAYLOAD_BYTES) {
        payload = {
          ...payload,
          mediaBase64: undefined,
          videoDataUrl: payload.videoDataUrl?.startsWith('data:') ? undefined : payload.videoDataUrl,
        };
      }
    } catch {
      // ignore size check errors
    }

    await executeDirectPayload(payload);
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex flex-col gap-6 font-['Inter']">
      {/* Clean Hero Header */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400 dark:text-zinc-500">
          <span>{t('kazakhstan')}</span>
          <span aria-hidden="true">·</span>
          <span>{t('lawsAndEthics')}</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            {language === 'kz'
              ? 'ҚР ӘҚБтК · № 230-VII Заңы · Сандық мәдениет'
              : 'КоАП РК · Закон № 230-VII · Цифровая культура'}
          </span>
        </div>
        <h2 className="font-['Inter'] text-xl sm:text-2xl font-semibold text-zinc-950 dark:text-zinc-50 tracking-tight">
          {t('scannerHeroTitle')}
        </h2>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 max-w-3xl leading-relaxed">
          {t('scannerHeroDesc')}
        </p>
      </div>

      {/* Main Working Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] p-5 sm:p-6 flex flex-col gap-6 transition-colors">
        {/* Modality Tabs (4 clean sources incl. URL) */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            {t('stepSource')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-zinc-100/80 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            {[
              { id: 'file', label: t('tabFileUniversal'), icon: FileUp },
              { id: 'url', label: t('tabUrl'), icon: Link2 },
              { id: 'text', label: t('tabText'), icon: FileText },
              { id: 'media', label: t('tabMedia'), icon: Video },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    setAuditError(null);
                    setRestrictedUrlNotice(null);
                    setActiveTab(tab.id as 'file' | 'url' | 'text' | 'media');
                  }}
                  className={`py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg text-[11px] sm:text-[13px] font-medium flex items-center justify-center gap-1.5 sm:gap-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs border border-zinc-200/60 dark:border-zinc-700'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.6} />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* File Size / Validation Error Alert Banner */}
        {uploadError && (
          <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 text-xs sm:text-sm flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" strokeWidth={1.7} />
              <span className="font-medium leading-relaxed">{uploadError}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 p-0.5"
            >
              <X className="w-4 h-4" strokeWidth={1.6} />
            </button>
          </div>
        )}

        {/* Dynamic Input Zone */}
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
            {t('stepObject')}
          </label>

          {/* TAB 1: FILE / SCREENSHOT / DOCUMENTS */}
          {activeTab === 'file' && (
            <div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                accept="image/*,video/*,audio/*,.pdf,.docx,.doc,.txt,.csv,.json,.md,.rtf,*/*"
                className="hidden"
              />

              {!uploadedFile && !filePreviewUrl ? (
                <div className="flex flex-col gap-3.5">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border border-dashed rounded-2xl p-7 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                      isDragging
                        ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100/70 dark:bg-zinc-800/40'
                        : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-950/40'
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 mb-3 shadow-2xs">
                      <FileUp className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                    <div className="font-['Inter'] font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      {t('dropScreenshotTitle')}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-md">
                      {t('dropScreenshotSubtitle')}
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800 text-[11px] font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400">
                      <span>PDF</span>
                      <span>·</span>
                      <span>DOCX</span>
                      <span>·</span>
                      <span>TXT / CSV</span>
                      <span>·</span>
                      <span>PNG / JPG</span>
                      <span>·</span>
                      <span>MP4 / Reels</span>
                      <span>·</span>
                      <span>MP3 / Voice</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 text-xs font-medium transition-colors"
                    >
                      {t('chooseFileBtn')}
                    </button>
                  </div>

                  {/* 5 Ready-to-click Test Scenarios matching Jury Spec */}
                  <div className="p-3.5 bg-zinc-50/70 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl">
                    <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2.5">
                      {language === 'kz'
                        ? 'Қорғауға арналған 5 дайын сынақ сценарийі (1 басумен):'
                        : '5 готовых тестовых сценариев для проверки (1 клик):'}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('political_doxing')}
                        className="p-3 text-left rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-600 transition-colors"
                      >
                        <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />
                          <span className="truncate">
                            {language === 'kz' ? '1. Саяси жалған ақпарат және доксинг' : '1. Политический вброс и доксинг'}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
                          {language === 'kz'
                            ? '1-слайд · ҚК 274, 131, 147-б. 5-б. · 84/100'
                            : '1-й слайд · ст. 274, 131, ч. 5 ст. 147 УК РК · 84/100'}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('casino_banner')}
                        className="p-3 text-left rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-amber-400 dark:hover:border-amber-600 transition-colors"
                      >
                        <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                          <span className="truncate">
                            {language === 'kz' ? '2. «Казино» сөзінсіз слоттар / рулетка' : '2. Казино без слова «казино»'}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
                          {language === 'kz'
                            ? 'Слоттар / $ USD · 455-б. 1-б. ҚР ӘҚБтК / 6-б. 5-1-т.'
                            : 'Слоты / $ USD · ч. 1 ст. 455 КоАП / п. 5-1 ст. 6'}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('unmarked_ad')}
                        className="p-3 text-left rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
                      >
                        <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                          <span className="truncate">
                            {language === 'kz' ? '3. «Жарнама» белгісінсіз және БСН-сіз жарнама' : '3. Реклама без «Жарнама» и БИН'}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
                          {language === 'kz'
                            ? 'ч. 2–3 ст. 455 ҚР ӘҚБтК · № 59-НҚ · 21-б.'
                            : 'ч. 2–3 ст. 455 КоАП · № 59-НҚ · ст. 21 о языках'}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('profanity_chat')}
                        className="p-3 text-left rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-600 transition-colors"
                      >
                        <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          <span className="truncate">
                            {language === 'kz' ? '4. Кибербуллинг және чаттағы боқтық (RU/KZ)' : '4. Кибербуллинг и мат в чате'}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">
                          {language === 'kz'
                            ? 'RU/KZ бейәдеп сөздер · 434, 73-4-б. ҚР ӘҚБтК'
                            : 'RU/KZ обсценная лексика · ст. 434, 73-4'}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('journalism_context')}
                        className="p-3 text-left rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors sm:col-span-2 lg:col-span-2"
                      >
                        <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                          <span className="truncate">
                            {language === 'kz'
                              ? '5. Жалған іске қосылудан қорғау (ІІМ / БАҚ)'
                              : '5. Ложное срабатывание (МВД / СМИ)'}
                          </span>
                        </div>
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 line-clamp-1">
                          {language === 'kz'
                            ? 'Жаңалықта 1Win / Kaspi / 42 500 бар · 0 АЕК (Қауіпсіз)'
                            : '1Win / Kaspi / 42 500 в новости · 0 МРП (Безопасно)'}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 bg-zinc-50/70 dark:bg-zinc-950/50 flex flex-col gap-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {filePreviewUrl ? (
                        <img
                          src={filePreviewUrl}
                          alt="Preview"
                          className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700 shrink-0"
                        />
                      ) : (
                        <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-zinc-700 dark:text-zinc-300 shrink-0">
                          <FileText className="w-5 h-5" strokeWidth={1.5} />
                          <span className="text-[9px] font-['JetBrains_Mono'] uppercase mt-0.5 text-zinc-400">
                            {parsedFileInfo?.fileType || 'DOC'}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                          {uploadedFile?.name || (language === 'kz' ? 'Жүктелген файл' : 'Загруженный файл')}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] mt-0.5 flex flex-wrap items-center gap-2 tabular-nums">
                          <span>
                            {uploadedFile && uploadedFile.size > 0
                              ? `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`
                              : parsedFileInfo?.fileSizeStr || 'Файл'}
                          </span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {language === 'kz' ? 'Файл дайын' : 'Готов к анализу'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        {language === 'kz' ? 'Ауыстыру' : 'Заменить'}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                        title={language === 'kz' ? 'Файлды жою' : 'Удалить файл'}
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.6} />
                      </button>
                    </div>
                  </div>

                  {/* OCR Recognition Workspace Card */}
                  <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 p-4 flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <ScanText className="w-4 h-4 text-zinc-600 dark:text-zinc-400" strokeWidth={1.6} />
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 font-['JetBrains_Mono']">
                          {t('ocrExtractedTitle')}
                        </span>
                        {isOcrLoading ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-['JetBrains_Mono'] text-zinc-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {t('ocrScanning')}
                          </span>
                        ) : ocrSuccess ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-['JetBrains_Mono'] text-emerald-600 dark:text-emerald-400 tabular-nums">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {Math.max(1, ocrCharCount)} {t('ocrSymbols')}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {filePreviewUrl && (
                          <button
                            type="button"
                            onClick={() => triggerOcr(filePreviewUrl, uploadedFile?.name)}
                            disabled={isOcrLoading}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center gap-1 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3 h-3 ${isOcrLoading ? 'animate-spin' : ''}`} strokeWidth={1.6} />
                            <span>{isOcrLoading ? (language === 'kz' ? 'Тану...' : 'Чтение...') : t('ocrRepeat')}</span>
                          </button>
                        )}
                        {ocrText && (
                          <button
                            type="button"
                            onClick={() => {
                              void copyTextToClipboard(ocrText).then((ok) => {
                                if (!ok || !isMountedRef.current) return;
                                setCopiedOcr(true);
                                if (copyOcrTimerRef.current) clearTimeout(copyOcrTimerRef.current);
                                copyOcrTimerRef.current = setTimeout(() => {
                                  if (isMountedRef.current) setCopiedOcr(false);
                                }, 2000);
                              });
                            }}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 flex items-center gap-1 transition-colors"
                          >
                            {copiedOcr ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedOcr ? t('ocrCopied') : t('ocrCopy')}</span>
                          </button>
                        )}
                        {ocrText && (
                          <button
                            type="button"
                            onClick={() => {
                              setOcrText('');
                              setOcrCharCount(0);
                              setOcrWarning(null);
                            }}
                            className="p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-400 hover:text-rose-600 transition-colors"
                            title={t('ocrClear')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {ocrWarning && (
                      <div className="px-3 py-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" strokeWidth={1.6} />
                        <span className="leading-relaxed">{ocrWarning}</span>
                      </div>
                    )}

                    <textarea
                      value={ocrText}
                      onChange={(e) => {
                        const val = e.target.value;
                        setOcrText(val);
                        setOcrCharCount(val.length);
                        if (!textInputDirtyRef.current) {
                          setTextInput(val);
                        }
                        const hasMat =
                          /(?:^|[^а-яёәғқңөұүһі])(?:бля(?:т[ья]?|д[ьт]?)?|ху[йияеёю][а-яё]*|пизд[а-яё]*|(?:за|по|вы|до|на|от|под|при|пере|раз|у|долбо|съ|въ)?[её]б(?:ать|ал[аио]?|ан[аоы]?|ут|ет|ёт|ись|уч|ок|ище|ну[а-яё]*)|сук[аиеу](?=$|[^а-яё])|сучк[аи]|наху[йи]|муда[кч]|гондон|пид[оа]р|шеше[ңн]|си[кқ]т|көт(?:і|ті|ін|ің|ке)?(?=$|[^а-яёәғқңөұүһі])|қота[қк])/i.test(
                            val
                          );
                        if (hasMat) {
                          setOcrWarning(
                            language === 'kz'
                              ? 'Назар аударыңыз: бейәдеп сөздер мен былапыт сөз тіркестері анықталды (ҚР ӘҚБтК 434-бабы).'
                              : 'Внимание: зафиксирована ненормативная лексика и обсценная брань (ст. 434 КоАП РК).'
                          );
                        }
                      }}
                      placeholder={
                        isOcrLoading
                          ? language === 'kz'
                            ? 'Скриншоттан оптикалық мәтін оқу орындалуда...'
                            : 'Выполняется оптическое распознавание текста...'
                          : t('ocrPlaceholder')
                      }
                      rows={7}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none font-['JetBrains_Mono'] leading-relaxed"
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 dark:text-zinc-500 font-['JetBrains_Mono']">
                      <span>
                        {language === 'kz'
                          ? 'Мәтін тексеру өрісіне автоматты түрде қойылды және аудитке дайын'
                          : 'Текст автоматически подставлен в поле ввода и готов к аудиту'}
                      </span>
                      <div className="flex items-center gap-3">
                        {ocrText.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setTextInput(ocrText);
                              textInputDirtyRef.current = false;
                              setActiveTab('text');
                            }}
                            className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 underline underline-offset-2"
                          >
                            {language === 'kz' ? 'Мәтін қойындысында ашу' : 'Открыть во вкладке «Текст»'}
                          </button>
                        )}
                        <span className="tabular-nums">
                          {t('ocrSymbols')}: {ocrCharCount}
                        </span>
                      </div>
                    </div>

                    {/* Real-time Live Pre-Check on OCR Text */}
                    {ocrText.trim().length > 4 && (() => {
                      const pre = runLivePreCheck(ocrText, undefined, 'small', language);
                      const statusLabel = language === 'kz' ? pre.statusLabelKz : pre.statusLabelRu;
                      const penaltySummary = language === 'kz' ? pre.penaltySummaryKz : pre.penaltySummaryRu;
                      return (
                        <div className="pt-3 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`w-2.5 h-2.5 rounded-full ${
                                  pre.status === 'critical'
                                    ? 'bg-rose-500'
                                    : pre.status === 'warning'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                              />
                              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                                {language === 'kz' ? 'Тәуекел индексі (Pre-Check):' : 'Индекс риска (Pre-Check):'}
                              </span>
                              <span className="font-['JetBrains_Mono'] font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
                                {pre.riskScore} / 100
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] font-bold border ${
                                  pre.status === 'critical'
                                    ? 'bg-rose-600 text-white border-rose-600'
                                    : pre.status === 'warning'
                                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                                    : 'bg-emerald-600 text-white border-emerald-600'
                                }`}
                              >
                                {statusLabel}
                              </span>
                            </div>
                            <span className="text-[11px] font-['JetBrains_Mono'] px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                              {pre.languageCoverage === 'bilingual'
                                ? 'KZ + RU'
                                : pre.languageCoverage === 'kz_only'
                                ? 'KZ'
                                : pre.languageCoverage === 'ru_only'
                                ? (language === 'kz' ? 'Тек RU (ст. 21)' : 'Только RU (ст. 21)')
                                : 'Neutral'}
                            </span>
                          </div>
                          <div className="text-[11px] font-['JetBrains_Mono'] font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100/80 dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-zinc-500 dark:text-zinc-400 font-normal">
                              {language === 'kz' ? 'Болжамды айыппұл (ШОБ):' : 'Предв. оценка штрафа (МБ):'}
                            </span>
                            <span
                              className={
                                pre.penaltyCalc.maxKzt > 0
                                  ? 'text-rose-700 dark:text-rose-400'
                                  : pre.triggers.length > 0
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }
                            >
                              {penaltySummary}
                            </span>
                          </div>
                          {pre.triggers.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {pre.triggers.map((trg) => (
                                <span
                                  key={trg.id}
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                    trg.category === 'legal' && trg.severity === 'critical'
                                      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900'
                                      : trg.category === 'ethics'
                                      ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-900'
                                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900'
                                  }`}
                                >
                                  <span className="font-['JetBrains_Mono'] text-[9px] uppercase opacity-75">
                                    {trg.category === 'legal'
                                      ? language === 'kz'
                                        ? 'ҚР Заңы'
                                        : 'Закон РК'
                                      : 'Этика'}
                                  </span>
                                  <span>· {language === 'kz' ? trg.labelKz : trg.labelRu}</span>
                                  <span className="font-['JetBrains_Mono'] text-[10px] opacity-75">({trg.article})</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: UNIFIED MEDIA (VIDEO / AUDIO) */}
          {activeTab === 'media' && (
            <div className="flex flex-col gap-4">
              {/* Segmented sub-mode toggle: Video vs Audio */}
              <div className="flex items-center gap-1.5 p-1 bg-zinc-100/80 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    setMediaSubMode('video');
                  }}
                  className={`flex-1 py-2 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs transition-colors flex items-center justify-center gap-1.5 sm:gap-2 ${
                    mediaSubMode === 'video'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Video className="w-4 h-4 shrink-0" strokeWidth={1.6} />
                  <span className="truncate">{language === 'kz' ? 'Бейне (MP4 / MOV)' : 'Видеофайл (MP4 / MOV)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUploadError(null);
                    setMediaSubMode('audio');
                  }}
                  className={`flex-1 py-2 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs transition-colors flex items-center justify-center gap-1.5 sm:gap-2 ${
                    mediaSubMode === 'audio'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <Mic className="w-4 h-4 shrink-0" strokeWidth={1.6} />
                  <span className="truncate">{language === 'kz' ? 'Аудио / Микрофон' : 'Аудио / Микрофон'}</span>
                </button>
              </div>

              {/* VIDEO SUB-MODE */}
              {mediaSubMode === 'video' && (
                <div className="flex flex-col gap-4">
                  <input
                    type="file"
                    ref={videoFileInputRef}
                    accept="video/*,.mp4,.mov,.webm,.m4v"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleVideoFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  {!videoPlayableUrl && !videoFile && (
                    <div
                      onClick={() => videoFileInputRef.current?.click()}
                      className="border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-950/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 mb-3 shadow-2xs">
                        <Video className="w-5 h-5" strokeWidth={1.5} />
                      </div>
                      <div className="font-medium text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                        {t('videoDropTitle')}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        {t('videoDropSubtitle')}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          videoFileInputRef.current?.click();
                        }}
                        className="mt-4 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        {t('videoSelectBtn')}
                      </button>
                    </div>
                  )}

                  {(isExtractingFrames || videoPrepStage === 'ocr_frames') && (
                    <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center gap-2.5 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
                      <Loader2 className="w-4 h-4 animate-spin text-zinc-600 shrink-0" />
                      <span>
                        {videoPrepStage === 'ocr_frames'
                          ? language === 'kz'
                            ? '5 кадрдан мәтінді тану (OCR) орындалуда...'
                            : 'Распознавание текста (OCR) по 5 кадрам видео...'
                          : language === 'kz'
                          ? '5 негізгі кадр мен аудионы шығару...'
                          : 'Извлечение 5 ключевых кадров и аудиодорожки...'}
                      </span>
                    </div>
                  )}

                  {(videoPlayableUrl || videoFrames.length > 0) && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-3.5">
                      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Video className="w-4 h-4 text-zinc-500 shrink-0" strokeWidth={1.6} />
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {videoFile ? videoFile.name : language === 'kz' ? 'Бейнематериал' : 'Видеоматериал'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-['JetBrains_Mono'] text-[11px] text-zinc-500 tabular-nums shrink-0">
                          <span>{videoDuration}</span>
                          {videoFile && <span>· {(videoFile.size / (1024 * 1024)).toFixed(1)} MB</span>}
                          <button
                            type="button"
                            onClick={handleClearVideo}
                            className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 ml-1"
                            title={language === 'kz' ? 'Бейнені жою' : 'Удалить видео'}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {videoPlayableUrl && (
                        <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 aspect-video max-h-[300px] flex items-center justify-center">
                          <video
                            src={videoPlayableUrl}
                            controls
                            playsInline
                            className="w-full h-full max-h-[290px] object-contain"
                          />
                        </div>
                      )}

                      {videoFrames.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-[11px] font-['JetBrains_Mono'] text-zinc-400">
                            <span>{t('videoFilmstripTitle')}</span>
                            <span className="tabular-nums">
                              {videoFrames.length} {t('videoFramesCount')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 overflow-x-auto pb-1">
                            {videoFrames.map((frame, idx) => {
                              const durParts = videoDuration.split(':');
                              const totalSec =
                                parseInt(durParts[0] || '0', 10) * 60 + parseInt(durParts[1] || '15', 10);
                              const pct =
                                VIDEO_SAMPLE_PERCENTAGES[idx] ??
                                (idx + 1) / (videoFrames.length + 1);
                              const sec = Math.min(totalSec, Math.round(totalSec * pct));
                              const m = Math.floor(sec / 60).toString().padStart(2, '0');
                              const s = (sec % 60).toString().padStart(2, '0');
                              const timeLabel = `${m}:${s}`;

                              return (
                                <div
                                  key={idx}
                                  className="relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 shrink-0 h-16 w-24 bg-zinc-900 group cursor-pointer"
                                  onClick={() => setFilePreviewUrl(frame)}
                                >
                                  <img
                                    src={frame}
                                    alt={`Сцена ${idx + 1}`}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                  />
                                  <span className="absolute bottom-1 right-1 bg-black/75 px-1.5 py-0.5 rounded text-[9px] text-white font-['JetBrains_Mono'] tabular-nums">
                                    {timeLabel}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block font-medium text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] text-[11px] mb-1.5">
                          {language === 'kz' ? 'Сипаттама немесе контекст' : 'Описание или сопутствующий текст'}
                        </label>
                        <textarea
                          value={videoCaption}
                          onChange={(e) => setVideoCaption(e.target.value)}
                          rows={2}
                          placeholder={
                            language === 'kz'
                              ? 'Бейне авторын, контекстін немесе пікірін көрсетіңіз...'
                              : 'Укажите автора, контекст или комментарии к видео (необязательно)...'
                          }
                          className="w-full bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AUDIO SUB-MODE */}
              {mediaSubMode === 'audio' && (
                <div className="flex flex-col gap-4">
                  <audio
                    ref={audioElementRef}
                    src={audioDataUrl || undefined}
                    onEnded={() => setIsPlayingAudio(false)}
                  />
                  <input
                    type="file"
                    ref={audioFileInputRef}
                    accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleAudioFileSelect(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  <div className="flex items-center gap-1.5 p-1 bg-zinc-100/80 dark:bg-zinc-950 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setAudioMode('record')}
                      className={`flex-1 py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        audioMode === 'record'
                          ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Mic className="w-4 h-4 text-rose-500" strokeWidth={1.6} />
                      <span>{t('audioRecordMode')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAudioMode('upload')}
                      className={`flex-1 py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                        audioMode === 'upload'
                          ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-2xs'
                          : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <FileUp className="w-4 h-4" strokeWidth={1.6} />
                      <span>{t('audioUploadMode')}</span>
                    </button>
                  </div>

                  {audioMode === 'record' && (
                    <div className="p-7 bg-zinc-50/70 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center gap-4">
                      {isRecording ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-sm">
                            <Mic className="w-6 h-6" strokeWidth={1.7} />
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-medium text-rose-600 dark:text-rose-400 font-['JetBrains_Mono']">
                              {t('audioRecordingInProgress')}
                            </span>
                            <span className="font-['JetBrains_Mono'] text-2xl font-semibold text-zinc-950 dark:text-zinc-50 mt-1 tabular-nums">
                              00:{recordingSeconds.toString().padStart(2, '0')} / 01:00
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 h-8 my-1">
                            {[40, 75, 95, 60, 85, 100, 70, 90, 50, 80, 65, 45].map((h, i) => (
                              <div
                                key={i}
                                className="w-1.5 bg-rose-500 rounded-full animate-pulse"
                                style={{
                                  height: `${h}%`,
                                  animationDelay: `${i * 80}ms`,
                                  animationDuration: '600ms',
                                }}
                              />
                            ))}
                          </div>

                          <button
                            type="button"
                            onClick={handleStopRecording}
                            className="px-5 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium text-xs flex items-center gap-2 transition-colors"
                          >
                            <Square className="w-3.5 h-3.5 fill-current" />
                            <span>{t('audioStopRecord')}</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2.5">
                          <div className="w-12 h-12 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 shadow-2xs">
                            <Mic className="w-5 h-5" strokeWidth={1.5} />
                          </div>
                          <div className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                            {language === 'kz'
                              ? 'Микрофоннан аудиожазба немесе қоңырауды жазу'
                              : 'Запись аудиосообщения или речи с микрофона'}
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md">
                            {language === 'kz'
                              ? 'Төмендегі батырманы басып, сөйлеңіз. AI таймкодтармен сөзді мәтінге айналдырады.'
                              : 'Нажмите кнопку ниже и произнесите речь. Система выполнит транскрипцию с таймкодами и проверит нормы РК.'}
                          </p>
                          <button
                            type="button"
                            onClick={handleStartRecording}
                            className="mt-2 px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs flex items-center gap-2 transition-colors"
                          >
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span>{t('audioStartRecord')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {audioMode === 'upload' && (
                    <div
                      onClick={() => audioFileInputRef.current?.click()}
                      className="border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-950/40 rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200 mb-3 shadow-2xs">
                        <Mic className="w-5 h-5" strokeWidth={1.5} />
                      </div>
                      <div className="font-medium text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">
                        {t('audioDropTitle')}
                      </div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        {t('audioDropSubtitle')}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          audioFileInputRef.current?.click();
                        }}
                        className="mt-4 px-4 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-800 dark:text-zinc-200"
                      >
                        {t('chooseFileBtn')}
                      </button>
                    </div>
                  )}

                  {audioDataUrl && (
                    <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            onClick={handleTogglePlayAudio}
                            className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 flex items-center justify-center shrink-0 transition-colors"
                          >
                            {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                          <div className="min-w-0">
                            <div className="font-medium text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                              {audioFileName || (language === 'kz' ? 'Дауыс жазбасы' : 'Голосовая дорожка')}
                            </div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-['JetBrains_Mono'] flex items-center gap-2 mt-0.5 tabular-nums">
                              <span>{audioDuration}</span>
                              <span>·</span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {language === 'kz' ? 'Дайын' : 'Готово'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleClearAudio}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.6} />
                        </button>
                      </div>

                      <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 flex items-center gap-1 h-9">
                        {[15, 30, 45, 80, 95, 60, 40, 90, 100, 75, 50, 85, 30, 60, 90, 70, 45, 80, 65, 35, 50, 75, 40, 20].map(
                          (bar, i) => (
                            <div
                              key={i}
                              className={`flex-1 rounded-full transition-all ${
                                isPlayingAudio ? 'bg-zinc-900 dark:bg-zinc-100 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-700'
                              }`}
                              style={{ height: `${bar}%` }}
                            />
                          )
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-[11px] font-['JetBrains_Mono'] text-zinc-500">
                          <span>
                            {language === 'kz'
                              ? 'Стенограмма және танылған мәтін (STT)'
                              : 'Стенограмма и распознанный текст (STT)'}
                          </span>
                          <span className="tabular-nums">
                            {t('ocrSymbols')}: {audioTranscriptPreview.length}
                          </span>
                        </div>
                        <textarea
                          value={audioTranscriptPreview}
                          onChange={(e) => setAudioTranscriptPreview(e.target.value)}
                          placeholder={
                            language === 'kz'
                              ? 'Стенограмма мәтіні осында көрсетіледі...'
                              : 'Здесь отобразится текст речи после транскрибации...'
                          }
                          rows={3}
                          className="w-full bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: URL */}
          {activeTab === 'url' && (
            <div className="flex flex-col gap-3.5">
              <div className="relative flex items-center">
                <Link2 className="w-4 h-4 text-zinc-400 absolute left-3.5" strokeWidth={1.6} />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (restrictedUrlNotice) setRestrictedUrlNotice(null);
                  }}
                  placeholder="https://t.me/..., https://youtube.com/..., https://tengrinews.kz/..., https://tiktok.com/..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 pl-10 pr-20 py-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
                />
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('');
                      setRestrictedUrlNotice(null);
                    }}
                    className="absolute right-2 px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    {t('ocrClear')}
                  </button>
                )}
              </div>

              {restrictedUrlNotice && (
                <div className="p-4 rounded-xl bg-amber-50/90 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-900/70 flex flex-col gap-3">
                  <div className="flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" strokeWidth={1.7} />
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-amber-950 dark:text-amber-100">
                        {restrictedUrlNotice}
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                        {language === 'kz'
                          ? 'Қате орнына CheckActivity скриншотты жүктеуге немесе мәтінді қоюға көшеді:'
                          : 'Вместо ошибки или домысла CheckActivity предлагает перейти к проверке по скриншоту или тексту:'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRestrictedUrlNotice(null);
                        setActiveTab('file');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:opacity-90 transition-opacity"
                    >
                      <FileUp className="w-3.5 h-3.5" strokeWidth={1.6} />
                      <span>{language === 'kz' ? 'Скриншот жүктеу' : 'Загрузить скриншот'}</span>
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRestrictedUrlNotice(null);
                        setActiveTab('text');
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-medium hover:bg-amber-100/60 dark:hover:bg-amber-900/40 transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" strokeWidth={1.6} />
                      <span>{language === 'kz' ? 'Жарияланым мәтінін қою' : 'Скопировать и вставить текст'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="p-4 bg-zinc-50/70 dark:bg-zinc-950/50 border border-zinc-200/80 dark:border-zinc-800 rounded-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-[11px] font-['JetBrains_Mono'] text-zinc-500">
                  <span>
                    {language === 'kz' ? 'Қолдау көрсетілетін сілтемелер' : 'Поддерживаемые источники'}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">On-Demand URL Parser</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {[
                    {
                      name: language === 'kz' ? 'Веб-сайттар / БАҚ' : 'Веб-сайты / СМИ',
                      match: /^https?:\/\//i.test(urlInput) && !urlInput.includes('youtube') && !urlInput.includes('youtu.be') && !urlInput.includes('tiktok') && !urlInput.includes('t.me') && !urlInput.includes('instagram.com'),
                    },
                    { name: 'Telegram (t.me)', match: urlInput.includes('t.me') || urlInput.includes('telegram.me') },
                    { name: 'YouTube / Shorts', match: urlInput.includes('youtube.com') || urlInput.includes('youtu.be') },
                    { name: 'TikTok / Reels', match: urlInput.includes('tiktok.com') || urlInput.includes('instagram.com') },
                  ].map((p) => (
                    <div
                      key={p.name}
                      className={`p-2.5 rounded-xl border text-center font-medium transition-colors ${
                        p.match
                          ? 'bg-zinc-900 dark:bg-zinc-100 border-zinc-900 dark:border-zinc-100 text-white dark:text-zinc-900'
                          : 'bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {language === 'kz'
                    ? 'Жүйе веб-беттердің HTML/OpenGraph мәтінін, ашық Telegram-арналардың жазбаларын және YouTube/TikTok метадеректерін нақты уақытта жүктейді. Жабық аккаунттар үшін скриншот жүктеу немесе мәтін қою ұсынылады.'
                    : 'Парсер по запросу извлекает текст публичных постов Telegram (t.me/s/...), YouTube/Shorts, TikTok и веб-страниц РК. Если профиль закрыт или ограничен, система безопасно перенаправит на загрузку скриншота или текста.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: TEXT */}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-3">
              <textarea
                rows={6}
                value={textInput}
                onChange={(e) => {
                  const val = e.target.value;
                  setTextInput(val);
                  textInputDirtyRef.current = val.trim().length > 0;
                }}
                placeholder={t('textPlaceholder')}
                className="w-full bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none leading-relaxed"
              />
              <div className="flex flex-wrap justify-between items-center gap-1 text-[11px] text-zinc-400 dark:text-zinc-500 font-['JetBrains_Mono']">
                <span className="tabular-nums">
                  {t('ocrSymbols')}: {textInput.length}
                </span>
                <span>
                  {language === 'kz'
                    ? 'ҚР ӘҚБтК, № 230-VII Заңы және этика нормалары'
                    : 'Проверка по КоАП РК, Закону № 230-VII и этике'}
                </span>
              </div>

              {/* Real-time Live Pre-Check Sandbox */}
              {textInput.trim().length > 3 && (() => {
                const pre = runLivePreCheck(textInput, undefined, 'small', language);
                const statusLabel = language === 'kz' ? pre.statusLabelKz : pre.statusLabelRu;
                const penaltySummary = language === 'kz' ? pre.penaltySummaryKz : pre.penaltySummaryRu;
                return (
                  <div className="p-3.5 rounded-xl bg-zinc-50/90 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${
                            pre.status === 'critical'
                              ? 'bg-rose-500'
                              : pre.status === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {language === 'kz' ? 'Жарияланым алдындағы тәуекел:' : 'Индекс риска (Pre-Check):'}
                        </span>
                        <span className="font-['JetBrains_Mono'] font-bold tabular-nums text-zinc-950 dark:text-zinc-50">
                          {pre.riskScore} / 100
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-['JetBrains_Mono'] font-bold border ${
                            pre.status === 'critical'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : pre.status === 'warning'
                              ? 'bg-amber-500 text-zinc-950 border-amber-500'
                              : 'bg-emerald-600 text-white border-emerald-600'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <span className="text-[11px] font-['JetBrains_Mono'] px-2 py-0.5 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300">
                        {pre.languageCoverage === 'bilingual'
                          ? 'KZ + RU'
                          : pre.languageCoverage === 'kz_only'
                          ? 'KZ'
                          : pre.languageCoverage === 'ru_only'
                          ? (language === 'kz' ? 'Тек RU (ст. 21)' : 'Только RU (ст. 21)')
                          : 'Neutral'}
                      </span>
                    </div>

                    <div className="text-[11px] font-['JetBrains_Mono'] font-semibold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-200/80 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-zinc-500 dark:text-zinc-400 font-normal">
                        {language === 'kz' ? 'Болжамды айыппұл (ШОБ):' : 'Предв. оценка штрафа (МБ):'}
                      </span>
                      <span
                        className={
                          pre.penaltyCalc.maxKzt > 0
                            ? 'text-rose-700 dark:text-rose-400'
                            : pre.triggers.length > 0
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }
                      >
                        {penaltySummary}
                      </span>
                    </div>

                    {pre.triggers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {pre.triggers.map((trg) => (
                          <span
                            key={trg.id}
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                              trg.category === 'legal' && trg.severity === 'critical'
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-900'
                                : trg.category === 'ethics'
                                ? 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-900'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-900'
                            }`}
                          >
                            <span className="font-['JetBrains_Mono'] text-[9px] uppercase opacity-75">
                              {trg.category === 'legal'
                                ? language === 'kz'
                                  ? 'ҚР Заңы'
                                  : 'Закон РК'
                                : 'Этика'}
                            </span>
                            <span>· {language === 'kz' ? trg.labelKz : trg.labelRu}</span>
                            <span className="font-['JetBrains_Mono'] text-[10px] opacity-75">({trg.article})</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        {language === 'kz'
                          ? 'Алдын ала тексеру бойынша айқын бұзушылық триггерлері табылмады.'
                          : 'Явных триггеров нарушений при экспресс-проверке не обнаружено.'}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Dynamic Emoji Intelligence Inspector */}
        {(() => {
          const textToInspect = `${ocrText} ${textInput} ${urlInput} ${audioTranscriptPreview} ${videoCaption} ${fileTextNote}`;
          const currentEmojiAnalysis = analyzeEmojis(textToInspect);
          if (currentEmojiAnalysis.detectedEmojis.length === 0) return null;

          return (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" strokeWidth={1.6} />
                  {language === 'kz'
                    ? `Эмодзилер мен жасырын триггерлер (${currentEmojiAnalysis.detectedEmojis.length})`
                    : `Эмодзи и скрытые триггеры (${currentEmojiAnalysis.detectedEmojis.length})`}
                </span>
                <span className="text-[11px] font-['JetBrains_Mono'] font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                  +{currentEmojiAnalysis.totalRiskPoints} pts
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {currentEmojiAnalysis.detectedEmojis.map((emoji) => {
                  const info = EMOJI_DICTIONARY[emoji];
                  return (
                    <span
                      key={emoji}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200"
                    >
                      <span className="text-sm leading-none">{emoji}</span>
                      <span className="text-[11px]">{info ? info.label : language === 'kz' ? 'Таңба' : 'Символ'}</span>
                    </span>
                  );
                })}
              </div>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
                {currentEmojiAnalysis.summary}
              </p>
            </div>
          );
        })()}

        {/* Automatic Compliance Coverage Bar + Collapsed Advanced Options */}
        <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 min-w-0">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.7} />
              <span className="font-medium truncate sm:whitespace-normal">
                {language === 'kz'
                  ? 'ҚР ӘҚБтК, № 230-VII Заңы, ҚК және цифрлық этиканың 12 нормасы бойынша автоматты тексеру'
                  : 'Автоматическая проверка по 12 нормам КоАП РК, Закона № 230-VII, УК РК и цифровой этики'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 shrink-0 self-start sm:self-auto transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.6} />
              <span>{language === 'kz' ? 'Қосымша параметрлер' : 'Расширенные параметры'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                strokeWidth={1.6}
              />
            </button>
          </div>

          {showAdvanced && (
            <div className="p-4 rounded-xl bg-zinc-50/60 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-4">
              {/* Auto-Audit Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-zinc-700 dark:text-zinc-300 shrink-0" strokeWidth={1.6} />
                  <div>
                    <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                      {language === 'kz'
                        ? 'Бірден автоматты тексеру (Auto-Audit)'
                        : 'Экспресс-проверка сразу при загрузке файла'}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {language === 'kz'
                        ? 'Файлды тастаған сәтте бірден сараптама басталады'
                        : 'После распознавания файла аудит запустится автоматически'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAutoAuditOnUpload(!autoAuditOnUpload)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    autoAuditOnUpload
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                  }`}
                >
                  {autoAuditOnUpload ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" strokeWidth={1.8} />
                  ) : (
                    <Circle className="w-3.5 h-3.5" strokeWidth={1.6} />
                  )}
                  <span>
                    {autoAuditOnUpload
                      ? language === 'kz'
                        ? 'Қосулы'
                        : 'Включено'
                      : language === 'kz'
                      ? 'Өшірулі'
                      : 'Выкл'}
                  </span>
                </button>
              </div>

              {/* Optional Context Note */}
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                  {t('noteLabel')}
                </label>
                <input
                  type="text"
                  value={fileTextNote}
                  onChange={(e) => setFileTextNote(e.target.value)}
                  placeholder={t('notePlaceholder')}
                  className="w-full bg-white dark:bg-zinc-900 px-3.5 py-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
                />
              </div>

              {/* Read-only summary of the 12 audited norms */}
              <div>
                <div className="text-[11px] font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400 mb-2">
                  {language === 'kz'
                    ? 'Белсенді комплаенс-модульдер (12 норма):'
                    : 'Активные модули проверки (все 12 норм включены автоматически):'}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {ALL_COMPLIANCE_FILTERS.map((filter) => (
                    <div
                      key={filter.id}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/70 dark:border-zinc-800 text-[11px]"
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                          filter.type === 'ethics' ? 'text-violet-500' : 'text-emerald-500'
                        }`}
                        strokeWidth={1.7}
                      />
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-800 dark:text-zinc-200 truncate">
                          {filter.name}
                        </div>
                        <div className="text-[10px] font-['JetBrains_Mono'] text-zinc-400 truncate">
                          {filter.article}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4-Step Animated Progress Indicator (< 3s pipeline) & Primary CTA */}
        <div className="pt-1 flex flex-col gap-3">
          {isProcessing && (
            <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-[11px] font-['JetBrains_Mono'] text-zinc-500 dark:text-zinc-400">
                <span>
                  {language === 'kz'
                    ? 'Мультимодальды комплаенс-конвейер (4 кезең)'
                    : 'Мультимодальный комплаенс-конвейер (4 шага)'}
                </span>
                <span className="tabular-nums font-semibold text-zinc-900 dark:text-zinc-100">
                  {processingStepIndex} / 4
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-full transition-all duration-300"
                  style={{ width: `${processingStepIndex * 25}%` }}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                  {
                    step: 1,
                    titleRu:
                      processingModality === 'video'
                        ? 'Извлечение 5 кадров и аудиодорожки'
                        : 'Извлечение текста (KZ/RU OCR) и метаданных',
                    titleKz:
                      processingModality === 'video'
                        ? '5 негізгі кадр мен аудионы шығару'
                        : 'Мәтінді (KZ/RU OCR) және метадеректерді шығару',
                  },
                  {
                    step: 2,
                    titleRu:
                      processingModality === 'video'
                        ? 'Распознавание текста (OCR) и речи'
                        : 'Мультимодальный анализ (Vision AI)',
                    titleKz:
                      processingModality === 'video'
                        ? 'Кадрдағы мәтін (OCR) мен сөзді тану'
                        : 'Мультимодальды талдау (Vision AI)',
                  },
                  {
                    step: 3,
                    titleRu: 'Юридический AI-аудит РК (КоАП / № 230-VII)',
                    titleKz: 'ҚР ӘҚБтК, ҚК және № 230-VII AI-аудиті',
                  },
                  {
                    step: 4,
                    titleRu: 'Формирование SHA-256 отчёта',
                    titleKz: 'SHA-256 есебін қалыптастыру',
                  },
                ].map((item) => {
                  const isDone = processingStepIndex > item.step;
                  const isCurrent = processingStepIndex === item.step;
                  return (
                    <div
                      key={item.step}
                      className={`px-2.5 py-2 rounded-lg border text-[11px] flex items-center gap-2 transition-colors ${
                        isCurrent
                          ? 'bg-white dark:bg-zinc-900 border-zinc-900 dark:border-zinc-100 text-zinc-950 dark:text-zinc-50 font-medium'
                          : isDone
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300'
                          : 'bg-white/50 dark:bg-zinc-900/40 border-zinc-200/60 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" strokeWidth={1.8} />
                      ) : isCurrent ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" strokeWidth={1.8} />
                      ) : (
                        <Circle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.6} />
                      )}
                      <span className="line-clamp-2 leading-tight">
                        {language === 'kz' ? item.titleKz : item.titleRu}
                      </span>
                    </div>
                  );
                })}
              </div>
              {isSlowNetwork && (
                <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>
                    {language === 'kz'
                      ? 'Желі баяу немесе ауқымды медиафайл өңделуде — мультимодальды AI-аудит жалғасуда...'
                      : 'Соединение медленное или обрабатывается объёмный медиафайл — мультимодальный AI-аудит продолжается...'}
                  </span>
                </div>
              )}
            </div>
          )}

          {auditError && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-50/85 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/80 text-rose-950 dark:text-rose-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" strokeWidth={1.8} />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold">
                    {language === 'kz' ? 'Тексеру сәтсіз аяқталды' : 'Ошибка при выполнении аудита'}
                  </div>
                  <div className="text-xs text-rose-800 dark:text-rose-200 mt-0.5 leading-relaxed">
                    {auditError}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    if (lastPayloadRef.current) {
                      executeDirectPayload(lastPayloadRef.current);
                    } else {
                      handleExecute();
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.8} />
                  <span>{language === 'kz' ? 'Қайталау' : 'Повторить'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuditError(null)}
                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 hover:bg-rose-100/70 dark:hover:bg-rose-900/40 transition-colors"
                  title={language === 'kz' ? 'Жабу' : 'Закрыть'}
                >
                  <X className="w-4 h-4" strokeWidth={1.6} />
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            disabled={isProcessing}
            onClick={handleExecute}
            className={`w-full py-3.5 px-6 rounded-xl font-['Inter'] font-semibold text-sm flex items-center justify-center gap-2.5 transition-all ${
              isProcessing
                ? 'bg-zinc-700 dark:bg-zinc-300 text-white dark:text-zinc-900 opacity-85 cursor-wait'
                : 'bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 active:scale-[0.995]'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="truncate">{processingStep}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" strokeWidth={1.8} />
                <span>{t('executeBtn')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
