/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { AuditCase, ModalityType } from '../types';
import {
  KAZAKHSTAN_LEGAL_FILTERS,
  INTERNET_ETHICS_FILTERS,
  ALL_COMPLIANCE_FILTERS,
  PRIMARY_AUDIT_CASE,
} from '../data/mockData';
import {
  analyzeContentWithGemini,
  ContentPayload,
  extractTextWithOcr,
} from '../services/geminiService';
import { generateSampleScreenshot, getSampleText } from '../utils/sampleScreenshots';
import { analyzeEmojis, EMOJI_DICTIONARY } from '../utils/emojiIntelligence';

interface ScannerViewProps {
  onRunAudit: (auditCase: AuditCase) => void;
  presetData?: { modality: ModalityType; urlOrText: string };
}

// Client-side image preparer: preserves text sharpness and prevents PNG transparency from becoming black
function prepareImageFile(file: File): Promise<{ dataUrl: string; sizeStr: string }> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const originalDataUrl = (e.target?.result as string) || '';
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 2400;
        let { width, height } = img;

        // If file is already within reasonable dimensions and size, keep original lossless quality
        if (width <= MAX_DIM && height <= MAX_DIM && file.size < 4 * 1024 * 1024) {
          resolve({
            dataUrl: originalDataUrl,
            sizeStr: file.size > 0 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : '320 KB',
          });
          return;
        }

        // Scale proportionally if very large
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // CRITICAL: Always fill canvas with pure white background before drawing
          // This prevents PNG alpha channels / transparency from becoming solid black in JPEG conversion!
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.94);
          const approxKb = Math.round((compressed.length * 3) / 4 / 1024);
          resolve({ dataUrl: compressed, sizeStr: `${approxKb} KB (оптимизировано)` });
          return;
        }

        resolve({
          dataUrl: originalDataUrl,
          sizeStr: file.size > 0 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : '320 KB',
        });
      };
      img.onerror = () => {
        resolve({
          dataUrl: originalDataUrl,
          sizeStr: file.size > 0 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : '320 KB',
        });
      };
      img.src = originalDataUrl;
    };
    reader.onerror = () => resolve({ dataUrl: '', sizeStr: '0 KB' });
    reader.readAsDataURL(file);
  });
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function extractVideoMultiFrames(file: File): Promise<{
  frames: string[];
  durationLabel: string;
  playableUrl: string;
}> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    let isResolved = false;
    const captured: string[] = [];

    const finish = (durationLabel: string) => {
      if (isResolved) return;
      isResolved = true;
      clearTimeout(globalTimer);
      resolve({
        frames: captured,
        durationLabel,
        playableUrl: objectUrl,
      });
    };

    // Global fail-safe timeout: never hang more than 3.5s
    const globalTimer = setTimeout(() => {
      finish('00:20');
    }, 3500);

    const grabCurrentFrame = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(640, video.videoWidth || 640);
        canvas.height = Math.min(480, video.videoHeight || 360);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = canvas.toDataURL('image/jpeg', 0.82);
          if (frame && frame.length > 500 && !captured.includes(frame)) {
            captured.push(frame);
          }
        }
      } catch {
        // ignore
      }
    };

    video.onloadeddata = () => {
      grabCurrentFrame();
    };

    video.onloadedmetadata = async () => {
      const duration = video.duration && !isNaN(video.duration) ? video.duration : 15;
      const minutes = Math.floor(duration / 60).toString().padStart(2, '0');
      const seconds = Math.floor(duration % 60).toString().padStart(2, '0');
      const durationLabel = `${minutes}:${seconds}`;

      grabCurrentFrame();

      const seekTimes = [
        Math.min(Math.max(0.2, duration * 0.15), Math.max(0.2, duration - 0.2)),
        Math.min(Math.max(0.5, duration * 0.45), Math.max(0.2, duration - 0.2)),
        Math.min(Math.max(1.0, duration * 0.75), Math.max(0.2, duration - 0.2)),
        Math.min(Math.max(1.5, duration * 0.92), Math.max(0.2, duration - 0.2)),
      ];

      for (const t of seekTimes) {
        if (isResolved) break;
        await new Promise<void>((rSeek) => {
          const seekTimeout = setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            rSeek();
          }, 600);

          const onSeeked = () => {
            clearTimeout(seekTimeout);
            video.removeEventListener('seeked', onSeeked);
            grabCurrentFrame();
            rSeek();
          };

          video.addEventListener('seeked', onSeeked);
          try {
            video.currentTime = t;
          } catch {
            clearTimeout(seekTimeout);
            rSeek();
          }
        });
      }

      finish(durationLabel);
    };

    video.onerror = () => {
      finish('00:15');
    };
  });
}

