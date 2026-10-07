"use client";

import { useRef, useState } from "react";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.hwp,.hwpx,.docx";

export default function Dropzone({
  onFile,
  compact = false,
}: {
  onFile: (f: File) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="문서 넣고 시작하기"
      className={`dropzone flex flex-col items-center justify-center text-center ${
        compact ? "px-6 py-8" : "px-8 py-12 sm:py-16"
      } ${dragging ? "dragging" : ""}`}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#c93a1e" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" strokeLinecap="round" />
      </svg>
      <p className={`font-display font-bold ${compact ? "text-lg mt-3" : "text-2xl mt-4"}`}>
        문서 넣고 시작하기
      </p>
      {!compact && (
        <p className="mt-2 text-sm" style={{ color: "var(--ink-60)" }}>
          끌어다 놓거나 눌러서 선택 — 가입 없이 바로 열립니다
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-1.5">
        {["PDF", "JPG", "PNG", "HWP", "HWPX", "DOCX"].map((f) => (
          <span
            key={f}
            className="mono-label rounded-full border px-2.5 py-1"
            style={{ borderColor: "var(--ink-15)" }}
          >
            {f}
          </span>
        ))}
      </div>
      {!compact && (
        <p className="mt-3 text-xs" style={{ color: "var(--ink-40)" }}>
          DOCX·HWPX는 원본 형식으로 저장 — 구형 HWP는 HWPX·PDF로 변환해 넣어주세요
        </p>
      )}
    </div>
  );
}
