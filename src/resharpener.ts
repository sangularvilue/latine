/**
 * Skill resharpener — picks a Latin passage at the user's reading level
 * and presents it as a paragraph to read, with translation reveal.
 */

import { ALL_PASSAGES } from './passages';
import { loadProgress } from './progress';
import type { Passage } from './types';

/** Determine user's tier based on how many passages they've completed. */
export function getUserTier(): { tier: string; level: number } {
  const { completed } = loadProgress();
  const n = completed.length;
  if (n < 10) return { tier: 'Beginner', level: 0 };
  if (n < 40) return { tier: 'Elementary', level: 1 };
  if (n < 100) return { tier: 'Intermediate', level: 2 };
  if (n < 200) return { tier: 'Advanced', level: 3 };
  return { tier: 'Mastery', level: 4 };
}

/** Get a few passages at or near the user's level for reading practice. */
export function getResharpenerPassages(): Passage[] {
  const { completed } = loadProgress();
  const { level } = getUserTier();

  // Group passages by directory tier
  const tiers: Passage[][] = [[], [], [], [], []];
  for (const p of ALL_PASSAGES) {
    // Determine tier from position in the sorted list
    const idx = ALL_PASSAGES.indexOf(p);
    const frac = idx / ALL_PASSAGES.length;
    if (frac < 0.15) tiers[0]!.push(p);
    else if (frac < 0.40) tiers[1]!.push(p);
    else if (frac < 0.65) tiers[2]!.push(p);
    else if (frac < 0.85) tiers[3]!.push(p);
    else tiers[4]!.push(p);
  }

  // Pick from the user's tier and one below
  const pool: Passage[] = [];
  if (level > 0) pool.push(...(tiers[level - 1] ?? []));
  pool.push(...(tiers[level] ?? []));

  // Prefer uncompleted passages, but include completed ones too
  const uncompleted = pool.filter(p => !completed.includes(p.id));
  const source = uncompleted.length >= 3 ? uncompleted : pool;

  // Shuffle and pick 3
  const shuffled = [...source].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

/** Build a reading paragraph from a passage — Latin text with no hints. */
export function buildReadingBlock(passage: Passage): { latin: string; translation: string; source: string } {
  return {
    latin: passage.latin.join(' '),
    translation: passage.translation,
    source: `${passage.source} — ${passage.reference}`,
  };
}
