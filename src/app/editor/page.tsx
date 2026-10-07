"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Dropzone from "@/components/Dropzone";
import ToolPanel from "@/components/ToolPanel";
import SealMark from "@/components/SealMark";
import {
  loadPdf,
  renderPage,
  findSignatureSpots,
  exportPdf,
  download,
  PdfPasswordError,
  type PdfDoc,
} from "@/lib/pdf";
import { makeSampleDoc, SAMPLE_SPOTS } from "@/lib/sampleDoc";
import { pendingFile } from "@/lib/pending";
import { loadVault, addToVault, removeFromVault } from "@/lib/vault";
import { fetchMe, pullVault, pushVault, recordUsage, type Me } from "@/lib/account";
import { textToPng } from "@/lib/imaging";
import {
  loadDocx,
  renderDocxPreview,
  findPreviewSpots,
  paraIndexAt,
  exportDocx,
} from "@/lib/docx";
import { loadHwpx, exportHwpx, type HwpxDoc } from "@/lib/hwpx";
import {
  loadTemplates,
  saveTemplate,
  removeTemplate,
  templatePlacements,
  type Template,
} from "@/lib/templates";
import { runBatch, type BatchResult } from "@/lib/batch";
import type JSZip from "jszip";
import type { Asset, Placement, SignatureSpot } from "@/lib/types";
import { uid } from "@/lib/types";

type DocState =
  | { kind: "pdf"; pdf: PdfDoc; fileName: string }
  | {
      kind: "image";
      img: HTMLImageElement;
      w: number;
      h: number;
      fileName: string;
      sample?: boolean;
    }
  | {
      kind: "docx";
      fileName: string;
      bytes: ArrayBuffer;
      zip: JSZip;
      xmlDoc: Document;
    }
  | { kind: "hwpx"; fileName: string; doc: HwpxDoc }
  | { kind: "unsupported"; fileName: string; reason: string }
  | null;

const EXT_OK = ["pdf", "jpg", "jpeg", "png", "docx", "hwpx"];
const EXT_SOON = ["hwp"]; // 바이너리 HWP는 서버 변환기 필요 — 계속 검증 중

