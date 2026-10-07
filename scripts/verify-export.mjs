// exportPdf 합성 검증 — 최소 PNG 인코더로 도장 이미지를 만들어 PDF에 싣는다.
// 실행: node scripts/verify-export.mjs
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, degrees } from "pdf-lib";
import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const bytes = readFileSync(join(dir, "..", "examples", "계약서-테스트.pdf"));

// --- 최소 PNG 인코더 (64×64 인주색 원, 투명 배경) ---
function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
const S = 64;
const raw = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  for (let x = 0; x < S; x++) {
    const i = y * (S * 4 + 1) + 1 + x * 4;
    const on = Math.hypot(x - S / 2, y - S / 2) < S * 0.45;
    raw[i] = 0xb9; raw[i + 1] = 0x30; raw[i + 2] = 0x16;
    raw[i + 3] = on ? 255 : 0;
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

// --- exportPdf와 동일한 합성 로직 ---
const out = await PDFDocument.load(new Uint8Array(bytes).slice(0));
const img = await out.embedPng(png);
const pages = out.getPages();

const srcDoc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
const placements = [
  { page: 0, x: 290, y: 385, w: 56, h: 56, rot: 8 }, // '갑 ... (인)' 위에 살짝 기울여
  { page: 0, x: 160, y: 460, w: 56, h: 56, rot: -5 }, // '을 ... (인)'
  { page: 1, x: 185, y: 95, w: 52, h: 52, rot: 3 },  // 2쪽 '날인'
];

for (const pl of placements) {
  const vp = (await srcDoc.getPage(pl.page + 1)).getViewport({ scale: 1 });
  const a = (pl.rot * Math.PI) / 180;
  const cx = pl.x + pl.w / 2;
  const cy = pl.y + pl.h / 2;
  const llView = [
    cx + (-pl.w / 2) * Math.cos(a) - (pl.h / 2) * Math.sin(a),
    cy + (-pl.w / 2) * Math.sin(a) + (pl.h / 2) * Math.cos(a),
  ];
  const lrView = [
    cx + (pl.w / 2) * Math.cos(a) - (pl.h / 2) * Math.sin(a),
    cy + (pl.w / 2) * Math.sin(a) + (pl.h / 2) * Math.cos(a),
  ];
  const [llx, lly] = vp.convertToPdfPoint(llView[0], llView[1]);
  const [lrx, lry] = vp.convertToPdfPoint(lrView[0], lrView[1]);
  const theta = (Math.atan2(lry - lly, lrx - llx) * 180) / Math.PI;
  pages[pl.page].drawImage(img, {
    x: llx, y: lly, width: pl.w, height: pl.h, rotate: degrees(theta),
  });
}

const result = await out.save();
const outPath = join(dir, "..", "examples", "계약서-테스트-날인.pdf");
writeFileSync(outPath, result);
console.log("input:", bytes.length, "→ output:", result.length);
// 출력물이 pdf.js로 다시 열리는지 확인
const check = await pdfjs.getDocument({ data: new Uint8Array(result) }).promise;
console.log("reopened, pages:", check.numPages);
console.log("written:", outPath);
