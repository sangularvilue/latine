/**
 * Latine — entry point.
 * Always shows companion UI + canvas preview.
 * Desktop also shows a QR code for scanning with EvenHub.
 * Bridge connection is always attempted on startup.
 */

import { startApp, setFrameCallback, simulateAction } from './latine-app';
import { BUF_W, BUF_H } from '@shared/constants';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('Missing #app');

const isDesktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

appRoot.innerHTML = `
  <div style="font-family:'JetBrains Mono',monospace;background:#0f1419;color:#e0d5c1;min-height:100vh;padding:12px;box-sizing:border-box">
    <div style="max-width:600px;margin:0 auto">
      <h1 style="margin:0 0 4px;font-size:18px;color:#5ccfe6">Latine</h1>
      <p style="margin:0 0 8px;font-size:12px;color:#707a8c" id="status">Starting...</p>

      ${isDesktop ? `
        <div id="qr-section" style="text-align:center;margin-bottom:16px">
          <div id="qr-container" style="display:inline-block;background:#fff;padding:12px;border-radius:8px"></div>
          <p style="margin:8px 0 0;font-size:11px;color:#5c6773">Scan with EvenHub</p>
        </div>
      ` : ''}

      <div style="text-align:center">
        <div style="display:inline-block;border:2px solid #5ccfe6;background:#000;border-radius:4px;overflow:hidden;max-width:100%">
          <canvas id="preview" width="${BUF_W}" height="${BUF_H}"
            style="width:100%;max-width:${BUF_W * 2}px;height:auto;image-rendering:pixelated;display:block"></canvas>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
        <button id="sim-up" style="padding:8px 20px;background:#1a1f26;color:#5ccfe6;border:1px solid #5ccfe6;border-radius:4px;cursor:pointer;font-family:inherit;font-size:14px">Swipe Up</button>
        <button id="sim-down" style="padding:8px 20px;background:#1a1f26;color:#5ccfe6;border:1px solid #5ccfe6;border-radius:4px;cursor:pointer;font-family:inherit;font-size:14px">Swipe Down</button>
        <button id="sim-tap" style="padding:8px 20px;background:#1a1f26;color:#5ccfe6;border:1px solid #5ccfe6;border-radius:4px;cursor:pointer;font-family:inherit;font-size:14px">Tap</button>
      </div>
      <p style="margin:8px 0 0;font-size:11px;color:#5c6773;text-align:center">Swipe to cycle choices, Tap to select</p>
    </div>
  </div>
`;

// QR code (desktop only)
if (isDesktop) {
  (async () => {
    try {
      const qrModule = await import('qrcode');
      const toCanvas = qrModule.toCanvas ?? qrModule.default?.toCanvas;
      if (!toCanvas) throw new Error('toCanvas not found');
      const container = document.getElementById('qr-container')!;
      const canvas = document.createElement('canvas');
      await toCanvas(canvas, window.location.href, {
        width: 200,
        margin: 0,
        color: { dark: '#0f1419', light: '#ffffff' },
      });
      container.appendChild(canvas);
    } catch (err) {
      console.error('[Latine] QR failed:', err);
    }
  })();
}

// Canvas preview
const statusEl = document.getElementById('status')!;
const previewCanvas = document.getElementById('preview') as HTMLCanvasElement;
const previewCtx = previewCanvas.getContext('2d')!;
const previewImageData = previewCtx.createImageData(BUF_W, BUF_H);

setFrameCallback((buf: Uint8Array) => {
  const data = previewImageData.data;
  for (let i = 0; i < BUF_W * BUF_H; i++) {
    const bright = buf[i] ? 255 : 0;
    data[i * 4] = bright;
    data[i * 4 + 1] = bright;
    data[i * 4 + 2] = bright;
    data[i * 4 + 3] = 255;
  }
  previewCtx.putImageData(previewImageData, 0, 0);
});

// Sim buttons
document.getElementById('sim-up')!.addEventListener('click', () => simulateAction('SCROLL_UP'));
document.getElementById('sim-down')!.addEventListener('click', () => simulateAction('SCROLL_DOWN'));
document.getElementById('sim-tap')!.addEventListener('click', () => simulateAction('TAP'));

// Keyboard controls
document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowUp': case 'w': simulateAction('SCROLL_UP'); e.preventDefault(); break;
    case 'ArrowDown': case 's': simulateAction('SCROLL_DOWN'); e.preventDefault(); break;
    case ' ': case 'Enter': simulateAction('TAP'); e.preventDefault(); break;
  }
});

// Start app + connect bridge
(async () => {
  try {
    await startApp();
    statusEl.textContent = 'Running — connecting to glasses...';
  } catch (err) {
    statusEl.textContent = 'Error: ' + (err as Error).message;
  }
})();
