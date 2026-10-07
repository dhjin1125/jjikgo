"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SealMark from "@/components/SealMark";
import SealMaker from "@/components/SealMaker";
import PhotoExtract from "@/components/PhotoExtract";
import SignaturePad from "@/components/SignaturePad";
import Dropzone from "@/components/Dropzone";
import { pendingFile } from "@/lib/pending";
import { addToVault } from "@/lib/vault";
import type { Asset } from "@/lib/types";

type ToolId = "seal" | "photo" | "draw" | "pdf" | "hwp" | "docx";

const TOOLS: Record<
  string,
  { id: ToolId; title: string; desc: string; tip: string }
> = {
  "make-seal": {
    id: "seal",
    title: "도장 만들기",
    desc: "이름만 넣으면 원형·타원형·사각형 도장이 만들어집니다. 인주 잉크 질감으로 찍은 것처럼 보입니다.",
    tip: "2~4자 이름이 가장 잘 어울립니다. ‘잉크 다시 찍기’로 찍힘 결을 바꿀 수 있습니다.",
  },
  "signature-cleanup": {
    id: "photo",
    title: "서명 배경 제거",
    desc: "종이에 쓴 서명·도장 사진을 올리면 배경과 그림자를 지우고 투명 PNG로 다듬습니다.",
    tip: "흰 종이에 진한 펜으로 쓴 사진이 가장 깔끔합니다. 강도 슬라이더로 조절하세요.",
  },
  "draw-sign": {
    id: "draw",
    title: "서명 직접 그리기",
    desc: "마우스나 터치로 서명을 그리면 바로 문서에 넣을 수 있는 PNG가 됩니다.",
    tip: "천천히 크게 그리는 편이 결과가 좋습니다. 되돌리기로 획 단위로 지울 수 있습니다.",
  },
  "pdf-sign": {
    id: "pdf",
    title: "PDF 서명 넣기",
    desc: "PDF를 넣으면 (인)·서명 자리를 자동으로 찾아 추천합니다. 도장·서명·날짜를 올리고 PDF로 저장합니다.",
    tip: "추천이 틀리면 문서 위를 직접 눌러 배치할 수 있습니다. 암호 걸린 PDF는 해제 후 이용하세요.",
  },
  "hwp-stamp": {
    id: "hwp",
    title: "한글 도장 넣기",
    desc: "HWP·HWPX 원본 형식 저장은 출시 전 호환성 검증 중입니다. 지금은 한글에서 PDF로 저장해 넣을 수 있습니다.",
    tip: "한글에서 ‘파일 → PDF로 저장하기’ 후 아래에 넣으면 바로 날인할 수 있습니다.",
  },
  "docx-sign": {
    id: "docx",
    title: "워드 서명 넣기",
    desc: "DOCX 원본 형식 저장은 출시 전 호환성 검증 중입니다. 지금은 워드에서 PDF로 저장해 넣을 수 있습니다.",
    tip: "워드에서 ‘다른 이름으로 저장 → PDF’ 후 아래에 넣으면 바로 서명할 수 있습니다.",
  },
};

export default function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const tool = TOOLS[slug];
  const router = useRouter();
  const [last, setLast] = useState<Asset | null>(null);

  if (!tool) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-2xl font-bold">없는 도구입니다</h1>
        <Link href="/" className="btn btn-ghost mt-6">
          찍고로 돌아가기
        </Link>
      </main>
    );
  }

  const isMaker = tool.id === "seal" || tool.id === "photo" || tool.id === "draw";
  const pick = (a: Asset, save: boolean) => {
    setLast(a);
    if (save) addToVault(a);
  };

  const downloadPng = () => {
    if (!last) return;
    const a = document.createElement("a");
    a.href = last.dataUrl;
    a.download = `${last.name || "찍고"}.png`;
    a.click();
  };

  return (
    <div>
      <header className="border-b" style={{ borderColor: "var(--ink-08)" }}>
        <div className="mx-auto flex h-14 max-w-[880px] items-center gap-3 px-6">
          <Link href="/" className="flex items-center gap-2">
            <SealMark size={24} />
            <span className="font-display text-lg font-black">찍고</span>
          </Link>
          <span className="mono-label">/ {tool.title}</span>
        </div>
      </header>

      <main className="mx-auto max-w-[880px] px-6 py-14">
        <h1 className="font-display text-3xl font-bold sm:text-4xl">{tool.title}</h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed" style={{ color: "var(--ink-60)" }}>
          {tool.desc}
        </p>

        <div className="sheet mt-8 p-6 sm:p-8">
          {tool.id === "seal" && <SealMaker onAsset={pick} />}
          {tool.id === "photo" && <PhotoExtract onAsset={pick} />}
          {tool.id === "draw" && <SignaturePad onAsset={pick} />}
          {(tool.id === "pdf" || tool.id === "hwp" || tool.id === "docx") && (
            <Dropzone
              onFile={(f) => {
                pendingFile.file = f;
                router.push("/editor");
              }}
              compact
            />
          )}
        </div>

        {isMaker && last && (
          <div className="stamp-in mt-4 flex items-center gap-3 rounded-sm border p-4" style={{ borderColor: "var(--seal)", background: "var(--seal-wash)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={last.dataUrl} alt={last.name} className="h-14 w-14 bg-white object-contain" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{last.name}</p>
              <p className="text-xs" style={{ color: "var(--ink-60)" }}>
                투명 배경 PNG — 문서에 올릴 준비가 됐습니다
              </p>
            </div>
            <button className="btn btn-outline text-sm" onClick={downloadPng}>
              PNG 저장
            </button>
            <button
              className="btn btn-primary text-sm"
              onClick={() => {
                pendingFile.asset = last;
                router.push("/editor");
              }}
            >
              문서에 넣기
            </button>
          </div>
        )}

        <p className="mt-6 text-xs leading-relaxed" style={{ color: "var(--ink-40)" }}>
          {tool.tip}
        </p>

        <div className="mt-10 border-t pt-8" style={{ borderColor: "var(--ink-08)" }}>
          <p className="mono-label mb-3">다른 도구</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TOOLS)
              .filter(([s]) => s !== slug)
              .map(([s, t]) => (
                <Link key={s} href={`/tools/${s}`} className="btn btn-outline text-sm">
                  {t.title}
                </Link>
              ))}
          </div>
        </div>
      </main>
    </div>
  );
}
