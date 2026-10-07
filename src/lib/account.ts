// 클라이언트 계정·동기화·결제 헬퍼.
import type { Asset } from "./types";

export interface Me {
  id: string;
  email: string | null;
  name: string;
  provider: string;
}

export async function fetchMe(): Promise<Me | null> {
  try {
    const r = await fetch("/api/auth/me");
    const j = await r.json();
    return j.user ?? null;
  } catch {
    return null;
  }
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
}

/** 서버 도장함을 내려받아 로컬과 id 기준 병합 (서버 우선) */
export async function pullVault(local: Asset[]): Promise<Asset[]> {
  const r = await fetch("/api/vault");
  if (!r.ok) return local;
  const { assets } = (await r.json()) as { assets: Asset[] };
  const map = new Map<string, Asset>();
  for (const a of local) map.set(a.id, a);
  for (const a of assets) map.set(a.id, a);
  return [...map.values()].sort((x, y) => y.createdAt - x.createdAt);
}

/** 로컬 도장함을 서버에 저장 (로그인 상태일 때만; 403 한도는 에러 반환) */
export async function pushVault(assets: Asset[]): Promise<string | null> {
  try {
    const r = await fetch("/api/vault", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assets }),
    });
    if (r.status === 401) return null; // 비로그인 — 조용히 로컬만
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return j.error ?? "도장함 동기화 실패";
    }
    return null;
  } catch {
    return null; // 오프라인 — 로컬 유지
  }
}

/** 내보내기 사용 기록 — 로그인 사용자 한도 확인. 차단 시 에러 메시지 반환 */
export async function recordUsage(kind: string, pages: number): Promise<string | null> {
  try {
    const r = await fetch("/api/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, pages }),
    });
    if (r.status === 403) {
      const j = await r.json().catch(() => ({}));
      return j.error ?? "사용 한도에 도달했습니다.";
    }
    return null;
  } catch {
    return null;
  }
}

declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestPayment: (
        method: string,
        params: Record<string, unknown>
      ) => Promise<void>;
    };
  }
}

let tossLoader: Promise<void> | null = null;
function loadTossSdk() {
  if (!tossLoader)
    tossLoader = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://js.tosspayments.com/v1/payment";
      s.onload = () => res();
      s.onerror = rej;
      document.head.appendChild(s);
    });
  return tossLoader;
}

/** 이용권 결제 — 토스 결제창 호출. 준비 중/로그인 필요 시 에러 메시지 반환 */
export async function startCheckout(plan: "pass7" | "pro"): Promise<string | null> {
  const r = await fetch("/api/payments/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return j.error ?? "결제를 시작하지 못했습니다.";
  try {
    await loadTossSdk();
    const tp = window.TossPayments!(j.clientKey);
    await tp.requestPayment("카드", {
      amount: j.amount,
      orderId: j.orderId,
      orderName: j.orderName,
      successUrl: j.successUrl,
      failUrl: j.failUrl,
    });
    return null;
  } catch (e) {
    return (e as Error).message ?? "결제창을 열지 못했습니다.";
  }
}
