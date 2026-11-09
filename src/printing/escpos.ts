/**
 * Minimal ESC/POS command builder.
 *
 * Text is never sent as characters. Cheap thermal printers have no Sinhala or
 * Tamil fonts, so the whole receipt is drawn as an image (see receipt.ts) and
 * sent as a raster bitmap, which works on almost any 58mm/80mm printer.
 */

const ESC = 0x1b
const GS = 0x1d

/** A 1-bit image: `width` must be a multiple of 8; `bits[y * width + x]` is 1 for black. */
export interface MonoBitmap {
  width: number
  height: number
  bits: Uint8Array
}

/** Packs 1-bit pixels into bytes, MSB = leftmost pixel, as ESC/POS expects. */
export function packRows(img: MonoBitmap, fromRow: number, rowCount: number): Uint8Array {
  if (img.width % 8 !== 0) throw new Error('Bitmap width must be a multiple of 8')
  const bytesPerRow = img.width / 8
  const out = new Uint8Array(bytesPerRow * rowCount)
  for (let y = 0; y < rowCount; y++) {
    const srcRow = (fromRow + y) * img.width
    for (let bx = 0; bx < bytesPerRow; bx++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        if (img.bits[srcRow + bx * 8 + bit]) byte |= 0x80 >> bit
      }
      out[y * bytesPerRow + bx] = byte
    }
  }
  return out
}

export class EscPosBuilder {
  private parts: number[] = []

  /** ESC @ — reset the printer to its defaults. */
  init(): this {
    this.parts.push(ESC, 0x40)
    return this
  }

  /**
   * GS v 0 — print a raster image. Sent in bands, because many cheap printers
   * drop data when one image command is too large for their buffer.
   */
  raster(img: MonoBitmap, bandHeight = 128): this {
    const bytesPerRow = img.width / 8
    for (let y = 0; y < img.height; y += bandHeight) {
      const rows = Math.min(bandHeight, img.height - y)
      this.parts.push(GS, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8)
      for (const b of packRows(img, y, rows)) this.parts.push(b)
    }
    return this
  }

  /** ESC d n — feed n lines. */
  feed(lines = 3): this {
    this.parts.push(ESC, 0x64, lines)
    return this
  }

  /** GS V 66 n — feed then partial cut. Ignored by printers without a cutter. */
  cut(): this {
    this.parts.push(GS, 0x56, 0x42, 0x00)
    return this
  }

  /** ESC p — pulse the cash drawer connected to the printer's RJ11 port. */
  openDrawer(pin: 0 | 1 = 0): this {
    this.parts.push(ESC, 0x70, pin, 0x19, 0xfa)
    return this
  }

  build(): Uint8Array {
    return Uint8Array.from(this.parts)
  }
}
