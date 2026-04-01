/**
 * Latine — landing page with modes, gamification, and glasses companion.
 */

import { startApp, setStatusCallback, setPreviewCallback, simulateAction } from './latine-app';
import { ALL_PASSAGES, ALL_READING_PASSAGES } from './passages';
import { loadProgress } from './progress';
import { loadGamification, getRank, getAccuracy, isDailyChallengeComplete, getDailyChallengeIndex, todayDateStr } from './gamification';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) throw new Error('Missing #app');

const isDesktop = !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

function render() {
  const progress = loadProgress();
  const gam = loadGamification();
  const rank = getRank(gam.xp);
  const accuracy = getAccuracy();
  const completedCount = progress.completed.length;
  const totalDrills = ALL_PASSAGES.length;
  const totalReadings = ALL_READING_PASSAGES.length;
  const pct = totalDrills > 0 ? Math.round((completedCount / totalDrills) * 100) : 0;

  // Daily challenge
  const dailyDone = isDailyChallengeComplete();
  const dailyIdx = getDailyChallengeIndex(totalDrills);
  const dailyPassage = ALL_PASSAGES[dailyIdx];

  // Next passage for continue
  const currentPassage = progress.current ? ALL_PASSAGES.find(p => p.id === progress.current!.passageId) : null;
  const nextIdx = ALL_PASSAGES.findIndex(p => !progress.completed.includes(p.id));
  const nextPassage = nextIdx >= 0 ? ALL_PASSAGES[nextIdx] : null;
  const continueTarget = currentPassage ?? nextPassage;

  appRoot!.innerHTML = `
    <div style="font-family:'Manrope','Segoe UI',system-ui,sans-serif;background:#0f1419;color:#e0d5c1;min-height:100vh;box-sizing:border-box">
      <div style="max-width:640px;margin:0 auto;padding:16px">

        <!-- Header -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div>
            <h1 style="margin:0;font-size:28px;font-weight:700;color:#5ccfe6;font-family:'Fraunces',Georgia,serif">LATINE</h1>
            <p style="margin:2px 0 0;font-size:12px;color:#707a8c">Latin for smart glasses</p>
          </div>
          <div style="text-align:right">
            <div style="font-size:22px;font-weight:700;color:#ffd580">${gam.xp.toLocaleString()} XP</div>
            <div style="font-size:13px;color:#d4bfff">${rank.title}</div>
          </div>
        </div>

        <!-- Stats row -->
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <div style="flex:1;background:#1a1f26;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:700;color:#5ccfe6">${gam.currentStreak}</div>
            <div style="font-size:11px;color:#707a8c">Streak</div>
          </div>
          <div style="flex:1;background:#1a1f26;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:700;color:#73d0ff">${accuracy}%</div>
            <div style="font-size:11px;color:#707a8c">Accuracy</div>
          </div>
          <div style="flex:1;background:#1a1f26;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:700;color:#bae67e">${completedCount}</div>
            <div style="font-size:11px;color:#707a8c">Completed</div>
          </div>
          <div style="flex:1;background:#1a1f26;border-radius:8px;padding:10px;text-align:center">
            <div style="font-size:20px;font-weight:700;color:#ffd580">${gam.bestStreak}</div>
            <div style="font-size:11px;color:#707a8c">Best Streak</div>
          </div>
        </div>

        <!-- XP Progress bar -->
        <div style="margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#707a8c;margin-bottom:4px">
            <span>${rank.title}</span>
            <span>${rank.nextRank ? rank.nextRank.title + ' in ' + rank.xpToNext + ' XP' : 'Max rank!'}</span>
          </div>
          <div style="background:#1a1f26;border-radius:6px;height:6px;overflow:hidden">
            <div style="background:linear-gradient(90deg,#d4bfff,#ffd580);height:100%;width:${Math.round(rank.progress * 100)}%;border-radius:6px"></div>
          </div>
        </div>

        <!-- Daily Challenge -->
        ${!dailyDone && dailyPassage ? `
          <div style="background:linear-gradient(135deg,#1a1f26,#2d2640);border:1px solid #5c4d8a;border-radius:10px;padding:14px;margin-bottom:16px;cursor:pointer" id="daily-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:14px;font-weight:600;color:#d4bfff">Daily Challenge</span>
              <span style="font-size:12px;color:#ffd580;font-weight:600">+50 XP</span>
            </div>
            <p style="margin:0;font-size:13px;color:#e0d5c1">${dailyPassage.source} — ${dailyPassage.reference}</p>
            <p style="margin:4px 0 0;font-size:12px;color:#707a8c">${dailyPassage.latin.join(' ').slice(0, 60)}...</p>
          </div>
        ` : dailyDone ? `
          <div style="background:#1a2620;border:1px solid #3d6b4f;border-radius:10px;padding:12px;margin-bottom:16px;text-align:center">
            <span style="color:#bae67e;font-size:13px;font-weight:600">Daily challenge complete! Come back tomorrow.</span>
          </div>
        ` : ''}

        <!-- Mode Cards -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px">

          <!-- Learn -->
          <div id="mode-learn" style="background:#1a1f26;border:1px solid #2d3640;border-radius:10px;padding:14px;cursor:pointer;transition:border-color 0.2s;text-align:center">
            <div style="font-size:28px;margin-bottom:6px">📖</div>
            <div style="font-size:15px;font-weight:600;color:#5ccfe6">Learn</div>
            <div style="font-size:11px;color:#707a8c;margin-top:4px">${completedCount}/${totalDrills} drills</div>
            ${continueTarget ? `<div style="font-size:10px;color:#5c6773;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${continueTarget.reference}</div>` : ''}
          </div>

          <!-- Practice -->
          <div id="mode-practice" style="background:#1a1f26;border:1px solid #2d3640;border-radius:10px;padding:14px;cursor:pointer;transition:border-color 0.2s;text-align:center">
            <div style="font-size:28px;margin-bottom:6px">⚡</div>
            <div style="font-size:15px;font-weight:600;color:#ffd580">Practice</div>
            <div style="font-size:11px;color:#707a8c;margin-top:4px">Quick quiz</div>
            <div style="font-size:10px;color:#5c6773;margin-top:4px">${gam.practiceRoundsCompleted} rounds done</div>
          </div>

          <!-- Read -->
          <div id="mode-read" style="background:#1a1f26;border:1px solid #2d3640;border-radius:10px;padding:14px;cursor:pointer;transition:border-color 0.2s;text-align:center">
            <div style="font-size:28px;margin-bottom:6px">📜</div>
            <div style="font-size:15px;font-weight:600;color:#bae67e">Read</div>
            <div style="font-size:11px;color:#707a8c;margin-top:4px">${totalReadings} passages</div>
            <div style="font-size:10px;color:#5c6773;margin-top:4px">${gam.readPassagesCompleted.length} completed</div>
          </div>

        </div>

        <!-- Drill progress bar -->
        <div style="margin-bottom:20px">
          <div style="display:flex;justify-content:space-between;font-size:11px;color:#707a8c;margin-bottom:4px">
            <span>Drill progress</span>
            <span>${pct}%</span>
          </div>
          <div style="background:#1a1f26;border-radius:6px;height:6px;overflow:hidden">
            <div style="background:linear-gradient(90deg,#5ccfe6,#73d0ff);height:100%;width:${pct}%;border-radius:6px"></div>
          </div>
        </div>

        <!-- Glasses Companion -->
        <details id="glasses-panel" ${isDesktop ? '' : 'open'}>
          <summary style="cursor:pointer;font-size:14px;font-weight:600;color:#707a8c;margin-bottom:8px;user-select:none">Glasses companion</summary>
          <p style="margin:0 0 6px;font-size:12px;color:#5c6773" id="status">Starting...</p>
          <div id="preview" style="background:#000;border:1px solid #2d3640;border-radius:6px;padding:12px;min-height:60px;font-size:13px;line-height:1.5;white-space:pre-wrap;color:#e0d5c1;font-family:'JetBrains Mono',monospace"></div>
          <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
            <button id="sim-up" class="sim-btn">Swipe Up</button>
            <button id="sim-down" class="sim-btn">Swipe Down</button>
            <button id="sim-tap" class="sim-btn">Tap</button>
          </div>
          <pre id="log" style="margin:8px 0 0;font-size:10px;color:#5c6773;max-height:100px;overflow-y:auto;white-space:pre-wrap"></pre>
        </details>

        <style>
          .sim-btn {
            padding:6px 14px;background:#1a1f26;color:#5ccfe6;
            border:1px solid #2d3640;border-radius:4px;cursor:pointer;
            font-family:inherit;font-size:12px;
          }
          .sim-btn:active { background:#2d3640; }
          #mode-learn:hover, #mode-practice:hover, #mode-read:hover, #daily-card:hover {
            border-color:#5ccfe6;
          }
          details summary::-webkit-details-marker { color:#5c6773; }
        </style>
      </div>
    </div>
  `;

  // Wire interactions
  document.getElementById('mode-learn')?.addEventListener('click', () => {
    openGlassesPanel();
  });
  document.getElementById('mode-practice')?.addEventListener('click', () => {
    openGlassesPanel();
    // TODO: switch to practice mode on glasses
  });
  document.getElementById('mode-read')?.addEventListener('click', () => {
    openGlassesPanel();
    // TODO: switch to read mode on glasses
  });
  document.getElementById('daily-card')?.addEventListener('click', () => {
    openGlassesPanel();
    // TODO: start daily challenge
  });

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

  document.getElementById('sim-up')!.addEventListener('click', () => simulateAction('SCROLL_UP'));
  document.getElementById('sim-down')!.addEventListener('click', () => simulateAction('SCROLL_DOWN'));
  document.getElementById('sim-tap')!.addEventListener('click', () => simulateAction('TAP'));

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowUp': case 'w': simulateAction('SCROLL_UP'); e.preventDefault(); break;
      case 'ArrowDown': case 's': simulateAction('SCROLL_DOWN'); e.preventDefault(); break;
      case ' ': case 'Enter': simulateAction('TAP'); e.preventDefault(); break;
    }
  });
}

function openGlassesPanel() {
  const panel = document.getElementById('glasses-panel') as HTMLDetailsElement;
  if (panel) panel.open = true;
  panel?.scrollIntoView({ behavior: 'smooth' });
}

// Render and start
try {
  render();
} catch (err) {
  console.error('[Latine] Landing error:', err);
  appRoot!.innerHTML = `<div style="padding:20px;color:#ff6666;background:#0f1419;font-family:monospace;font-size:14px;white-space:pre-wrap">Error: ${(err as Error).stack || (err as Error).message}</div>`;
}
void startApp();
