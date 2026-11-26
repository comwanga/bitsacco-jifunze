import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, expect, test } from "vitest";
import { mp4DurationSeconds } from "../../lib/content/mp4.ts";
import { mp4Header } from "../helpers/mp4.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jifunze-mp4-"));
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));
const write = (name: string, data: Buffer) => {
  const f = path.join(dir, name);
  fs.writeFileSync(f, data);
  return f;
};

test("reads the duration from 32-bit and 64-bit movie headers", () => {
  expect(mp4DurationSeconds(write("one.mp4", mp4Header(1)))).toBe(1);
  expect(mp4DurationSeconds(write("long.mp4", mp4Header(180)))).toBe(180);
  expect(mp4DurationSeconds(write("v1.mp4", mp4Header(90, 1)))).toBe(90);
});

test("finds the movie header after a large media box (moov at the end)", () => {
  const head = mp4Header(42);
  const ftypSize = head.readUInt32BE(0);
  const mdat = Buffer.alloc(64 * 1024);
  mdat.writeUInt32BE(mdat.length, 0);
  mdat.write("mdat", 4, "latin1");
  expect(mp4DurationSeconds(write("late.mp4", Buffer.concat([head.subarray(0, ftypSize), mdat, head.subarray(ftypSize)])))).toBe(42);
});

test("anything that is not an MP4 has no duration", () => {
  expect(mp4DurationSeconds(write("x.png", Buffer.from("\x89PNG\r\n\x1a\n0000000000000000", "latin1")))).toBeNull();
  expect(mp4DurationSeconds(write("empty.mp4", Buffer.alloc(0)))).toBeNull();
});
