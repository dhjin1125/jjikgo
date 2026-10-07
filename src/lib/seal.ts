// 이름으로 도장을 만든다: 원형/타원형/사각형 + 절제된 잉크 질감.
// 출력은 투명 배경 PNG data URL.

export type SealShape = "circle" | "oval" | "square";

const SEAL = "#b93016"; // 인주 — 문서 위에서 살짝 진하게

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 잉크 질감: 알파에 그레인을 곱하고 가장자리 스펙클로 찍힘 불균일을 만든다 */
function applyInkTexture(ctx: CanvasRenderingContext2D, size: number, seed: number) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const rnd = mulberry(seed);
  // 채널 고정 노이즈 맵 (픽셀별 순수 랜덤보다 덩어리진 잉크 느낌)
  const grain = new Float32Array(64 * 64);
  for (let i = 0; i < grain.length; i++) grain[i] = rnd();
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (d[i + 3] === 0) continue;
      const gx = (x * 64) / size | 0;
      const gy = (y * 64) / size | 0;
      const g = grain[(gy * 64 + gx) | 0];
      // 중심은 진하게, 외곽으로 갈수록 스펙클 증가
      const dist = Math.hypot(x - c, y - c) / c; // 0..1+
      const edge = Math.max(0, dist - 0.55) * 1.6;
      const a = 1 - g * (0.28 + edge * 0.55);
      d[i + 3] = Math.round(d[i + 3] * Math.max(0.35, Math.min(1, a)));
    }
  }
  ctx.putImageData(img, 0, 0);
  // 큰 찍힘 빈틈 몇 군데 (destination-out 원형 소프트 마스크)
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const r = size * (0.32 + rnd() * 0.16);
    const px = c + Math.cos(a) * size * 0.33;
    const py = c + Math.sin(a) * size * 0.33;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r);
    grad.addColorStop(0, `rgba(0,0,0,${0.25 + rnd() * 0.3})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  ctx.restore();
}

/** 2글자→2x1? 한국 도장 관례: 2자는 그대로, 3~4자는 2열 그리드 */
function layout(chars: string[]): { cols: number; rows: number } {
  if (chars.length <= 2) return { cols: 1, rows: chars.length };
  if (chars.length === 3) return { cols: 1, rows: 3 };
  return { cols: 2, rows: Math.ceil(chars.length / 2) }; // 4자 → 2x2
}

export async function generateSeal(opts: {
  name: string;
  shape: SealShape;
  seed?: number;
}): Promise<{ dataUrl: string; aspect: number }> {
  const { name, shape } = opts;
  const seed = opts.seed ?? Math.floor(Math.random() * 1e9);
  await document.fonts.load('900 100px "Noto Serif KR"').catch(() => {});
  const size = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d")!;
  const c = size / 2;

  ctx.strokeStyle = SEAL;
  ctx.fillStyle = SEAL;
  ctx.lineJoin = "round";

  const rnd = mulberry(seed + 7);
  const jitter = (v: number) => v + (rnd() - 0.5) * size * 0.008;

  if (shape === "circle" || shape === "oval") {
    const rx = shape === "circle" ? size * 0.44 : size * 0.4;
    const ry = shape === "circle" ? size * 0.44 : size * 0.46;
    ctx.lineWidth = size * 0.035;
    // 살짝 손그린 듯한 이중 원 — 실제 인주 번짐 흉내
    ctx.beginPath();
    ctx.ellipse(c, c, rx, ry, (rnd() - 0.5) * 0.02, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = size * 0.012;
    ctx.beginPath();
    ctx.ellipse(c, c, rx * 0.985, ry * 0.985, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else {
    const half = size * 0.41;
    ctx.lineWidth = size * 0.035;
    ctx.strokeRect(jitter(c - half), jitter(c - half), half * 2, half * 2);
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = size * 0.012;
    ctx.strokeRect(c - half * 0.985, c - half * 0.985, half * 1.97, half * 1.97);
    ctx.restore();
  }

  // 글자 배치
  const chars = [...name.trim()].filter((ch) => ch.trim());
  if (!chars.length) throw new Error("empty name");
  const { cols, rows } = layout(chars);
  const inner = shape === "square" ? 0.72 : 0.66; // 테두리 안쪽 사용 비율
  const box = size * inner;
  const cell = Math.min(box / cols, box / rows) * 0.92;
  ctx.fillStyle = SEAL;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `900 ${cell}px "Noto Serif KR", "NanumMyeongjo", serif`;

  const ox = c - ((cols - 1) * cell) / 2;
  const oy = c - ((rows - 1) * cell) / 2;
  // 한국 인장은 오른쪽 열부터 읽는 관례 — 2x2는 우→좌, 위→아래
  const order =
    cols === 2 ? [1, 3, 0, 2].slice(0, chars.length) : chars.map((_, i) => i);
  chars.forEach((ch, i) => {
    const slot = order[i];
    const col = slot % cols;
    const row = (slot / cols) | 0;
    ctx.fillText(ch, ox + col * cell, oy + row * cell + cell * 0.04);
  });

  applyInkTexture(ctx, size, seed);
  return { dataUrl: cv.toDataURL("image/png"), aspect: 1 };
}
