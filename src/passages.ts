import type { Passage } from './types';

// Auto-import all passage JSON files using Vite glob
const modules = import.meta.glob('../passages/**/*.json', { eager: true }) as Record<string, { default: Passage }>;

export const ALL_PASSAGES: Passage[] = [];

// Sort by filename for stable ordering
const keys = Object.keys(modules).sort();
for (const key of keys) {
  const mod = modules[key];
  if (mod && typeof mod === 'object') {
    // Vite glob with eager returns the JSON directly (not under .default)
    const passage = (mod as any).default ?? mod;
    if (passage && passage.id && passage.steps) {
      ALL_PASSAGES.push(passage as Passage);
    }
  }
}

export function getPassageById(id: string): Passage | undefined {
  return ALL_PASSAGES.find(p => p.id === id);
}
