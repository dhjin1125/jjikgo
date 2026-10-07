// 일괄 처리 — 같은 양식의 여러 문서에 같은 서식을 적용해 ZIP으로 저장.
import JSZip from "jszip";
import { loadPdf, exportPdf } from "./pdf";
import { loadDocx, exportDocx } from "./docx";
import { loadHwpx, exportHwpx } from "./hwpx";
import type { Template } from "./templates";
import { templatePlacements } from "./templates";
import type { Asset } from "./types";

export interface BatchResult {
  name: string;
  bytes: Uint8Array;
  ok: boolean;
  error?: string;
}

export async function runBatch(
  files: File[],
  template: Template,
  onProgress?: (done: number, total: number) => void
): Promise<{ results: BatchResult[]; zipBytes: Uint8Array }> {
  const assetMap = new Map<string, Asset>(template.assets.map((a) => [a.id, a]));
  const getAsset = (id: string) => assetMap.get(id);
  const results: BatchResult[] = [];

  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, "");
    try {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (ext !== template.docKind && !(template.docKind === "image" && ["jpg","jpeg","png"].includes(ext))) {
        throw new Error(`서식은 ${template.docKind.toUpperCase()}용 — 이 파일은 ${ext.toUpperCase()}`);
      }
      const placements = templatePlacements(template);

      if (ext === "pdf") {
        const pdf = await loadPdf(f);
        const bytes = await exportPdf(pdf.doc, pdf.bytes, placements, getAsset);
        results.push({ name: `${base}-날인.pdf`, bytes, ok: true });
      } else if (["jpg", "jpeg", "png"].includes(ext)) {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = URL.createObjectURL(f);
        });
        const cv = document.createElement("canvas");
        cv.width = img.naturalWidth;
        cv.height = img.naturalHeight;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        for (const pl of placements) {
          const a = getAsset(pl.assetId);
          if (!a) continue;
          const im = new Image();
          await new Promise((r) => {
            im.onload = r;
            im.src = a.dataUrl;
          });
          const pw = pl.w * img.naturalWidth;
          const ph = pl.h * img.naturalHeight;
          ctx.save();
          ctx.translate(pl.x * img.naturalWidth + pw / 2, pl.y * img.naturalHeight + ph / 2);
          ctx.rotate((pl.rot * Math.PI) / 180);
          ctx.drawImage(im, -pw / 2, -ph / 2, pw, ph);
          ctx.restore();
        }
        const { PDFDocument } = await import("pdf-lib");
        const out = await PDFDocument.create();
        const png = await out.embedPng(cv.toDataURL("image/png"));
        const pg = out.addPage([img.naturalWidth, img.naturalHeight]);
        pg.drawImage(png, { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight });
        results.push({ name: `${base}-날인.pdf`, bytes: await out.save(), ok: true });
      } else if (ext === "docx") {
        const { zip } = await loadDocx(await f.arrayBuffer());
        // 배치의 표시 px는 없으므로 w를 mm로 해석할 수 없다 — 대신
        // 서식의 w/h를 미리보기 비율 기준으로 저장했으므로 여기선
        // 문단 삽입 크기를 고정 20mm로 처리하는 대신, 템플릿에 mm를 함께
        // 저장하는 편이 정확하다. v1은 비율 추정: w비율*210mm.
        const bytes = await exportDocx(
          zip,
          placements
            .filter((p) => p.para !== undefined && p.para >= 0)
            .map((p) => ({ assetId: p.assetId, paraIndex: p.para!, widthMm: Math.max(8, Math.min(60, p.w)) })),
          getAsset
        );
        results.push({ name: `${base}-날인.docx`, bytes, ok: true });
      } else if (ext === "hwpx") {
        const hwpx = await loadHwpx(await f.arrayBuffer());
        const bytes = await exportHwpx(
          hwpx,
          placements
            .filter((p) => p.para !== undefined && hwpx.paras[p.para!])
            .map((p) => ({
              assetId: p.assetId,
              section: hwpx.paras[p.para!].section,
              paraIndex: hwpx.paras[p.para!].paraIndex,
              widthMm: Math.max(8, Math.min(60, p.w)),
            })),
          getAsset
        );
        results.push({ name: `${base}-날인.hwpx`, bytes, ok: true });
      } else {
        throw new Error("지원하지 않는 형식");
      }
    } catch (e) {
      results.push({ name: f.name, bytes: new Uint8Array(), ok: false, error: (e as Error).message });
    }
    onProgress?.(results.length, files.length);
  }

  const zip = new JSZip();
  for (const r of results.filter((r) => r.ok)) zip.file(r.name, r.bytes);
  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  return { results, zipBytes };
}
