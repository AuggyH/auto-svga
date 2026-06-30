import { inflateSync } from "node:zlib";
import type { RgbaImage } from "./png-writer.js";

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function decodeRgbaPng(buffer: Buffer): RgbaImage {
  if (!buffer.subarray(0, 8).equals(signature)) {
    throw new Error("Input is not a PNG file.");
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const palette: Array<[number, number, number]> = [];
  let indexedAlpha: number[] = [];
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      const interlace = data.readUInt8(12);
      if (interlace !== 0 || !isSupportedBitDepth(colorType, bitDepth)) {
        throw new Error("Only supported non-interlaced PNG files can be decoded.");
      }
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "PLTE") {
      for (let index = 0; index + 2 < data.length; index += 3) {
        palette.push([data[index], data[index + 1], data[index + 2]]);
      }
    } else if (type === "tRNS" && colorType === 3) {
      indexedAlpha = [...data];
    } else if (type === "IEND") {
      break;
    }
  }

  const channels = channelsFor(colorType);
  if (colorType === 3 && palette.length === 0) {
    throw new Error("Indexed PNG is missing PLTE palette.");
  }
  const inflated = inflateSync(Buffer.concat(idatChunks));
  const stride = rowStride(width, colorType, bitDepth, channels);
  const filterBytesPerPixel = filterByteWidth(colorType, bitDepth, channels);
  const rgba = new Uint8Array(width * height * 4);
  let readOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated.readUInt8(readOffset);
    readOffset += 1;
    const scanline = Buffer.from(inflated.subarray(readOffset, readOffset + stride));
    readOffset += stride;
    unfilter(scanline, previous, filter, filterBytesPerPixel);
    writeRgbaRow(rgba, scanline, y, width, colorType, bitDepth, channels, palette, indexedAlpha);
    previous = scanline;
  }

  return { width, height, pixels: rgba };
}

function channelsFor(colorType: number): number {
  if (colorType === 6) {
    return 4;
  }
  if (colorType === 4) {
    return 2;
  }
  if (colorType === 2) {
    return 3;
  }
  if (colorType === 0) {
    return 1;
  }
  if (colorType === 3) {
    return 1;
  }
  throw new Error(`Unsupported PNG color type: ${colorType}`);
}

function isSupportedBitDepth(colorType: number, bitDepth: number): boolean {
  if (colorType === 3) {
    return bitDepth === 1 || bitDepth === 2 || bitDepth === 4 || bitDepth === 8;
  }
  return bitDepth === 8;
}

function rowStride(width: number, colorType: number, bitDepth: number, channels: number): number {
  if (colorType === 3) {
    return Math.ceil(width * bitDepth / 8);
  }
  return width * channels;
}

function filterByteWidth(colorType: number, bitDepth: number, channels: number): number {
  return colorType === 3 && bitDepth < 8 ? 1 : channels;
}

function unfilter(scanline: Buffer, previous: Buffer, filter: number, bytesPerPixel: number): void {
  for (let index = 0; index < scanline.length; index += 1) {
    const left = index >= bytesPerPixel ? scanline[index - bytesPerPixel] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] ?? 0 : 0;

    if (filter === 1) {
      scanline[index] = (scanline[index] + left) & 0xff;
    } else if (filter === 2) {
      scanline[index] = (scanline[index] + up) & 0xff;
    } else if (filter === 3) {
      scanline[index] = (scanline[index] + Math.floor((left + up) / 2)) & 0xff;
    } else if (filter === 4) {
      scanline[index] = (scanline[index] + paeth(left, up, upLeft)) & 0xff;
    } else if (filter !== 0) {
      throw new Error(`Unsupported PNG filter: ${filter}`);
    }
  }
}

function writeRgbaRow(
  rgba: Uint8Array,
  scanline: Buffer,
  y: number,
  width: number,
  colorType: number,
  bitDepth: number,
  channels: number,
  palette: ReadonlyArray<readonly [number, number, number]>,
  indexedAlpha: readonly number[]
): void {
  for (let x = 0; x < width; x += 1) {
    const source = x * channels;
    const target = (y * width + x) * 4;
    if (colorType === 6) {
      rgba[target] = scanline[source];
      rgba[target + 1] = scanline[source + 1];
      rgba[target + 2] = scanline[source + 2];
      rgba[target + 3] = scanline[source + 3];
    } else if (colorType === 4) {
      rgba[target] = scanline[source];
      rgba[target + 1] = scanline[source];
      rgba[target + 2] = scanline[source];
      rgba[target + 3] = scanline[source + 1];
    } else if (colorType === 2) {
      rgba[target] = scanline[source];
      rgba[target + 1] = scanline[source + 1];
      rgba[target + 2] = scanline[source + 2];
      rgba[target + 3] = 255;
    } else if (colorType === 3) {
      const paletteIndex = readIndexedPaletteValue(scanline, x, bitDepth);
      const entry = palette[paletteIndex];
      if (!entry) {
        throw new Error(`Indexed PNG palette entry missing: ${paletteIndex}`);
      }
      rgba[target] = entry[0];
      rgba[target + 1] = entry[1];
      rgba[target + 2] = entry[2];
      rgba[target + 3] = indexedAlpha[paletteIndex] ?? 255;
    } else {
      rgba[target] = scanline[source];
      rgba[target + 1] = scanline[source];
      rgba[target + 2] = scanline[source];
      rgba[target + 3] = 255;
    }
  }
}

function readIndexedPaletteValue(scanline: Buffer, x: number, bitDepth: number): number {
  if (bitDepth === 8) {
    return scanline[x];
  }
  const bitOffset = x * bitDepth;
  const byte = scanline[Math.floor(bitOffset / 8)];
  const shift = 8 - bitDepth - (bitOffset % 8);
  const mask = (1 << bitDepth) - 1;
  return (byte >> shift) & mask;
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) {
    return left;
  }
  return pb <= pc ? up : upLeft;
}
