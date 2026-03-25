/**
 * Latine App — uses native text + list containers on the glasses.
 * No pixel buffer rendering — the SDK handles display directly.
 */

import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { getRawEventType, normalizeEventType } from './even-events';
import type { AppState, Passage, Step } from './types';
import { getTodaysPassage } from './passages';

const BRIDGE_TIMEOUT_MS = 8000;
const FEEDBACK_DURATION_MS = 1800;
const WRONG_DURATION_MS = 1000;

let bridge: EvenAppBridge | null = null;
let startupRendered = false;
let state: AppState;
let statusCallback: ((msg: string) => void) | null = null;
let previewCallback: ((phase: string, lines: string[]) => void) | null = null;

function log(msg: string): void {
  console.log(`[Latine] ${msg}`);
  statusCallback?.(msg);
}

function createInitialState(): AppState {
  return {
    phase: 'title',
    passage: getTodaysPassage(),
    stepIndex: 0,
    cursor: 0,
    revealed: new Map(),
    feedbackTimer: 0,
  };
}

// ── Glasses rendering via SDK containers ──

async function renderToGlasses(): Promise<void> {
  if (!bridge) return;

  const lines = buildDisplayLines();
  previewCallback?.(state.phase, lines);

  switch (state.phase) {
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
  const p = state.passage;
  switch (state.phase) {
    case 'title':
      return ['LATINE', '', p.source, p.reference, '', 'Tap to begin'];
    case 'sentence':
      return [p.latin.join(' '), '', `${p.steps.length} questions`, 'Tap to start'];
    case 'question': {
      const step = p.steps[state.stepIndex]!;
      const progress = `${state.stepIndex + 1}/${p.steps.length}`;
      return [p.latin.join(' '), '', `${progress}  ${step.prompt}`, ...step.choices.map((c, i) => i === state.cursor ? `> ${c}` : `  ${c}`)];
    }
    case 'correct': {
      const step = p.steps[state.stepIndex]!;
      const reveal = step.reveal ? `${step.reveal.word} = "${step.reveal.gloss}"` : '';
      return [p.latin.join(' '), '', 'CORRECT!', reveal];
    }
    case 'wrong':
      return [p.latin.join(' '), '', 'Try again...'];
    case 'summary':
      return [p.latin.join(' '), '', p.translation, '', 'Complete!'];
    default:
      return [];
  }
}

async function renderTitlePage(): Promise<void> {
  const p = state.passage;

  const titleText = new TextContainerProperty({
    containerID: 1,
    containerName: 'lat-title',
    content: `LATINE\n${p.source} · ${p.reference}`,
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

  const captureList = buildCaptureList(3);

  await rebuildPage({
    containerTotalNum: 3,
    textObject: [titleText, tapHint],
    listObject: [captureList],
  });
}

async function renderSentencePage(): Promise<void> {
  const p = state.passage;

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
    content: `${p.steps.length} questions — Tap to start`,
    xPosition: 8,
    yPosition: 180,
    width: 560,
    height: 40,
    isEventCapture: 0,
  });

  const captureList = buildCaptureList(3);

  await rebuildPage({
    containerTotalNum: 3,
    textObject: [latinText, infoText],
    listObject: [captureList],
  });
}

async function renderQuestionPage(): Promise<void> {
  const p = state.passage;
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
  const step = state.passage.steps[state.stepIndex]!;
  const isCorrect = state.phase === 'correct';

  let content: string;
  if (isCorrect && step.reveal) {
    content = `CORRECT!\n${step.reveal.word} = "${step.reveal.gloss}"`;
  } else if (isCorrect) {
    content = 'CORRECT!';
  } else {
    content = 'Try again...';
  }

  // Build partial translation
  if (isCorrect) {
    const parts: string[] = [];
    for (const word of state.passage.latin) {
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
    yPosition: 60,
    width: 560,
    height: 160,
    isEventCapture: 0,
  });

  const captureList = buildCaptureList(2);

  await rebuildPage({
    containerTotalNum: 2,
    textObject: [feedbackText],
    listObject: [captureList],
  });
}

async function renderSummaryPage(): Promise<void> {
  const p = state.passage;

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
    content: `${p.translation}\n\nComplete! Tap to restart.`,
    xPosition: 8,
    yPosition: 110,
    width: 560,
    height: 160,
    isEventCapture: 0,
  });

  const captureList = buildCaptureList(3);

  await rebuildPage({
    containerTotalNum: 3,
    textObject: [latinText, transText],
    listObject: [captureList],
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

function handleAction(type: string, selectedIndex: number): void {
  const prevPhase = state.phase;

  switch (state.phase) {
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
      }
      break;

    case 'question': {
      const step = state.passage.steps[state.stepIndex];
      if (!step) break;

      if (type === 'scroll') {
        // List container handles scroll selection natively, just track index
        if (selectedIndex >= 0 && selectedIndex < step.choices.length) {
          state.cursor = selectedIndex;
        }
        return; // Don't re-render on scroll — list handles highlight
      }

      if (type === 'click') {
        // Use the selected index from the list
        const idx = (selectedIndex >= 0 && selectedIndex < step.choices.length)
          ? selectedIndex
          : state.cursor;
        state.cursor = idx;

        const selected = step.choices[idx];
        if (selected === step.target) {
          if (step.reveal) {
            state.revealed.set(step.reveal.word, step.reveal.gloss);
          }
          state.phase = 'correct';
          setTimeout(() => {
            state.stepIndex++;
            state.cursor = 0;
            if (state.stepIndex >= state.passage.steps.length) {
              state.phase = 'summary';
            } else {
              state.phase = 'question';
            }
            void renderToGlasses();
          }, FEEDBACK_DURATION_MS);
        } else {
          state.phase = 'wrong';
          setTimeout(() => {
            state.phase = 'question';
            void renderToGlasses();
          }, WRONG_DURATION_MS);
        }
      }
      break;
    }

    case 'correct':
    case 'wrong':
      // Ignore — timer handles transition
      return;

    case 'summary':
      if (type === 'click') {
        state.phase = 'title';
        state.stepIndex = 0;
        state.cursor = 0;
        state.revealed = new Map();
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
        log(`Scroll (index=${incomingIndex})`);
        handleAction('scroll', incomingIndex);
      } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        log('Double tap');
        handleAction('click', incomingIndex);
      }
    });
    log('Event listener registered');
  } catch (err) {
    log('Event error: ' + String(err));
  }

  // Render initial page to glasses
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
  switch (actionType) {
    case 'SCROLL_UP':
    case 'SCROLL_DOWN':
      handleAction('scroll', -1);
      break;
    case 'TAP':
    case 'DOUBLE_TAP':
      handleAction('click', -1);
      break;
  }
  // For phone sim without bridge, manually update preview
  const lines = buildDisplayLines();
  previewCallback?.(state.phase, lines);
}

export async function startApp(): Promise<void> {
  state = createInitialState();
  log(`Passage: ${state.passage.source} ${state.passage.reference}`);
  await connectBridge();
}
