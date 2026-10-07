// 서명란 추천 로직 Node 검증 — 브라우저 없이 pdf.js 텍스트 추출을 확인한다.
// 실행: node scripts/verify-spots.mjs
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const bytes = readFileSync(join(dir, "..", "examples", "계약서-테스트.pdf"));

const SPOT_RE =
  /\(인\)|（인）|\( ?서 ?명 ?\)|\(서명\)|서명란|날인|서명|성명|성  명/;

const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
console.log("pages:", doc.numPages);

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const viewport = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const spots = [];
  for (const item of tc.items) {
    if (!item.str) continue;
    const m = item.str.match(SPOT_RE);
    if (!m) continue;
    const tx = pdfjs.Util.transform(viewport.transform, item.transform);
    const left = tx[4];
    const top = tx[5] - item.height;
    spots.push({
      str: item.str.trim(),
      x: +(left + item.width).toFixed(1),
      y: +(top + item.height / 2).toFixed(1),
    });
  }
  console.log(`page ${p}:`, spots);
}
