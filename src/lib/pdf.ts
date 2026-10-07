// PDF 불러오기·렌더·서명란 추천·pdf-lib 합성 출력.
import * as pdfjs from "pdfjs-dist";
import { PDFDocument, degrees } from "pdf-lib";
import type { Placement, SignatureSpot } from "./types";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
}

export interface PdfDoc {
  doc: pdfjs.PDFDocumentProxy;
  bytes: ArrayBuffer;
  numPages: number;
  /** 페이지별 scale=1 뷰포트 크기 [w,h] — 회전 페이지는 표시 기준 크기 */
  sizes: { w: number; h: number }[];
}

export class PdfPasswordError extends Error {}
export class PdfParseError extends Error {}

export async function loadPdf(file: File | ArrayBuffer): Promise<PdfDoc> {
  const bytes =
    file instanceof File ? await file.arrayBuffer() : file.slice(0);
  let doc: pdfjs.PDFDocumentProxy;
  try {
    doc = await pdfjs.getDocument({ data: bytes.slice(0) }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name ?? "";
    if (name === "PasswordException") throw new PdfPasswordError();
    throw new PdfParseError();
  }
  const sizes: { w: number; h: number }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const vp = p.getViewport({ scale: 1 });
    sizes.push({ w: vp.width, h: vp.height });
  }
  return { doc, bytes, numPages: doc.numPages, sizes };
}

export async function renderPage(
  doc: pdfjs.PDFDocumentProxy,
  pageNum: number, // 1-based
  scale: number,
  canvas: HTMLCanvasElement
): Promise<void> {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = viewport.width * dpr;
  canvas.height = viewport.height * dpr;
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  await page.render({
    canvasContext: ctx,
    canvas,
    viewport,
  }).promise;
}

const SPOT_RE =
  /\(인\)|（인）|\( ?서 ?명 ?\)|\(서명\)|서명란|날인|서명|성명|성  명/;

/** 텍스트 레이어에서 (인)·서명·성명 주변 후보 위치를 추천한다 */
export async function findSignatureSpots(
  doc: pdfjs.PDFDocumentProxy,
  pageNum: number
): Promise<SignatureSpot[]> {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const spots: SignatureSpot[] = [];

  for (const item of tc.items) {
    if (!("str" in item) || !item.str) continue;
    const str = item.str;
    const m = str.match(SPOT_RE);
    if (!m) continue;
    const tx = pdfjs.Util.transform(viewport.transform, item.transform);
    const left = tx[4];
    const top = tx[5] - item.height;
    const h = item.height;
    const w = item.width;

    // "(인)" 자체가 있으면 그 위에 겹쳐 찍는다 — 라벨이 아니라 도장 자리
    const inIdx = str.search(/\( ?인 ?\)|（ ?인 ?）/);
    if (inIdx >= 0) {
      const frac = (inIdx + 1.5) / Math.max(str.length, 1);
      spots.push({
        page: pageNum - 1,
        x: left + w * frac,
        y: top + h / 2,
        r: h * 1.7,
        label: str.trim().slice(0, 12) || "(인)",
      });
      continue;
    }
    // 라벨(성명·서명) 오른쪽 빈 자리 추천
    spots.push({
      page: pageNum - 1,
      x: left + w + h * 1.4,
      y: top + h / 2,
      r: h * 1.5,
      label: str.trim().slice(0, 12) || "서명란",
    });
  }
  // 겹침 제거 — 같은 자리 후보가 중복되지 않게
  return spots.filter(
    (s, i) =>
      !spots
        .slice(0, i)
        .some((o) => Math.hypot(o.x - s.x, o.y - s.y) < s.r * 0.8)
  );
}

/**
 * view-space(scale 1, y-down) 배치 → pdf-lib drawImage 좌표(y-up).
 * 회전된 페이지도 convertToPdfPoint로 정확히 변환한다.
 */
export async function exportPdf(
  pdfjsDoc: pdfjs.PDFDocumentProxy,
  pdfBytes: ArrayBuffer,
  placements: Placement[],
  getAsset: (id: string) => { dataUrl: string } | undefined
): Promise<Uint8Array> {
  const out = await PDFDocument.load(pdfBytes.slice(0), {
    ignoreEncryption: true,
  });
  const pages = out.getPages();
  const cache = new Map<string, Promise<import("pdf-lib").PDFImage>>();
  const embed = (id: string, dataUrl: string) => {
    if (!cache.has(id)) cache.set(id, out.embedPng(dataUrl));
    return cache.get(id)!;
  };
  const viewports = new Map<number, pdfjs.PageViewport>();
  const vp = async (i: number) => {
    if (!viewports.has(i))
      viewports.set(i, (await pdfjsDoc.getPage(i + 1)).getViewport({ scale: 1 }));
    return viewports.get(i)!;
  };

  for (const pl of placements) {
    const asset = getAsset(pl.assetId);
    const page = pages[pl.page];
    if (!asset || !page) continue;
    const img = await embed(pl.assetId, asset.dataUrl);
    const v = await vp(pl.page);

    const a = (pl.rot * Math.PI) / 180; // y-down 기준 시계방향 회전
    const cx = pl.x + pl.w / 2;
    const cy = pl.y + pl.h / 2;
    // 화면상의 좌하단·우하단 코너를 pdf 좌표로 변환 → pivot과 각도를 얻는다
    const llView = [
      cx + (-pl.w / 2) * Math.cos(a) - (pl.h / 2) * Math.sin(a),
      cy + (-pl.w / 2) * Math.sin(a) + (pl.h / 2) * Math.cos(a),
    ] as const;
    const lrView = [
      cx + (pl.w / 2) * Math.cos(a) - (pl.h / 2) * Math.sin(a),
      cy + (pl.w / 2) * Math.sin(a) + (pl.h / 2) * Math.cos(a),
    ] as const;
    const [llx, lly] = v.convertToPdfPoint(llView[0], llView[1]);
    const [lrx, lry] = v.convertToPdfPoint(lrView[0], lrView[1]);
    const theta = (Math.atan2(lry - lly, lrx - llx) * 180) / Math.PI;

    page.drawImage(img, {
      x: llx,
      y: lly,
      width: pl.w,
      height: pl.h,
      rotate: degrees(theta),
    });
  }
  return out.save();
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
