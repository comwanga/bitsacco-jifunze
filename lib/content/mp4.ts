import fs from "node:fs";

/**
 * The duration in seconds from an MP4's movie header (moov/mvhd), or null when the file is not an MP4.
 * Walks top-level boxes by their headers, so a moov box after a large mdat is still found without
 * reading the media data.
 */
export function mp4DurationSeconds(file: string): number | null {
  const fd = fs.openSync(file, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const read = (offset: number, length: number) => {
      const buf = Buffer.alloc(length);
      return buf.subarray(0, fs.readSync(fd, buf, 0, length, offset));
    };
    let offset = 0;
    let first = true;
    while (offset + 8 <= size) {
      const head = read(offset, 16);
      if (head.length < 8) return null;
      let boxSize = head.readUInt32BE(0);
      const type = head.toString("latin1", 4, 8);
      let headerSize = 8;
      if (boxSize === 1) {
        if (head.length < 16) return null;
        boxSize = Number(head.readBigUInt64BE(8));
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = size - offset;
      }
      if (first && type !== "ftyp") return null;
      first = false;
      if (boxSize < headerSize || offset + boxSize > size) return null;
      if (type === "moov") return mvhdDuration(read(offset + headerSize, boxSize - headerSize));
      offset += boxSize;
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

function mvhdDuration(moov: Buffer): number | null {
  let offset = 0;
  while (offset + 8 <= moov.length) {
    const boxSize = moov.readUInt32BE(offset);
    if (boxSize < 8 || offset + boxSize > moov.length) return null;
    if (moov.toString("latin1", offset + 4, offset + 8) === "mvhd") {
      const body = moov.subarray(offset + 8, offset + boxSize);
      const version = body.readUInt8(0);
      const timescale = version === 1 ? body.readUInt32BE(20) : body.readUInt32BE(12);
      const duration = version === 1 ? Number(body.readBigUInt64BE(24)) : body.readUInt32BE(16);
      return timescale > 0 ? duration / timescale : null;
    }
    offset += boxSize;
  }
  return null;
}
