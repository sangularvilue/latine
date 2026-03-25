/**
 * Convert a region of a 1-bit pixel buffer to PNG ArrayBuffer
 * using an off-screen canvas, matching how LotH sends tiles.
 */

const canvasCache = new Map<string, { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>();

function getCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const key = `${w}x${h}`;
  let entry = canvasCache.get(key);
  if (!entry) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    entry = { canvas, ctx };
    canvasCache.set(key, entry);
  }
  return entry;
}

/**
 * Encode a region of the pixel buffer as a PNG ArrayBuffer.
 */
export async function encodePng(
  buf: Uint8Array,
  bufW: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<ArrayBuffer> {
  const { canvas, ctx } = getCanvas(w, h);
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const srcIdx = (y + row) * bufW + (x + col);
      const dstIdx = (row * w + col) * 4;
      const val = buf[srcIdx] ? 255 : 0;
      data[dstIdx] = val;
      data[dstIdx + 1] = val;
      data[dstIdx + 2] = val;
      data[dstIdx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('toBlob failed'));
        blob.arrayBuffer().then(resolve, reject);
      },
      'image/png',
    );
  });
}
