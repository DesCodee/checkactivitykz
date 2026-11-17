/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

function bytesToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array | null {
  const trimmed = (dataUrl || '').trim();
  const match = trimmed.match(/^data:[^;]*;base64,(.+)$/s);
  if (!match) return null;
  return base64ToUint8Array(match[1]);
}

export function base64ToUint8Array(rawBase64: string): Uint8Array | null {
  if (!rawBase64) return null;
  try {
    const cleanB64 = rawBase64.replace(/\s+/g, '');
    const binaryStr = atob(cleanB64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export async function computeSha256FromBuffer(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const arrayBuffer =
    buffer instanceof ArrayBuffer ? buffer : Uint8Array.from(buffer).buffer;
  const digest = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return bytesToHex(digest);
}

export async function computeSha256FromText(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  return computeSha256FromBuffer(encoded);
}

export async function computeFileSha256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  return computeSha256FromBuffer(buffer);
}

export async function computeContentPayloadSha256(payload: {
  sha256?: string;
  mediaBase64?: string;
  videoDataUrl?: string;
  audioDataUrl?: string;
  imageDataUrl?: string;
  url?: string;
  text?: string;
  fileName?: string;
}): Promise<string> {
  if (payload.sha256 && /^[a-f0-9]{64}$/i.test(payload.sha256.trim())) {
    return payload.sha256.trim().toLowerCase();
  }

  const candidateMedia = [
    payload.mediaBase64,
    payload.videoDataUrl,
    payload.audioDataUrl,
    payload.imageDataUrl,
  ];

  for (const media of candidateMedia) {
    if (!media || typeof media !== 'string') continue;
    const fromDataUrl = dataUrlToUint8Array(media);
    if (fromDataUrl && fromDataUrl.byteLength > 0) {
      return computeSha256FromBuffer(fromDataUrl);
    }
    if (media === payload.mediaBase64 && !media.startsWith('http') && !media.startsWith('blob:')) {
      const fromRawB64 = base64ToUint8Array(media);
      if (fromRawB64 && fromRawB64.byteLength > 0) {
        return computeSha256FromBuffer(fromRawB64);
      }
    }
  }

  const canonicalText = (payload.url || payload.text || payload.fileName || '').trim();
  return computeSha256FromText(canonicalText);
}
