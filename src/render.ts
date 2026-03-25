/**
 * Renderer — draws each phase to the 400x200 pixel buffer.
 */

import type { AppState } from './types';
import { BUF_W, BUF_H, MARGIN, LINE_HEIGHT } from '@shared/constants';
import { drawText, drawTextCentered, measureText, FONT_H, FONT_W, FONT } from '@shared/font';
import { fillRect, hLine } from '@shared/draw';

const pixels = new Uint8Array(BUF_W * BUF_H);

export function getPixels(): Uint8Array {
  return pixels;
}

export function render(state: AppState): void {
  pixels.fill(0);

  switch (state.phase) {
    case 'title':
      renderTitle(state);
      break;
    case 'sentence':
      renderSentence(state);
      break;
    case 'question':
      renderQuestionScreen(state);
      break;
    case 'correct':
      renderCorrect(state);
      break;
    case 'wrong':
      renderWrong(state);
      break;
    case 'summary':
      renderSummary(state);
      break;
  }
}

function renderTitle(state: AppState): void {
  drawTextCentered(pixels, BUF_W, 30, 'LATINE');
  hLine(pixels, BUF_W, MARGIN, 42, BUF_W - MARGIN * 2);

  drawTextCentered(pixels, BUF_W, 60, state.passage.source);
  drawTextCentered(pixels, BUF_W, 75, state.passage.reference);

  drawTextCentered(pixels, BUF_W, 120, 'TAP TO BEGIN');
}

function renderSentence(state: AppState): void {
  renderLatinLine(state, MARGIN, MARGIN);

  const stepCount = `${state.passage.steps.length} questions`;
  drawTextCentered(pixels, BUF_W, BUF_H - MARGIN - FONT_H - LINE_HEIGHT, stepCount);
  drawTextCentered(pixels, BUF_W, BUF_H - MARGIN - FONT_H, 'TAP TO START');
}

function renderQuestionScreen(state: AppState): void {
  // Latin text at top with revealed words highlighted
  const latinY = MARGIN;
  renderLatinWithRevealed(state, MARGIN, latinY);

  // Divider
  const divY = latinY + LINE_HEIGHT * 2 + 2;
  hLine(pixels, BUF_W, MARGIN, divY, BUF_W - MARGIN * 2);

  // Progress
  const step = state.stepIndex + 1;
  const total = state.passage.steps.length;
  const progressStr = `${step}/${total}`;
  const progressW = measureText(progressStr);
  drawText(pixels, BUF_W, BUF_W - MARGIN - progressW, divY + 4, progressStr);

  // Question prompt
  const promptY = divY + 4;
  const currentStep = state.passage.steps[state.stepIndex]!;
  drawText(pixels, BUF_W, MARGIN, promptY, currentStep.prompt);

  // Four choices
  const choicesStartY = promptY + LINE_HEIGHT + 6;
  const choiceH = LINE_HEIGHT + 2;

  for (let i = 0; i < 4; i++) {
    const choice = currentStep.choices[i]!;
    const cy = choicesStartY + i * choiceH;
    const label = `${choice}`;

    if (i === state.cursor) {
      // Highlighted: white rectangle, black text
      fillRect(pixels, BUF_W, MARGIN, cy - 1, BUF_W - MARGIN * 2, FONT_H + 2);
      // Draw text inverted (black on white)
      const tx = MARGIN + 4;
      drawTextBlack(pixels, BUF_W, tx, cy, '> ' + label);
    } else {
      drawText(pixels, BUF_W, MARGIN + 4, cy, '  ' + label);
    }
  }
}

function renderCorrect(state: AppState): void {
  renderLatinWithRevealed(state, MARGIN, MARGIN);

  const divY = MARGIN + LINE_HEIGHT * 2 + 2;
  hLine(pixels, BUF_W, MARGIN, divY, BUF_W - MARGIN * 2);

  drawTextCentered(pixels, BUF_W, divY + 8, 'CORRECT!');

  const currentStep = state.passage.steps[state.stepIndex]!;
  if (currentStep.reveal) {
    const revealStr = `${currentStep.reveal.word} = "${currentStep.reveal.gloss}"`;
    drawTextCentered(pixels, BUF_W, divY + 8 + LINE_HEIGHT + 4, revealStr);
  }

  // Show building translation
  renderTranslationProgress(state, divY + 8 + LINE_HEIGHT * 2 + 8);
}

