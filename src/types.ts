/** A single step in the parsing drill. */
export interface Step {
  /** Question prompt displayed to the user. */
  prompt: string;
  /** The correct answer string (must match one of choices). */
  target: string;
  /** Four answer choices. */
  choices: [string, string, string, string];
  /** If non-null, reveals this word's gloss in the running translation. */
  reveal: { word: string; gloss: string } | null;
}

/** A complete passage for one day's drill. */
export interface Passage {
  id: string;
  source: string;
  reference: string;
  /** The Latin sentence as an array of words. */
  latin: string[];
  /** Ordered list of drill steps. */
  steps: Step[];
  /** Full English translation. */
  translation: string;
}

/** App phase. */
export type Phase = 'title' | 'sentence' | 'question' | 'correct' | 'wrong' | 'summary';

/** App state. */
export interface AppState {
  phase: Phase;
  passage: Passage;
  /** Index into passage.steps. */
  stepIndex: number;
  /** Currently highlighted choice (0-3). */
  cursor: number;
  /** Words whose gloss has been revealed so far (word -> gloss). */
  revealed: Map<string, string>;
  /** Timer for feedback phases (auto-advance). */
  feedbackTimer: number;
}

/** Input actions from glasses or keyboard. */
export type Action =
  | { type: 'SCROLL'; direction: 'up' | 'down' }
  | { type: 'TAP'; selectedIndex: number; selectedName: string }
  | { type: 'DOUBLE_TAP' }
  | { type: 'FOREGROUND_ENTER' }
  | { type: 'FOREGROUND_EXIT' };
