import { deflateSync } from "node:zlib"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/**
 * Innoventa's mark, rasterised to the one PNG iOS insists on.
 *
 * ⚠️ **iOS ignores a web manifest's `icons` entirely** and reads `<link rel="apple-touch-icon">`, which
 * must be a raster. With no such tag it puts a *screenshot of the page* on the home screen — which is
 * what an installed station looked like: a grey square with a letter in it.
 *
 * ⚠️ **Why a hand-written encoder rather than `sharp`.** The mark is a rounded plate, a stem and three
 * chevrons — geometry this file can describe exactly. Carrying an image toolchain in a frontend whose
 * only raster is this one file would be a dependency, a native build step and a lockfile entry for a
 * hundred lines of arithmetic.
 *
 * ⚠️ **The geometry is `public/favicon.svg`'s and `src/lib/mark.ts`'s, and the three must not drift.**
 * That is why this is a re-runnable script rather than a file somebody drew once: when the mark
 * changes, `node scripts/paint-apple-touch-icon.mjs` is the whole of keeping this in step.
 *
 *     node scripts/paint-apple-touch-icon.mjs
 */

/** The shipped brand blue — `public/favicon.svg`'s light value, not an invented one. */
const PLATE = [0x1e, 0x78, 0xa4]
const INK = [0xff, 0xff, 0xff]

/** ⚠️ 180 is what iOS asks for, and it is drawn edge to edge: iOS applies its own mask. */
const SIZE = 180
const SAMPLES = 4

/** The mark's own grid — everything below is in these units and scaled at the end. */
const GRID = 32
const PLATE_RADIUS = 7
const STROKE = 2.6

/** Distance from a point to a line segment — the ink is drawn as capsules around these. */
function distanceToSegment(x, y, ax, ay, bx, by) {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared))

  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy))
}

/** Inside the rounded plate? Signed-distance to a rounded rectangle, in grid units. */
function insidePlate(x, y) {
  const halfway = GRID / 2
  const offsetX = Math.abs(x - halfway) - (halfway - PLATE_RADIUS)
  const offsetY = Math.abs(y - halfway) - (halfway - PLATE_RADIUS)
  const outsideX = Math.max(offsetX, 0)
  const outsideY = Math.max(offsetY, 0)

  return Math.hypot(outsideX, outsideY) + Math.min(Math.max(offsetX, offsetY), 0) - PLATE_RADIUS <= 0
}

/**
 * The ink's opacity at a point.
 *
 * ⚠️ The three chevrons fade rather than changing colour — each is the same ink at a lower opacity, so
 * it thins with whatever the plate is instead of being a second colour anybody has to choose.
 */
function inkAt(x, y) {
  const radius = STROKE / 2
  const strokes = [
    { points: [[16, 5], [16, 16]], opacity: 1 },
    { points: [[4, 12], [16, 16], [28, 12]], opacity: 1 },
    { points: [[4, 17], [16, 21], [28, 17]], opacity: 0.8 },
    { points: [[4, 22], [16, 26], [28, 22]], opacity: 0.5 },
  ]

  let strongest = 0

  for (const stroke of strokes) {
    for (let index = 0; index < stroke.points.length - 1; index += 1) {
      const [ax, ay] = stroke.points[index]
      const [bx, by] = stroke.points[index + 1]

      if (distanceToSegment(x, y, ax, ay, bx, by) <= radius) {
        strongest = Math.max(strongest, stroke.opacity)
      }
    }
  }

  return strongest
}

function paint() {
  // ⚠️ Opaque, with no alpha at all: iOS composites a home-screen icon onto its own background and a
  // transparent one comes out as a white square with a mark floating in it.
  const pixels = Buffer.alloc(SIZE * SIZE * 3)

  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      let plateHits = 0
      let inkTotal = 0

      // Supersampled rather than analytically anti-aliased — sixteen samples is plenty at this size and
      // it keeps the geometry above readable as geometry.
      for (let sampleY = 0; sampleY < SAMPLES; sampleY += 1) {
        for (let sampleX = 0; sampleX < SAMPLES; sampleX += 1) {
          const x = ((column + (sampleX + 0.5) / SAMPLES) / SIZE) * GRID
          const y = ((row + (sampleY + 0.5) / SAMPLES) / SIZE) * GRID

          if (insidePlate(x, y)) {
            plateHits += 1
            inkTotal += inkAt(x, y)
          }
        }
      }

      const samples = SAMPLES * SAMPLES
      const plateCoverage = plateHits / samples
      const inkCoverage = inkTotal / samples
      const offset = (row * SIZE + column) * 3

      for (let channel = 0; channel < 3; channel += 1) {
        // Outside the plate the pixel is the plate colour too — the icon is drawn edge to edge and iOS
        // rounds it itself, so a transparent corner would only ever be a lighter corner.
        const plated = PLATE[channel]
        const withInk = plated * (1 - inkCoverage) + INK[channel] * inkCoverage

        pixels[offset + channel] = Math.round(plateCoverage > 0 ? withInk : plated)
      }
    }
  }

  return pixels
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }

  return value >>> 0
})

function crc32(buffer) {
  let value = 0xffffffff

  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8)
  }

  return (value ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)

  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))

  return Buffer.concat([length, body, checksum])
}

function encodePng(pixels) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(SIZE, 0)
  header.writeUInt32BE(SIZE, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // truecolour, no alpha
  header[10] = 0
  header[11] = 0
  header[12] = 0

  // Every scanline is prefixed with its filter type. Zero — "none" — because the image is tiny and a
  // filter would only make this file harder to read for no size that matters.
  const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1))

  for (let row = 0; row < SIZE; row += 1) {
    raw[row * (SIZE * 3 + 1)] = 0
    pixels.copy(raw, row * (SIZE * 3 + 1) + 1, row * SIZE * 3, (row + 1) * SIZE * 3)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const destination = fileURLToPath(new URL("../public/apple-touch-icon.png", import.meta.url))

writeFileSync(destination, encodePng(paint()))

console.log(`apple-touch-icon.png written — ${SIZE}×${SIZE}`)
