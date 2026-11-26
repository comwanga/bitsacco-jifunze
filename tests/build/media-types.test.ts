import fs from "node:fs";
import { expect, test } from "vitest";

test("nginx serves WebVTT captions as text/vtt without replacing its other types", () => {
  const conf = fs.readFileSync("docker/nginx.conf", "utf8").replaceAll("\r\n", "\n");
  const start = conf.indexOf("location ~* ^/videos/.+\\.vtt$ {");
  expect(start).toBeGreaterThan(-1);
  const block = conf.slice(start, conf.indexOf("\n  }", start));
  expect(block).toContain("default_type text/vtt;");
  expect(block).toMatch(/types \{\s*\}/);
  expect(block).toContain("security-headers.conf");
  // A server-wide types block would replace nginx's whole built-in MIME map.
  expect(conf.replace(block, "")).not.toMatch(/^\s*types \{/m);
});

test("nginx sandboxes blog SVGs so a file opened directly cannot run script", () => {
  const conf = fs.readFileSync("docker/nginx.conf", "utf8").replaceAll("\r\n", "\n");
  const start = conf.indexOf("location ~* ^/images/blog/.+\\.svg$ {");
  expect(start).toBeGreaterThan(-1);
  const block = conf.slice(start, conf.indexOf("\n  }", start));
  expect(block).toContain("security-headers.conf");
  expect(block).toMatch(/add_header Content-Security-Policy "[^"]*default-src 'none'[^"]*sandbox[^"]*" always;/);
});

test("the local test server knows the video, caption and image types", () => {
  const serve = fs.readFileSync("scripts/serve-out.mjs", "utf8");
  for (const [ext, type] of [[".mp4", "video/mp4"], [".vtt", "text/vtt"], [".webp", "image/webp"], [".jpg", "image/jpeg"]]) {
    expect(serve).toContain(`"${ext}": "${type}"`);
  }
});
