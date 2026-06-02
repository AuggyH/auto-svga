import { deflateSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export interface RgbaImage {
  width: number;
  height: number;
  pixels: Uint8Array;
}

export async function writeRgbaPng(filePath: string, image: RgbaImage): Promise<void> {
  await writeFile(filePath, encodeRgbaPng(image));
}

export function encodeRgbaPng(image: RgbaImage): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(image.width, 0);
  ihdr.writeUInt32BE(image.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const stride = image.width * 4;
  const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    raw[y * (stride + 1)] = 0;
    image.pixels.copyWithin;
    Buffer.from(image.pixels.buffer, image.pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

export function createTransparentImage(width: number, height: number): RgbaImage {
  return {
    width,
    height,
    pixels: new Uint8Array(width * height * 4)
  };
}

export function setPixel(image: RgbaImage, x: number, y: number, rgba: [number, number, number, number]): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) {
    return;
  }

  const offset = (y * image.width + x) * 4;
  image.pixels[offset] = rgba[0];
  image.pixels[offset + 1] = rgba[1];
  image.pixels[offset + 2] = rgba[2];
  image.pixels[offset + 3] = rgba[3];
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
