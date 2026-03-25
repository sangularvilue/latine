import type { Passage } from './types';

import vulgateJn from '../passages/vulgate-jn-1-1.json';
import vulgateGn from '../passages/vulgate-gn-1-1.json';
import aeneid from '../passages/aeneid-1-1.json';

const ALL_PASSAGES: Passage[] = [
  vulgateJn as Passage,
  vulgateGn as Passage,
  aeneid as Passage,
];

/** Pick today's passage based on day of year. */
export function getTodaysPassage(): Passage {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return ALL_PASSAGES[dayOfYear % ALL_PASSAGES.length]!;
}

export function getPassageCount(): number {
  return ALL_PASSAGES.length;
}
