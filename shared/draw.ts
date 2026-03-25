/**
 * Pixel buffer drawing primitives for 1-bit monochrome rendering.
 */

export function setPixel(
  buf: Uint8Array, bufW: number, x: number, y: number, val: number,
): void {
  if (x >= 0 && x < bufW && y >= 0) {
    const idx = y * bufW + x;
    if (idx < buf.length) buf[idx] = val;
  }
}

export function fillRect(
  buf: Uint8Array, bufW: number, x: number, y: number, w: number, h: number, val: number = 1,
): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      setPixel(buf, bufW, x + i, y + j, val);
    }
  }
}

export function hLine(
  buf: Uint8Array, bufW: number, x: number, y: number, len: number, val: number = 1,
): void {
  for (let i = 0; i < len; i++) {
    setPixel(buf, bufW, x + i, y, val);
  }
}

/** Invert all pixels in a rectangle (for selection highlight). */
export function invertRect(
  buf: Uint8Array, bufW: number, x: number, y: number, w: number, h: number,
): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const px = x + i;
      const py = y + j;
      if (px >= 0 && px < bufW && py >= 0) {
        const idx = py * bufW + px;
        if (idx < buf.length) buf[idx] = buf[idx] ? 0 : 1;
      }
    }
  }
}
