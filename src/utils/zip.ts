import { readFile, writeFile } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";

export interface ZipFileEntry {
  sourcePath: string;
  archivePath: string;
}

interface EncodedZipEntry {
  name: Buffer;
  compressed: Buffer;
  crc32: number;
  size: number;
  offset: number;
}

export async function writeZipFile(outputPath: string, files: ZipFileEntry[]): Promise<void> {
  const encoded: EncodedZipEntry[] = [];
  const localParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const contents = await readFile(file.sourcePath);
    const name = Buffer.from(file.archivePath.replaceAll("\\", "/"), "utf8");
    const compressed = deflateRawSync(contents);
    const entry = {
      name,
      compressed,
      crc32: crc32(contents),
      size: contents.length,
      offset
    };
    const header = localHeader(entry);
    localParts.push(header, compressed);
    offset += header.length + compressed.length;
    encoded.push(entry);
  }

  const centralParts = encoded.map(centralHeader);
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = endOfCentralDirectory(encoded.length, centralSize, offset);
  await writeFile(outputPath, Buffer.concat([...localParts, ...centralParts, end]));
}

function localHeader(entry: EncodedZipEntry): Buffer {
  const header = Buffer.alloc(30 + entry.name.length);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(0, 10);
  header.writeUInt32LE(entry.crc32, 14);
  header.writeUInt32LE(entry.compressed.length, 18);
  header.writeUInt32LE(entry.size, 22);
  header.writeUInt16LE(entry.name.length, 26);
  header.writeUInt16LE(0, 28);
  entry.name.copy(header, 30);
  return header;
}

function centralHeader(entry: EncodedZipEntry): Buffer {
  const header = Buffer.alloc(46 + entry.name.length);
  header.writeUInt32LE(0x02014b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(20, 6);
  header.writeUInt16LE(0x0800, 8);
  header.writeUInt16LE(8, 10);
  header.writeUInt32LE(0, 12);
  header.writeUInt32LE(entry.crc32, 16);
  header.writeUInt32LE(entry.compressed.length, 20);
  header.writeUInt32LE(entry.size, 24);
  header.writeUInt16LE(entry.name.length, 28);
  header.writeUInt16LE(0, 30);
  header.writeUInt16LE(0, 32);
  header.writeUInt16LE(0, 34);
  header.writeUInt16LE(0, 36);
  header.writeUInt32LE(0, 38);
  header.writeUInt32LE(entry.offset, 42);
  entry.name.copy(header, 46);
  return header;
}

function endOfCentralDirectory(entryCount: number, centralSize: number, centralOffset: number): Buffer {
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entryCount, 8);
  end.writeUInt16LE(entryCount, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  return end;
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
