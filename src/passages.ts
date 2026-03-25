import type { Passage } from './types';

import vulgateJn1_1 from '../passages/vulgate-jn-1-1.json';
import vulgateGn1_1 from '../passages/vulgate-gn-1-1.json';
import aeneid1_1 from '../passages/aeneid-1-1.json';
import vulgatePs23_1 from '../passages/vulgate-ps-23-1.json';
import vulgatePs42_1 from '../passages/vulgate-ps-42-1.json';
import aeneid1_33 from '../passages/aeneid-1-33.json';
import vulgateMt5_3 from '../passages/vulgate-mt-5-3.json';
import missalGloria from '../passages/missal-gloria.json';
import caesarBg1_1 from '../passages/caesar-bg-1-1.json';
import ciceroCat1_1 from '../passages/cicero-cat-1-1.json';
import vulgateJn8_32 from '../passages/vulgate-jn-8-32.json';
import horaceOdes3_30 from '../passages/horace-odes-3-30.json';
import vulgatePs51_10 from '../passages/vulgate-ps-51-10.json';
import aeneid4_569 from '../passages/aeneid-4-569.json';
import vulgateRom8_28 from '../passages/vulgate-rom-8-28.json';
import missalSanctus from '../passages/missal-sanctus.json';
import ovidMet1_1 from '../passages/ovid-met-1-1.json';
import vulgateEccl1_2 from '../passages/vulgate-eccl-1-2.json';
import catullus85 from '../passages/catullus-85.json';
import vulgatePs119_105 from '../passages/vulgate-ps-119-105.json';
import aeneid2_49 from '../passages/aeneid-2-49.json';
import vulgateJn1_14 from '../passages/vulgate-jn-1-14.json';
import caesarBg4_25 from '../passages/caesar-bg-4-25.json';
import vulgatePrv1_7 from '../passages/vulgate-prv-1-7.json';
import horaceArs343 from '../passages/horace-ars-343.json';
import vulgateMt6_9 from '../passages/vulgate-mt-6-9.json';
import aeneid6_126 from '../passages/aeneid-6-126.json';
import ciceroAmic23 from '../passages/cicero-amic-23.json';
import vulgateIs9_6 from '../passages/vulgate-is-9-6.json';
import missalAgnusDei from '../passages/missal-agnus-dei.json';
import ovidArs1_1 from '../passages/ovid-ars-1-1.json';
import vulgatePs27_1 from '../passages/vulgate-ps-27-1.json';
import caesarBg1_3 from '../passages/caesar-bg-1-3.json';
import vulgateJn3_16 from '../passages/vulgate-jn-3-16.json';
import catullus5 from '../passages/catullus-5.json';
import vulgatePs46_10 from '../passages/vulgate-ps-46-10.json';
import aeneid1_203 from '../passages/aeneid-1-203.json';
import vulgateLk1_28 from '../passages/vulgate-lk-1-28.json';
import ciceroArch7 from '../passages/cicero-arch-7.json';
import vulgateRom1_17 from '../passages/vulgate-rom-1-17.json';
import horaceSat1_1 from '../passages/horace-sat-1-1.json';
import vulgatePs130_1 from '../passages/vulgate-ps-130-1.json';
import aeneid3_57 from '../passages/aeneid-3-57.json';

export const ALL_PASSAGES: Passage[] = [
  // Beginner — short, familiar sentences
  vulgateJn1_1 as Passage,
  vulgateGn1_1 as Passage,
  vulgatePs23_1 as Passage,
  vulgatePs42_1 as Passage,
  missalGloria as Passage,
  missalSanctus as Passage,
  catullus85 as Passage,
  vulgateIs9_6 as Passage,
  vulgatePs27_1 as Passage,
  aeneid3_57 as Passage,

  // Intermediate — slightly longer, more grammar
  vulgateMt5_3 as Passage,
  vulgateJn8_32 as Passage,
  vulgatePs51_10 as Passage,
  vulgateEccl1_2 as Passage,
  vulgateJn1_14 as Passage,
  vulgateRom1_17 as Passage,
  vulgatePs130_1 as Passage,
  vulgatePrv1_7 as Passage,
  vulgateJn3_16 as Passage,
  vulgateLk1_28 as Passage,
  missalAgnusDei as Passage,
  catullus5 as Passage,
  aeneid1_33 as Passage,
  aeneid6_126 as Passage,

  // Advanced — longer sentences, classical authors
  aeneid1_1 as Passage,
  aeneid2_49 as Passage,
  aeneid4_569 as Passage,
  aeneid1_203 as Passage,
  caesarBg1_1 as Passage,
  caesarBg4_25 as Passage,
  caesarBg1_3 as Passage,
  ciceroCat1_1 as Passage,
  ciceroAmic23 as Passage,
  ciceroArch7 as Passage,
  horaceOdes3_30 as Passage,
  horaceSat1_1 as Passage,
  horaceArs343 as Passage,
  ovidMet1_1 as Passage,
  ovidArs1_1 as Passage,
  vulgateRom8_28 as Passage,
  vulgateMt6_9 as Passage,
  vulgatePs119_105 as Passage,
  vulgatePs46_10 as Passage,
];

export function getPassageById(id: string): Passage | undefined {
  return ALL_PASSAGES.find(p => p.id === id);
}
