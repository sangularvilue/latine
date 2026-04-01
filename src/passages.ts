import type { Passage } from './types';
import type { ReadingPassage } from './gamification-types';

// Auto-import all drill passage JSON files
const drillModules = import.meta.glob('../passages/{01-foundations,02-elementary,03-intermediate,04-advanced,05-mastery}/**/*.json', { eager: true }) as Record<string, any>;

export const ALL_PASSAGES: Passage[] = [];

const drillKeys = Object.keys(drillModules).sort();
for (const key of drillKeys) {
  const mod = drillModules[key];
  if (mod && typeof mod === 'object') {
    const passage = mod.default ?? mod;
    if (passage && passage.id && passage.steps) {
      ALL_PASSAGES.push(passage as Passage);
    }
  }
}

// Auto-import reading passage JSON files
const readingModules = import.meta.glob('../passages/reading/**/*.json', { eager: true }) as Record<string, any>;

export const ALL_READING_PASSAGES: ReadingPassage[] = [];

const readingKeys = Object.keys(readingModules).sort();
for (const key of readingKeys) {
  const mod = readingModules[key];
  if (mod && typeof mod === 'object') {
    const passage = mod.default ?? mod;
    if (passage && passage.id && passage.questions) {
      ALL_READING_PASSAGES.push(passage as ReadingPassage);
    }
  }
}

export function getPassageById(id: string): Passage | undefined {
  return ALL_PASSAGES.find(p => p.id === id);
}

export function getReadingPassageById(id: string): ReadingPassage | undefined {
  return ALL_READING_PASSAGES.find(p => p.id === id);
}
