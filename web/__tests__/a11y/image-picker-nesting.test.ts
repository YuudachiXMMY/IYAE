import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * `LocalImagePicker` renders a `<button>`. Anything interactive passed as its children becomes
 * a button inside a button: two tab stops and two screen-reader announcements for one action,
 * which is worse than the unreachable `<div onClick>` it replaced.
 *
 * Four of the five call sites had exactly that when the picker was converted. A source scan
 * rather than a render test because the offending sites include `ProfileHeader`, which is
 * unwired and has no test harness — and because the failure is structural, so it is cheap to
 * see in the source and easy to reintroduce.
 */
const ROOT = join(import.meta.dirname, "../..");

function tsxFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFilesUnder(rel));
    else if (entry.name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

/** The children passed to each <LocalImagePicker> in a file. */
function pickerChildren(source: string): string[] {
  const blocks: string[] = [];
  let from = 0;
  for (;;) {
    const open = source.indexOf("<LocalImagePicker", from);
    if (open === -1) break;
    const openEnd = source.indexOf(">", open);
    const close = source.indexOf("</LocalImagePicker>", openEnd);
    if (openEnd === -1 || close === -1) break;
    blocks.push(source.slice(openEnd + 1, close));
    from = close + 1;
  }
  return blocks;
}

describe("LocalImagePicker call sites", () => {
  const files = [...tsxFilesUnder("components"), ...tsxFilesUnder("app")].filter((f) =>
    readFileSync(join(ROOT, f), "utf8").includes("<LocalImagePicker")
  );

  it("has call sites to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s passes no interactive element as children", (file) => {
    const source = readFileSync(join(ROOT, file), "utf8");
    for (const children of pickerChildren(source)) {
      expect(children, `nested <button> inside the picker's own button, in ${file}`)
        .not.toMatch(/<button[\s>]/);
      expect(children, `nested <Button> inside the picker's own button, in ${file}`)
        .not.toMatch(/<Button[\s>]/);
      expect(children, `nested <a> inside the picker's own button, in ${file}`)
        .not.toMatch(/<a\s[^>]*href/);
    }
  });
});
