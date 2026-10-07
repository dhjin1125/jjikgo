// 반복 서식 — 자주 쓰는 양식의 서명 위치·크기를 저장해 다음 문서에 그대로 적용.
// 템플릿에 자산 PNG를 함께 저장해 도장함과 무관하게 동작하게 한다.
import type { Asset, Placement } from "./types";
import { uid } from "./types";

export interface Template {
  id: string;
  name: string;
  docKind: "pdf" | "image" | "docx" | "hwpx";
  createdAt: number;
  assets: Asset[]; // 서식이 참조하는 도장·서명의 사본
  placements: Omit<Placement, "id">[];
}

const KEY = "jjikgo.templates.v1";

export function loadTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Template[];
  } catch {
    return [];
  }
}

export function saveTemplate(
  name: string,
  docKind: Template["docKind"],
  placements: Placement[],
  assetOf: (id: string) => Asset | undefined
): Template[] {
  const assets: Asset[] = [];
  for (const p of placements) {
    const a = assetOf(p.assetId);
    if (a && !assets.some((x) => x.id === a.id)) assets.push(a);
  }
  const t: Template = {
    id: uid(),
    name,
    docKind,
    createdAt: Date.now(),
    assets,
    placements: placements.map((p) => {
      const { id, ...rest } = p;
      void id;
      return rest;
    }),
  };
  const next = [t, ...loadTemplates()];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 용량 초과 — 무시 */
  }
  return next;
}

export function removeTemplate(id: string): Template[] {
  const next = loadTemplates().filter((t) => t.id !== id);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/** 서식을 문서 배치로 변환 — 새 placement id 부여 */
export function templatePlacements(t: Template): Placement[] {
  return t.placements.map((p) => ({ ...p, id: uid() }));
}
