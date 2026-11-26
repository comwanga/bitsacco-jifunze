/** A header-only MP4 (ftyp + moov/mvhd, timescale 1000) saying the video lasts `seconds`. */
export function mp4Header(seconds: number, version: 0 | 1 = 0): Buffer {
  const box = (type: string, payload: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(8 + payload.length, 0);
    head.write(type, 4, "latin1");
    return Buffer.concat([head, payload]);
  };
  const ftyp = box("ftyp", Buffer.concat([Buffer.from("isom", "latin1"), Buffer.from([0, 0, 2, 0]), Buffer.from("isomiso2mp41", "latin1")]));
  const timescale = 1000;
  let mvhd: Buffer;
  if (version === 0) {
    mvhd = Buffer.alloc(100);
    mvhd.writeUInt8(0, 0);
    mvhd.writeUInt32BE(timescale, 12);
    mvhd.writeUInt32BE(seconds * timescale, 16);
  } else {
    mvhd = Buffer.alloc(112);
    mvhd.writeUInt8(1, 0);
    mvhd.writeUInt32BE(timescale, 20);
    mvhd.writeBigUInt64BE(BigInt(seconds * timescale), 24);
  }
  return Buffer.concat([ftyp, box("moov", box("mvhd", mvhd))]);
}
