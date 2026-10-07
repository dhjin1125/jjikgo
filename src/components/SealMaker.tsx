"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generateSeal, type SealShape } from "@/lib/seal";
import type { Asset } from "@/lib/types";
import { uid } from "@/lib/types";

const SHAPES: { id: SealShape; label: string }[] = [
  { id: "circle", label: "원형" },
  { id: "oval", label: "타원형" },
  { id: "square", label: "사각형" },
];

export default function SealMaker({
  onAsset,
}: {
  onAsset: (a: Asset, save: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [shape, setShape] = useState<SealShape>("circle");
  const [seed, setSeed] = useState(42);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const last = useRef<{ dataUrl: string; aspect: number } | null>(null);

  const render = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 4) {
      setPreview(null);
      last.current = null;
      return;
    }
    setBusy(true);
    try {
      const out = await generateSeal({ name: trimmed, shape, seed });
      last.current = out;
      setPreview(out.dataUrl);
    } finally {
      setBusy(false);
    }
  }, [name, shape, seed]);

  useEffect(() => {
    const t = setTimeout(render, 200);
    return () => clearTimeout(t);
  }, [render]);

  const emit = (save: boolean) => {
    if (!last.current) return;
    onAsset(
      {
        id: uid(),
        kind: "seal",
        name: `${name.trim()} 도장`,
        dataUrl: last.current.dataUrl,
        aspect: last.current.aspect,
        createdAt: Date.now(),
      },
      save
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="block">
        <span className="mono-label">이름 (2~4자)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={4}
          placeholder="홍길동"
          className="mt-1.5 w-full rounded-sm border bg-white px-3 py-2.5 text-lg font-display font-bold"
          style={{ borderColor: "var(--ink-15)" }}
        />
      </label>

      <div>
        <span className="mono-label">모양</span>
        <div className="mt-1.5 flex gap-1.5">
          {SHAPES.map((s) => (
            <button
              key={s.id}
              onClick={() => setShape(s.id)}
              className="rounded-sm border px-3 py-2 text-sm font-medium"
              style={{
                borderColor: shape === s.id ? "var(--seal)" : "var(--ink-15)",
                background: shape === s.id ? "var(--seal-wash)" : "white",
                color: shape === s.id ? "var(--seal-deep)" : "var(--ink)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex items-center justify-center rounded-sm border bg-white p-4"
        style={{ borderColor: "var(--ink-15)", minHeight: 160 }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt={`${name} 도장 미리보기`}
            className="h-32 w-32 object-contain"
          />
        ) : (
          <p className="text-sm" style={{ color: "var(--ink-40)" }}>
            이름을 넣으면 도장이 만들어집니다
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          className="btn btn-outline text-sm"
          onClick={() => setSeed(Math.floor(Math.random() * 1e9))}
          disabled={!preview || busy}
        >
          잉크 다시 찍기
        </button>
        <button
          className="btn btn-primary flex-1 justify-center"
          onClick={() => emit(false)}
          disabled={!preview}
        >
          이 도장 사용
        </button>
      </div>
      <button
        className="btn btn-outline justify-center text-sm"
        onClick={() => emit(true)}
        disabled={!preview}
      >
        도장함에 저장하고 사용
      </button>
    </div>
  );
}
