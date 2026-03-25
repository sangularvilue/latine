/**
 * Latine App — bridge lifecycle, game loop, state machine.
 */

import {
  waitForEvenAppBridge,
  ImageRawDataUpdate,
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ListContainerProperty,
  ListItemContainerProperty,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';
import type { AppState, Action } from './types';
import { getTodaysPassage } from './passages';
import { mapEvenHubEvent } from './input';
import { render, getPixels } from './render';
import { encodeBmp } from '@shared/bmp';
import {
  BUF_W, IMAGE_WIDTH, IMAGE_HEIGHT,
  BOARD_DISPLAY_X, BOARD_DISPLAY_Y,
  SEND_INTERVAL_MS, TICK_MS,
  CONTAINER_ID_TL, CONTAINER_ID_TR, CONTAINER_ID_BL, CONTAINER_ID_BR,
  CONTAINER_NAME_TL, CONTAINER_NAME_TR, CONTAINER_NAME_BL, CONTAINER_NAME_BR,
} from '@shared/constants';

const FEEDBACK_DURATION_MS = 1500;
const WRONG_DURATION_MS = 800;

let bridge: EvenAppBridge | null = null;
let state: AppState;
let running = false;
let lastSendTime = 0;
let dirty = true;
let frameCallback: ((buf: Uint8Array) => void) | null = null;

const TILE_CONTAINERS = [
  { id: CONTAINER_ID_TL, name: CONTAINER_NAME_TL, offX: 0, offY: 0 },
  { id: CONTAINER_ID_TR, name: CONTAINER_NAME_TR, offX: IMAGE_WIDTH, offY: 0 },
  { id: CONTAINER_ID_BL, name: CONTAINER_NAME_BL, offX: 0, offY: IMAGE_HEIGHT },
] as const;

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

// ── Input handling ──

function handleAction(action: Action): void {
  switch (state.phase) {
    case 'title':
      if (action.type === 'TAP' || action.type === 'DOUBLE_TAP') {
        state.phase = 'sentence';
      }
      break;

    case 'sentence':
      if (action.type === 'TAP' || action.type === 'DOUBLE_TAP') {
        state.phase = 'question';
        state.stepIndex = 0;
        state.cursor = 0;
      }
      break;

    case 'question':
      handleQuestionInput(action);
      break;

    case 'correct':
    case 'wrong':
      // Ignore input during feedback — auto-advances
      break;

    case 'summary':
      if (action.type === 'TAP' || action.type === 'DOUBLE_TAP') {
        // Restart with same passage
        state.phase = 'title';
        state.stepIndex = 0;
        state.cursor = 0;
        state.revealed = new Map();
      }
      break;
  }
  dirty = true;
}

function handleQuestionInput(action: Action): void {
  const step = state.passage.steps[state.stepIndex];
  if (!step) return;

  switch (action.type) {
    case 'SCROLL': {
      const dir = action.direction === 'up' ? -1 : 1;
      state.cursor = ((state.cursor + dir) % 4 + 4) % 4;
      break;
    }
    case 'TAP':
    case 'DOUBLE_TAP': {
      const selected = step.choices[state.cursor];
      if (selected === step.target) {
        // Correct — reveal word if applicable
        if (step.reveal) {
          state.revealed.set(step.reveal.word, step.reveal.gloss);
        }
        state.phase = 'correct';
        state.feedbackTimer = FEEDBACK_DURATION_MS;
      } else {
        state.phase = 'wrong';
        state.feedbackTimer = WRONG_DURATION_MS;
      }
      break;
    }
  }
}

// ── Game loop ──

function tick(): void {
  if (!running) return;

  // Handle feedback timers
  if (state.phase === 'correct' || state.phase === 'wrong') {
    state.feedbackTimer -= TICK_MS;
    if (state.feedbackTimer <= 0) {
      if (state.phase === 'correct') {
        // Advance to next step or summary
        state.stepIndex++;
        state.cursor = 0;
        if (state.stepIndex >= state.passage.steps.length) {
          state.phase = 'summary';
        } else {
          state.phase = 'question';
        }
      } else {
        // Wrong — go back to question
        state.phase = 'question';
      }
      dirty = true;
    }
  }

  // Render
  if (dirty) {
    render(state);
    const buf = getPixels();

    if (frameCallback) frameCallback(buf);

    const now = performance.now();
    if (bridge && now - lastSendTime >= SEND_INTERVAL_MS) {
      lastSendTime = now;
      for (const tile of TILE_CONTAINERS) {
        const bmp = encodeBmp(buf, BUF_W, tile.offX, tile.offY, IMAGE_WIDTH, IMAGE_HEIGHT);
        void bridge.updateImageRawData(new ImageRawDataUpdate({
          containerID: tile.id,
          containerName: tile.name,
          imageData: bmp,
        }));
      }
    }

    dirty = false;
  }

  setTimeout(tick, TICK_MS);
}

// ── Bridge ──

function composeStartupPage(): CreateStartUpPageContainer {
  const imageObjects = [
    new ImageContainerProperty({
      xPosition: BOARD_DISPLAY_X,
      yPosition: BOARD_DISPLAY_Y,
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      containerID: CONTAINER_ID_TL,
      containerName: CONTAINER_NAME_TL,
    }),
    new ImageContainerProperty({
      xPosition: BOARD_DISPLAY_X + IMAGE_WIDTH,
      yPosition: BOARD_DISPLAY_Y,
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      containerID: CONTAINER_ID_TR,
      containerName: CONTAINER_NAME_TR,
    }),
    new ImageContainerProperty({
      xPosition: BOARD_DISPLAY_X,
      yPosition: BOARD_DISPLAY_Y + IMAGE_HEIGHT,
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
      containerID: CONTAINER_ID_BL,
      containerName: CONTAINER_NAME_BL,
    }),
  ];

  const listObjects = [
    new ListContainerProperty({
      containerID: CONTAINER_ID_BR,
      containerName: CONTAINER_NAME_BR,
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
    }),
  ];

  return new CreateStartUpPageContainer({
    containerTotalNum: imageObjects.length + listObjects.length,
    imageObject: imageObjects,
    listObject: listObjects,
  });
}

async function connectBridge(): Promise<void> {
  try {
    bridge = await waitForEvenAppBridge();
    console.log('[Latine] Bridge connected');

    await bridge.createStartUpPageContainer(composeStartupPage());

    bridge.onEvenHubEvent((event: EvenHubEvent) => {
      const action = mapEvenHubEvent(event);
      if (action) handleAction(action);
    });

    dirty = true;
  } catch (err) {
    console.error('[Latine] Bridge error:', err);
    bridge = null;
  }
}

// ── Public API ──

export function setFrameCallback(cb: (buf: Uint8Array) => void): void {
  frameCallback = cb;
}

export function getState(): AppState {
  return state;
}

export function simulateAction(actionType: 'SCROLL_UP' | 'SCROLL_DOWN' | 'TAP' | 'DOUBLE_TAP'): void {
  let action: Action;
  switch (actionType) {
    case 'SCROLL_UP':
      action = { type: 'SCROLL', direction: 'up' };
      break;
    case 'SCROLL_DOWN':
      action = { type: 'SCROLL', direction: 'down' };
      break;
    case 'TAP':
      action = { type: 'TAP', selectedIndex: 0, selectedName: '' };
      break;
    case 'DOUBLE_TAP':
      action = { type: 'DOUBLE_TAP' };
      break;
  }
  handleAction(action);
}

export async function startApp(): Promise<void> {
  state = createInitialState();
  running = true;
  dirty = true;
  tick();
  connectBridge();
}
