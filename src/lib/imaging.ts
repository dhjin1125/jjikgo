// 서명 사진 배경 제거 + 텍스트(이름·날짜) → 투명 PNG.

/**
 * 밝은 종이 배경을 제거하고 획을 살린다.
 * 방법: 휘도 기반 알파 — 밝은 픽셀일수록 투명, 어두운 획은 원색·불투명 유지.
 * strength(0..1): 배경 제거 강도. 높일수록 연한 획까지 살지만 배경 그림자가 남을 수 있다.
 */
export async function extractInk(
  source: HTMLImageElement | ImageBitmap,
  strength = 0.62
): Promise<{ dataUrl: string; aspect: number }> {
  const w = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const max = 1600;
  const k = Math.min(1, max / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * k));
  const ch = Math.max(1, Math.round(h * k));

  const cv = document.createElement("canvas");
  cv.width = cw;
  cv.height = ch;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(source, 0, 0, cw, ch);
  const img = ctx.getImageData(0, 0, cw, ch);
  const d = img.data;

  // 배경 밝기 추정: 모서리 샘플의 중앙값
  const corners: number[] = [];
  const sample = (x: number, y: number) => {
    const i = (y * cw + x) * 4;
    corners.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  };
  const m = 4;
  for (let y = 0; y < m; y++)
    for (let x = 0; x < m; x++) {
      sample(x, y);
      sample(cw - 1 - x, y);
      sample(x, ch - 1 - y);
      sample(cw - 1 - x, ch - 1 - y);
    }
  corners.sort((a, b) => a - b);
  const bg = corners[(corners.length / 2) | 0]; // 보통 200~245

  const lo = bg - (bg - 40) * strength; // 이 밝기 이하는 완전 불투명
  const hi = bg - 8; // 이 밝기 이상은 투명

  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const t = Math.max(0, Math.min(1, (hi - lum) / Math.max(1, hi - lo)));
    const a = t * t * (3 - 2 * t); // smoothstep — 회색 띠 방지
    // 색은 어두운 획 쪽으로 당겨 필체를 살린다
    const darken = 0.55 + 0.45 * a;
    d[i] = Math.min(255, d[i] * darken);
    d[i + 1] = Math.min(255, d[i + 1] * darken);
    d[i + 2] = Math.min(255, d[i + 2] * darken);
    d[i + 3] = Math.round(255 * a);
  }
  ctx.putImageData(img, 0, 0);

  // 여백 크롭
  const box = alphaBBox(ctx, cw, ch);
  if (!box) return { dataUrl: cv.toDataURL("image/png"), aspect: cw / ch };
  const out = document.createElement("canvas");
  out.width = box.w;
  out.height = box.h;
  out.getContext("2d")!.drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return { dataUrl: out.toDataURL("image/png"), aspect: box.w / box.h };
}

function alphaBBox(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0, found = false;
  for (let y = 0; y < h; y += 2)
    for (let x = 0; x < w; x += 2) {
      if (d[(y * w + x) * 4 + 3] > 12) {
        found = true;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  if (!found) return null;
  const pad = 8;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w, x1 + pad);
  y1 = Math.min(h, y1 + pad);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 이름·날짜 같은 짧은 텍스트를 투명 PNG로 — PDF 내장 폰트가 한글을 못 쓰므로 이미지로 */
export async function textToPng(
  text: string,
  opts: { fontSize?: number; color?: string; serif?: boolean } = {}
): Promise<{ dataUrl: string; aspect: number }> {
  const fontSize = opts.fontSize ?? 96;
  const family = opts.serif
    ? '"Noto Serif KR", serif'
    : '"IBM Plex Sans KR", sans-serif';
  await document.fonts.load(`600 ${fontSize}px ${family}`).catch(() => {});
  const cv = document.createElement("canvas");
  const ctx = cv.getContext("2d")!;
  ctx.font = `600 ${fontSize}px ${family}`;
  const w = Math.ceil(ctx.measureText(text).width) + 16;
  const h = Math.ceil(fontSize * 1.4);
  cv.width = w;
  cv.height = h;
  ctx.font = `600 ${fontSize}px ${family}`;
  ctx.fillStyle = opts.color ?? "#1c1b1a";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 8, h / 2);
  return { dataUrl: cv.toDataURL("image/png"), aspect: w / h };
}
