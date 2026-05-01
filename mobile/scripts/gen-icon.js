// Generates a 1024x1024 CHiiRAG Stock Journal app icon using pngjs
const { PNG } = require('pngjs')
const fs = require('fs')
const path = require('path')

const SIZE = 1024
const png = new PNG({ width: SIZE, height: SIZE, filterType: -1 })

// Color palette
const BG       = [15, 23, 42, 255]    // Deep navy #0f172a
const SAFFRON  = [255, 153, 51, 255]  // #FF9933
const WHITE    = [255, 255, 255, 255]
const INDIA_G  = [19, 136, 8, 255]    // #138808
const ACCENT   = [14, 165, 233, 255]  // Sky blue #0ea5e9
const ACCENT_D = [2, 132, 199, 255]   // Darker accent
const GOLD     = [245, 158, 11, 255]  // #f59e0b

function setPixel(x, y, r, g, b, a) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  const idx = (y * SIZE + x) * 4
  png.data[idx]     = r
  png.data[idx + 1] = g
  png.data[idx + 2] = b
  png.data[idx + 3] = a
}

function fillRect(x1, y1, x2, y2, [r, g, b, a]) {
  for (let y = y1; y < y2; y++)
    for (let x = x1; x < x2; x++)
      setPixel(x, y, r, g, b, a)
}

function circle(cx, cy, radius, [r, g, b, a]) {
  for (let y = cy - radius; y <= cy + radius; y++)
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist <= radius) setPixel(x, y, r, g, b, a)
    }
}

function circleRing(cx, cy, innerR, outerR, [r, g, b, a]) {
  for (let y = cy - outerR; y <= cy + outerR; y++)
    for (let x = cx - outerR; x <= cx + outerR; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist <= outerR && dist >= innerR) setPixel(x, y, r, g, b, a)
    }
}

// ── Background ──
fillRect(0, 0, SIZE, SIZE, BG)

// ── Rounded corner mask (simulate rounded rectangle) ──
const CORNER = 160
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const inCornerTL = x < CORNER && y < CORNER
    const inCornerTR = x >= SIZE - CORNER && y < CORNER
    const inCornerBL = x < CORNER && y >= SIZE - CORNER
    const inCornerBR = x >= SIZE - CORNER && y >= SIZE - CORNER

    let masked = false
    if (inCornerTL) {
      const dist = Math.sqrt((x - CORNER) ** 2 + (y - CORNER) ** 2)
      masked = dist > CORNER
    } else if (inCornerTR) {
      const dist = Math.sqrt((x - (SIZE - CORNER)) ** 2 + (y - CORNER) ** 2)
      masked = dist > CORNER
    } else if (inCornerBL) {
      const dist = Math.sqrt((x - CORNER) ** 2 + (y - (SIZE - CORNER)) ** 2)
      masked = dist > CORNER
    } else if (inCornerBR) {
      const dist = Math.sqrt((x - (SIZE - CORNER)) ** 2 + (y - (SIZE - CORNER)) ** 2)
      masked = dist > CORNER
    }
    if (masked) setPixel(x, y, 0, 0, 0, 0)
  }
}

// ── Tricolor vertical stripe on left ──
const STRIPE_W = 60
const STRIPE_H = SIZE - 200
const STRIPE_X = 80
const STRIPE_Y = 100
fillRect(STRIPE_X, STRIPE_Y, STRIPE_X + STRIPE_W, STRIPE_Y + Math.floor(STRIPE_H / 3), SAFFRON)
fillRect(STRIPE_X, STRIPE_Y + Math.floor(STRIPE_H / 3), STRIPE_X + STRIPE_W, STRIPE_Y + Math.floor(2 * STRIPE_H / 3), WHITE)
fillRect(STRIPE_X, STRIPE_Y + Math.floor(2 * STRIPE_H / 3), STRIPE_X + STRIPE_W, STRIPE_Y + STRIPE_H, INDIA_G)

// ── Tricolor horizontal bar at bottom ──
const BAR_H = 32
const BAR_Y = SIZE - 130
fillRect(80, BAR_Y, SIZE - 80, BAR_Y + Math.floor(BAR_H / 3), SAFFRON)
fillRect(80, BAR_Y + Math.floor(BAR_H / 3), SIZE - 80, BAR_Y + Math.floor(2 * BAR_H / 3), WHITE)
fillRect(80, BAR_Y + Math.floor(2 * BAR_H / 3), SIZE - 80, BAR_Y + BAR_H, INDIA_G)

