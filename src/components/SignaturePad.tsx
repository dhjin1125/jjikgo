"use client";

import { useEffect, useRef, useState } from "react";
import type { Asset } from "@/lib/types";
import { uid } from "@/lib/types";

type Pt = { x: number; y: number; w: number };

export default function SignaturePad({
  onAsset,
}: {
  onAsset: (a: Asset, save: boolean) => void;
}) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Pt[][]>([]);
  const cur = useRef<Pt[] | null>(null);
  const [empty, setEmpty] = useState(true);
  const [color, setColor] = useState("#1c1b1a");

  const redraw = () => {
    const cv = cvRef.current!;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    const paint = (pts: Pt[]) => {
      if (pts.length < 2) {
        if (pts[0]) {
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, pts[0].w / 2, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
        return;
      }
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        ctx.beginPath();
        ctx.lineWidth = (p0.w + p1.w) / 2;
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    };
    strokes.current.forEach(paint);
    if (cur.current) paint(cur.current);
  };

  useEffect(() => {
    const cv = cvRef.current!;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = r.width * dpr;
    cv.height = r.height * dpr;
    cv.getContext("2d")!.scale(dpr, dpr);
  }, []);

  useEffect(redraw, [color]);

  const toLocal = (e: React.PointerEvent) => {
    const r = cvRef.current!.getBoundingClientRect();
    const p = Math.min(9, 2.5 + (e.pressure || 0.3) * 7);
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: p };
  };

  const exportPng = (): { dataUrl: string; aspect: number } | null => {
    const cv = cvRef.current!;
    const box = (() => {
      const ctx = cv.getContext("2d")!;
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0, ok = false;
      for (let y = 0; y < cv.height; y += 2)
        for (let x = 0; x < cv.width; x += 2)
          if (d[(y * cv.width + x) * 4 + 3] > 10) {
            ok = true;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (!ok) return null;
      const pad = 24;
      return {
        x: Math.max(0, x0 - pad),
        y: Math.max(0, y0 - pad),
        w: Math.min(cv.width, x1 + pad) - Math.max(0, x0 - pad),
        h: Math.min(cv.height, y1 + pad) - Math.max(0, y0 - pad),
      };
    })();
    if (!box) return null;
    const out = document.createElement("canvas");
    out.width = box.w;
    out.height = box.h;
    out.getContext("2d")!.drawImage(cv, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    return { dataUrl: out.toDataURL("image/png"), aspect: box.w / box.h };
  };

  const emit = (save: boolean) => {
    const png = exportPng();
    if (!png) return;
    onAsset(
      {
        id: uid(),
        kind: "signature",
        name: "그린 서명",
        dataUrl: png.dataUrl,
        aspect: png.aspect,
        createdAt: Date.now(),
      },
      save
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={cvRef}
        className="pad-canvas h-44 w-full rounded-sm border bg-white"
        style={{ borderColor: "var(--ink-15)" }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          cur.current = [toLocal(e)];
        }}
        onPointerMove={(e) => {
          if (!cur.current) return;
          cur.current.push(toLocal(e));
          redraw();
        }}
        onPointerUp={() => {
          if (cur.current?.length) {
            strokes.current.push(cur.current);
            setEmpty(false);
          }
          cur.current = null;
        }}
      />
      <div className="flex items-center gap-2">
        {["#1c1b1a", "#1d3fbf", "#c93a1e"].map((c) => (
          <button
            key={c}
            aria-label={`잉크 ${c}`}
            onClick={() => setColor(c)}
            className="h-6 w-6 rounded-full border"
            style={{
              background: c,
              borderColor: color === c ? "var(--ink)" : "var(--ink-15)",
              outline: color === c ? "2px solid var(--ink)" : "none",
              outlineOffset: 2,
            }}
          />
        ))}
        <div className="flex-1" />
        <button
          className="btn btn-outline px-3 py-1.5 text-xs"
          disabled={empty}
          onClick={() => {
            strokes.current.pop();
            setEmpty(!strokes.current.length);
            redraw();
          }}
        >
          되돌리기
        </button>
        <button
          className="btn btn-outline px-3 py-1.5 text-xs"
          disabled={empty}
          onClick={() => {
            strokes.current = [];
            setEmpty(true);
            redraw();
          }}
        >
          지우기
        </button>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary flex-1 justify-center" disabled={empty} onClick={() => emit(false)}>
          이 서명 사용
        </button>
        <button className="btn btn-outline text-sm" disabled={empty} onClick={() => emit(true)}>
          도장함에 저장
        </button>
      </div>
    </div>
  );
}