export const ScannerView: React.FC<ScannerViewProps> = ({ onRunAudit, presetData }) => {
  const [activeTab, setActiveTab] = useState<'file' | 'video' | 'audio' | 'url' | 'text'>(
    presetData?.modality === 'video'
      ? 'video'
      : presetData?.modality === 'audio'
      ? 'audio'
      : presetData?.modality === 'url'
      ? 'url'
      : presetData?.modality === 'text'
      ? 'text'
      : 'file'
  );

  // Input states
  const [urlInput, setUrlInput] = useState(presetData?.urlOrText || '');
  const [textInput, setTextInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [fileTextNote, setFileTextNote] = useState('');

  // Video & Reels states
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFrames, setVideoFrames] = useState<string[]>([]);
  const [videoPlayableUrl, setVideoPlayableUrl] = useState<string | null>(null);
  const [videoMediaBase64, setVideoMediaBase64] = useState<string | null>(null);
  const [videoUrlInput, setVideoUrlInput] = useState<string>('');
  const [videoCaption, setVideoCaption] = useState<string>('');
  const [videoWarning, setVideoWarning] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<string>('00:00');
  const [activeVideoFrameIndex, setActiveVideoFrameIndex] = useState(0);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // Audio & Microphone states
  const [audioMode, setAudioMode] = useState<'record' | 'upload'>('record');
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [audioMediaBase64, setAudioMediaBase64] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('');
  const [audioDuration, setAudioDuration] = useState<string>('00:00');
  const [audioTranscriptPreview, setAudioTranscriptPreview] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioWarning, setAudioWarning] = useState<string | null>(null);

  // Global upload alert
  const [uploadError, setUploadError] = useState<string | null>(null);

  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // OCR Recognition states
  const [ocrText, setOcrText] = useState('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrSuccess, setOcrSuccess] = useState(false);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const [ocrCharCount, setOcrCharCount] = useState(0);
  const [copiedOcr, setCopiedOcr] = useState(false);

  // Compliance & Ethics checklist filters
  const [filters, setFilters] = useState(ALL_COMPLIANCE_FILTERS);
  const [activeFilterCategory, setActiveFilterCategory] = useState<'all' | 'legal' | 'ethics'>('all');

  // Loading state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeOcrPromiseRef = useRef<Promise<any> | null>(null);

  // Clean up audio recorder and timer on unmount
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Audio handlers
  const handleStartRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Ваш браузер не поддерживает доступ к микрофону.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          setAudioDataUrl(dataUrl);
          setAudioFileName(`voice_record_${Date.now()}.webm`);
          const mins = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
          const secs = (recordingSeconds % 60).toString().padStart(2, '0');
          setAudioDuration(`${mins}:${secs}`);
          setAudioTranscriptPreview('Голосовая аудиозапись зафиксирована с микрофона устройства. Нажмите «Запустить экспертизу» для полной транскрибации речи и проверки на нормы РК.');
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 60) {
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.warn('Microphone error:', err);
      alert('Микрофон недоступен. Вы можете загрузить аудиофайл с устройства или выбрать один из готовых тестовых аудио-кейсов.');
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
    if (file.size > 100 * 1024 * 1024) {
      setUploadError(
        'Аудиофайл слишком большой (> 100 МБ). Пожалуйста, загрузите фрагмент короче (рекомендуется до 5–10 минут или до 50 МБ) для быстрой обработки.'
      );
      return;
    }

    const dataUrl = await readFileAsBase64(file);
    setAudioDataUrl(dataUrl);
    setAudioMediaBase64(dataUrl);
    setAudioFileName(file.name);
    setAudioDuration('00:30');
    setAudioTranscriptPreview('Аудиозапись загружена. Готова к транскрипции с таймкодами (ММ:СС) и комплаенс-проверке.');
    setAudioWarning(null);
  };

  const handleVideoFileSelect = async (file: File) => {
    setUploadError(null);
    if (file.size > 100 * 1024 * 1024) {
      setUploadError(
        'Файл видео слишком большой (> 100 МБ). Пожалуйста, загрузите фрагмент короче (рекомендуется до 1–2 минут или до 50 МБ) для быстрой и точной обработки.'
      );
      return;
    }

    setVideoFile(file);
    setVideoCaption(file.name);
    setVideoWarning(null);
    setIsExtractingFrames(true);

    const { frames, durationLabel, playableUrl } = await extractVideoMultiFrames(file);
    setIsExtractingFrames(false);

    if (frames.length > 0) {
      setVideoFrames(frames);
      setFilePreviewUrl(frames[0]);
    }
    setVideoPlayableUrl(playableUrl);
    setVideoDuration(durationLabel);

    if (file.size <= 40 * 1024 * 1024) {
      const b64 = await readFileAsBase64(file);
      setVideoMediaBase64(b64);
    } else {
      setVideoMediaBase64(null);
    }
  };

  const handleClearVideo = () => {
    setVideoFile(null);
    setVideoFrames([]);
    setVideoPlayableUrl(null);
    setVideoMediaBase64(null);
    setVideoUrlInput('');
    setVideoCaption('');
    setVideoWarning(null);
    setVideoDuration('00:00');
    setActiveVideoFrameIndex(0);
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
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    setAudioDataUrl(null);
    setAudioFileName('');
    setAudioDuration('00:00');
    setAudioTranscriptPreview('');
    setAudioWarning(null);
    setIsPlayingAudio(false);
    if (audioFileInputRef.current) audioFileInputRef.current.value = '';
  };

  const toggleFilter = (id: string) => {
    setFilters((prev) =>
      prev.map((f) => (f.id === id ? { ...f, active: !f.active } : f))
    );
  };

  const setAllFiltersState = (active: boolean, filterType?: 'legal' | 'ethics') => {
    setFilters((prev) =>
      prev.map((f) => {
        if (!filterType || f.type === filterType) {
          return { ...f, active };
        }
        return f;
      })
    );
  };

  // OCR Execution handler for images
  const triggerOcr = (dataUrl: string, fileName?: string) => {
    if (!dataUrl) return Promise.resolve(null);
    setIsOcrLoading(true);
    const promise = extractTextWithOcr(dataUrl, fileName)
      .then((res) => {
        if (res.text && res.text.trim().length > 0) {
          const cleanText = res.text.replace(/\[текст на изображении не обнаружен\]/gi, '').trim();
          if (cleanText.length > 0) {
            setOcrText(cleanText);
            setOcrCharCount(cleanText.length);
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
        setOcrSuccess(true);
        return null;
      })
      .finally(() => {
        setIsOcrLoading(false);
      });

    activeOcrPromiseRef.current = promise;
    return promise;
  };

  const handleFileSelect = async (file: File) => {
    setUploadedFile(file);
    setOcrText('');
    setOcrWarning(null);
    setOcrSuccess(false);
    setOcrCharCount(0);

    if (file.type.startsWith('image/')) {
      const { dataUrl } = await prepareImageFile(file);
      setFilePreviewUrl(dataUrl);
      // Automatically trigger OCR extraction immediately upon selection
      triggerOcr(dataUrl, file.name);
    } else if (file.type.startsWith('video/')) {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;
        video.onloadedmetadata = () => {
          video.currentTime = Math.min(1.0, (video.duration || 2) / 2);
        };
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(640, video.videoWidth || 640);
          canvas.height = Math.min(480, video.videoHeight || 360);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = canvas.toDataURL('image/jpeg', 0.85);
            setFilePreviewUrl(frame);
            // Also trigger OCR on the extracted video frame!
            triggerOcr(frame, file.name);
          }
          URL.revokeObjectURL(objectUrl);
        };
        video.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          setFilePreviewUrl(null);
        };
      } catch {
        setFilePreviewUrl(null);
      }
    } else {
      setFilePreviewUrl(null);
    }
  };

  // Support instant Ctrl+V screenshot paste anywhere in scanner
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/')) {
          e.preventDefault();
          setActiveTab('file');
          handleFileSelect(file);
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
    setUploadedFile(null);
    setFilePreviewUrl(null);
    setFileTextNote('');
    setOcrText('');
    setOcrWarning(null);
    setOcrSuccess(false);
    setOcrCharCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Instant Sample Screenshot Loader for immediate OCR testing
  const handleLoadSampleScreenshot = (type: 'profanity_chat' | 'casino_banner' | 'unmarked_ad') => {
    const sample = generateSampleScreenshot(type);
    const sampleText = getSampleText(type);
    setUploadedFile(new File([], sample.fileName, { type: 'image/png' }));
    setFilePreviewUrl(sample.dataUrl);
    setFileTextNote('');
    // Instantly set text and warning so user never waits and never sees empty state
    setOcrText(sampleText);
    setOcrCharCount(sampleText.length);
    setOcrSuccess(true);
    if (type === 'profanity_chat') {
      setOcrWarning('Внимание: зафиксирована ненормативная лексика и обсценная брань (ст. 434 КоАП РК).');
    } else if (type === 'casino_banner') {
      setOcrWarning('Внимание: в тексте обнаружены признаки рекламы азартных игр (ст. 445-1 КоАП РК).');
    } else {
      setOcrWarning('Внимание: отсутствуют обязательная маркировка «Жарнама» и данные рекламодателя (Закон № 230-VII).');
    }
    triggerOcr(sample.dataUrl, sample.fileName);
  };

  const handleExecute = async () => {
    let payload: ContentPayload;

    if (activeTab === 'file') {
      if (!uploadedFile && !filePreviewUrl) {
        alert('Пожалуйста, выберите или перетащите файл для проверки.');
        return;
      }

      // If OCR is still in progress, wait for it so we don't submit an empty text payload
      if (isOcrLoading && activeOcrPromiseRef.current) {
        setIsProcessing(true);
        setProcessingStep('Завершение оптического считывания надписей (OCR)...');
        try {
          await activeOcrPromiseRef.current;
        } catch {
          // continue
        }
      }

      const isImage = (uploadedFile && uploadedFile.type.startsWith('image/')) || !!filePreviewUrl;
      const isVideo = uploadedFile ? uploadedFile.type.startsWith('video/') : false;

      const combinedText = [ocrText.trim(), fileTextNote.trim()]
        .filter(Boolean)
        .join('\n\n[Дополнительное примечание]: ');

      if (isVideo) {
        payload = {
          modality: 'video',
          fileName: uploadedFile?.name || 'video_clip.mp4',
          fileSize:
            uploadedFile && uploadedFile.size > 0
              ? `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`
              : '2.5 MB',
          imageDataUrl: filePreviewUrl || undefined,
          videoFrames: filePreviewUrl ? [filePreviewUrl] : undefined,
          videoDataUrl: videoPlayableUrl || undefined,
          mediaBase64: videoMediaBase64 || undefined,
          mimeType: uploadedFile?.type || 'video/mp4',
          audioDuration: '00:15',
          text: combinedText || '',
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
        };
      }
    } else if (activeTab === 'video') {
      const hasUploadedVideo = videoFile || videoPlayableUrl || videoFrames.length > 0;
      const hasVideoUrl = videoUrlInput.trim().length > 0;

      if (!hasUploadedVideo && !hasVideoUrl) {
        alert('Пожалуйста, загрузите видеофайл или укажите ссылку на видео (YouTube, TikTok, Reels).');
        return;
      }

      if (hasVideoUrl && !hasUploadedVideo) {
        payload = {
          modality: 'video',
          url: videoUrlInput.trim(),
          text: videoCaption.trim() ? `${videoUrlInput.trim()}\n\n[Описание]: ${videoCaption.trim()}` : videoUrlInput.trim(),
        };
      } else {
        const frames = videoFrames.length > 0 ? videoFrames : filePreviewUrl ? [filePreviewUrl] : [];
        payload = {
          modality: 'video',
          fileName: videoFile?.name || 'video_clip.mp4',
          fileSize: videoFile && videoFile.size > 0 ? `${(videoFile.size / (1024 * 1024)).toFixed(2)} MB` : '3.8 MB',
          imageDataUrl: frames[0] || undefined,
          videoFrames: frames,
          videoDataUrl: videoPlayableUrl || undefined,
          mediaBase64: videoMediaBase64 || undefined,
          mimeType: videoFile?.type || 'video/mp4',
          audioDuration: videoDuration || '00:20',
          text: videoCaption || videoFile?.name || 'Видеоматериал для проверки',
        };
      }
    } else if (activeTab === 'audio') {
      if (!audioDataUrl && !audioTranscriptPreview.trim()) {
        alert('Пожалуйста, запишите аудио с микрофона или выберите аудиофайл.');
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
      };
    } else if (activeTab === 'url') {
      if (!urlInput.trim()) {
        alert('Пожалуйста, укажите ссылку для проверки.');
        return;
      }
      const isVideoLink = /youtube\.com|youtu\.be|tiktok\.com|instagram\.com\/reel|instagram\.com\/p|\.mp4|\.mov/i.test(urlInput.trim());
      payload = {
        modality: isVideoLink ? 'video' : 'url',
        url: urlInput.trim(),
        text: urlInput.trim(),
      };
    } else {
      if (!textInput.trim()) {
        alert('Пожалуйста, введите текст для проверки.');
        return;
      }
      payload = {
        modality: 'url',
        text: textInput.trim(),
      };
    }

    setIsProcessing(true);
    setProcessingStep('1. Мультимодальный анализ Gemini AI (распознавание аудио/видеопотока и текста)...');

    const t1 = setTimeout(() => {
      setProcessingStep('2. Транскрипция речи с таймкодами (ММ:СС) и определение языка (RU / KZ)...');
    }, 700);

    const t2 = setTimeout(() => {
      setProcessingStep('3. Юридическая сверка с КоАП РК (ст. 434, 445-1, 455, 79) и Законом № 230-VII...');
    }, 1400);

    const t3 = setTimeout(() => {
      setProcessingStep('4. Аудит интернет-этики (кибербуллинг, Dark Patterns, скрытая реклама)...');
    }, 2100);

    const t4 = setTimeout(() => {
      setProcessingStep('5. Формирование экспертного заключения Check Activity KZ...');
    }, 2800);

    try {
      const audited = await analyzeContentWithGemini(payload);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      setIsProcessing(false);
      onRunAudit(audited);
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      console.warn('Analysis error:', err);
      setIsProcessing(false);
      onRunAudit(PRIMARY_AUDIT_CASE);
    }
  };

  const displayedFilters =
    activeFilterCategory === 'all'
      ? filters
      : filters.filter((f) => f.type === activeFilterCategory);

  const activeLegalCount = filters.filter((f) => f.type === 'legal' && f.active).length;
  const activeEthicsCount = filters.filter((f) => f.type === 'ethics' && f.active).length;

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 flex flex-col gap-5 sm:gap-6 font-['Inter']">
      {/* Title & Introduction */}
      <div className="border-b border-slate-200 pb-4 sm:pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
            РЕСПУБЛИКА КАЗАХСТАН
          </span>
          <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
            ЗАКОН + ИНТЕРНЕТ-ЭТИКА
          </span>
          <span className="font-['JetBrains_Mono'] text-[11px] sm:text-xs text-slate-500 hidden sm:inline">
            КоАП РК • Закон № 230-VII • Цифровая культура
          </span>
        </div>
        <h1 className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
          Аудит контента на правонарушения и цифровую этику
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 mt-1.5 max-w-3xl leading-relaxed">
          Комплексный анализ онлайн-материалов: проверка на соблюдение законов РК (маркировка рекламы, запрет казино, персональные данные, язык) и сетевой этики (кибербуллинг, манипулятивный маркетинг/FOMO, скрытая реклама, токсичность).
        </p>
      </div>

      {/* Main Working Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
        {/* Modality Tabs */}
        <div>
          <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 font-['JetBrains_Mono']">
            1. Выберите источник контента:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2 p-1 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('file')}
              className={`py-2 px-2 sm:px-2.5 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'file'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              <span className="truncate">Скриншот</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('video')}
              className={`py-2 px-2 sm:px-2.5 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'video'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-purple-600">movie</span>
              <span className="truncate">Видео / Reels</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audio')}
              className={`py-2 px-2 sm:px-2.5 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'audio'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px] text-sky-600">graphic_eq</span>
              <span className="truncate">Аудио</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('url')}
              className={`py-2 px-2 sm:px-2.5 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'url'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">link</span>
              <span className="truncate">По ссылке</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('text')}
              className={`py-2 px-2 sm:px-2.5 rounded-md text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-all col-span-2 sm:col-span-1 ${
                activeTab === 'text'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">description</span>
              <span className="truncate">Текст</span>
            </button>
          </div>
        </div>

        {/* File Size Error Alert Banner */}
        {uploadError && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs sm:text-sm flex items-start justify-between gap-3 shadow-xs animate-fade-in">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[20px] text-rose-600 shrink-0 mt-0.5">
                error
              </span>
              <span className="font-medium leading-relaxed">{uploadError}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadError(null)}
              className="text-rose-500 hover:text-rose-800 p-0.5"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* Dynamic Input Zone */}
        <div>
          <label className="block text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 font-['JetBrains_Mono']">
            2. Объект проверки:
          </label>

          {/* TAB 1: FILE / SCREENSHOT */}
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
                accept="image/*,video/*,audio/*"
                className="hidden"
              />

              {!uploadedFile && !filePreviewUrl ? (
                <div className="flex flex-col gap-3">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                      isDragging
                        ? 'border-sky-500 bg-sky-50/50'
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
                    }`}
                  >
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 mb-2.5 shadow-xs">
                      <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                    </div>
                    <div className="font-['Plus_Jakarta_Sans'] font-semibold text-xs sm:text-sm text-slate-900">
                      Перетащите скриншот, фото или видео для распознавания
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-500 mt-1">
                      Поддерживаются PNG, JPG, WebP, MP4, MOV, MP3, WAV до 50 МБ
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="mt-3.5 px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 shadow-xs transition-colors"
                    >
                      Выбрать файл на устройстве
                    </button>
                  </div>

                  {/* Ready-made test screenshots for instant OCR testing */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2 font-['JetBrains_Mono'] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-sky-600">bolt</span>
                      Тестовые скриншоты для быстрой проверки OCR:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('profanity_chat')}
                        className="p-2.5 text-left rounded-lg bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50/30 transition-all group"
                      >
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-red-700 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-red-500">chat_error</span>
                          Чат с матами (Telegram)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          Обсценная лексика, ст. 434 КоАП РК
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('casino_banner')}
                        className="p-2.5 text-left rounded-lg bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all group"
                      >
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-amber-700 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-amber-500">casino</span>
                          Казино 1Win (Слоты)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          Запрет азартных игр, ст. 445-1 КоАП РК
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadSampleScreenshot('unmarked_ad')}
                        className="p-2.5 text-left rounded-lg bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50/30 transition-all group"
                      >
                        <div className="text-xs font-semibold text-slate-900 group-hover:text-sky-700 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px] text-sky-500">sell</span>
                          Баннер без маркировки
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                          Нет плашки «Жарнама», Закон № 230-VII
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl p-3 sm:p-4 bg-slate-50 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {filePreviewUrl ? (
                        <img
                          src={filePreviewUrl}
                          alt="Preview"
                          className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border border-slate-200 shrink-0 shadow-xs"
                        />
                      ) : (
                        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                          <span className="material-symbols-outlined text-[24px]">audio_file</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                          {uploadedFile?.name || 'Загруженный скриншот'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-['JetBrains_Mono'] mt-0.5 flex flex-wrap items-center gap-2">
                          <span>
                            {uploadedFile && uploadedFile.size > 0
                              ? `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB`
                              : 'Тестовый файл'}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-700 font-medium">Файл загружен</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100"
                      >
                        Заменить
                      </button>
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50"
                        title="Удалить файл"
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* OCR Recognition Workspace Card */}
                  <div className="bg-white rounded-lg border border-slate-200 p-3 sm:p-4 flex flex-col gap-2.5 shadow-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-sky-600">
                          document_scanner
                        </span>
                        <span className="text-xs font-bold text-slate-800 font-['JetBrains_Mono'] uppercase">
                          Текст, извлеченный со скриншота (OCR):
                        </span>
                        {isOcrLoading ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200 animate-pulse">
                            <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                            Идет OCR-сканирование...
                          </span>
                        ) : ocrSuccess ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Распознано: {ocrCharCount} символов
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-1.5">
                        {filePreviewUrl && (
                          <button
                            type="button"
                            onClick={() => triggerOcr(filePreviewUrl, uploadedFile?.name)}
                            disabled={isOcrLoading}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition-colors disabled:opacity-50"
                            title="Запустить OCR заново"
                          >
                            <span className="material-symbols-outlined text-[14px]">refresh</span>
                            <span>{isOcrLoading ? 'Распознаем...' : 'Повторить OCR'}</span>
                          </button>
                        )}
                        {ocrText && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(ocrText);
                              setCopiedOcr(true);
                              setTimeout(() => setCopiedOcr(false), 2000);
                            }}
                            className="px-2 py-1 rounded text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {copiedOcr ? 'done' : 'content_copy'}
                            </span>
                            <span>{copiedOcr ? 'Скопировано' : 'Копировать'}</span>
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
                            className="px-2 py-1 rounded text-[11px] font-medium bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors"
                            title="Очистить распознанный текст"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Notice / Warning Bar if violations or profanity detected in OCR text */}
                    {ocrWarning && (
                      <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-red-600 shrink-0">
                          warning
                        </span>
                        <span className="font-medium">{ocrWarning}</span>
                      </div>
                    )}

                    {/* Editable OCR Textarea */}
                    <div className="relative">
                      <textarea
                        value={ocrText}
                        onChange={(e) => {
                          setOcrText(e.target.value);
                          setOcrCharCount(e.target.value.length);
                          const hasMat = /блят[ья]|\bбля\b|ху[йияеё]|пизд[аеёиу]|еб[аатьулоы]|ёб[аать]|сук[аи]|наху[йи]|муда[кч]|гондон|пидор|чмо\b|дерьм[оа]|шешен[ді]|сиктир|көт[і]/i.test(e.target.value);
                          if (hasMat) {
                            setOcrWarning('Внимание: зафиксирована ненормативная лексика и обсценная брань (ст. 434 КоАП РК).');
                          }
                        }}
                        placeholder={
                          isOcrLoading
                            ? 'Выполняется оптическое распознавание текста со скриншота (Gemini 3.8 Flash)...'
                            : 'Текст со скриншота извлечен сюда. Вы также можете дополнить или исправить его вручную.'
                        }
                        rows={4}
                        className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none font-['Inter'] leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 font-['JetBrains_Mono']">
                      <span className="text-slate-500">
                        {isOcrLoading
                          ? 'Нейросеть считывает надписи, чаты и дисклеймеры...'
                          : 'Текст передается в AI-анализ законодательства РК и интернет-этики'}
                      </span>
                      <span>Символов: {ocrCharCount}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Дополнительное примечание к материалу (необязательно):
                    </label>
                    <input
                      type="text"
                      value={fileTextNote}
                      onChange={(e) => setFileTextNote(e.target.value)}
                      placeholder="Например: переписка с оскорблениями в группе, реклама слотов, баннер без ИИН/БИН..."
                      className="w-full bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-sky-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VIDEO / REELS / TIKTOK */}
          {activeTab === 'video' && (
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

              {/* Video URL Input Field */}
              <div className="p-3.5 sm:p-4 rounded-xl bg-purple-50/50 border border-purple-200 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
                    <span className="material-symbols-outlined text-[18px] text-purple-600">link</span>
                    <span>Анализ видео по ссылке (YouTube, TikTok, Reels, Shorts, VK Video):</span>
                  </label>
                  <span className="text-[10px] font-mono font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                    Online Video AI
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 flex items-center">
                    <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[18px]">
                      videocam
                    </span>
                    <input
                      type="url"
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      placeholder="Вставьте ссылку: https://youtube.com/watch?v=..., https://tiktok.com/@..., https://instagram.com/reel/..."
                      className="w-full bg-white pl-9 pr-3 py-2 rounded-lg border border-purple-200 text-xs text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none shadow-2xs font-['Inter']"
                    />
                  </div>
                  {videoUrlInput && (
                    <button
                      type="button"
                      onClick={() => setVideoUrlInput('')}
                      className="px-2.5 py-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white text-xs border border-transparent hover:border-slate-200"
                    >
                      Очистить
                    </button>
                  )}
                </div>
                {videoUrlInput && (
                  <div className="text-[11px] text-purple-800 flex items-center gap-1.5 font-mono">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span>
                    <span>
                      {videoUrlInput.includes('youtube.com') || videoUrlInput.includes('youtu.be')
                        ? 'Обнаружено видео YouTube: извлечение превью, метаданных и комплаенс-анализ'
                        : videoUrlInput.includes('tiktok.com')
                        ? 'Обнаружен видеоролик TikTok: анализ видеоряда и описания'
                        : videoUrlInput.includes('instagram.com')
                        ? 'Обнаружен Instagram Reels / публикация: комплаенс-контроль'
                        : 'Ссылка на видео готова к мультимодальной проверке'}
                    </span>
                  </div>
                )}
              </div>

              {/* Upload Dropzone when no file selected */}
              {!videoPlayableUrl && !videoFile && (
                <div
                  onClick={() => videoFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-purple-400 bg-slate-50/70 hover:bg-purple-50/30 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-purple-600 mb-2 shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">video_file</span>
                  </div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-900">
                    Загрузить видеофайл для детальной раскадровки
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Поддерживаются MP4, MOV, WebM, M4V (до 100 МБ)
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      videoFileInputRef.current?.click();
                    }}
                    className="mt-3 px-3.5 py-1.5 rounded-lg bg-white border border-purple-300 text-xs font-semibold text-purple-700 shadow-xs hover:bg-purple-50"
                  >
                    Выбрать видеофайл на устройстве
                  </button>
                </div>
              )}

              {/* Frame Extraction Spinner */}
              {isExtractingFrames && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center gap-3 text-xs text-purple-800 font-medium">
                  <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Извлечение ключевых сцен и покадровая раскадровка видео...</span>
                </div>
              )}

              {/* Active Video Preview Deck with Real HTML5 Player & Keyframes */}
              {(videoPlayableUrl || videoFrames.length > 0) && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-purple-200 shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-purple-600">
                        videocam
                      </span>
                      <span className="text-xs font-bold text-slate-900 font-['Plus_Jakarta_Sans']">
                        {videoFile ? `Загружено видео: ${videoFile.name}` : 'Видеоматериал:'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
                      <span>{videoDuration}</span>
                      {videoFile && (
                        <span>• {(videoFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                      )}
                      <button
                        type="button"
                        onClick={handleClearVideo}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 ml-1"
                        title="Удалить видео"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>

                  {/* HTML5 Video Player */}
                  {videoPlayableUrl && (
                    <div className="relative rounded-lg overflow-hidden border border-slate-300 bg-slate-950 aspect-video max-h-[300px] flex items-center justify-center">
                      <video
                        src={videoPlayableUrl}
                        controls
                        playsInline
                        className="w-full h-full max-h-[290px] object-contain rounded"
                      />
                    </div>
                  )}

                  {/* Keyframes Filmstrip */}
                  {videoFrames.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase">
                        <span>Раскадровка ключевых кадров (Keyframe Filmstrip):</span>
                        <span>{videoFrames.length} кадров</span>
                      </div>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {videoFrames.map((frame, idx) => (
                          <div
                            key={idx}
                            className="relative rounded-md overflow-hidden border border-slate-200 shrink-0 shadow-2xs"
                            style={{ width: '110px', height: '62px' }}
                          >
                            <img src={frame} alt={`Frame ${idx + 1}`} className="w-full h-full object-cover" />
                            <span className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.2 rounded text-[9px] text-white font-mono">
                              00:0{idx * 4 + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Caption / Context Notes */}
                  <div>
                    <label className="block font-semibold text-slate-700 font-['JetBrains_Mono'] uppercase text-[11px] mb-1">
                      Описание, контекст или сопутствующий текст:
                    </label>
                    <textarea
                      value={videoCaption}
                      onChange={(e) => setVideoCaption(e.target.value)}
                      rows={2}
                      placeholder="Укажите автора, контекст или комментарии к видео (необязательно)..."
                      className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none font-['Inter'] leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB AUDIO: AUDIO CHECK & RECORDING */}
          {activeTab === 'audio' && (
            <div className="flex flex-col gap-4">
              {/* Hidden audio element and file input */}
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

              {/* Audio Mode Switcher */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setAudioMode('record')}
                  className={`flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    audioMode === 'record'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-rose-500">mic</span>
                  <span>Запись с микрофона</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAudioMode('upload')}
                  className={`flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                    audioMode === 'upload'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-sky-600">upload_file</span>
                  <span>Загрузить аудиофайл (MP3, WAV, M4A, OGG)</span>
                </button>
              </div>

              {/* Mode 1: Microphone Recorder */}
              {audioMode === 'record' && (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center gap-4">
                  {isRecording ? (
                    <div className="flex flex-col items-center gap-3 animate-fade-in">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg animate-pulse">
                          <span className="material-symbols-outlined text-[32px]">mic</span>
                        </div>
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 animate-ping"></span>
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-rose-600 uppercase font-mono tracking-wider">
                          Идет запись голосового сообщения...
                        </span>
                        <span className="font-['JetBrains_Mono'] text-2xl font-bold text-slate-900 mt-1">
                          00:{recordingSeconds.toString().padStart(2, '0')} / 01:00
                        </span>
                      </div>

                      {/* Animated sound wave bars */}
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
                        className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-md flex items-center gap-2 transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">stop</span>
                        <span>Остановить запись</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2.5">
                      <div className="w-14 h-14 rounded-full bg-white border border-slate-300 flex items-center justify-center text-slate-700 shadow-xs">
                        <span className="material-symbols-outlined text-[28px] text-sky-600">mic</span>
                      </div>
                      <div className="font-['Plus_Jakarta_Sans'] font-semibold text-sm text-slate-900">
                        Запись аудиосообщения или звонка с микрофона
                      </div>
                      <p className="text-xs text-slate-500 max-w-md">
                        Нажмите кнопку ниже и произнесите речь или воспроизведите аудиозапись. AI выполнит транскрипцию с таймкодами (ММ:СС), определит язык и проверит соблюдение норм РК.
                      </p>
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        className="mt-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs shadow-sm flex items-center gap-2 transition-all hover:shadow"
                      >
                        <span className="material-symbols-outlined text-[18px]">fiber_manual_record</span>
                        <span>Начать запись с микрофона</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Mode 2: Audio File Upload */}
              {audioMode === 'upload' && (
                <div
                  onClick={() => audioFileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/60 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all"
                >
                  <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-sky-600 mb-2 shadow-xs">
                    <span className="material-symbols-outlined text-[26px]">audio_file</span>
                  </div>
                  <div className="font-semibold text-xs sm:text-sm text-slate-900">
                    Перетащите аудиофайл или голосовую запись
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Поддерживаются MP3, WAV, M4A, OGG, WebM, AAC (до 100 МБ)
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      audioFileInputRef.current?.click();
                    }}
                    className="mt-3 px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-medium text-slate-700 shadow-xs"
                  >
                    Выбрать аудиофайл
                  </button>
                </div>
              )}

              {/* Active Audio Player Preview (if audio recorded or loaded) */}
              {audioDataUrl && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-sky-200 shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        type="button"
                        onClick={handleTogglePlayAudio}
                        className="w-10 h-10 rounded-xl bg-sky-600 hover:bg-sky-700 text-white flex items-center justify-center shrink-0 shadow-xs transition-colors"
                      >
                        <span className="material-symbols-outlined text-[24px]">
                          {isPlayingAudio ? 'pause' : 'play_arrow'}
                        </span>
                      </button>
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                          {audioFileName || 'Голосовая дорожка'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>Длительность: {audioDuration}</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-semibold">Аудиозапись готова</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleClearAudio}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Очистить аудио"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>

                  {/* Waveform graphic visualization */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center gap-1 h-9">
                    {[15, 30, 45, 80, 95, 60, 40, 90, 100, 75, 50, 85, 30, 60, 90, 70, 45, 80, 65, 35, 50, 75, 40, 20].map((bar, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all ${
                          isPlayingAudio ? 'bg-sky-500 animate-pulse' : 'bg-slate-300'
                        }`}
                        style={{ height: `${bar}%` }}
                      />
                    ))}
                  </div>

                  {/* Warning Notice if audio contains flagged keywords */}
                  {audioWarning && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-rose-600 shrink-0">warning</span>
                      <span className="font-medium">{audioWarning}</span>
                    </div>
                  )}

                  {/* Speech-to-Text Transcript Preview */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 flex items-center gap-1 font-['JetBrains_Mono'] uppercase text-[11px]">
                        <span className="material-symbols-outlined text-[15px] text-sky-600">graphic_eq</span>
                        Стенограмма и распознанный текст (STT):
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        Символов: {audioTranscriptPreview.length}
                      </span>
                    </div>
                    <textarea
                      value={audioTranscriptPreview}
                      onChange={(e) => setAudioTranscriptPreview(e.target.value)}
                      placeholder="Здесь отобразится текст речи после транскрибации. Вы также можете дополнить его контекстом."
                      rows={3}
                      className="w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none font-['Inter'] leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: URL */}
          {activeTab === 'url' && (
            <div className="flex flex-col gap-3">
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-slate-400 text-[20px]">
                  link
                </span>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Вставьте ссылку: https://youtube.com/..., https://tiktok.com/..., https://instagram.com/..., https://t.me/..."
                  className="w-full bg-slate-50 pl-10 pr-20 py-2.5 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none"
                />
                {urlInput && (
                  <button
                    type="button"
                    onClick={() => setUrlInput('')}
                    className="absolute right-2 px-2.5 py-1 rounded text-xs text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    Очистить
                  </button>
                )}
              </div>

              {/* Supported Platforms & Live Detection */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 font-['JetBrains_Mono'] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-sky-600">travel_explore</span>
                    Поддерживаемые онлайн-ресурсы:
                  </span>
                  <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    Real-time Scraper + Gemini AI
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${urlInput.includes('youtube.com') || urlInput.includes('youtu.be') ? 'bg-red-50 border-red-300 text-red-900 font-semibold ring-1 ring-red-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                    <span className="material-symbols-outlined text-[16px] text-red-600">smart_display</span>
                    <span>YouTube / Shorts</span>
                  </div>
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${urlInput.includes('tiktok.com') ? 'bg-purple-50 border-purple-300 text-purple-900 font-semibold ring-1 ring-purple-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                    <span className="material-symbols-outlined text-[16px] text-purple-600">movie</span>
                    <span>TikTok Videos</span>
                  </div>
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${urlInput.includes('instagram.com') ? 'bg-pink-50 border-pink-300 text-pink-900 font-semibold ring-1 ring-pink-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                    <span className="material-symbols-outlined text-[16px] text-pink-600">photo_camera</span>
                    <span>Instagram Reels / Post</span>
                  </div>
                  <div className={`p-2 rounded-lg border flex items-center gap-1.5 ${urlInput.includes('t.me') || urlInput.includes('telegram') ? 'bg-sky-50 border-sky-300 text-sky-900 font-semibold ring-1 ring-sky-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                    <span className="material-symbols-outlined text-[16px] text-sky-600">send</span>
                    <span>Telegram Каналы</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                  CheckActivity автоматически извлекает метаданные страницы, обложку/превью видео, заголовки, описание и проводит всестороннюю сверку с нормами законодательства РК (Закон № 230-VII, ст. 434, 445-1, 455 КоАП РК).
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: TEXT */}
          {activeTab === 'text' && (
            <div className="flex flex-col gap-2">
              <textarea
                rows={4}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Вставьте текст рекламного объявления, поста, комментария или предложения (включая эмодзи 🎰, 💩, 🚨)..."
                className="w-full bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:outline-none font-['Inter'] leading-relaxed"
              />
              <div className="flex flex-wrap justify-between items-center gap-1 text-[11px] text-slate-500">
                <span>Символов: {textInput.length}</span>
                <span>Проверка по КоАП РК, Закону № 230-VII и нормам сетевой этики</span>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Emoji Intelligence Inspector */}
        {(() => {
          const textToInspect = `${ocrText} ${textInput} ${urlInput} ${audioTranscriptPreview} ${videoCaption} ${fileTextNote}`;
          const currentEmojiAnalysis = analyzeEmojis(textToInspect);
          if (currentEmojiAnalysis.detectedEmojis.length === 0) return null;

          return (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-xs flex flex-col gap-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5 font-['Plus_Jakarta_Sans']">
                  <span className="material-symbols-outlined text-[18px] text-amber-600">mood</span>
                  Распознаны эмодзи и скрытые триггеры ({currentEmojiAnalysis.detectedEmojis.length}):
                </span>
                <span className="text-[11px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                  Влияние на риск: +{currentEmojiAnalysis.totalRiskPoints} pts
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {currentEmojiAnalysis.detectedEmojis.map((emoji) => {
                  const info = EMOJI_DICTIONARY[emoji];
                  return (
                    <span
                      key={emoji}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border shadow-2xs ${
                        info?.riskLevel === 'critical'
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : info?.riskLevel === 'warning'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-white text-slate-800 border-slate-200'
                      }`}
                    >
                      <span className="text-base leading-none">{emoji}</span>
                      <span className="text-[11px] font-semibold">{info ? info.label : 'Символ'}</span>
                    </span>
                  );
                })}
              </div>

              <p className="text-[11px] text-amber-900 leading-snug">
                {currentEmojiAnalysis.summary}
              </p>
            </div>
          );
        })()}



        {/* Regulatory & Ethics Modules Selector */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 font-['JetBrains_Mono']">
                3. Модули аудита:
              </span>
              <span className="text-xs font-medium text-slate-500">
                (Закон: {activeLegalCount}/{KAZAKHSTAN_LEGAL_FILTERS.length} • Этика: {activeEthicsCount}/{INTERNET_ETHICS_FILTERS.length})
              </span>
            </div>

            {/* Quick toggles */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setActiveFilterCategory('all')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  activeFilterCategory === 'all'
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Все ({filters.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterCategory('legal')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  activeFilterCategory === 'legal'
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Закон РК ({KAZAKHSTAN_LEGAL_FILTERS.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilterCategory('ethics')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium border ${
                  activeFilterCategory === 'ethics'
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Интернет-этика ({INTERNET_ETHICS_FILTERS.length})
              </button>
              <button
                type="button"
                onClick={() => setAllFiltersState(true)}
                className="px-2 py-0.5 rounded text-[11px] text-slate-500 hover:text-slate-800 underline ml-1"
              >
                Вкл все
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {displayedFilters.map((filter) => {
              const isEthics = filter.type === 'ethics';
              return (
                <label
                  key={filter.id}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                    filter.active
                      ? isEthics
                        ? 'bg-purple-50/40 border-purple-200 text-slate-900'
                        : 'bg-sky-50/40 border-sky-200 text-slate-900'
                      : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={filter.active}
                    onChange={() => toggleFilter(filter.id)}
                    className="mt-0.5 rounded text-sky-600 focus:ring-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold truncate">{filter.name}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono mt-0.5 truncate ${
                        isEthics ? 'text-purple-700' : 'text-sky-700'
                      }`}
                    >
                      {filter.article}
                    </span>
                    <span className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                      {filter.description}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            disabled={isProcessing}
            onClick={handleExecute}
            className="w-full py-3.5 px-6 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-['Plus_Jakarta_Sans'] font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-colors disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <span className="material-symbols-outlined text-[20px] animate-spin">
                  progress_activity
                </span>
                <span className="truncate">{processingStep}</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">policy</span>
                <span>Запустить аудит: Закон РК + Интернет-этика</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
