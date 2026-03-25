/**
 * Latine App — uses native text + list containers on the glasses.
 */

import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { getRawEventType, normalizeEventType } from './even-events';
import type { AppState, Passage } from './types';
import { ALL_PASSAGES, getPassageById } from './passages';
import { loadProgress, markCompleted, saveCurrent, clearCurrent, isCompleted } from './progress';

const BRIDGE_TIMEOUT_MS = 8000;
const FEEDBACK_DURATION_MS = 1800;
const WRONG_DURATION_MS = 2000;
const INPUT_LOCKOUT_MS = 500;

let inputLockedUntil = 0;

let bridge: EvenAppBridge | null = null;
let startupRendered = false;
let state: AppState;
let statusCallback: ((msg: string) => void) | null = null;
let previewCallback: ((phase: string, lines: string[]) => void) | null = null;

function log(msg: string): void {
  console.log(`[Latine] ${msg}`);
  statusCallback?.(msg);
}

function nextPassageIndex(): number {
  // Find the first uncompleted passage; fall back to 0 if all done
  const idx = ALL_PASSAGES.findIndex(p => !isCompleted(p.id));
  return idx >= 0 ? idx : 0;
}

function createInitialState(): AppState {
  return {
    phase: 'selector',
    passage: null,
    stepIndex: 0,
    cursor: nextPassageIndex(),
    revealed: new Map(),
    feedbackTimer: 0,
    wrongChoice: null,
  };
}

// ── Glasses rendering ──

async function renderToGlasses(): Promise<void> {
  if (!bridge) return;

  const lines = buildDisplayLines();
  previewCallback?.(state.phase, lines);

  switch (state.phase) {
    case 'selector':
      await renderSelectorPage();
      break;
    case 'title':
      await renderTitlePage();
      break;
    case 'sentence':
      await renderSentencePage();
      break;
    case 'question':
      await renderQuestionPage();
      break;
    case 'correct':
    case 'wrong':
      await renderFeedbackPage();
      break;
    case 'summary':
      await renderSummaryPage();
      break;
  }
}

function buildDisplayLines(): string[] {
  switch (state.phase) {
    case 'selector': {
      const items = ALL_PASSAGES.map(p => {
        const check = isCompleted(p.id) ? ' ✓' : '';
        return `${p.source} · ${p.reference}${check}`;
      });
      return ['LATINE', 'Select a passage:', '', ...items];
    }
    case 'title': {
      const p = state.passage!;
      return ['LATINE', '', p.source, p.reference, '', 'Tap to begin'];
    }
    case 'sentence': {
      const p = state.passage!;
      return [p.latin.join(' '), '', `${p.steps.length} questions`, 'Tap to start'];
    }
    case 'question': {
      const p = state.passage!;
      const step = p.steps[state.stepIndex]!;
      const progress = `${state.stepIndex + 1}/${p.steps.length}`;
      return [
        p.latin.join(' '), '',
        `${progress}  ${step.prompt}`,
        ...step.choices.map((c, i) => i === state.cursor ? `> ${c}` : `  ${c}`),
      ];
    }
    case 'correct': {
      const p = state.passage!;
      const step = p.steps[state.stepIndex]!;
      const reveal = step.reveal ? `${step.reveal.word} = "${step.reveal.gloss}"` : '';
      return [p.latin.join(' '), '', 'CORRECT!', reveal];
    }
    case 'wrong': {
      const p = state.passage!;
      const step = p.steps[state.stepIndex]!;
      const hint = state.wrongChoice && step.hints?.[state.wrongChoice];
      return [p.latin.join(' '), '', 'Incorrect', hint || 'Try again...'];
    }
    case 'summary': {
      const p = state.passage!;
      return [p.latin.join(' '), '', p.translation, '', '✓ Complete!'];
    }
    default:
      return [];
  }
}

function selectorItems(): string[] {
  return ALL_PASSAGES.map((p, i) => {
    const check = isCompleted(p.id) ? ' *' : '';
    const num = String(i + 1).padStart(2, ' ');
    return `${num}. ${p.reference}${check}`;
  });
}

