/**
 * Latine — entry point.
 * Landing page with Continue, Resharpener, and glasses companion panel.
 */

import { startApp, setStatusCallback, setPreviewCallback, simulateAction } from './latine-app';
import { ALL_PASSAGES, getPassageById } from './passages';
import { loadProgress } from './progress';
import { getUserTier, getResharpenerPassages, buildReadingBlock } from './resharpener';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('Missing #app');

const isDesktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function renderLanding() {
  const progress = loadProgress();
  const completedCount = progress.completed.length;
  const totalCount = ALL_PASSAGES.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const { tier } = getUserTier();

  // Figure out "continue" target
  const currentPassage = progress.current ? getPassageById(progress.current.passageId) : null;
  const nextIdx = ALL_PASSAGES.findIndex(p => !progress.completed.includes(p.id));
  const nextPassage = nextIdx >= 0 ? ALL_PASSAGES[nextIdx] : null;
  const continuePassage = currentPassage ?? nextPassage;
  const continueLabel = currentPassage
    ? `Resume: ${currentPassage.source} — ${currentPassage.reference}`
    : nextPassage
      ? `Next: ${nextPassage.source} — ${nextPassage.reference}`
      : 'All passages complete!';

  // Resharpener passages
  const readings = getResharpenerPassages().map(buildReadingBlock);

  appRoot!.innerHTML = `
    <div style="font-family:'Manrope','Segoe UI',system-ui,sans-serif;background:#0f1419;color:#e0d5c1;min-height:100vh;box-sizing:border-box">

      <!-- Header -->
      <div style="padding:24px 16px 0;max-width:640px;margin:0 auto">
        <h1 style="margin:0;font-size:32px;font-weight:700;color:#5ccfe6;letter-spacing:1px;font-family:'Fraunces',Georgia,serif">Latine</h1>
        <p style="margin:4px 0 0;font-size:14px;color:#707a8c">Latin parsing drills for Even G2 glasses</p>
      </div>

      <!-- Progress bar -->
      <div style="padding:16px 16px 0;max-width:640px;margin:0 auto">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
          <span style="font-size:13px;color:#707a8c">${tier} level</span>
          <span style="font-size:13px;color:#707a8c">${completedCount} / ${totalCount} passages (${pct}%)</span>
        </div>
        <div style="background:#1a1f26;border-radius:6px;height:8px;overflow:hidden">
          <div style="background:linear-gradient(90deg,#5ccfe6,#73d0ff);height:100%;width:${pct}%;border-radius:6px;transition:width 0.3s"></div>
        </div>
      </div>

      <!-- Continue button -->
      <div style="padding:16px 16px 0;max-width:640px;margin:0 auto">
        <button id="btn-continue" style="width:100%;padding:14px 20px;background:linear-gradient(135deg,#5ccfe6,#73d0ff);color:#0f1419;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:16px;font-weight:600;text-align:left;transition:opacity 0.2s"
          ${continuePassage ? '' : 'disabled'}>
          ${continueLabel}
        </button>
      </div>

      <!-- Resharpener -->
      <div style="padding:20px 16px 0;max-width:640px;margin:0 auto">
        <h2 style="margin:0 0 8px;font-size:16px;font-weight:600;color:#e0d5c1">Quick reading practice</h2>
        <p style="margin:0 0 12px;font-size:13px;color:#707a8c">Try reading these at your current level. Tap to reveal the translation.</p>
        <div id="readings" style="display:flex;flex-direction:column;gap:10px">
          ${readings.map((r, i) => `
            <div class="reading-card" style="background:#1a1f26;border:1px solid #2d3640;border-radius:8px;padding:14px;cursor:pointer" data-idx="${i}">
              <p style="margin:0 0 4px;font-size:11px;color:#5c6773;font-style:italic">${r.source}</p>
              <p style="margin:0;font-size:15px;line-height:1.5;color:#e0d5c1">${r.latin}</p>
              <p class="translation" style="margin:8px 0 0;font-size:13px;color:#5ccfe6;display:none">${r.translation}</p>
            </div>
          `).join('')}
        </div>
        <button id="btn-refresh" style="margin-top:10px;padding:8px 16px;background:transparent;color:#5ccfe6;border:1px solid #5ccfe6;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px">Shuffle new passages</button>
      </div>

      ${isDesktop ? `
      <!-- QR Code -->
      <div style="padding:24px 16px 0;max-width:640px;margin:0 auto;text-align:center">
        <div style="display:inline-block;background:#fff;padding:12px;border-radius:8px" id="qr-container"></div>
        <p style="margin:8px 0 0;font-size:11px;color:#5c6773">Scan with EvenHub to load on glasses</p>
      </div>
      ` : ''}

      <!-- Glasses companion panel (collapsible) -->
      <div style="padding:20px 16px;max-width:640px;margin:0 auto">
        <details id="glasses-panel" ${isDesktop ? '' : 'open'}>
          <summary style="cursor:pointer;font-size:14px;font-weight:600;color:#707a8c;margin-bottom:8px;user-select:none">Glasses companion</summary>
          <p style="margin:0 0 6px;font-size:12px;color:#5c6773" id="status">Starting...</p>
          <div id="preview" style="background:#000;border:1px solid #2d3640;border-radius:6px;padding:12px;min-height:80px;font-size:13px;line-height:1.5;white-space:pre-wrap;color:#e0d5c1;font-family:'JetBrains Mono',monospace"></div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <button id="sim-up" class="sim-btn">Swipe Up</button>
            <button id="sim-down" class="sim-btn">Swipe Down</button>
            <button id="sim-tap" class="sim-btn">Tap</button>
          </div>
          <pre id="log" style="margin:8px 0 0;font-size:10px;color:#5c6773;max-height:100px;overflow-y:auto;white-space:pre-wrap"></pre>
        </details>
      </div>

      <style>
        .sim-btn {
          padding:6px 14px;
          background:#1a1f26;
          color:#5ccfe6;
          border:1px solid #2d3640;
          border-radius:4px;
          cursor:pointer;
          font-family:inherit;
          font-size:12px;
        }
        .sim-btn:active { background:#2d3640; }
        .reading-card:active { border-color:#5ccfe6; }
        #btn-continue:active { opacity:0.8; }
        #btn-continue:disabled { opacity:0.4; cursor:default; }
        details summary::-webkit-details-marker { color:#5c6773; }
      </style>
    </div>
  `;

  // --- Wire up interactions ---

  // Continue button
  document.getElementById('btn-continue')?.addEventListener('click', () => {
    // Start the glasses app and open the companion panel
    const panel = document.getElementById('glasses-panel') as HTMLDetailsElement;
    if (panel) panel.open = true;
    panel?.scrollIntoView({ behavior: 'smooth' });
  });

  // Reading card tap to reveal
  document.querySelectorAll('.reading-card').forEach(card => {
    card.addEventListener('click', () => {
      const trans = card.querySelector('.translation') as HTMLElement;
      if (trans) trans.style.display = trans.style.display === 'none' ? 'block' : 'none';
    });
  });

  // Shuffle button
  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    renderLanding();
  });

  // QR code (desktop only)
  if (isDesktop) {
    (async () => {
      try {
        const qrModule = await import('qrcode');
        const toCanvas = qrModule.toCanvas ?? qrModule.default?.toCanvas;
        if (!toCanvas) throw new Error('toCanvas not found');
        const container = document.getElementById('qr-container');
        if (!container) return;
        const canvas = document.createElement('canvas');
        await toCanvas(canvas, window.location.href, {
          width: 180,
          margin: 0,
          color: { dark: '#0f1419', light: '#ffffff' },
        });
        container.appendChild(canvas);
      } catch (err) {
        console.error('[Latine] QR failed:', err);
      }
    })();
  }

  // Glasses companion
  const logEl = document.getElementById('log')!;
  const statusEl = document.getElementById('status')!;
  const previewEl = document.getElementById('preview')!;

  setStatusCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    logEl.textContent = `[${time}] ${msg}\n${logEl.textContent ?? ''}`.slice(0, 2000);
    statusEl.textContent = msg;
  });

  setPreviewCallback((_phase: string, lines: string[]) => {
    previewEl.textContent = lines.join('\n');
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
}

// Render and start
try {
  renderLanding();
} catch (err) {
  console.error('[Latine] Landing page error:', err);
  appRoot!.innerHTML = `<div style="padding:20px;color:red;font-family:monospace">Error: ${(err as Error).message}<br><br>Falling back to glasses companion.</div>`;
}
void startApp();