export default function EditorPage() {
  const router = useRouter();
  const [doc, setDoc] = useState<DocState>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [scale, setScale] = useState(1);
  const [spots, setSpots] = useState<SignatureSpot[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [vault, setVault] = useState<Asset[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedPl, setSelectedPl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showTools, setShowTools] = useState(false); // 모바일 하단 시트
  const [templates, setTemplates] = useState<Template[]>([]);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<BatchResult[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docxRef = useRef<HTMLDivElement>(null);
  const [docxSize, setDocxSize] = useState({ w: 1, h: 1 });
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const spotsCache = useRef(new Map<number, SignatureSpot[]>());
  const drag = useRef<{
    id: string;
    mode: "move" | "resize" | "rotate";
    sx: number; sy: number;
    ox: number; oy: number; ow: number; oh: number; orot: number;
  } | null>(null);

  /* ---------- 파일 열기 ---------- */
  const openFile = useCallback(async (f: File) => {
    setErr(null);
    setLoading(true);
    setPlacements([]);
    setSelectedPl(null);
    setPage(0);
    spotsCache.current.clear();
    try {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (ext === "pdf") {
        setDoc({ kind: "pdf", pdf: await loadPdf(f), fileName: f.name });
      } else if (ext === "docx") {
        const bytes = await f.arrayBuffer();
        const { zip, xmlDoc } = await loadDocx(bytes);
        setDoc({ kind: "docx", fileName: f.name, bytes, zip, xmlDoc });
      } else if (ext === "hwpx") {
        setDoc({
          kind: "hwpx",
          fileName: f.name,
          doc: await loadHwpx(await f.arrayBuffer()),
        });
      } else if (EXT_OK.includes(ext)) {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = URL.createObjectURL(f);
        });
        setDoc({ kind: "image", img, w: img.naturalWidth, h: img.naturalHeight, fileName: f.name });
      } else if (EXT_SOON.includes(ext)) {
        setDoc({
          kind: "unsupported",
          fileName: f.name,
          reason: `구형 한글(HWP) 바이너리는 별도 변환 서버가 필요해 검증 중입니다. 한글에서 HWPX 또는 PDF로 저장하면 바로 이용할 수 있습니다.`,
        });
      } else {
        setDoc({
          kind: "unsupported",
          fileName: f.name,
          reason: "지원하지 않는 형식입니다. PDF·JPG·PNG·DOCX·HWPX를 넣어주세요.",
        });
      }
    } catch (e) {
      if (e instanceof PdfPasswordError)
        setErr("암호가 걸린 PDF입니다. 암호를 해제한 뒤 다시 넣어주세요.");
      else setErr("파일을 읽지 못했습니다. 손상되지 않은 문서인지 확인해주세요.");
      setDoc(null);
    } finally {
      setLoading(false);
    }
  }, []);

  /* 랜딩에서 넘어온 파일/샘플 */
  useEffect(() => {
    setVault(loadVault());
    setTemplates(loadTemplates());
    void fetchMe().then(async (m) => {
      setMe(m);
      if (m) {
        const merged = await pullVault(loadVault());
        setVault(merged);
      }
    });
    if (pendingFile.asset) {
      const a = pendingFile.asset;
      pendingFile.asset = null;
      setAssets((l) => [a, ...l]);
      setSelectedAsset(a.id);
    }
    if (pendingFile.file) {
      const f = pendingFile.file;
      pendingFile.file = null;
      void openFile(f);
    } else if (pendingFile.sample) {
      pendingFile.sample = false;
      setLoading(true);
      void makeSampleDoc().then(({ dataUrl }) => {
        const img = new Image();
        img.onload = () =>
          setDoc({ kind: "image", img, w: img.naturalWidth, h: img.naturalHeight, fileName: "샘플 위임장", sample: true });
        img.src = dataUrl;
        setLoading(false);
      });
    }
  }, [openFile]);

  /* ---------- 페이지 렌더 + 배율 ---------- */
  const pageUnit = useCallback((): { w: number; h: number } => {
    if (!doc) return { w: 1, h: 1 };
    if (doc.kind === "pdf") return doc.pdf.sizes[page] ?? { w: 1, h: 1 };
    if (doc.kind === "image") return { w: doc.w, h: doc.h };
    if (doc.kind === "docx") return docxSize;
    return { w: 1, h: 1 };
  }, [doc, page, docxSize]);

  useEffect(() => {
    if (!doc || doc.kind === "unsupported" || doc.kind === "hwpx" || !wrapRef.current) return;
    const cw = Math.min(wrapRef.current.clientWidth - 32, 880);

    if (doc.kind === "docx") {
      // 미리보기를 원래 크기로 렌더한 뒤 측정 → 스테이지는 transform scale
      const el = docxRef.current!;
      void renderDocxPreview(doc.bytes, el).then(() => {
        const wrap = el.firstElementChild as HTMLElement | null;
        const w = wrap?.offsetWidth || el.scrollWidth || 794;
        const h = wrap?.offsetHeight || el.scrollHeight || 1123;
        setDocxSize({ w, h });
        const s = Math.min(cw / w, 2.5);
        setScale(s);
        setSpots(
          findPreviewSpots(el).map((sp) => ({
            page: 0,
            x: sp.x + sp.h * 0.9,
            y: sp.y,
            r: sp.h * 1.5,
            label: sp.label,
            para: sp.paraIndex,
          }))
        );
      });
      return;
    }

    const u = pageUnit();
    const s = Math.min(cw / u.w, 2.5);
    setScale(s);

    const cv = canvasRef.current!;
    if (doc.kind === "pdf") {
      void renderPage(doc.pdf.doc, page + 1, s, cv).then(async () => {
        if (!spotsCache.current.has(page)) {
          spotsCache.current.set(page, await findSignatureSpots(doc.pdf.doc, page + 1));
        }
        setSpots(spotsCache.current.get(page)!);
      });
    } else {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = doc.w * s * dpr;
      cv.height = doc.h * s * dpr;
      cv.style.width = `${doc.w * s}px`;
      cv.style.height = `${doc.h * s}px`;
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, doc.w * s, doc.h * s);
      ctx.drawImage(doc.img, 0, 0, doc.w * s, doc.h * s);
      // 샘플 문서에만 미리 잡아둔 서명란을 보여준다 — 일반 이미지는 텍스트 인식이 없어 직접 배치
      setSpots(doc.sample ? SAMPLE_SPOTS.map((sp) => ({ ...sp })) : []);
    }
  }, [doc, page, pageUnit]);

  /* ---------- 배치 ---------- */
  const toUnit = (clientX: number, clientY: number) => {
    const r = stageRef.current!.getBoundingClientRect();
    const isImg = doc?.kind === "image";
    const u = pageUnit();
    if (isImg)
      return {
        x: (clientX - r.left) / (u.w * scale),
        y: (clientY - r.top) / (u.h * scale),
      };
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  };

  const assetOf = (id: string | null) =>
    [...assets, ...vault].find((a) => a.id === id);

  const placeAt = (cx: number, cy: number, wUnit: number, para?: number) => {
    const a = assetOf(selectedAsset);
    if (!a) return;
    const h = wUnit / a.aspect;
    const pl: Placement = {
      id: uid(),
      assetId: a.id,
      page,
      x: cx - wUnit / 2,
      y: cy - h / 2,
      w: wUnit,
      h,
      rot: 0,
      para,
    };
    setPlacements((p) => [...p, pl]);
    setSelectedPl(pl.id);
  };

  const defaultSize = (a: Asset) => {
    if (doc?.kind === "image") {
      return a.kind === "seal" ? 0.09 : a.kind === "text" ? 0.16 : 0.22; // 너비 비율
    }
    if (doc?.kind === "docx") {
      const w = docxSize.w;
      return a.kind === "seal" ? w * 0.085 : a.kind === "text" ? w * 0.18 : w * 0.22;
    }
    return a.kind === "seal" ? 58 : a.kind === "text" ? 110 : 150; // pt
  };

  const onStagePointerDown = (e: React.PointerEvent) => {
    const tgt = e.target as HTMLElement;
    const inDocxPreview =
      doc?.kind === "docx" && docxRef.current?.contains(tgt);
    if (
      e.target !== stageRef.current &&
      tgt.tagName !== "CANVAS" &&
      !inDocxPreview
    )
      return;
    if (!selectedAsset) {
      setSelectedPl(null);
      return;
    }
    const p = toUnit(e.clientX, e.clientY);
    const a = assetOf(selectedAsset)!;
    if (doc?.kind === "docx" && docxRef.current) {
      // 워드는 문단에 연결해 삽입한다 — 클릭한 문단을 찾아 표시 위치를 문단 끝으로
      const pi = paraIndexAt(docxRef.current, e.clientX, e.clientY);
      if (pi < 0) {
        setErr("문단 위를 눌러주세요. 워드 문서는 텍스트가 있는 문단에 도장이 삽입됩니다.");
        return;
      }
      setErr(null);
      const pEl = docxRef.current.querySelectorAll("p")[pi];
      const pr = pEl.getBoundingClientRect();
      const sr = stageRef.current!.getBoundingClientRect();
      const cx = (pr.right - sr.left) / scale;
      const cy = (pr.top + pr.height / 2 - sr.top) / scale;
      placeAt(cx, cy, defaultSize(a), pi);
      return;
    }
    placeAt(p.x, p.y, defaultSize(a));
  };

  const startDrag = (e: React.PointerEvent, pl: Placement, mode: "move" | "resize" | "rotate") => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedPl(pl.id);
    const p = toUnit(e.clientX, e.clientY);
    drag.current = {
      id: pl.id, mode, sx: p.x, sy: p.y,
      ox: pl.x, oy: pl.y, ow: pl.w, oh: pl.h, orot: pl.rot,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toUnit(e.clientX, e.clientY);
    setPlacements((list) =>
      list.map((pl) => {
        if (pl.id !== d.id) return pl;
        if (d.mode === "move")
          return { ...pl, x: d.ox + (p.x - d.sx), y: d.oy + (p.y - d.sy) };
        if (d.mode === "resize") {
          const nw = Math.max(d.ow * 0.3, d.ow + (p.x - d.sx));
          return { ...pl, w: nw, h: nw / (d.ow / d.oh) };
        }
        // rotate: 중심 기준 각도
        const cx = d.ox + d.ow / 2;
        const cy = d.oy + d.oh / 2;
        const a0 = Math.atan2(d.sy - cy, d.sx - cx);
        const a1 = Math.atan2(p.y - cy, p.x - cx);
        return { ...pl, rot: d.orot + ((a1 - a0) * 180) / Math.PI };
      })
    );
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    // 워드: 이동한 뒤 놓인 자리의 문단으로 삽입 대상 갱신
    if (d?.mode === "move" && doc?.kind === "docx" && docxRef.current) {
      const pi = paraIndexAt(docxRef.current, e.clientX, e.clientY);
      if (pi >= 0)
        setPlacements((l) =>
          l.map((pl) => (pl.id === d.id ? { ...pl, para: pi } : pl))
        );
    }
  };

  const placeOnSpot = (s: SignatureSpot) => {
    const a = assetOf(selectedAsset);
    if (!a) return;
    placeAt(s.x, s.y, s.r * 2, s.para);
  };

  /* ----------보내기 ---------- */
  const doExport = async (as: "pdf" | "png") => {
    if (!doc || doc.kind === "unsupported" || !placements.length) return;
    setExporting(true);
    try {
      if (me) {
        const msg = await recordUsage(
          doc.kind,
          doc.kind === "pdf" ? doc.pdf.numPages : 1
        );
        if (msg) {
          setErr(msg);
          return;
        }
      }
      const assetMap = new Map([...assets, ...vault].map((a) => [a.id, a]));
      const getAsset = (id: string) => assetMap.get(id);
      const base = doc.fileName.replace(/\.[^.]+$/, "");

      if (doc.kind === "pdf") {
        const bytes = await exportPdf(doc.pdf.doc, doc.pdf.bytes, placements, getAsset);
        download(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${base}-날인.pdf`);
      } else if (doc.kind === "docx") {
        const pageWmm = 210; // 표시 너비 비율→mm (A4 기준 근사 — 실제 여백 포함 너비)
        const bytes = await exportDocx(
          doc.zip,
          placements
            .filter((p) => p.para !== undefined && p.para >= 0)
            .map((p) => ({
              assetId: p.assetId,
              paraIndex: p.para!,
              widthMm: Math.max(8, (p.w / docxSize.w) * pageWmm),
            })),
          getAsset
        );
        download(
          new Blob([bytes as BlobPart], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          `${base}-날인.docx`
        );
      } else if (doc.kind === "hwpx") {
        const paras = doc.doc.paras;
        const bytes = await exportHwpx(
          doc.doc,
          placements
            .filter((p) => p.para !== undefined && paras[p.para!])
            .map((p) => ({
              assetId: p.assetId,
              section: paras[p.para!].section,
              paraIndex: paras[p.para!].paraIndex,
              widthMm: p.w, // hwpx는 w를 mm로 저장
            })),
          getAsset
        );
        download(
          new Blob([bytes as BlobPart], { type: "application/octet-stream" }),
          `${base}-날인.hwpx`
        );
      } else {
        // 이미지: 원본 해상도로 합성
        const cv = document.createElement("canvas");
        cv.width = doc.w;
        cv.height = doc.h;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(doc.img, 0, 0);
        const imgs = await Promise.all(
          placements.map(async (pl) => {
            const a = getAsset(pl.assetId)!;
            const im = new Image();
            await new Promise((r) => {
              im.onload = r;
              im.src = a.dataUrl;
            });
            return { pl, im };
          })
        );
        for (const { pl, im } of imgs) {
          const px = pl.x * doc.w, py = pl.y * doc.h;
          const pw = pl.w * doc.w, ph = pl.h * doc.h;
          ctx.save();
          ctx.translate(px + pw / 2, py + ph / 2);
          ctx.rotate((pl.rot * Math.PI) / 180);
          ctx.drawImage(im, -pw / 2, -ph / 2, pw, ph);
          ctx.restore();
        }
        if (as === "png") {
          const blob = await new Promise<Blob>((r) => cv.toBlob((b) => r(b!), "image/png"));
          download(blob, `${base}-날인.png`);
        } else {
          const { PDFDocument } = await import("pdf-lib");
          const out = await PDFDocument.create();
          const png = await out.embedPng(cv.toDataURL("image/png"));
          const pg = out.addPage([doc.w, doc.h]);
          pg.drawImage(png, { x: 0, y: 0, width: doc.w, height: doc.h });
          const bytes = await out.save();
          download(new Blob([bytes as BlobPart], { type: "application/pdf" }), `${base}-날인.pdf`);
        }
      }
    } finally {
      setExporting(false);
    }
  };

  const addAsset = (a: Asset, save: boolean) => {
    setAssets((l) => [a, ...l]);
    if (save) {
      const next = addToVault(a);
      setVault(next);
      if (me)
        void pushVault(next).then((msg) => msg && setSyncNote(msg));
    }
    setSelectedAsset(a.id);
  };

  const removeVaultAsset = (id: string) => {
    const next = removeFromVault(id);
    setVault(next);
    if (me) void pushVault(next);
  };

  const addTextAsset = async (kind: "name" | "date") => {
    const today = new Date();
    const text =
      kind === "date"
        ? `${today.getFullYear()}. ${today.getMonth() + 1}. ${today.getDate()}.`
        : (prompt("문서에 넣을 이름을 입력하세요") ?? "").trim();
    if (!text) return;
    const png = await textToPng(text);
    addAsset(
      { id: uid(), kind: "text", name: text, dataUrl: png.dataUrl, aspect: png.aspect, createdAt: Date.now() },
      false
    );
  };

  /* ---------- 반복 서식 ---------- */
  const saveAsTemplate = () => {
    if (!doc || doc.kind === "unsupported" || !placements.length) return;
    const name = prompt("이 서식의 이름 (예: 용역계약서)")?.trim();
    if (!name) return;
    const pls =
      doc.kind === "docx"
        ? placements.map((p) => ({
            ...p,
            w: (p.w / docxSize.w) * 210,
            h: (p.h / docxSize.w) * 210,
          }))
        : placements;
    setTemplates(saveTemplate(name, doc.kind, pls, assetOf));
  };

  const applyTemplate = (t: Template) => {
    if (!doc || doc.kind === "unsupported") return;
    if (doc.kind !== t.docKind) {
      setErr(`이 서식은 ${t.docKind.toUpperCase()}용입니다. 같은 형식의 문서에 적용하세요.`);
      return;
    }
    setErr(null);
    setAssets((l) => [
      ...t.assets.filter((a) => !l.some((x) => x.id === a.id)),
      ...l,
    ]);
    const pls = templatePlacements(t).map((p) =>
      doc.kind === "docx"
        ? { ...p, w: (p.w / 210) * docxSize.w, h: (p.h / 210) * docxSize.w }
        : p
    );
    setPlacements(pls);
  };

  const runBatchFiles = async (t: Template, files: File[]) => {
    setBatchResults(null);
    setBatchProgress(`0 / ${files.length}`);
    const { results, zipBytes } = await runBatch(files, t, (d, n) =>
      setBatchProgress(`${d} / ${n}`)
    );
    const okCount = results.filter((r) => r.ok).length;
    if (okCount)
      download(
        new Blob([zipBytes as BlobPart], { type: "application/zip" }),
        `날인-${okCount}건.zip`
      );
    setBatchResults(results);
    setBatchProgress(null);
  };

  const pagePlacements = placements.filter((p) => p.page === page);
  const u = pageUnit();
  const isImg = doc?.kind === "image";
  const spotX = (s: SignatureSpot) => (isImg ? s.x * u.w : s.x);
  const spotY = (s: SignatureSpot) => (isImg ? s.y * u.h : s.y);
  const spotR = (s: SignatureSpot) => (isImg ? s.r * u.w : s.r);

  /* ---------- 화면 ---------- */
  return (
    <div className="flex min-h-screen flex-col">
      {/* 상단 바 */}
      <header
        className="flex items-center gap-3 border-b bg-white px-4 py-2.5"
        style={{ borderColor: "var(--ink-15)" }}
      >
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2"
          aria-label="처음으로"
        >
          <SealMark size={26} />
          <span className="font-display text-lg font-black">찍고</span>
        </button>
        {doc && doc.kind !== "unsupported" && (
          <>
            <span className="mono-label hidden sm:inline">{doc.fileName}</span>
            <span className="flex-1" />
            <button
              className="btn btn-ghost px-3 py-1.5 text-sm no-underline"
              onClick={() => {
                setDoc(null);
                setPlacements([]);
                setErr(null);
              }}
            >
              다른 문서
            </button>
            {doc.kind === "image" ? (
              <div className="flex gap-1.5">
                <button className="btn btn-outline text-sm" onClick={() => doExport("png")} disabled={!placements.length || exporting}>
                  PNG 저장
                </button>
                <button className="btn btn-primary py-2 text-sm" onClick={() => doExport("pdf")} disabled={!placements.length || exporting}>
                  {exporting ? "저장 중…" : "PDF로 저장"}
                </button>
              </div>
            ) : doc.kind === "docx" ? (
              <button className="btn btn-primary py-2 text-sm" onClick={() => doExport("pdf")} disabled={!placements.length || exporting}>
                {exporting ? "저장 중…" : "완성본 DOCX 저장"}
              </button>
            ) : doc.kind === "hwpx" ? (
              <button className="btn btn-primary py-2 text-sm" onClick={() => doExport("pdf")} disabled={!placements.length || exporting}>
                {exporting ? "저장 중…" : "완성본 HWPX 저장"}
              </button>
            ) : (
              <button className="btn btn-primary py-2 text-sm" onClick={() => doExport("pdf")} disabled={!placements.length || exporting}>
                {exporting ? "저장 중…" : "완성본 PDF 저장"}
              </button>
            )}
          </>
        )}
        {(!doc || doc.kind === "unsupported") && <span className="flex-1" />}
        {me ? (
          <span className="mono-label" title={me.email ?? me.provider}>
            {me.name || me.email || "계정"} 님
          </span>
        ) : (
          <a href="/login" className="mono-label hover:text-ink">
            로그인
          </a>
        )}
      </header>

      {/* 본문 */}
      {!doc ? (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
          {err && (
            <p className="mb-4 rounded-sm border px-4 py-3 text-sm" style={{ borderColor: "var(--error)", color: "var(--error)" }}>
              {err}
            </p>
          )}
          {loading ? (
            <div className="sheet p-10">
              <p className="mono-label mb-3">문서 여는 중</p>
              <div className="progress-line"><i style={{ width: "60%" }} /></div>
            </div>
          ) : (
            <>
              <h1 className="font-display mb-6 text-center text-2xl font-bold">
                문서를 넣으면 바로 시작합니다
              </h1>
              <Dropzone onFile={openFile} />
              {templates.length > 0 && (
                <details className="sheet mt-4 p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    같은 양식 여러 장 — 일괄 처리
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed" style={{ color: "var(--ink-60)" }}>
                    저장해 둔 반복 서식을 여러 문서에 한꺼번에 찍고 ZIP으로 받습니다.
                    양식이 다른 문서는 개별 처리로 전환하세요.
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {templates.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">
                          {t.name} <span className="mono-label">{t.docKind.toUpperCase()}</span>
                        </span>
                        <label className="btn btn-outline px-2.5 py-1 text-xs">
                          {batchProgress ? `처리 중 ${batchProgress}` : "파일 선택"}
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.docx,.hwpx"
                            className="hidden"
                            disabled={!!batchProgress}
                            onChange={(e) => {
                              const fs = Array.from(e.target.files ?? []);
                              e.target.value = "";
                              if (fs.length) void runBatchFiles(t, fs);
                            }}
                          />
                        </label>
                      </div>
                    ))}
                    {batchResults && (
                      <ul className="mt-1 text-xs leading-relaxed" style={{ color: "var(--ink-60)" }}>
                        {batchResults.map((r, i) => (
                          <li key={i} style={{ color: r.ok ? "var(--success)" : "var(--error)" }}>
                            {r.name} — {r.ok ? "완료" : `실패: ${r.error}`}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              )}
              <button
                className="btn btn-ghost mt-4 self-center text-sm"
                onClick={() => {
                  setLoading(true);
                  void makeSampleDoc().then(({ dataUrl }) => {
                    const img = new Image();
                    img.onload = () =>
                      setDoc({ kind: "image", img, w: img.naturalWidth, h: img.naturalHeight, fileName: "샘플 위임장", sample: true });
                    img.src = dataUrl;
                    setLoading(false);
                  });
                }}
              >
                샘플로 체험하기
              </button>
            </>
          )}
        </main>
      ) : doc.kind === "unsupported" ? (
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-16">
          <div className="sheet p-8">
            <p className="mono-label mb-2" style={{ color: "var(--warning)" }}>지원 검증 중</p>
            <h2 className="font-display text-xl font-bold">{doc.fileName}</h2>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-60)" }}>
              {doc.reason}
              <br />
              지금은 <strong className="font-semibold" style={{ color: "var(--ink)" }}>PDF·JPG·PNG</strong>를 바로
              처리할 수 있습니다. 한글·워드 파일은 해당 프로그램에서
              <em className="font-medium not-italic"> ‘다른 이름으로 저장 → PDF’</em> 하면
              그대로 이용할 수 있습니다.
            </p>
            <div className="mt-6">
              <Dropzone onFile={openFile} compact />
            </div>
          </div>
        </main>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* 데스크톱: 페이지 목록 */}
          {doc.kind === "pdf" && doc.pdf.numPages > 1 && (
            <aside
              className="nice-scroll hidden w-28 flex-col gap-2 overflow-y-auto border-r p-3 md:flex"
              style={{ borderColor: "var(--ink-15)" }}
            >
              {doc.pdf.sizes.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className="rounded-sm border bg-white p-1 text-center"
                  style={{ borderColor: page === i ? "var(--seal)" : "var(--ink-15)" }}
                >
                  <div
                    className="mx-auto bg-white"
                    style={{
                      width: 64,
                      height: (64 * s.h) / s.w,
                      border: "1px solid var(--ink-08)",
                      position: "relative",
                    }}
                  >
                    {placements.filter((p) => p.page === i).length > 0 && (
                      <SealMark size={14} glyph={false} className="absolute bottom-1 right-1" />
                    )}
                  </div>
                  <span className="mono-label">{i + 1}</span>
                </button>
              ))}
            </aside>
          )}

          {/* 문서 스테이지 */}
          {doc.kind === "hwpx" ? (
            <HwpxPane
              doc={doc.doc}
              placements={placements}
              assetOf={assetOf}
              selectedAsset={selectedAsset}
              selectedPl={selectedPl}
              setSelectedPl={setSelectedPl}
              onInsert={(para) => {
                const a = assetOf(selectedAsset);
                if (!a) return;
                const wmm = a.kind === "seal" ? 18 : a.kind === "text" ? 30 : 40;
                const pl: Placement = {
                  id: uid(),
                  assetId: a.id,
                  page: 0,
                  x: 0,
                  y: 0,
                  w: wmm,
                  h: wmm / a.aspect,
                  rot: 0,
                  para,
                };
                setPlacements((p) => [...p, pl]);
                setSelectedPl(pl.id);
              }}
              onResize={(id, mm) =>
                setPlacements((l) =>
                  l.map((p) =>
                    p.id === id
                      ? { ...p, w: mm, h: mm / (p.w / p.h) }
                      : p
                  )
                )
              }
              onRemove={(id) =>
                setPlacements((l) => l.filter((p) => p.id !== id))
              }
            />
          ) : (
          <div
            ref={wrapRef}
            className="nice-scroll flex-1 overflow-auto p-4"
            style={{ background: "var(--paper)" }}
          >
            <div
              ref={stageRef}
              className="sheet relative mx-auto"
              style={{
                width: u.w * scale,
                height: u.h * scale,
                touchAction: "none",
              }}
              onPointerDown={onStagePointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {doc.kind === "docx" ? (
                <div
                  ref={docxRef}
                  className="docx-holder absolute left-0 top-0 origin-top-left"
                  style={{ transform: `scale(${scale})` }}
                />
              ) : (
                <canvas ref={canvasRef} className="absolute inset-0" />
              )}

              {/* 서명란 추천 마커 */}
              {spots.map((s, i) => (
                <button
                  key={i}
                  className="absolute z-10 flex items-center justify-center rounded-full border-2 border-dashed text-[10px] font-bold"
                  style={{
                    left: spotX(s) * scale - spotR(s) * scale,
                    top: spotY(s) * scale - spotR(s) * scale,
                    width: spotR(s) * 2 * scale,
                    height: spotR(s) * 2 * scale,
                    borderColor: "var(--seal)",
                    color: "var(--seal-deep)",
                    background: "rgba(251,234,228,.55)",
                  }}
                  title={`${s.label} — 여기에 찍기`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    placeOnSpot(s);
                  }}
                >
                  인
                </button>
              ))}

              {/* 배치된 도장·서명 */}
              {pagePlacements.map((pl) => {
                const a = assetOf(pl.assetId);
                if (!a) return null;
                const sel = pl.id === selectedPl;
                return (
                  <div
                    key={pl.id}
                    className={`placement stamp-in ${sel ? "selected" : ""}`}
                    style={{
                      left: pl.x * scale,
                      top: pl.y * scale,
                      width: pl.w * scale,
                      height: pl.h * scale,
                      transform: `rotate(${pl.rot}deg)`,
                    }}
                    onPointerDown={(e) => startDrag(e, pl, "move")}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.dataUrl}
                      alt={a.name}
                      draggable={false}
                      className="h-full w-full object-contain select-none"
                    />
                    {sel && (
                      <>
                        {doc.kind !== "docx" && (
                          <span
                            className="handle handle-rot"
                            onPointerDown={(e) => startDrag(e, pl, "rotate")}
                          />
                        )}
                        <span
                          className="handle handle-se"
                          onPointerDown={(e) => startDrag(e, pl, "resize")}
                        />
                        <button
                          className="handle-del"
                          aria-label="삭제"
                          onClick={() => {
                            setPlacements((l) => l.filter((x) => x.id !== pl.id));
                            setSelectedPl(null);
                          }}
                          onPointerDown={(e) => e.stopPropagation()}
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 페이지 이동 (모바일/공통) */}
            {doc.kind === "pdf" && doc.pdf.numPages > 1 && (
              <div className="mt-3 flex items-center justify-center gap-3 md:hidden">
                <button className="btn btn-outline px-3 py-1.5 text-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
                <span className="mono-label">{page + 1} / {doc.pdf.numPages}</span>
                <button className="btn btn-outline px-3 py-1.5 text-sm" disabled={page === doc.pdf.numPages - 1} onClick={() => setPage(page + 1)}>다음</button>
              </div>
            )}
            {err && (
              <p className="mt-4 text-center text-sm" style={{ color: "var(--warning)" }}>{err}</p>
            )}
            {selectedAsset && !placements.length && (
              <p className="mt-4 text-center text-sm" style={{ color: "var(--ink-60)" }}>
                문서 위를 눌러 놓거나, 빨간 <b style={{ color: "var(--seal-deep)" }}>(인)</b> 표시를 눌러 추천 자리에 찍으세요.
              </p>
            )}
          </div>
          )}

          {/* 우측 도구 패널 — 데스크톱 */}
          <aside
            className="nice-scroll hidden w-80 flex-col gap-5 overflow-y-auto border-l bg-white p-4 lg:flex"
            style={{ borderColor: "var(--ink-15)" }}
          >
            <EditorSide
              assets={assets}
              vault={vault}
              selectedAsset={selectedAsset}
              setSelectedAsset={setSelectedAsset}
              removeVaultAsset={removeVaultAsset}
              addAsset={addAsset}
              addTextAsset={addTextAsset}
              placements={placements}
              templates={templates}
              saveAsTemplate={saveAsTemplate}
              applyTemplate={applyTemplate}
              removeTemplate={(id) => setTemplates(removeTemplate(id))}
              syncNote={syncNote}
            />
          </aside>
        </div>
      )}

      {/* 모바일 하단 도구 */}
      {doc && doc.kind !== "unsupported" && (
        <div
          className="border-t bg-white lg:hidden"
          style={{ borderColor: "var(--ink-15)" }}
        >
          <button
            className="mono-label flex w-full items-center justify-between px-4 py-3"
            onClick={() => setShowTools(!showTools)}
          >
            <span>도장·서명 도구 {selectedAsset ? "" : "— 먼저 만들거나 고르세요"}</span>
            <span>{showTools ? "닫기 ▾" : "열기 ▴"}</span>
          </button>
          {showTools && (
            <div className="nice-scroll max-h-[55vh] overflow-y-auto px-4 pb-5">
              <EditorSide
                assets={assets}
                vault={vault}
                selectedAsset={selectedAsset}
                setSelectedAsset={(id) => {
                  setSelectedAsset(id);
                  setShowTools(false);
                }}
                removeVaultAsset={removeVaultAsset}
                addAsset={addAsset}
                addTextAsset={addTextAsset}
                placements={placements}
                templates={templates}
                saveAsTemplate={saveAsTemplate}
                applyTemplate={applyTemplate}
                removeTemplate={(id) => setTemplates(removeTemplate(id))}
                syncNote={syncNote}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* 우측/하단 공용 도구 영역 */
function EditorSide({
  assets,
  vault,
  selectedAsset,
  setSelectedAsset,
  removeVaultAsset,
  addAsset,
  addTextAsset,
  placements,
  templates,
  saveAsTemplate,
  applyTemplate,
  removeTemplate,
  syncNote,
}: {
  assets: Asset[];
  vault: Asset[];
  selectedAsset: string | null;
  setSelectedAsset: (id: string) => void;
  removeVaultAsset: (id: string) => void;
  addAsset: (a: Asset, save: boolean) => void;
  addTextAsset: (kind: "name" | "date") => void;
  placements: Placement[];
  templates: Template[];
  saveAsTemplate: () => void;
  applyTemplate: (t: Template) => void;
  removeTemplate: (id: string) => void;
  syncNote: string | null;
}) {
  return (
    <>
      {/* 현재 작업 + 도장함 자산 */}
      <section>
        <p className="mono-label mb-2">내 도장·서명</p>
        {[...assets, ...vault].length === 0 ? (
          <p className="text-xs leading-relaxed" style={{ color: "var(--ink-40)" }}>
            아래에서 도장을 만들거나 서명을 준비하세요.
            <br />만든 것은 이 목록에 쌓입니다.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* 도장함 저장 항목은 작업 목록과 id로 중복 제거 */}
            {[...assets, ...vault.filter((v) => !assets.some((a) => a.id === v.id))].map((a) => (
              <div key={a.id} className="group relative">
                <button
                  onClick={() => setSelectedAsset(a.id)}
                  className="block h-16 w-16 rounded-sm border bg-white p-1"
                  style={{
                    borderColor: selectedAsset === a.id ? "var(--seal)" : "var(--ink-15)",
                    boxShadow:
                      selectedAsset === a.id ? "0 0 0 2px var(--seal-wash)" : "none",
                  }}
                  title={a.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.dataUrl} alt={a.name} className="h-full w-full object-contain" />
                </button>
                {vault.some((v) => v.id === a.id) && (
                  <button
                    aria-label="도장함에서 삭제"
                    className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full text-[10px] text-white group-hover:flex"
                    style={{ background: "var(--ink)" }}
                    onClick={() => removeVaultAsset(a.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {selectedAsset && (
          <p className="mt-2 text-xs" style={{ color: "var(--seal-deep)" }}>
            선택됨 — 문서 위를 누르면 그 자리에 찍힙니다.
          </p>
        )}
      </section>

      <section>
        <p className="mono-label mb-2">이름·날짜 넣기</p>
        <div className="flex gap-2">
          <button className="btn btn-outline flex-1 justify-center text-sm" onClick={() => addTextAsset("name")}>
            이름
          </button>
          <button className="btn btn-outline flex-1 justify-center text-sm" onClick={() => addTextAsset("date")}>
            오늘 날짜
          </button>
        </div>
      </section>

      <section>
        <p className="mono-label mb-1">만들기</p>
        <ToolPanel onAsset={addAsset} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="mono-label">반복 서식</p>
          <button
            className="btn btn-outline px-2 py-0.5 text-[11px]"
            disabled={!placements.length}
            onClick={saveAsTemplate}
            title={placements.length ? "현재 배치를 서식으로 저장" : "먼저 도장을 배치하세요"}
          >
            현재 배치 저장
          </button>
        </div>
        {templates.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--ink-40)" }}>
            배치를 저장하면 같은 양식에 바로 적용하고, 여러 문서 일괄 처리에도 씁니다.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-1.5 text-xs">
                <button
                  className="flex-1 truncate rounded-sm border px-2 py-1 text-left"
                  style={{ borderColor: "var(--ink-15)" }}
                  onClick={() => applyTemplate(t)}
                  title={`${t.name} 적용`}
                >
                  {t.name} <span className="mono-label">{t.docKind}</span>
                </button>
                <button
                  className="px-1 text-sm"
                  style={{ color: "var(--ink-40)" }}
                  onClick={() => removeTemplate(t.id)}
                  aria-label="서식 삭제"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        className="rounded-sm border p-3 text-xs leading-relaxed"
        style={{ borderColor: "var(--ink-08)", color: "var(--ink-60)" }}
      >
        <p className="mono-label mb-1">보관 안내</p>
        {placements.length}개 날인됨 · 문서는 이 브라우저에서만 처리되며 외부로 전송되지 않습니다.
        도장함은 이 기기에 저장됩니다. 로그인하면 서버와 동기화됩니다.
        {syncNote && <span style={{ color: "var(--warning)" }}><br />{syncNote}</span>}
      </section>
    </>
  );
}

/* HWPX(한글 XML) — 렌더러가 없어 문단 목록으로 표시하고, 선택한 문단 끝에 도장을 삽입한다 */
function HwpxPane({
  doc,
  placements,
  assetOf,
  selectedAsset,
  selectedPl,
  setSelectedPl,
  onInsert,
  onResize,
  onRemove,
}: {
  doc: HwpxDoc;
  placements: Placement[];
  assetOf: (id: string | null) => Asset | undefined;
  selectedAsset: string | null;
  selectedPl: string | null;
  setSelectedPl: (id: string | null) => void;
  onInsert: (para: number) => void;
  onResize: (id: string, mm: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      className="nice-scroll flex-1 overflow-auto p-4"
      style={{ background: "var(--paper)" }}
    >
      <div className="sheet mx-auto max-w-3xl p-6 sm:p-8">
        <p className="mono-label mb-1" style={{ color: "var(--warning)" }}>
          HWPX 문서 — 문단 단위로 표시
        </p>
        <p className="mb-5 text-sm leading-relaxed" style={{ color: "var(--ink-60)" }}>
          한글 문서의 글자가 아닌 <b>문단 끝</b>에 도장이 삽입됩니다.
          <b style={{ color: "var(--seal-deep)" }}>(인)</b> 표시 문단을 고르거나,
          원하는 문단을 눌러 배치하세요. 저장하면 원본 HWPX에 그림이 들어갑니다.
        </p>
        <ol className="flex flex-col gap-1.5">
          {doc.paras.map((p, i) => {
            if (!p.text) return null;
            const here = placements.filter((pl) => pl.para === i);
            return (
              <li
                key={i}
                className="flex items-center gap-2 rounded-sm border px-3 py-2 text-sm"
                style={{
                  borderColor: p.spot
                    ? "var(--seal)"
                    : here.length
                      ? "var(--ink-40)"
                      : "var(--ink-08)",
                  background: p.spot ? "var(--seal-wash)" : undefined,
                }}
              >
                <span className="flex-1 truncate" title={p.text}>{p.text}</span>
                {here.map((pl) => {
                  const a = assetOf(pl.assetId);
                  if (!a) return null;
                  const sel = pl.id === selectedPl;
                  return (
                    <span key={pl.id} className="relative inline-flex items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.dataUrl}
                        alt={a.name}
                        className="stamp-in h-8 cursor-pointer object-contain"
                        style={{ width: `${pl.w * 2.5}px`, outline: sel ? "1.5px solid var(--seal)" : "none" }}
                        onClick={() => setSelectedPl(sel ? null : pl.id)}
                      />
                      {sel && (
                        <span className="ml-1 flex items-center gap-1">
                          <button className="btn btn-outline px-1.5 py-0.5 text-[11px]" onClick={() => onResize(pl.id, Math.max(8, pl.w - 3))}>−</button>
                          <button className="btn btn-outline px-1.5 py-0.5 text-[11px]" onClick={() => onResize(pl.id, Math.min(80, pl.w + 3))}>+</button>
                          <button className="btn btn-outline px-1.5 py-0.5 text-[11px]" onClick={() => onRemove(pl.id)}>×</button>
                        </span>
                      )}
                    </span>
                  );
                })}
                <button
                  className="shrink-0 rounded-full border-2 border-dashed px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    borderColor: p.spot ? "var(--seal)" : "var(--ink-15)",
                    color: p.spot ? "var(--seal-deep)" : "var(--ink-40)",
                  }}
                  disabled={!selectedAsset}
                  onClick={() => onInsert(i)}
                  title={selectedAsset ? "이 문단 끝에 찍기" : "먼저 도장·서명을 선택하세요"}
                >
                  {p.spot ? "인" : "찍기"}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