async function renderSelectorPage(): Promise<void> {
  const items = selectorItems();

  const titleText = new TextContainerProperty({
    containerID: 1,
    containerName: 'lat-title',
    content: `LATINE - ${ALL_PASSAGES.length} passages`,
    xPosition: 8,
    yPosition: 0,
    width: 560,
    height: 32,
    isEventCapture: 0,
  });

  const passageList = new ListContainerProperty({
    containerID: 2,
    containerName: 'lat-passages',
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length,
      itemWidth: 556,
      isItemSelectBorderEn: 1,
      itemName: items,
    }),
    isEventCapture: 1,
    xPosition: 8,
    yPosition: 40,
    width: 560,
    height: 248,
  });

  await rebuildPage({
    containerTotalNum: 2,
    textObject: [titleText],
    listObject: [passageList],
  });
}

async function renderTitlePage(): Promise<void> {
  const p = state.passage!;

  const titleText = new TextContainerProperty({
    containerID: 1,
    containerName: 'lat-title',
    content: `LATINE\n${p.source} \u00B7 ${p.reference}`,
    xPosition: 8,
    yPosition: 40,
    width: 560,
    height: 120,
    isEventCapture: 0,
  });

  const tapHint = new TextContainerProperty({
    containerID: 2,
    containerName: 'lat-hint',
    content: 'Tap to begin',
    xPosition: 8,
    yPosition: 200,
    width: 560,
    height: 40,
    isEventCapture: 0,
  });

  await rebuildPage({
    containerTotalNum: 3,
    textObject: [titleText, tapHint],
    listObject: [buildCaptureList(3)],
  });
}

async function renderSentencePage(): Promise<void> {
  const p = state.passage!;

  const latinText = new TextContainerProperty({
    containerID: 1,
    containerName: 'lat-latin',
    content: p.latin.join(' '),
    xPosition: 8,
    yPosition: 20,
    width: 560,
    height: 100,
    isEventCapture: 0,
  });

  const infoText = new TextContainerProperty({
    containerID: 2,
    containerName: 'lat-info',
    content: `${p.steps.length} questions \u2014 Tap to start`,
    xPosition: 8,
    yPosition: 180,
    width: 560,
    height: 40,
    isEventCapture: 0,
  });

  await rebuildPage({
    containerTotalNum: 3,
    textObject: [latinText, infoText],
    listObject: [buildCaptureList(3)],
  });
}

async function renderQuestionPage(): Promise<void> {
  const p = state.passage!;
  const step = p.steps[state.stepIndex]!;
  const progress = `[${state.stepIndex + 1}/${p.steps.length}]`;

  const promptText = new TextContainerProperty({
    containerID: 1,
    containerName: 'lat-prompt',
    content: `${progress} ${step.prompt}`,
    xPosition: 8,
    yPosition: 0,
    width: 560,
    height: 40,
    isEventCapture: 0,
  });

  const choiceList = new ListContainerProperty({
    containerID: 2,
    containerName: 'lat-choices',
    itemContainer: new ListItemContainerProperty({
      itemCount: step.choices.length,
      itemWidth: 556,
      isItemSelectBorderEn: 1,
      itemName: [...step.choices],
    }),
    isEventCapture: 1,
    xPosition: 8,
    yPosition: 50,
    width: 560,
    height: 238,
  });

  await rebuildPage({
    containerTotalNum: 2,
    textObject: [promptText],
    listObject: [choiceList],
  });
}

async function renderFeedbackPage(): Promise<void> {
  const p = state.passage!;
  const step = p.steps[state.stepIndex]!;
  const isCorrect = state.phase === 'correct';

  let content: string;
  if (isCorrect && step.reveal) {
    content = `CORRECT!\n${step.reveal.word} = "${step.reveal.gloss}"`;
  } else if (isCorrect) {
    content = 'CORRECT!';
  } else {
    const hint = state.wrongChoice && step.hints?.[state.wrongChoice];
    content = hint ? `Incorrect\n\n${hint}` : 'Incorrect \u2014 try again';
  }

  // Show partial translation on correct
  if (isCorrect) {
    const parts: string[] = [];
    for (const word of p.latin) {
      if (state.revealed.has(word)) {
        parts.push(state.revealed.get(word)!);
      }
    }
    if (parts.length > 0) {
      content += `\n\n${parts.join(' ')}`;
    }
  }

  const feedbackText = new TextContainerProperty({
    containerID: 1,
    containerName: 'lat-feedback',
    content,
    xPosition: 8,
    yPosition: 40,
    width: 560,
    height: 200,
    isEventCapture: 0,
  });

  await rebuildPage({
    containerTotalNum: 2,
    textObject: [feedbackText],
    listObject: [buildCaptureList(2)],
  });
}

