// news-image-20261119
// Draws one 1024x1024 PNG infographic summing up the world's news of
// Thursday 19 November 2026. Node 22, standard library only.
// Own 5x7 bitmap font + own PNG encoder (node:zlib + hand-rolled CRC32).
// Deterministic: two runs write byte-identical files.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------- font ----
// Each glyph is 7 rows of 5 cells. "#" = ink, "." = empty.
const FONT: Record<string, string[]> = {
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  D: ["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  G: [".####", "#....", "#....", "#..##", "#...#", "#...#", ".###."],
  H: ["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  I: [".###.", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  J: ["..###", "...#.", "...#.", "...#.", "...#.", "#..#.", ".##.."],
  K: ["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  M: ["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  P: ["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."],
  Q: [".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  S: [".####", "#....", "#....", ".###.", "....#", "....#", "####."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  U: ["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  V: ["#...#", "#...#", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  W: ["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"],
  X: ["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
  Z: ["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"],

  a: [".....", ".....", ".###.", "....#", ".####", "#...#", ".###."],
  b: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."],
  c: [".....", ".....", ".####", "#....", "#....", "#....", ".####"],
  d: ["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"],
  e: [".....", ".....", ".###.", "#...#", "#####", "#....", ".###."],
  f: ["..##.", ".#...", ".#...", "####.", ".#...", ".#...", ".#..."],
  g: [".....", ".####", "#...#", "#...#", ".####", "....#", ".###."],
  h: ["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"],
  i: [".....", "..#..", ".....", ".##..", "..#..", "..#..", ".###."],
  j: [".....", "..#..", ".....", ".##..", "..#..", "..#..", "##..."],
  k: ["#....", "#....", "#..#.", "#.#..", "##...", "#.#..", "#..#."],
  l: [".##..", "..#..", "..#..", "..#..", "..#..", "..#..", ".###."],
  m: [".....", ".....", "##.#.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"],
  n: [".....", ".....", "####.", "#...#", "#...#", "#...#", "#...#"],
  o: [".....", ".....", ".###.", "#...#", "#...#", "#...#", ".###."],
  p: [".....", ".....", "####.", "#...#", "#...#", "####.", "#...."],
  q: [".....", ".....", ".####", "#...#", "#...#", ".####", "....#"],
  r: [".....", ".....", "#.##.", "##..#", "#....", "#....", "#...."],
  s: [".....", ".....", ".####", "#....", ".###.", "....#", "####."],
  t: [".#...", ".#...", "####.", ".#...", ".#...", ".#...", "..##."],
  u: [".....", ".....", "#...#", "#...#", "#...#", "#...#", ".###."],
  v: [".....", ".....", "#...#", "#...#", "#...#", ".#.#.", "..#.."],
  w: [".....", ".....", "#...#", "#...#", "#.#.#", "#.#.#", ".#.#."],
  x: [".....", ".....", "#...#", ".#.#.", "..#..", ".#.#.", "#...#"],
  y: [".....", ".....", "#...#", "#...#", ".#.#.", "..#..", "..#.."],
  z: [".....", ".....", "#####", "...#.", "..#..", ".#...", "#####"],

  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": [".###.", "#....", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "...#.", "..#..", "..#..", "..#.."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "....#", ".###."],

  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ",": [".....", ".....", ".....", ".....", ".....", ".##..", ".#..."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  ";": [".....", ".##..", ".##..", ".....", ".##..", ".##..", ".#..."],
  "!": ["..#..", "..#..", "..#..", "..#..", "..#..", ".....", "..#.."],
  "?": [".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."],
  "'": ["..#..", "..#..", ".#...", ".....", ".....", ".....", "....."],
  '"': [".#.#.", ".#.#.", ".#.#.", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", ".###.", ".....", ".....", "....."],
  "–": [".....", ".....", ".....", "####.", ".....", ".....", "....."],
  "—": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  "/": ["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."],
  "(": ["...##", "..#..", ".#...", ".#...", ".#...", "..#..", "...##"],
  ")": ["##...", "..#..", "...#.", "...#.", "...#.", "..#..", "##..."],
  "&": [".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"],
  "%": ["##..#", "##.#.", "..#..", "..#..", ".#...", ".#.##", "...##"],
  $: ["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "@": [".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "*": [".....", ".#.#.", "..#..", "#####", "..#..", ".#.#.", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "·": [".....", ".....", ".....", ".##..", ".##..", ".....", "....."],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
};

// ---------------------------------------------------------------- canvas ---
const W = 1024;
const H = 1024;

type RGB = [number, number, number];

const CREAM: RGB = [0xf7, 0xf3, 0xe8];
const NAVY: RGB = [0x16, 0x21, 0x3e];
const GOLD: RGB = [0xd4, 0xa0, 0x17];
const INK: RGB = [0x1a, 0x23, 0x40];
const WHITE: RGB = [0xff, 0xff, 0xff];
const SLATE: RGB = [0x3a, 0x43, 0x58];
const CARD_EDGE: RGB = [0xdd, 0xd5, 0xc2];
const SUBLINE: RGB = [0xc9, 0xd1, 0xe3];
const FOOT: RGB = [0x4a, 0x4a, 0x45];

class Canvas {
  data: Buffer;
  constructor() {
    this.data = Buffer.alloc(W * H * 3);
  }
  fill(color: RGB): void {
    for (let i = 0; i < W * H; i++) {
      this.data[i * 3] = color[0];
      this.data[i * 3 + 1] = color[1];
      this.data[i * 3 + 2] = color[2];
    }
  }
  pixel(x: number, y: number, color: RGB): void {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const o = (y * W + x) * 3;
    this.data[o] = color[0];
    this.data[o + 1] = color[1];
    this.data[o + 2] = color[2];
  }
  rect(x: number, y: number, w: number, h: number, color: RGB): void {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        this.pixel(xx, yy, color);
      }
    }
  }
  // 1px outline rectangle
  frame(x: number, y: number, w: number, h: number, color: RGB): void {
    this.rect(x, y, w, 1, color);
    this.rect(x, y + h - 1, w, 1, color);
    this.rect(x, y, 1, h, color);
    this.rect(x + w - 1, y, 1, h, color);
  }
}

// Glyph advance is 6 cells (5 + 1 spacing).
function textWidth(text: string, scale: number): number {
  if (text.length === 0) return 0;
  return text.length * 6 * scale - scale;
}

function drawText(
  cv: Canvas,
  text: string,
  x: number,
  y: number,
  scale: number,
  color: RGB,
): void {
  let cx = x;
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT["?"];
    for (let row = 0; row < 7; row++) {
      const bits = glyph[row];
      for (let col = 0; col < 5; col++) {
        if (bits[col] === "#") {
          cv.rect(cx + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cx += 6 * scale;
  }
}

function drawTextCentered(
  cv: Canvas,
  text: string,
  y: number,
  scale: number,
  color: RGB,
): void {
  const x = Math.round((W - textWidth(text, scale)) / 2);
  drawText(cv, text, x, y, scale, color);
}

// Greedy word wrap to at most two lines within maxWidth px.
function wrapTwoLines(text: string, scale: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur === "" ? w : cur + " " + w;
    if (textWidth(next, scale) <= maxWidth) {
      cur = next;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------ png ----
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePng(cv: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    cv.data.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------------------- content ---
interface Story {
  cat: string;
  color: RGB;
  darkText: boolean; // chip text navy instead of white (light chip colour)
  headline: string;
  summary: string;
}

const STORIES: Story[] = [
  {
    cat: "DIPLOMACY",
    color: [0x25, 0x63, 0xeb],
    darkText: false,
    headline: "Trump, Xi, Putin meet in China",
    summary: "First three-way summit ends with a peace declaration.",
  },
  {
    cat: "JUSTICE",
    color: [0x7c, 0x3a, 0xed],
    darkText: false,
    headline: "Myanmar committed genocide",
    summary: "World court rules 9-6: 2017 Rohingya crackdown was genocide.",
  },
  {
    cat: "UKRAINE",
    color: [0xea, 0xb3, 0x08],
    darkText: true,
    headline: "Kerch Bridge hit a third time",
    summary: "Ukraine strikes Crimea bridge again; rail traffic halted.",
  },
  {
    cat: "MIDDLE EAST",
    color: [0xea, 0x58, 0x0c],
    darkText: false,
    headline: "Israeli tanks push into Gaza",
    summary: "Ground operation near Nuseirat goes past ceasefire line.",
  },
  {
    cat: "IRAN",
    color: [0xdc, 0x26, 0x26],
    darkText: false,
    headline: "Iran hits Gulf after US strike",
    summary: "US hits Qeshm island; Iran retaliates on Kuwait, Bahrain.",
  },
  {
    cat: "TECH",
    color: [0x0d, 0x94, 0x88],
    darkText: false,
    headline: "Anthropic IPO raises $81bn",
    summary: "Record stock debut at $83 a share; trading starts today.",
  },
  {
    cat: "ASIA",
    color: [0x16, 0xa3, 0x4a],
    darkText: false,
    headline: "North Korea expands enrichment",
    summary: "IAEA warns Yongbyon uranium enrichment is growing fast.",
  },
];

const CARD_X = 28;
const CARD_W = 968;
const TEXT_X = 52;
const TEXT_MAX = 932; // 984 - 52
const ROWS_TOP = 174;
const ROW_H = 110;
const ROW_GAP = 5;

// Gold "TOP STORY" badge drawn next to the category chip of the first card
// (the day's biggest story). Same 20 px height as the chip, navy text on gold.
function drawTopStoryBadge(cv: Canvas, chipY: number, chipW: number): void {
  const badgeText = "TOP STORY";
  const badgeW = textWidth(badgeText, 2) + 16;
  const badgeX = TEXT_X + chipW + 10;
  cv.rect(badgeX, chipY, badgeW, 20, GOLD);
  drawText(cv, badgeText, badgeX + 8, chipY + 3, 2, NAVY);
}

function renderEntry(): Canvas {
  const cv = new Canvas();
  cv.fill(CREAM);

  // Header band + gold rule.
  cv.rect(0, 0, W, 160, NAVY);
  cv.rect(0, 160, W, 5, GOLD);

  drawTextCentered(cv, "THE WORLD IN ONE IMAGE", 26, 3, GOLD);
  drawTextCentered(cv, "THURSDAY, 19 NOVEMBER 2026", 56, 6, WHITE);
  drawTextCentered(cv, "Seven stories that defined the day", 110, 3, SUBLINE);

  // Story rows.
  STORIES.forEach((s, i) => {
    const y = ROWS_TOP + i * (ROW_H + ROW_GAP);
    // White card + edge.
    cv.rect(CARD_X, y, CARD_W, ROW_H, WHITE);
    cv.frame(CARD_X, y, CARD_W, ROW_H, CARD_EDGE);
    // Coloured left accent bar.
    cv.rect(CARD_X, y, 10, ROW_H, s.color);

    // Category chip.
    const chipText = s.cat;
    const chipW = textWidth(chipText, 2) + 16;
    const chipY = y + 6;
    cv.rect(TEXT_X, chipY, chipW, 20, s.color);
    drawText(
      cv,
      chipText,
      TEXT_X + 8,
      chipY + 3,
      2,
      s.darkText ? NAVY : WHITE,
    );

    // Mark the first card as the day's top story.
    if (i === 0) {
      drawTopStoryBadge(cv, chipY, chipW);
    }

    // Headline, one line, scale 5.
    drawText(cv, s.headline, TEXT_X, y + 28, 5, INK);

    // Summary, up to two lines, scale 3.
    const lines = wrapTwoLines(s.summary, 3, TEXT_MAX);
    lines.forEach((line, li) => {
      drawText(cv, line, TEXT_X, y + 65 + li * 23, 3, SLATE);
    });
  });

  // Footer.
  drawTextCentered(
    cv,
    "Sources: Reuters · AP · The Guardian · The Independent — 19 Nov 2026",
    982,
    2,
    FOOT,
  );
  drawTextCentered(cv, "make.fun · news-image-20261119", 1000, 2, FOOT);

  return cv;
}

// ------------------------------------------------------------- font test ---
function renderFontTest(): Canvas {
  const cv = new Canvas();
  cv.fill(CREAM);
  cv.rect(0, 0, W, 64, NAVY);
  drawTextCentered(cv, "FONT TEST — 5x7 BITMAP", 20, 3, WHITE);
  const lines: string[] = [
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "abcdefghijklmnopqrstuvwxyz",
    "0123456789",
    ".,;:!?'\"-",
    "–—/()&%$#@+*=",
    "· · · middle dot · · ·",
  ];
  lines.forEach((line, i) => {
    drawText(cv, line, 40, 100 + i * 56, 4, INK);
  });
  // Every glyph again, large, one per line pair for close inspection.
  drawText(cv, "ABCDEFGHIJKLM", 40, 470, 6, INK);
  drawText(cv, "NOPQRSTUVWXYZ", 40, 530, 6, INK);
  drawText(cv, "abcdefghijklm", 40, 600, 6, INK);
  drawText(cv, "nopqrstuvwxyz", 40, 660, 6, INK);
  drawText(cv, "0123456789", 40, 730, 6, INK);
  drawText(cv, ".,;:!?'\"-–—/", 40, 800, 6, INK);
  drawText(cv, "()&%$#@+*=·", 40, 870, 6, INK);
  return cv;
}

// ------------------------------------------------------------------ main ---
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  fs.mkdirSync(outDir, { recursive: true });

  const entry = encodePng(renderEntry());
  fs.writeFileSync(path.join(outDir, "entry.png"), entry);

  if (process.env.FONT_TEST === "1") {
    const test = encodePng(renderFontTest());
    fs.writeFileSync(path.join(outDir, "font-test.png"), test);
  }
}

main();