function renderWrong(state: AppState): void {
  renderLatinWithRevealed(state, MARGIN, MARGIN);

  const divY = MARGIN + LINE_HEIGHT * 2 + 2;
  hLine(pixels, BUF_W, MARGIN, divY, BUF_W - MARGIN * 2);

  drawTextCentered(pixels, BUF_W, divY + 20, 'TRY AGAIN');
}

function renderSummary(state: AppState): void {
  renderLatinLine(state, MARGIN, MARGIN);

  const divY = MARGIN + LINE_HEIGHT * 2;
  hLine(pixels, BUF_W, MARGIN, divY, BUF_W - MARGIN * 2);

  // Full translation, word-wrapped
  const transY = divY + 6;
  drawWrapped(pixels, BUF_W, MARGIN, transY, state.passage.translation, BUF_W - MARGIN * 2);

  drawTextCentered(pixels, BUF_W, BUF_H - MARGIN - FONT_H, 'COMPLETE!');
}

// ── Helpers ──

/** Draw the full Latin sentence, word-wrapped. */
function renderLatinLine(state: AppState, x: number, y: number): void {
  const text = state.passage.latin.join(' ');
  drawWrapped(pixels, BUF_W, x, y, text, BUF_W - MARGIN * 2);
}

/** Draw the Latin sentence with revealed words underlined. */
function renderLatinWithRevealed(state: AppState, x: number, y: number): void {
  let cx = x;
  let cy = y;
  const maxW = BUF_W - MARGIN * 2;

  for (let i = 0; i < state.passage.latin.length; i++) {
    const word = state.passage.latin[i]!;
    const wordW = measureText(word);
    const spaceW = FONT_W + 1;

    // Wrap if needed
    if (cx + wordW > x + maxW && cx > x) {
      cx = x;
      cy += LINE_HEIGHT;
    }

    drawText(pixels, BUF_W, cx, cy, word);

    // Underline revealed words
    if (state.revealed.has(word)) {
      hLine(pixels, BUF_W, cx, cy + FONT_H + 1, wordW);
    }

    cx += wordW + spaceW;
  }
}

/** Show partial translation built so far. */
function renderTranslationProgress(state: AppState, y: number): void {
  const parts: string[] = [];
  for (const word of state.passage.latin) {
    if (state.revealed.has(word)) {
      parts.push(state.revealed.get(word)!);
    }
  }
  if (parts.length > 0) {
    const text = parts.join(' ');
    drawWrapped(pixels, BUF_W, MARGIN, y, text, BUF_W - MARGIN * 2);
  }
}

/** Word-wrap text within maxW pixels. */
function drawWrapped(
  buf: Uint8Array, bufW: number, x: number, y: number, text: string, maxW: number,
): void {
  const words = text.split(' ');
  let cx = x;
  let cy = y;
  const spaceW = FONT_W + 1;

  for (const word of words) {
    const wordW = measureText(word);
    if (cx + wordW > x + maxW && cx > x) {
      cx = x;
      cy += LINE_HEIGHT;
    }
    drawText(buf, bufW, cx, cy, word);
    cx += wordW + spaceW;
  }
}

/** Draw text as black on white (for inverted selection). */
function drawTextBlack(
  buf: Uint8Array, bufW: number, x: number, y: number, text: string,
): void {
  let cx = x;
  for (const ch of text) {
    drawCharBlack(buf, bufW, cx, y, ch);
    cx += FONT_W + 1;
  }
}

function drawCharBlack(
  buf: Uint8Array, bufW: number, x: number, y: number, ch: string,
): void {
  const glyph = FONT[ch] ?? FONT[ch.toUpperCase()];
  if (!glyph) return;
  for (let row = 0; row < FONT_H; row++) {
    const bits = (glyph as number[])[row]!;
    for (let col = 0; col < FONT_W; col++) {
      const px = x + col;
      const py = y + row;
      if (px >= 0 && px < bufW && py >= 0) {
        const idx = py * bufW + px;
        if (idx < buf.length) {
          // Black text on white background: glyph pixels become 0
          if (bits & (1 << (FONT_W - 1 - col))) {
            buf[idx] = 0;
          }
        }
      }
    }
  }
}
