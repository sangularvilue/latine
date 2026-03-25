/**
 * Progress persistence via localStorage.
 */

const STORAGE_KEY = 'latine-progress';

export interface Progress {
  /** IDs of completed passages. */
  completed: string[];
  /** In-progress state: passage ID + step index. */
  current: { passageId: string; stepIndex: number } | null;
}

function defaultProgress(): Progress {
  return { completed: [], current: null };
}

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    return {
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      current: parsed.current ?? null,
    };
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: Progress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // localStorage unavailable or full — silently fail
  }
}

export function markCompleted(passageId: string): void {
  const progress = loadProgress();
  if (!progress.completed.includes(passageId)) {
    progress.completed.push(passageId);
  }
  if (progress.current?.passageId === passageId) {
    progress.current = null;
  }
  saveProgress(progress);
}

export function saveCurrent(passageId: string, stepIndex: number): void {
  const progress = loadProgress();
  progress.current = { passageId, stepIndex };
  saveProgress(progress);
}

export function clearCurrent(): void {
  const progress = loadProgress();
  progress.current = null;
  saveProgress(progress);
}

export function isCompleted(passageId: string): boolean {
  return loadProgress().completed.includes(passageId);
}
