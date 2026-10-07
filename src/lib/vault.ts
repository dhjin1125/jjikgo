// 도장함 — 계정 없이 이 브라우저에 저장. 로그인·동기화는 계정 기능 도입 시 이관.
import type { Asset } from "./types";

const KEY = "jjikgo.vault.v1";

export function loadVault(): Asset[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Asset[];
  } catch {
    return [];
  }
}

export function saveVault(assets: Asset[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(assets));
  } catch {
    // 용량 초과 등 — 조용히 실패, 작업 자산에는 영향 없음
  }
}

export function addToVault(asset: Asset): Asset[] {
  const list = loadVault();
  const next = [asset, ...list.filter((a) => a.id !== asset.id)];
  saveVault(next);
  return next;
}

export function removeFromVault(id: string): Asset[] {
  const next = loadVault().filter((a) => a.id !== id);
  saveVault(next);
  return next;
}
