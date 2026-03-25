/**
 * Shared constants for Latine.
 * 400x200 display using 3 image tiles + 1 event capture list container.
 */

// G2 display
export const DISPLAY_WIDTH = 576;
export const DISPLAY_HEIGHT = 288;

// Image containers (max 200x100 per Even SDK)
export const IMAGE_WIDTH = 200;
export const IMAGE_HEIGHT = 100;

// 2x2 grid layout
export const TILE_COLS = 2;
export const TILE_ROWS = 2;

// Virtual canvas (400x200)
export const BUF_W = IMAGE_WIDTH * TILE_COLS; // 400
export const BUF_H = IMAGE_HEIGHT * TILE_ROWS; // 200

// Position of the 400x200 area centered on 576x288 display
export const BOARD_DISPLAY_X = Math.floor((DISPLAY_WIDTH - BUF_W) / 2); // 88
export const BOARD_DISPLAY_Y = Math.floor((DISPLAY_HEIGHT - BUF_H) / 2); // 44

// Container IDs
export const CONTAINER_ID_TL = 1;
export const CONTAINER_ID_TR = 2;
export const CONTAINER_ID_BL = 3;
export const CONTAINER_ID_BR = 4;

export const CONTAINER_NAME_TL = 'lat-tl';
export const CONTAINER_NAME_TR = 'lat-tr';
export const CONTAINER_NAME_BL = 'lat-bl';
export const CONTAINER_NAME_BR = 'lat-br';

// Timing
export const TICK_MS = 1000 / 60;
export const SEND_INTERVAL_MS = 50; // 20fps to glasses

// Layout
export const MARGIN = 4;
export const LINE_HEIGHT = 10; // FONT_H(7) + 3px gap
