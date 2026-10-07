"use client";

import { useEffect, useRef, useState } from "react";
import { extractInk } from "@/lib/imaging";

/** 랜딩의 "실제 전후 비교" — 가짜 서명 사진을 만들고 진짜 보정 로직을 돌린다 */
export default function BeforeAfter() {
  const [raw, setRaw] = useState<string | null>(null);
  const [clean, setClean] = useState<string | null>(null);
  const [pos, setPos] = useState(58);
  const made = useRef(false);

  useEffect(() => {
    if (made.current) return;
    made.current = true;
    // 종이 사진 흉내: 크림색 배경 + 잡점 + 서명 획
    const cv = document.createElement("canvas");
    cv.width = 720;
    cv.height = 400;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#f2eee2";
    ctx.fillRect(0, 0, 720, 400);
    let s = 7;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(120,110,90,${rnd() * 0.08})`;
      ctx.fillRect(rnd() * 720, rnd() * 400, 1.6, 1.6);
    }
    // 사진 그림자(한쪽 어두움)
    const g = ctx.createLinearGradient(0, 0, 720, 400);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(60,50,30,.14)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 720, 400);
    // 서명 획
    ctx.strokeStyle = "#1a2240";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const stroke = (pts: number[][]) => {
      ctx.beginPath();
      ctx.lineWidth = 5 + rnd() * 3;
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i][0] + pts[i + 1][0]) / 2;
        const yc = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
      }
      ctx.stroke();
    };
    stroke([[120, 220], [200, 120], [280, 240], [360, 130], [430, 230]]);
    stroke([[160, 280], [300, 250], [480, 270]]);
    stroke([[480, 140], [560, 200], [620, 150]]);
    setRaw(cv.toDataURL("image/png"));

    const img = new Image();
    img.onload = async () => {
      const out = await extractInk(img, 0.66);
      setClean(out.dataUrl);
    };
    img.src = cv.toDataURL("image/png");
  }, []);

  return (
    <div className="sheet overflow-hidden">
      {/* 미니 문서 */}
      <div className="relative bg-white px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-md">
          <p className="font-display text-center text-lg font-bold">확 인 서</p>
          <div className="mt-6 space-y-3 text-[13px]" style={{ color: "var(--ink-60)" }}>
            <p>상기 본인은 위 사실을 확인하였습니다.</p>
            <div className="mt-6 flex items-end justify-end gap-6">
              <span>성명: 홍길동</span>
              <span className="relative inline-flex items-end">
                (인)
                {/* 서명이 얹히는 자리 */}
                <span
                  className="absolute -top-14 left-1/2 h-20 w-28 -translate-x-1/2 overflow-hidden"
                  aria-hidden="true"
                >
                  {/* 아래=그대로, 위=보정본 — pos%로 잘라 보여줌 */}
                  {raw && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={raw}
                      alt=""
                      className="absolute left-0 top-0 h-20 w-28 object-contain"
                    />
                  )}
                  {clean && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={clean}
                      alt=""
                      className="absolute left-0 top-0 h-20 w-28 object-contain"
                      style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
                    />
                  )}
                </span>
                <span
                  className="pointer-events-none absolute -top-14 bottom-0 w-px"
                  style={{
                    left: `calc(50% - 56px + ${(pos / 100) * 112}px)`,
                    background: "var(--seal)",
                  }}
                />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 비교 슬라이더 */}
      <div className="border-t px-6 py-4" style={{ borderColor: "var(--ink-15)" }}>
        <div className="flex items-center justify-between text-xs" style={{ color: "var(--ink-60)" }}>
          <span>보정 후 — 배경·그림자 제거</span>
          <span>사진 그대로 — 흰 배경·그림자</span>
        </div>
        <input
          type="range"
          min={4}
          max={96}
          value={pos}
          onChange={(e) => setPos(+e.target.value)}
          aria-label="전후 비교 슬라이더"
          className="mt-2 w-full accent-[#c93a1e]"
        />
      </div>
    </div>
  );
}
