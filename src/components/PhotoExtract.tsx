"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractInk } from "@/lib/imaging";
import type { Asset } from "@/lib/types";
import { uid } from "@/lib/types";

export default function PhotoExtract({
  onAsset,
}: {
  onAsset: (a: Asset, save: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [strength, setStrength] = useState(0.62);
  const [out, setOut] = useState<{ dataUrl: string; aspect: number } | null>(null);
  const [showOrig, setShowOrig] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    if (!imgRef.current) return;
    setBusy(true);
    try {
      setOut(await extractInk(imgRef.current, strength));
    } finally {
      setBusy(false);
    }
  }, [strength]);

  useEffect(() => {
    const t = setTimeout(run, 160);
    return () => clearTimeout(t);
  }, [run]);

  const emit = (save: boolean) => {
    if (!out) return;
    onAsset(
      {
        id: uid(),
        kind: "signature",
        name: "사진 서명",
        dataUrl: out.dataUrl,
        aspect: out.aspect,
        createdAt: Date.now(),
      },
      save
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const url = URL.createObjectURL(f);
          const img = new Image();
          img.onload = () => {
            imgRef.current = img;
            setSrc(url);
          };
          img.src = url;
          e.target.value = "";
        }}
      />

      {!src ? (
        <button
          className="rounded-sm border border-dashed bg-white px-4 py-10 text-center"
          style={{ borderColor: "var(--ink-40)" }}
          onClick={() => inputRef.current?.click()}
        >
          <p className="text-sm font-medium">서명·도장 사진 올리기</p>
          <p className="mt-1 text-xs" style={{ color: "var(--ink-40)" }}>
            흰 종이에 진하게 쓴 사진이 가장 잘 나옵니다
          </p>
        </button>
      ) : (
        <>
          <div
            className="relative flex items-center justify-center overflow-hidden rounded-sm border bg-white"
            style={{ borderColor: "var(--ink-15)", minHeight: 150 }}
          >
            {/* 투명 확인용 체크 무늬 */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(var(--ink-08) 0% 25%, white 0% 50%)",
                backgroundSize: "16px 16px",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={showOrig ? src : out?.dataUrl ?? ""}
              alt="서명 사진 보정 결과"
              className="relative z-10 max-h-44 object-contain p-3"
            />
          </div>

          <label className="block">
            <span className="mono-label flex justify-between">
              <span>배경 제거 강도</span>
              {busy && <span>보정 중…</span>}
            </span>
            <input
              type="range"
              min={0.3}
              max={0.9}
              step={0.02}
              value={strength}
              onChange={(e) => setStrength(+e.target.value)}
              className="mt-1 w-full accent-[#c93a1e]"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline px-3 py-1.5 text-xs"
              onMouseDown={() => setShowOrig(true)}
              onMouseUp={() => setShowOrig(false)}
              onMouseLeave={() => setShowOrig(false)}
              onTouchStart={() => setShowOrig(true)}
              onTouchEnd={() => setShowOrig(false)}
            >
              길게 눌러 원본 비교
            </button>
            <button
              className="btn btn-outline px-3 py-1.5 text-xs"
              onClick={() => {
                setSrc(null);
                setOut(null);
                imgRef.current = null;
              }}
            >
              다른 사진
            </button>
          </div>

          <div className="flex gap-2">
            <button
              className="btn btn-primary flex-1 justify-center"
              disabled={!out || busy}
              onClick={() => emit(false)}
            >
              이 서명 사용
            </button>
            <button
              className="btn btn-outline text-sm"
              disabled={!out || busy}
              onClick={() => emit(true)}
            >
              도장함에 저장
            </button>
          </div>
        </>
      )}
    </div>
  );
}
