/**
 * Latine App — modes: Home, Learn, Practice, Read
 * Uses native text + list containers on the glasses.
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
import type { Passage, Step } from './types';
import type { ReadingPassage, ReadingQuestion } from './gamification-types';
import { ALL_PASSAGES, ALL_READING_PASSAGES, getPassageById } from './passages';
import { loadProgress, markCompleted, saveCurrent, clearCurrent, isCompleted } from './progress';
import { loadGamification, awardXP, recordCorrect, recordWrong, getRank, completePracticeRound, completeReadPassage, getStreakBonus } from './gamification';

// ── Constants ──

const BRIDGE_TIMEOUT_MS = 8000;
const FEEDBACK_DURATION_MS = 1800;
const WRONG_DURATION_MS = 2000;
const INPUT_LOCKOUT_MS = 500;
const PAGE_SIZE = 6;
const PRACTICE_ROUND_SIZE = 10;

// ── State ──

type Mode = 'home' | 'learn' | 'practice' | 'read';
type Phase =
  // Home
  | 'home'
  // Learn
  | 'learn-selector' | 'learn-title' | 'learn-sentence' | 'learn-question' | 'learn-correct' | 'learn-wrong' | 'learn-summary'
  // Practice
  | 'practice-ready' | 'practice-question' | 'practice-correct' | 'practice-wrong' | 'practice-results'
  // Read
  | 'read-ready' | 'read-passage' | 'read-glossary' | 'read-question' | 'read-correct' | 'read-wrong' | 'read-complete';

interface AppState {
  mode: Mode;
  phase: Phase;
  cursor: number;
  // Learn mode
  passage: Passage | null;
  stepIndex: number;
  revealed: Map<string, string>;
  wrongChoice: string | null;
  // Practice mode
  practicePool: { step: Step; passageId: string }[];
  practiceIndex: number;
  practiceCorrect: number;
  practiceXP: number;
  // Read mode
  readPassage: ReadingPassage | null;
  readPages: string[];
  readPageIndex: number;
  readQuestionIndex: number;
  readCorrect: number;
}

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
  const idx = ALL_PASSAGES.findIndex(p => !isCompleted(p.id));
  return idx >= 0 ? idx : 0;
}

function createInitialState(): AppState {
  return {
    mode: 'home',
    phase: 'home',
    cursor: 0,
    passage: null,
    stepIndex: 0,
    revealed: new Map(),
    wrongChoice: null,
    practicePool: [],
    practiceIndex: 0,
    practiceCorrect: 0,
    practiceXP: 0,
    readPassage: null,
    readPages: [],
    readPageIndex: 0,
    readQuestionIndex: 0,
    readCorrect: 0,
  };
}

// ── Shared rendering helpers ──

function buildCaptureList(id: number): ListContainerProperty {
  return new ListContainerProperty({
    containerID: id,
    containerName: 'lat-cap',
    itemContainer: new ListItemContainerProperty({
      itemCount: 1, itemWidth: 1, isItemSelectBorderEn: 0, itemName: [' '],
    }),
    isEventCapture: 1,
    xPosition: 0, yPosition: 0, width: 1, height: 1,
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

async function renderTextPage(title: string, body: string): Promise<void> {
  const t = new TextContainerProperty({
    containerID: 1, containerName: 'lat-text',
    content: `${title}\n\n${body}`.slice(0, 990),
    xPosition: 8, yPosition: 0, width: 560, height: 280,
    isEventCapture: 0,
  });
  await rebuildPage({ containerTotalNum: 2, textObject: [t], listObject: [buildCaptureList(2)] });
}

async function renderQuestionUI(header: string, prompt: string, choices: string[]): Promise<void> {
  const t = new TextContainerProperty({
    containerID: 1, containerName: 'lat-prompt',
    content: `${header}\n${prompt}`,
    xPosition: 8, yPosition: 0, width: 560, height: 50,
    isEventCapture: 0,
  });
  const list = new ListContainerProperty({
    containerID: 2, containerName: 'lat-choices',
    itemContainer: new ListItemContainerProperty({
      itemCount: choices.length, itemWidth: 556, isItemSelectBorderEn: 1,
      itemName: choices,
    }),
    isEventCapture: 1,
    xPosition: 8, yPosition: 58, width: 560, height: 230,
  });
  await rebuildPage({ containerTotalNum: 2, textObject: [t], listObject: [list] });
}

// ── Home mode ──

async function renderHome(): Promise<void> {
  const gam = loadGamification();
  const rank = getRank(gam.xp);
  const completed = loadProgress().completed.length;

  const t = new TextContainerProperty({
    containerID: 1, containerName: 'lat-home',
    content: `LATINE   ${gam.xp}xp ${rank.title}\nStreak: ${gam.currentStreak}  Done: ${completed}`,
    xPosition: 8, yPosition: 0, width: 560, height: 40,
    isEventCapture: 0,
  });

  const items = [
    `Learn (${completed}/${ALL_PASSAGES.length} drills)`,
    `Practice (quick ${PRACTICE_ROUND_SIZE}Q quiz)`,
    `Read (${ALL_READING_PASSAGES.length} passages)`,
  ];
  const list = new ListContainerProperty({
    containerID: 2, containerName: 'lat-modes',
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length, itemWidth: 556, isItemSelectBorderEn: 1,
      itemName: items,
    }),
    isEventCapture: 1,
    xPosition: 8, yPosition: 48, width: 560, height: 240,
  });
  await rebuildPage({ containerTotalNum: 2, textObject: [t], listObject: [list] });
}

// ── Learn mode (existing drill logic) ──

function learnSelectorData(): { items: string[]; passageIndices: number[] } {
  const page = Math.floor(state.cursor / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, ALL_PASSAGES.length);
  const hasPrev = page > 0;
  const hasNext = end < ALL_PASSAGES.length;

  const items: string[] = [];
  const passageIndices: number[] = [];

  if (hasPrev) { items.push('<< Previous'); passageIndices.push(-1); }
  for (let i = start; i < end; i++) {
    const p = ALL_PASSAGES[i]!;
    items.push(`${p.reference}${isCompleted(p.id) ? ' *' : ''}`);
    passageIndices.push(i);
  }
  if (hasNext) { items.push('Next >>'); passageIndices.push(-2); }

  return { items, passageIndices };
}

async function renderLearnSelector(): Promise<void> {
  const { items } = learnSelectorData();
  const page = Math.floor(state.cursor / PAGE_SIZE);
  const totalPages = Math.ceil(ALL_PASSAGES.length / PAGE_SIZE);

  const t = new TextContainerProperty({
    containerID: 1, containerName: 'lat-title',
    content: `Learn (${page + 1}/${totalPages})`,
    xPosition: 8, yPosition: 0, width: 560, height: 32,
    isEventCapture: 0,
  });
  const list = new ListContainerProperty({
    containerID: 2, containerName: 'lat-passages',
    itemContainer: new ListItemContainerProperty({
      itemCount: items.length, itemWidth: 556, isItemSelectBorderEn: 1,
      itemName: items,
    }),
    isEventCapture: 1,
    xPosition: 8, yPosition: 40, width: 560, height: 248,
  });
  await rebuildPage({ containerTotalNum: 2, textObject: [t], listObject: [list] });
}

async function renderLearnTitle(): Promise<void> {
  const p = state.passage!;
  await renderTextPage(`LATINE\n${p.source} \u00B7 ${p.reference}`, 'Tap to begin');
}

async function renderLearnSentence(): Promise<void> {
  const p = state.passage!;
  await renderTextPage(p.latin.join(' '), `${p.steps.length} questions \u2014 Tap to start`);
}

async function renderLearnQuestion(): Promise<void> {
  const p = state.passage!;
  const step = p.steps[state.stepIndex]!;
  const progress = `[${state.stepIndex + 1}/${p.steps.length}]`;
  await renderQuestionUI(progress, step.prompt, [...step.choices]);
}

async function renderLearnFeedback(): Promise<void> {
  const p = state.passage!;
  const step = p.steps[state.stepIndex]!;
  const isCorrect = state.phase === 'learn-correct';

  let body: string;
  if (isCorrect) {
    const gam = loadGamification();
    const bonus = getStreakBonus(gam.currentStreak);
    body = `CORRECT! +10xp${bonus > 0 ? ` (+${bonus} streak)` : ''}`;
    if (step.reveal) body += `\n${step.reveal.word} = "${step.reveal.gloss}"`;
    const parts = [...state.revealed.values()];
    if (parts.length > 0) body += `\n\n${parts.join(' ')}`;
  } else {
    const hint = state.wrongChoice && step.hints?.[state.wrongChoice];
    body = hint ? `Incorrect\n\n${hint}` : 'Incorrect \u2014 try again';
  }
  await renderTextPage('', body);
}

async function renderLearnSummary(): Promise<void> {
  const p = state.passage!;
  await renderTextPage(p.latin.join(' '), `${p.translation}\n\n\u2713 Complete! Tap to return.`);
}

// ── Practice mode ──

function buildPracticePool(): { step: Step; passageId: string }[] {
  const progress = loadProgress();
  const completedPassages = ALL_PASSAGES.filter(p => progress.completed.includes(p.id));
  if (completedPassages.length === 0) return [];

  // Collect all steps from completed passages
  const allSteps: { step: Step; passageId: string }[] = [];
  for (const p of completedPassages) {
    for (const step of p.steps) {
      allSteps.push({ step, passageId: p.id });
    }
  }

  // Shuffle and take PRACTICE_ROUND_SIZE
  for (let i = allSteps.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allSteps[i], allSteps[j]] = [allSteps[j]!, allSteps[i]!];
  }
  return allSteps.slice(0, PRACTICE_ROUND_SIZE);
}

async function renderPracticeReady(): Promise<void> {
  const pool = buildPracticePool();
  if (pool.length === 0) {
    await renderTextPage('Practice', 'Complete some Learn drills first!\n\nPractice pulls questions from\npassages you\'ve already finished.\n\nTap to go back.');
  } else {
    await renderTextPage('Practice Round', `${Math.min(PRACTICE_ROUND_SIZE, pool.length)} random questions\nfrom completed drills\n\nTap to start!`);
  }
}

async function renderPracticeQuestion(): Promise<void> {
  const item = state.practicePool[state.practiceIndex]!;
  const progress = `[${state.practiceIndex + 1}/${state.practicePool.length}]`;
  await renderQuestionUI(progress, item.step.prompt, [...item.step.choices]);
}

async function renderPracticeFeedback(): Promise<void> {
  const item = state.practicePool[state.practiceIndex]!;
  const isCorrect = state.phase === 'practice-correct';
  if (isCorrect) {
    const gam = loadGamification();
    const bonus = getStreakBonus(gam.currentStreak);
    await renderTextPage('', `CORRECT! +10xp${bonus > 0 ? ` (+${bonus} streak)` : ''}\nStreak: ${gam.currentStreak}`);
  } else {
    const hint = state.wrongChoice && item.step.hints?.[state.wrongChoice];
    await renderTextPage('', hint ? `Incorrect\n\n${hint}\n\nAnswer: ${item.step.target}` : `Incorrect\n\nAnswer: ${item.step.target}`);
  }
}

async function renderPracticeResults(): Promise<void> {
  const total = state.practicePool.length;
  const pct = total > 0 ? Math.round((state.practiceCorrect / total) * 100) : 0;
  const gam = loadGamification();
  await renderTextPage('Round Complete!',
    `${state.practiceCorrect}/${total} correct (${pct}%)\n+${state.practiceXP} XP earned\nBest streak: ${gam.bestStreak}\n\nTap to return.`);
}

// ── Read mode ──

function pickRandomReadPassage(): ReadingPassage | null {
  const gam = loadGamification();
  // Prefer unread passages
  const unread = ALL_READING_PASSAGES.filter(p => !gam.readPassagesCompleted.includes(p.id));
  const pool = unread.length > 0 ? unread : ALL_READING_PASSAGES;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

async function renderReadReady(): Promise<void> {
  const gam = loadGamification();
  const total = ALL_READING_PASSAGES.length;
  const done = gam.readPassagesCompleted.length;
  const rp = pickRandomReadPassage();
  if (!rp) {
    await renderTextPage('Read', 'No passages available.');
    return;
  }
  // Store the picked passage so tap uses it
  state.readPassage = rp;
  await renderTextPage(
    `Read (${done}/${total} completed)`,
    `${rp.source} \u2014 ${rp.chapter}\n\nTap to start reading`
  );
}

function paginateText(text: string, charsPerPage: number = 400): string[] {
  const words = text.split(/\s+/);
  const pages: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > charsPerPage && current) {
      pages.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) pages.push(current);
  return pages.length > 0 ? pages : [''];
}

async function renderReadPassage(): Promise<void> {
  const rp = state.readPassage!;
  const page = state.readPages[state.readPageIndex] ?? '';
  const pageInfo = state.readPages.length > 1
    ? `(${state.readPageIndex + 1}/${state.readPages.length}) `
    : '';
  const nav = state.readPageIndex < state.readPages.length - 1
    ? '\n\nSwipe for more \u2014 Tap for vocabulary'
    : '\n\nTap for vocabulary';
  await renderTextPage(`${pageInfo}${rp.source} \u2014 ${rp.chapter}`, `${page}${nav}`);
}

async function renderReadGlossary(): Promise<void> {
  const rp = state.readPassage!;
  const entries = Object.entries(rp.glossary);
  const lines = entries.map(([word, def]) => `${word} \u2014 ${def}`).join('\n');
  await renderTextPage('Vocabulary', `${lines}\n\nTap for questions\nDouble-tap to re-read`);
}

async function renderReadQuestion(): Promise<void> {
  const rp = state.readPassage!;
  const q = rp.questions[state.readQuestionIndex]!;
  const progress = `[${state.readQuestionIndex + 1}/${rp.questions.length}]`;
  await renderQuestionUI(progress, q.prompt, [...q.choices]);
}

async function renderReadFeedback(): Promise<void> {
  const rp = state.readPassage!;
  const q = rp.questions[state.readQuestionIndex]!;
  const isCorrect = state.phase === 'read-correct';
  if (isCorrect) {
    const gam = loadGamification();
    await renderTextPage('', `CORRECT! +20xp\nStreak: ${gam.currentStreak}`);
  } else {
    await renderTextPage('', `Incorrect\n\nAnswer: ${q.target}`);
  }
}

async function renderReadComplete(): Promise<void> {
  const rp = state.readPassage!;
  const total = rp.questions.length;
  const pct = total > 0 ? Math.round((state.readCorrect / total) * 100) : 0;
  await renderTextPage('Passage Complete!',
    `${state.readCorrect}/${total} correct (${pct}%)\n\n${rp.translation.slice(0, 400)}\n\nTap to return.`);
}

// ── Main render dispatcher ──

async function renderToGlasses(): Promise<void> {
  if (!bridge) return;
  const lines = buildDisplayLines();
  previewCallback?.(state.phase, lines);

  switch (state.phase) {
    case 'home': await renderHome(); break;
    case 'learn-selector': await renderLearnSelector(); break;
    case 'learn-title': await renderLearnTitle(); break;
    case 'learn-sentence': await renderLearnSentence(); break;
    case 'learn-question': await renderLearnQuestion(); break;
    case 'learn-correct': case 'learn-wrong': await renderLearnFeedback(); break;
    case 'learn-summary': await renderLearnSummary(); break;
    case 'practice-ready': await renderPracticeReady(); break;
    case 'practice-question': await renderPracticeQuestion(); break;
    case 'practice-correct': case 'practice-wrong': await renderPracticeFeedback(); break;
    case 'practice-results': await renderPracticeResults(); break;
    case 'read-ready': await renderReadReady(); break;
    case 'read-passage': await renderReadPassage(); break;
    case 'read-glossary': await renderReadGlossary(); break;
    case 'read-question': await renderReadQuestion(); break;
    case 'read-correct': case 'read-wrong': await renderReadFeedback(); break;
    case 'read-complete': await renderReadComplete(); break;
  }
}

function buildDisplayLines(): string[] {
  const gam = loadGamification();
  switch (state.phase) {
    case 'home':
      return ['LATINE', `${gam.xp}xp ${getRank(gam.xp).title}`, '', '> Learn', '  Practice', '  Read'];
    case 'learn-selector':
      return ['Learn - Select passage'];
    case 'learn-title':
      return [state.passage!.source, state.passage!.reference, '', 'Tap to begin'];
    case 'learn-sentence':
      return [state.passage!.latin.join(' ')];
    case 'learn-question': {
      const step = state.passage!.steps[state.stepIndex]!;
      return [step.prompt, ...step.choices.map((c, i) => i === state.cursor ? `> ${c}` : `  ${c}`)];
    }
    case 'learn-correct': return ['CORRECT!'];
    case 'learn-wrong': return ['Incorrect'];
    case 'learn-summary': return [state.passage!.translation, '', 'Complete!'];
    case 'practice-ready': return ['Practice Round', 'Tap to start'];
    case 'practice-question': {
      const item = state.practicePool[state.practiceIndex]!;
      return [item.step.prompt, ...item.step.choices];
    }
    case 'practice-correct': return ['CORRECT!'];
    case 'practice-wrong': return ['Incorrect'];
    case 'practice-results': return [`${state.practiceCorrect}/${state.practicePool.length}`, 'Complete!'];
    case 'read-ready': return ['Read', state.readPassage ? `${state.readPassage.source} - ${state.readPassage.chapter}` : '', 'Tap to start'];
    case 'read-passage': {
      const page = state.readPages[state.readPageIndex] ?? '';
      return [`(${state.readPageIndex + 1}/${state.readPages.length})`, page.slice(0, 200)];
    }
    case 'read-glossary': return Object.entries(state.readPassage!.glossary).map(([w, d]) => `${w}: ${d}`);
    case 'read-question': {
      const q = state.readPassage!.questions[state.readQuestionIndex]!;
      return [q.prompt, ...q.choices];
    }
    case 'read-correct': return ['CORRECT!'];
    case 'read-wrong': return ['Incorrect'];
    case 'read-complete': return ['Complete!', state.readPassage!.translation.slice(0, 200)];
    default: return [];
  }
}

// ── Input handling ──

function goHome(): void {
  state.mode = 'home';
  state.phase = 'home';
  state.cursor = 0;
  state.passage = null;
  state.readPassage = null;
  state.wrongChoice = null;
  void renderToGlasses();
}

function handleAction(type: string, selectedIndex: number, scrollDir?: 'up' | 'down'): void {
  // Double-tap: return to home (bypasses lockout)
  // Exception: on glossary, double-tap goes back to passage
  if (type === 'double_tap' && state.phase !== 'home') {
    if (state.phase === 'read-glossary') {
      state.phase = 'read-passage';
      void renderToGlasses();
      return;
    }
    goHome();
    return;
  }

  if (Date.now() < inputLockedUntil) return;
  const prevPhase = state.phase;

  switch (state.phase) {

    // ── HOME ──
    case 'home': {
      if (type === 'click') {
        const idx = selectedIndex >= 0 && selectedIndex < 3 ? selectedIndex : state.cursor;
        if (idx === 0) {
          state.mode = 'learn';
          state.phase = 'learn-selector';
          state.cursor = nextPassageIndex();
        } else if (idx === 1) {
          state.mode = 'practice';
          state.phase = 'practice-ready';
          state.cursor = 0;
        } else if (idx === 2) {
          state.mode = 'read';
          state.phase = 'read-ready';
          state.cursor = 0;
        }
      }
      break;
    }

    // ── LEARN ──
    case 'learn-selector': {
      const { passageIndices } = learnSelectorData();
      if (type === 'scroll') return;
      if (type === 'click') {
        const listIdx = selectedIndex >= 0 && selectedIndex < passageIndices.length ? selectedIndex : -1;
        if (listIdx < 0) return;
        const mapped = passageIndices[listIdx]!;
        if (mapped === -1) { state.cursor = (Math.floor(state.cursor / PAGE_SIZE) - 1) * PAGE_SIZE; void renderToGlasses(); return; }
        if (mapped === -2) { state.cursor = (Math.floor(state.cursor / PAGE_SIZE) + 1) * PAGE_SIZE; void renderToGlasses(); return; }
        const passage = ALL_PASSAGES[mapped];
        if (passage) {
          state.passage = passage;
          state.cursor = 0;
          const progress = loadProgress();
          if (progress.current?.passageId === passage.id) {
            state.stepIndex = progress.current.stepIndex;
            state.phase = 'learn-question';
            state.revealed = new Map();
            for (let i = 0; i < state.stepIndex; i++) {
              const step = passage.steps[i];
              if (step?.reveal) state.revealed.set(step.reveal.word, step.reveal.gloss);
            }
          } else {
            state.stepIndex = 0;
            state.revealed = new Map();
            state.phase = 'learn-title';
          }
        }
      }
      break;
    }

    case 'learn-title':
      if (type === 'click') state.phase = 'learn-sentence';
      break;

    case 'learn-sentence':
      if (type === 'click') {
        state.phase = 'learn-question';
        state.stepIndex = 0;
        state.cursor = 0;
        saveCurrent(state.passage!.id, 0);
      }
      break;

    case 'learn-question': {
      const p = state.passage!;
      const step = p.steps[state.stepIndex];
      if (!step) break;
      if (type === 'scroll') { if (selectedIndex >= 0 && selectedIndex < step.choices.length) state.cursor = selectedIndex; return; }
      if (type === 'click') {
        const idx = (selectedIndex >= 0 && selectedIndex < step.choices.length) ? selectedIndex : state.cursor;
        state.cursor = idx;
        const selected = step.choices[idx];
        if (selected === step.target) {
          if (step.reveal) state.revealed.set(step.reveal.word, step.reveal.gloss);
          state.phase = 'learn-correct';
          state.wrongChoice = null;
          awardXP(10);
          recordCorrect();
          setTimeout(() => {
            state.stepIndex++;
            state.cursor = 0;
            if (state.stepIndex >= p.steps.length) {
              state.phase = 'learn-summary';
              markCompleted(p.id);
              clearCurrent();
            } else {
              state.phase = 'learn-question';
              saveCurrent(p.id, state.stepIndex);
            }
            inputLockedUntil = Date.now() + INPUT_LOCKOUT_MS;
            void renderToGlasses();
          }, FEEDBACK_DURATION_MS);
        } else {
          state.phase = 'learn-wrong';
          state.wrongChoice = selected!;
          recordWrong();
          setTimeout(() => {
            state.phase = 'learn-question';
            inputLockedUntil = Date.now() + INPUT_LOCKOUT_MS;
            void renderToGlasses();
          }, WRONG_DURATION_MS);
        }
      }
      break;
    }

    case 'learn-correct': case 'learn-wrong': return;

    case 'learn-summary':
      if (type === 'click') {
        state.phase = 'learn-selector';
        state.passage = null;
        state.cursor = nextPassageIndex();
        state.revealed = new Map();
        state.wrongChoice = null;
      }
      break;

    // ── PRACTICE ──
    case 'practice-ready': {
      if (type === 'click') {
        const pool = buildPracticePool();
        if (pool.length === 0) { goHome(); return; }
        state.practicePool = pool;
        state.practiceIndex = 0;
        state.practiceCorrect = 0;
        state.practiceXP = 0;
        state.cursor = 0;
        state.phase = 'practice-question';
      }
      break;
    }

    case 'practice-question': {
      const item = state.practicePool[state.practiceIndex]!;
      if (type === 'scroll') { if (selectedIndex >= 0 && selectedIndex < item.step.choices.length) state.cursor = selectedIndex; return; }
      if (type === 'click') {
        const idx = (selectedIndex >= 0 && selectedIndex < item.step.choices.length) ? selectedIndex : state.cursor;
        state.cursor = idx;
        const selected = item.step.choices[idx];
        if (selected === item.step.target) {
          state.phase = 'practice-correct';
          state.practiceCorrect++;
          state.practiceXP += 10;
          awardXP(10);
          recordCorrect();
          setTimeout(() => {
            state.practiceIndex++;
            state.cursor = 0;
            if (state.practiceIndex >= state.practicePool.length) {
              state.phase = 'practice-results';
              completePracticeRound();
            } else {
              state.phase = 'practice-question';
            }
            inputLockedUntil = Date.now() + INPUT_LOCKOUT_MS;
            void renderToGlasses();
          }, FEEDBACK_DURATION_MS);
        } else {
          state.phase = 'practice-wrong';
          state.wrongChoice = selected!;
          recordWrong();
          setTimeout(() => {
            state.practiceIndex++;
            state.cursor = 0;
            if (state.practiceIndex >= state.practicePool.length) {
              state.phase = 'practice-results';
              completePracticeRound();
            } else {
              state.phase = 'practice-question';
            }
            inputLockedUntil = Date.now() + INPUT_LOCKOUT_MS;
            void renderToGlasses();
          }, WRONG_DURATION_MS);
        }
      }
      break;
    }

    case 'practice-correct': case 'practice-wrong': return;

    case 'practice-results':
      if (type === 'click') goHome();
      break;

    // ── READ ──
    case 'read-ready': {
      if (type === 'click') {
        if (!state.readPassage) { goHome(); return; }
        state.readPages = paginateText(state.readPassage.latin);
        state.readPageIndex = 0;
        state.readQuestionIndex = 0;
        state.readCorrect = 0;
        state.phase = 'read-passage';
      }
      break;
    }

    case 'read-passage':
      if (type === 'scroll') {
        // Swipe through pages
        const dir = scrollDir === 'up' ? -1 : 1;
        const newPage = state.readPageIndex + dir;
        if (newPage >= 0 && newPage < state.readPages.length) {
          state.readPageIndex = newPage;
          void renderToGlasses();
        }
        return;
      }
      if (type === 'click') state.phase = 'read-glossary';
      break;

    case 'read-glossary':
      if (type === 'click') {
        state.cursor = 0;
        state.phase = 'read-question';
      }
      // Double-tap on glossary goes back to passage (handled by the
      // universal double-tap check at the top, but we override it here
      // to go to passage instead of home)
      break;

    case 'read-question': {
      const rp = state.readPassage!;
      const q = rp.questions[state.readQuestionIndex]!;
      if (type === 'scroll') { if (selectedIndex >= 0 && selectedIndex < q.choices.length) state.cursor = selectedIndex; return; }
      if (type === 'click') {
        const idx = (selectedIndex >= 0 && selectedIndex < q.choices.length) ? selectedIndex : state.cursor;
        state.cursor = idx;
        const selected = q.choices[idx];
        if (selected === q.target) {
          state.phase = 'read-correct';
          state.readCorrect++;
          awardXP(20);
          recordCorrect();
          setTimeout(() => {
            state.readQuestionIndex++;
            state.cursor = 0;
            if (state.readQuestionIndex >= rp.questions.length) {
              state.phase = 'read-complete';
              completeReadPassage(rp.id);
            } else {
              state.phase = 'read-question';
            }
            inputLockedUntil = Date.now() + INPUT_LOCKOUT_MS;
            void renderToGlasses();
          }, FEEDBACK_DURATION_MS);
        } else {
          state.phase = 'read-wrong';
          state.wrongChoice = selected!;
          recordWrong();
          setTimeout(() => {
            state.readQuestionIndex++;
            state.cursor = 0;
            if (state.readQuestionIndex >= rp.questions.length) {
              state.phase = 'read-complete';
              completeReadPassage(rp.id);
            } else {
              state.phase = 'read-question';
            }
            inputLockedUntil = Date.now() + INPUT_LOCKOUT_MS;
            void renderToGlasses();
          }, WRONG_DURATION_MS);
        }
      }
      break;
    }

    case 'read-correct': case 'read-wrong': return;

    case 'read-complete':
      if (type === 'click') {
        // Pick another random passage
        state.phase = 'read-ready';
        state.readPassage = null;
        state.cursor = 0;
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
        ? event.listEvent.currentSelectItemIndex : -1;

      if (eventType === OsEventTypeList.CLICK_EVENT || (eventType === undefined && event.listEvent)) {
        handleAction('click', incomingIndex);
      } else if (eventType === OsEventTypeList.SCROLL_TOP_EVENT || eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
        handleAction('scroll', incomingIndex);
      } else if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        handleAction('double_tap', incomingIndex);
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

export function setStatusCallback(cb: (msg: string) => void): void { statusCallback = cb; }
export function setPreviewCallback(cb: (phase: string, lines: string[]) => void): void { previewCallback = cb; }

export function simulateAction(actionType: 'SCROLL_UP' | 'SCROLL_DOWN' | 'TAP' | 'DOUBLE_TAP'): void {
  if (actionType === 'SCROLL_UP' || actionType === 'SCROLL_DOWN') {
    const dir = actionType === 'SCROLL_UP' ? -1 : 1;
    // Adjust cursor for sim
    if (state.phase === 'learn-selector') {
      state.cursor = ((state.cursor + dir) % ALL_PASSAGES.length + ALL_PASSAGES.length) % ALL_PASSAGES.length;
    } else if (state.phase === 'home') {
      state.cursor = ((state.cursor + dir) % 3 + 3) % 3;
    } else if (state.phase.includes('question')) {
      const maxChoices = 4;
      state.cursor = ((state.cursor + dir) % maxChoices + maxChoices) % maxChoices;
    }
    handleAction('scroll', state.cursor);
  } else if (actionType === 'DOUBLE_TAP') {
    handleAction('double_tap', state.cursor);
  } else {
    handleAction('click', state.cursor);
  }
  const lines = buildDisplayLines();
  previewCallback?.(state.phase, lines);
}

export async function startApp(): Promise<void> {
  state = createInitialState();
  log('Ready');
  const lines = buildDisplayLines();
  previewCallback?.(state.phase, lines);
  await connectBridge();
}
