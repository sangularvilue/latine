import type { Passage } from './types';

import vulgateJn from '../passages/vulgate-jn-1-1.json';
import vulgateGn from '../passages/vulgate-gn-1-1.json';
import aeneid from '../passages/aeneid-1-1.json';

export const ALL_PASSAGES: Passage[] = [
  vulgateJn as Passage,
  vulgateGn as Passage,
  aeneid as Passage,
];

export function getPassageById(id: string): Passage | undefined {
  return ALL_PASSAGES.find(p => p.id === id);
}
