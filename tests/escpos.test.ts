import { describe, expect, it } from 'vitest'
import { EscPosBuilder, packRows, type MonoBitmap } from '../src/printing/escpos'

function bitmap(width: number, height: number, black: (x: number, y: number) => boolean): MonoBitmap {
  const bits = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) bits[y * width + x] = black(x, y) ? 1 : 0
  return { width, height, bits }
}

describe('packRows', () => {
  it('packs the leftmost pixel into the most significant bit', () => {
    const img = bitmap(16, 1, (x) => x === 0 || x === 15)
    expect([...packRows(img, 0, 1)]).toEqual([0x80, 0x01])
  })

  it('rejects widths that are not a multiple of 8', () => {
    expect(() => packRows(bitmap(10, 1, () => false), 0, 1)).toThrow()
  })
})

describe('EscPosBuilder.raster', () => {
  it('splits tall images into bands with correct GS v 0 headers', () => {
    const img = bitmap(16, 300, () => true)
    const out = new EscPosBuilder().raster(img, 128).build()
    const bytesPerRow = 2
    // Bands of 128, 128 and 44 rows, each with an 8-byte header.
    expect(out.length).toBe(3 * 8 + 300 * bytesPerRow)
    expect([...out.slice(0, 8)]).toEqual([0x1d, 0x76, 0x30, 0x00, 2, 0, 128, 0])
    const third = 2 * (8 + 128 * bytesPerRow)
    expect([...out.slice(third, third + 8)]).toEqual([0x1d, 0x76, 0x30, 0x00, 2, 0, 44, 0])
  })

  it('starts with init and ends with cut', () => {
    const out = new EscPosBuilder().init().feed(2).cut().build()
    expect([...out]).toEqual([0x1b, 0x40, 0x1b, 0x64, 2, 0x1d, 0x56, 0x42, 0x00])
  })
})
