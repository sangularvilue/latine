/**
 * Latine — entry point.
 * Desktop: show QR code to scan with EvenHub.
 * Mobile: companion UI with canvas preview + controls.
 */

import { startApp, setFrameCallback, simulateAction } from './latine-app';
import { BUF_W, BUF_H } from '@shared/constants';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('Missing #app');

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

if (!isMobile) {
  renderDesktop();
} else {
  renderMobile();
}

async function renderDesktop(): Promise<void> {
  appRoot!.innerHTML = `
    <div style="font-family:'JetBrains Mono',monospace;background:#0f1419;color:#e0d5c1;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:24px;box-sizing:border-box">
      <h1 style="margin:0 0 8px;font-size:28px;color:#5ccfe6;letter-spacing:2px">LATINE</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#707a8c">Latin sentence drill for Even G2</p>
      <div id="qr-container" style="background:#fff;padding:16px;border-radius:8px"></div>
      <p style="margin:16px 0 0;font-size:13px;color:#707a8c">Scan with EvenHub to load on your glasses</p>
      <p style="margin:8px 0 24px;font-size:12px;color:#5c6773">${window.location.href}</p>
      <div style="border-top:1px solid #2d3640;padding-top:16px;width:100%;max-width:840px;display:flex;flex-direction:column;align-items:center">
        <p style="margin:0 0 8px;font-size:12px;color:#5c6773">Preview (Arrow keys + Space/Enter)</p>
        <p style="margin:0 0 8px;font-size:12px;color:#5c6773" id="status">Starting...</p>
        <div style="border:2px solid #5ccfe6;background:#000;border-radius:4px;overflow:hidden">
          <canvas id="preview" width="${BUF_W}" height="${BUF_H}"
            style="width:${BUF_W * 2}px;height:${BUF_H * 2}px;image-rendering:pixelated;display:block"></canvas>
        </div>
      </div>
    </div>
  `;

  try {
    const qrModule = await import('qrcode');
    const toCanvas = qrModule.toCanvas ?? qrModule.default?.toCanvas;
    if (!toCanvas) throw new Error('toCanvas not found');
    const container = document.getElementById('qr-container')!;
    const canvas = document.createElement('canvas');
    await toCanvas(canvas, window.location.href, {
      width: 280,
      margin: 0,
      color: { dark: '#0f1419', light: '#ffffff' },
    });
    container.appendChild(canvas);
  } catch (err) {
    console.error('[Latine] QR generation failed:', err);
    const container = document.getElementById('qr-container')!;
    container.innerHTML = `<p style="color:#0f1419;padding:20px;font-size:14px">${window.location.href}</p>`;
  }

  // Start app with preview
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

  // Keyboard controls
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': simulateAction('SCROLL_UP'); e.preventDefault(); break;
      case 'ArrowDown': case 's': simulateAction('SCROLL_DOWN'); e.preventDefault(); break;
      case ' ': case 'Enter': simulateAction('TAP'); e.preventDefault(); break;
    }
  });

  try {
    await startApp();
    statusEl.textContent = 'Running';
  } catch (err) {
    statusEl.textContent = 'Error: ' + (err as Error).message;
  }
}

async function renderMobile(): Promise<void> {
  appRoot!.innerHTML = `
    <div style="font-family:'JetBrains Mono',monospace;background:#0f1419;color:#e0d5c1;min-height:100vh;padding:12px;box-sizing:border-box">
      <h1 style="margin:0 0 4px;font-size:18px;color:#5ccfe6">Latine</h1>
      <p style="margin:0 0 8px;font-size:12px;color:#707a8c" id="status">Starting...</p>
      <div style="display:flex;justify-content:center">
        <div style="position:relative;display:inline-block;border:2px solid #5ccfe6;background:#000;border-radius:4px;overflow:hidden">
          <canvas id="preview" width="${BUF_W}" height="${BUF_H}"
            style="width:${BUF_W * 2}px;height:${BUF_H * 2}px;image-rendering:pixelated;display:block"></canvas>
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
        <button class="btn" id="sim-up" style="padding:8px 20px;background:#1a1f26;color:#5ccfe6;border:1px solid #5ccfe6;border-radius:4px;cursor:pointer;font-family:inherit">Swipe Up</button>
        <button class="btn" id="sim-down" style="padding:8px 20px;background:#1a1f26;color:#5ccfe6;border:1px solid #5ccfe6;border-radius:4px;cursor:pointer;font-family:inherit">Swipe Down</button>
        <button class="btn" id="sim-tap" style="padding:8px 20px;background:#1a1f26;color:#5ccfe6;border:1px solid #5ccfe6;border-radius:4px;cursor:pointer;font-family:inherit">Tap</button>
      </div>
      <p style="margin:8px 0 0;font-size:11px;color:#5c6773;text-align:center">Swipe to cycle choices, Tap to select</p>
    </div>
  `;

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

  // Keyboard controls (also useful for desktop testing)
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': simulateAction('SCROLL_UP'); e.preventDefault(); break;
      case 'ArrowDown': case 's': simulateAction('SCROLL_DOWN'); e.preventDefault(); break;
      case ' ': case 'Enter': simulateAction('TAP'); e.preventDefault(); break;
    }
  });

  try {
    await startApp();
    statusEl.textContent = 'Running';
  } catch (err) {
    statusEl.textContent = 'Error: ' + (err as Error).message;
  }
}