async function renderSummaryPage(): Promise<void> {
  const p = state.passage!;

  const latinText = new TextContainerProperty({
    containerID: 1,
    containerName: 'lat-latin',
    content: p.latin.join(' '),
    xPosition: 8,
    yPosition: 10,
    width: 560,
    height: 80,
    isEventCapture: 0,
  });

  const transText = new TextContainerProperty({
    containerID: 2,
    containerName: 'lat-trans',
    content: `${p.translation}\n\n\u2713 Complete! Tap to return.`,
    xPosition: 8,
    yPosition: 110,
    width: 560,
    height: 160,
    isEventCapture: 0,
  });

  await rebuildPage({
    containerTotalNum: 3,
    textObject: [latinText, transText],
    listObject: [buildCaptureList(3)],
  });
}

function buildCaptureList(id: number): ListContainerProperty {
  return new ListContainerProperty({
    containerID: id,
    containerName: 'lat-cap',
    itemContainer: new ListItemContainerProperty({
      itemCount: 1,
      itemWidth: 1,
      isItemSelectBorderEn: 0,
      itemName: [' '],
    }),
    isEventCapture: 1,
    xPosition: 0,
    yPosition: 0,
    width: 1,
    height: 1,
  });
}

async function rebuildPage(config: any): Promise<void> {
  if (!bridge) return;
  try {
    if (!startupRendered) {
      await bridge.createStartUpPageContainer(new CreateStartUpPageContainer(config));
      startupRendered = true;
    } else {
      await bridge.rebuildPageContainer(new RebuildPageContainer(config));
    }
  } catch (err) {
    log('Render error: ' + String(err));
  }
}

// ── Input handling ──

function handleAction(type: string, selectedIndex: number, scrollDir?: 'up' | 'down'): void {
  // Ignore input during lockout (prevents stale events after phase transitions)
  if (Date.now() < inputLockedUntil) return;

  const prevPhase = state.phase;

  switch (state.phase) {
    case 'selector': {
      if (type === 'scroll') {
        if (selectedIndex >= 0 && selectedIndex < ALL_PASSAGES.length) {
          state.cursor = selectedIndex;
        }
        return;
      }
      if (type === 'click') {
        const idx = (selectedIndex >= 0 && selectedIndex < ALL_PASSAGES.length)
          ? selectedIndex : state.cursor;
        const passage = ALL_PASSAGES[idx];
        if (passage) {
          state.passage = passage;
          state.cursor = 0;

          // Resume progress if mid-lesson
          const progress = loadProgress();
          if (progress.current?.passageId === passage.id) {
            state.stepIndex = progress.current.stepIndex;
            state.phase = 'question';
            state.revealed = new Map();
            // Re-reveal words from completed steps
            for (let i = 0; i < state.stepIndex; i++) {
              const step = passage.steps[i];
              if (step?.reveal) {
                state.revealed.set(step.reveal.word, step.reveal.gloss);
              }
            }
          } else {
            state.stepIndex = 0;
            state.revealed = new Map();
            state.phase = 'title';
          }
        }
      }
      break;
    }

    case 'title':
      if (type === 'click') {
        state.phase = 'sentence';
      }
      break;

    case 'sentence':
      if (type === 'click') {
        state.phase = 'question';
        state.stepIndex = 0;
        state.cursor = 0;
        saveCurrent(state.passage!.id, 0);
      }
      break;

    case 'question': {
      const p = state.passage!;
      const step = p.steps[state.stepIndex];
      if (!step) break;

      if (type === 'scroll') {
        if (selectedIndex >= 0 && selectedIndex < step.choices.length) {
          state.cursor = selectedIndex;
        }
        return;
      }

      if (type === 'click') {
        const idx = (selectedIndex >= 0 && selectedIndex < step.choices.length)
          ? selectedIndex : state.cursor;
        state.cursor = idx;

        const selected = step.choices[idx];
        if (selected === step.target) {
          if (step.reveal) {
            state.revealed.set(step.reveal.word, step.reveal.gloss);
          }
          state.phase = 'correct';
          state.wrongChoice = null;
          setTimeout(() => {
            state.stepIndex++;
            state.cursor = 0;
            if (state.stepIndex >= p.steps.length) {
              state.phase = 'summary';
              markCompleted(p.id);
              clearCurrent();
            } else {
              state.phase = 'question';
              saveCurrent(p.id, state.stepIndex);
            }
            inputLockedUntil = Date.now() + INPUT_LOCKOUT_MS;
            void renderToGlasses();
          }, FEEDBACK_DURATION_MS);
        } else {
          state.phase = 'wrong';
          state.wrongChoice = selected!;
          setTimeout(() => {
            state.phase = 'question';
            inputLockedUntil = Date.now() + INPUT_LOCKOUT_MS;
            void renderToGlasses();
          }, WRONG_DURATION_MS);
        }
      }
      break;
    }

    case 'correct':
    case 'wrong':
      return;

    case 'summary':
      if (type === 'click') {
        state.phase = 'selector';
        state.passage = null;
        state.stepIndex = 0;
        state.cursor = nextPassageIndex();
        state.revealed = new Map();
        state.wrongChoice = null;
      }
      break;
  }

  if (state.phase !== prevPhase) {
    void renderToGlasses();
  }
}

