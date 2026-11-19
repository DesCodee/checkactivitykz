/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Copies text to the clipboard safely across restricted environments (e.g. iframes
 * where navigator.clipboard.writeText rejects with NotAllowedError) without ever
 * producing an unhandled Promise rejection.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const safeText = typeof text === 'string' ? text : String(text ?? '');
  if (!safeText) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(safeText);
      return true;
    } catch {
      // Fall through to legacy execCommand fallback silently
    }
  }

  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  let textarea: HTMLTextAreaElement | null = null;
  try {
    textarea = document.createElement('textarea');
    textarea.value = safeText;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);

    const activeEl = document.activeElement as HTMLElement | null;
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, safeText.length);

    const copied = typeof document.execCommand === 'function' ? document.execCommand('copy') : false;
    if (activeEl && typeof activeEl.focus === 'function') {
      try {
        activeEl.focus({ preventScroll: true });
      } catch {
        // ignore focus restore failure
      }
    }
    return copied;
  } catch {
    return false;
  } finally {
    if (textarea && textarea.parentNode) {
      try {
        textarea.parentNode.removeChild(textarea);
      } catch {
        // ignore cleanup failure
      }
    }
  }
}
