// 랜딩/도구 페이지 → 편집기로 File·자산을 넘기는 인메모리 브릿지.
// 새로고침·직접 진입 시엔 비어 있고, 편집기가 자체 드롭존을 보여준다.
import type { Asset } from "./types";

export const pendingFile: {
  file: File | null;
  sample: boolean;
  asset: Asset | null;
} = { file: null, sample: false, asset: null };