// ── Bridge ──

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

async function connectBridge(): Promise<void> {
  log('Waiting for bridge...');

  try {
    bridge = await withTimeout(waitForEvenAppBridge(), BRIDGE_TIMEOUT_MS);
    log('Bridge connected!');
  } catch {
    log('Bridge timeout — no glasses detected');
    bridge = null;
    return;
  }

  try {
    bridge.onEvenHubEvent((event) => {
      const rawEventType = getRawEventType(event);
      const eventType = normalizeEventType(rawEventType, OsEventTypeList);

      const incomingIndex = typeof event.listEvent?.currentSelectItemIndex === 'number'
        ? event.listEvent.currentSelectItemIndex
        : -1;

      if (eventType === OsEventTypeList.CLICK_EVENT || (eventType === undefined && event.listEvent)) {
        log(`Tap (index=${incomingIndex})`);
        handleAction('click', incomingIndex);
      } else if (eventType === OsEventTypeList.SCROLL_TOP_EVENT || eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
        const dir = eventType === OsEventTypeList.SCROLL_TOP_EVENT ? 'up' : 'down';
        log(`Scroll ${dir} (index=${incomingIndex})`);
        handleAction('scroll', incomingIndex, dir);
      } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        log('Double tap');
        handleAction('click', incomingIndex);
      }
    });
    log('Event listener registered');
  } catch (err) {
    log('Event error: ' + String(err));
  }

  await renderToGlasses();
  log('Initial page rendered');
}

// ── Public API ──

export function setStatusCallback(cb: (msg: string) => void): void {
  statusCallback = cb;
}

export function setPreviewCallback(cb: (phase: string, lines: string[]) => void): void {
  previewCallback = cb;
}

export function simulateAction(actionType: 'SCROLL_UP' | 'SCROLL_DOWN' | 'TAP' | 'DOUBLE_TAP'): void {
  // For sim without bridge, manually adjust cursor for scroll
  if (actionType === 'SCROLL_UP' || actionType === 'SCROLL_DOWN') {
    const dir = actionType === 'SCROLL_UP' ? -1 : 1;
    if (state.phase === 'selector') {
      state.cursor = ((state.cursor + dir) % ALL_PASSAGES.length + ALL_PASSAGES.length) % ALL_PASSAGES.length;
    } else if (state.phase === 'question' && state.passage) {
      const step = state.passage.steps[state.stepIndex];
      if (step) {
        state.cursor = ((state.cursor + dir) % step.choices.length + step.choices.length) % step.choices.length;
      }
    }
    handleAction('scroll', state.cursor);
  } else {
    handleAction('click', state.cursor);
  }

  const lines = buildDisplayLines();
  previewCallback?.(state.phase, lines);
}

export async function startApp(): Promise<void> {
  state = createInitialState();
  log('Ready — select a passage');

  // Update preview immediately
  const lines = buildDisplayLines();
  previewCallback?.(state.phase, lines);

  await connectBridge();
}
