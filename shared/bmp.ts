/**
 * 1-bit monochrome BMP encoding for Even G2 glasses display.
 */

const BMP_SIGNATURE = [0x42, 0x4d] as const;
const BMP_FILE_HEADER_SIZE = 14;
const BMP_DIB_HEADER_SIZE = 40;
const BMP_COLOR_TABLE_SIZE = 8;
const BMP_HEADER_SIZE = BMP_FILE_HEADER_SIZE + BMP_DIB_HEADER_SIZE + BMP_COLOR_TABLE_SIZE;
const BMP_PPM = 2835;
const BMP_COLORS_USED = 2;

function getBmpRowStride(width: number): number {
  const rowBytes = Math.ceil(width / 8);
  return Math.ceil(rowBytes / 4) * 4;
}

function getBmpPixelDataSize(width: number, height: number): number {
  return getBmpRowStride(width) * height;
}

function getBmpFileSize(width: number, height: number): number {
  return BMP_HEADER_SIZE + getBmpPixelDataSize(width, height);
}

export function encodeBmp(
  buf: Uint8Array,
  bufW: number,
  x: number,
  y: number,
  w: number,
  h: number,
): Uint8Array {
  const fileSize = getBmpFileSize(w, h);
  const pixelDataSize = getBmpPixelDataSize(w, h);
  const rowStride = getBmpRowStride(w);
  const bmp = new Uint8Array(fileSize);
  const view = new DataView(bmp.buffer);

  bmp[0] = BMP_SIGNATURE[0];
  bmp[1] = BMP_SIGNATURE[1];
  view.setUint32(2, fileSize, true);
  view.setUint32(10, BMP_HEADER_SIZE, true);

  view.setUint32(14, BMP_DIB_HEADER_SIZE, true);
  view.setInt32(18, w, true);
  view.setInt32(22, -h, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 1, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, pixelDataSize, true);
  view.setInt32(38, BMP_PPM, true);
  view.setInt32(42, BMP_PPM, true);
  view.setUint32(46, BMP_COLORS_USED, true);
  view.setUint32(50, BMP_COLORS_USED, true);

  bmp[54] = 0; bmp[55] = 0; bmp[56] = 0; bmp[57] = 0;
  bmp[58] = 0xff; bmp[59] = 0xff; bmp[60] = 0xff; bmp[61] = 0;

  let offset = BMP_HEADER_SIZE;
  for (let row = 0; row < h; row++) {
    const srcY = y + row;
    for (let byteIdx = 0; byteIdx < rowStride; byteIdx++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const col = byteIdx * 8 + bit;
        if (col < w) {
          const srcX = x + col;
          if (buf[srcY * bufW + srcX]) {
            byte |= (0x80 >> bit);
          }
        }
      }
      bmp[offset + byteIdx] = byte;
    }
    offset += rowStride;
  }

  return bmp;
}
