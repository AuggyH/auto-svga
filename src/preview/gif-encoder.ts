import { writeFile } from "node:fs/promises";

interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface GifFrame {
  width: number;
  height: number;
  pixels: Uint8Array;
  delayCs: number;
}

const palette: Rgb[] = [
  { r: 0, g: 0, b: 0 },
  { r: 18, g: 22, b: 28 },
  { r: 54, g: 66, b: 82 },
  { r: 116, g: 139, b: 164 },
  { r: 188, g: 218, b: 246 },
  { r: 255, g: 232, b: 163 },
  { r: 255, g: 255, b: 255 },
  { r: 120, g: 180, b: 255 }
];

export async function writeGif(filePath: string, frames: GifFrame[]): Promise<void> {
  if (frames.length === 0) {
    throw new Error("Cannot write GIF without frames.");
  }

  const width = frames[0]?.width ?? 0;
  const height = frames[0]?.height ?? 0;
  const chunks: Buffer[] = [];

  chunks.push(Buffer.from("GIF89a", "ascii"));
  chunks.push(u16(width), u16(height));
  chunks.push(Buffer.from([0xf2, 0x00, 0x00]));
  chunks.push(globalColorTable());
  chunks.push(netscapeLoopExtension());

  for (const frame of frames) {
    chunks.push(graphicControlExtension(frame.delayCs));
    chunks.push(Buffer.from([0x2c]), u16(0), u16(0), u16(width), u16(height), Buffer.from([0x00]));
    chunks.push(Buffer.from([0x03]));
    chunks.push(imageData(frame.pixels, 3));
  }

  chunks.push(Buffer.from([0x3b]));
  await writeFile(filePath, Buffer.concat(chunks));
}

export function nearestPaletteIndex(r: number, g: number, b: number): number {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  palette.forEach((color, index) => {
    const distance = (r - color.r) ** 2 + (g - color.g) ** 2 + (b - color.b) ** 2;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function globalColorTable(): Buffer {
  const table = Buffer.alloc(8 * 3);
  palette.forEach((color, index) => {
    table[index * 3] = color.r;
    table[index * 3 + 1] = color.g;
    table[index * 3 + 2] = color.b;
  });
  return table;
}

function netscapeLoopExtension(): Buffer {
  return Buffer.from([0x21, 0xff, 0x0b, ...Buffer.from("NETSCAPE2.0", "ascii"), 0x03, 0x01, 0x00, 0x00, 0x00]);
}

function graphicControlExtension(delayCs: number): Buffer {
  return Buffer.from([0x21, 0xf9, 0x04, 0x00, delayCs & 0xff, (delayCs >> 8) & 0xff, 0x00, 0x00]);
}

function imageData(indices: Uint8Array, minCodeSize: number): Buffer {
  const encoded = lzwEncode(indices, minCodeSize);
  const blocks: Buffer[] = [];

  for (let offset = 0; offset < encoded.length; offset += 255) {
    const block = encoded.subarray(offset, offset + 255);
    blocks.push(Buffer.from([block.length]), block);
  }

  blocks.push(Buffer.from([0x00]));
  return Buffer.concat(blocks);
}

function lzwEncode(indices: Uint8Array, minCodeSize: number): Buffer {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  let nextCode = endCode + 1;
  let codeSize = minCodeSize + 1;
  const writer = new BitWriter();

  const resetDictionary = (): void => {
    nextCode = endCode + 1;
    codeSize = minCodeSize + 1;
  };

  resetDictionary();
  writer.write(clearCode, codeSize);

  let hasPrevious = false;
  for (const index of indices) {
    writer.write(index, codeSize);
    if (hasPrevious) {
      nextCode += 1;
      if (nextCode === (1 << codeSize) && codeSize < 12) {
        codeSize += 1;
      }
      if (nextCode >= 4095) {
        writer.write(clearCode, codeSize);
        resetDictionary();
        hasPrevious = false;
      }
    } else {
      hasPrevious = true;
    }
  }

  if (nextCode >= 4095) {
    writer.write(clearCode, codeSize);
    resetDictionary();
  }

  writer.write(endCode, codeSize);
  return writer.finish();
}

function u16(value: number): Buffer {
  return Buffer.from([value & 0xff, (value >> 8) & 0xff]);
}

class BitWriter {
  private bytes: number[] = [];
  private current = 0;
  private bitCount = 0;

  write(code: number, size: number): void {
    this.current |= code << this.bitCount;
    this.bitCount += size;

    while (this.bitCount >= 8) {
      this.bytes.push(this.current & 0xff);
      this.current >>= 8;
      this.bitCount -= 8;
    }
  }

  finish(): Buffer {
    if (this.bitCount > 0) {
      this.bytes.push(this.current & 0xff);
    }
    return Buffer.from(this.bytes);
  }
}
