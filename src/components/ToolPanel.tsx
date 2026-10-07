"use client";

import { useState } from "react";
import SealMaker from "./SealMaker";
import SignaturePad from "./SignaturePad";
import PhotoExtract from "./PhotoExtract";
import type { Asset } from "@/lib/types";

type Tab = "seal" | "draw" | "photo";

const TABS: { id: Tab; label: string }[] = [
  { id: "seal", label: "도장 만들기" },
  { id: "draw", label: "직접 서명" },
  { id: "photo", label: "사진에서 추출" },
];

export default function ToolPanel({
  onAsset,
}: {
  onAsset: (a: Asset, save: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>("seal");
  return (
    <div>
      <div className="flex border-b" style={{ borderColor: "var(--ink-15)" }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 px-2 py-2.5 text-[13px] font-medium"
            style={{
              color: tab === t.id ? "var(--seal-deep)" : "var(--ink-60)",
              borderBottom:
                tab === t.id ? "2px solid var(--seal)" : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-4">
        {tab === "seal" && <SealMaker onAsset={onAsset} />}
        {tab === "draw" && <SignaturePad onAsset={onAsset} />}
        {tab === "photo" && <PhotoExtract onAsset={onAsset} />}
      </div>
    </div>
  );
}