// ── Accent glow circle behind "C" ──
const CX = 560, CY = 490
circle(CX, CY, 300, [14, 165, 233, 20])
circle(CX, CY, 240, [14, 165, 233, 30])
circleRing(CX, CY, 215, 240, ACCENT)

// ── Large "C" letter using arc segments ──
// Draw the C as a thick ring with a gap on the right
const LETTER_R = 180
const LETTER_W = 52
for (let y = CY - LETTER_R - LETTER_W; y <= CY + LETTER_R + LETTER_W; y++) {
  for (let x = CX - LETTER_R - LETTER_W; x <= CX + LETTER_R + LETTER_W; x++) {
    const dx = x - CX
    const dy = y - CY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist >= LETTER_R - LETTER_W/2 && dist <= LETTER_R + LETTER_W/2) {
      // Exclude the right gap (roughly 60 degrees each side = 120 degree opening)
      const angle = Math.atan2(dy, dx) * (180 / Math.PI)
      // Gap: -50 to +50 degrees (right side)
      if (angle > -55 && angle < 55) continue
      // Top serif
      if (dist >= LETTER_R - LETTER_W/2 - 20 && dist <= LETTER_R + LETTER_W/2 + 20 && (angle > 155 || angle < -155)) {
        // widened ends
      }
      setPixel(x, y, ...WHITE)
    }
  }
}

// End caps of the C (horizontal strokes)
fillRect(CX + 60, CY - LETTER_R - LETTER_W/2, CX + 160, CY - LETTER_R + LETTER_W/2, WHITE)
fillRect(CX + 60, CY + LETTER_R - LETTER_W/2, CX + 160, CY + LETTER_R + LETTER_W/2, WHITE)

// ── "STOCK" small text (using dot matrix style rectangles) ──
const dotText = (startX, startY, scale, color) => {
  // S
  const glyphs = {
    S: [[1,1,1,1],[1,0,0,0],[1,1,1,1],[0,0,0,1],[1,1,1,1]],
    T: [[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
    O: [[0,1,1,0],[1,0,0,1],[1,0,0,1],[1,0,0,1],[0,1,1,0]],
    C: [[0,1,1,1],[1,0,0,0],[1,0,0,0],[1,0,0,0],[0,1,1,1]],
    K: [[1,0,0,1],[1,0,1,0],[1,1,0,0],[1,0,1,0],[1,0,0,1]],
  }
  const word = 'STOCK'
  let xOff = 0
  for (const ch of word) {
    const g = glyphs[ch]
    if (!g) { xOff += 6 * scale; continue }
    for (let row = 0; row < g.length; row++)
      for (let col = 0; col < g[row].length; col++)
        if (g[row][col]) fillRect(startX + xOff + col * scale, startY + row * scale, startX + xOff + (col + 1) * scale, startY + (row + 1) * scale, color)
    xOff += (g[0].length + 1) * scale
  }
}

dotText(420, 730, 10, ACCENT)

// ── "JOURNAL" even smaller ──
const j2Text = (startX, startY, scale, color) => {
  const glyphs = {
    J: [[0,0,1],[0,0,1],[0,0,1],[1,0,1],[0,1,1]],
    O: [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
    U: [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
    R: [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,0,1]],
    N: [[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1]],
    A: [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    L: [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
  }
  const word = 'JOURNAL'
  let xOff = 0
  for (const ch of word) {
    const g = glyphs[ch]
    if (!g) { xOff += 5 * scale; continue }
    for (let row = 0; row < g.length; row++)
      for (let col = 0; col < g[row].length; col++)
        if (g[row][col]) fillRect(startX + xOff + col * scale, startY + row * scale, startX + xOff + (col+1)*scale, startY + (row+1)*scale, color)
    xOff += (g[0].length + 1) * scale
  }
}

j2Text(370, 840, 8, [14, 165, 233, 180])

// ── Gold accent dots ──
circle(CX + 175, CY - 175, 18, GOLD)
circle(CX + 175, CY + 175, 18, GOLD)

// ── Write PNG ──
const outDir = path.join(__dirname, '..', 'assets')
const buffer = PNG.sync.write(png)
fs.writeFileSync(path.join(outDir, 'icon.png'), buffer)
fs.writeFileSync(path.join(outDir, 'adaptive-icon.png'), buffer)
console.log('Icon generated: assets/icon.png and assets/adaptive-icon.png')
