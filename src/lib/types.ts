export type AssetKind = "seal" | "signature" | "text";

export interface Asset {
  id: string;
  kind: AssetKind;
  name: string;
  dataUrl: string; // PNG data URL
  aspect: number; // width / height
  createdAt: number;
}

export type DocKind = "pdf" | "image" | "docx" | "hwpx" | "unsupported";

export interface Placement {
  id: string;
  assetId: string;
  page: number; // 0-based
  // PDF: page view-space points (top-left origin, scale=1). Image: 0..1 fraction.
  // DOCX/HWPX: 미리보기 px (표시용) — 실제 저장 위치는 para 문단 순번이 정한다.
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number; // degrees, clockwise as displayed
  para?: number; // DOCX/HWPX: 삽입 대상 문단(w:p / hp:p) 순번
}

export interface SignatureSpot {
  page: number;
  x: number; // center x (view points / fraction)
  y: number;
  r: number; // suggested size
  label: string; // e.g. "성명 (인)", "서명"
  para?: number; // DOCX/HWPX 서명란의 문단 순번
}

export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
