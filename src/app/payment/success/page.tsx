"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SealMark from "@/components/SealMark";

function Inner() {
  const params = useSearchParams();
  const [state, setState] = useState<"busy" | "ok" | "fail">("busy");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = Number(params.get("amount"));
    if (!paymentKey || !orderId || !amount) {
      setState("fail");
      setMsg("승인 정보가 누락됐습니다.");
      return;
    }
    void fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (r.ok) setState("ok");
        else {
          setState("fail");
          setMsg(j.error ?? "승인에 실패했습니다.");
        }
      })
      .catch(() => {
        setState("fail");
        setMsg("네트워크 오류 — 결제 내역을 확인해주세요.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="sheet mx-auto w-full max-w-md p-8 text-center">
      <SealMark size={34} className="mx-auto" />
      {state === "busy" && <p className="mt-5 text-sm">결제를 확인하고 있습니다…</p>}
      {state === "ok" && (
        <>
          <h1 className="font-display mt-4 text-2xl font-bold">이용권이 활성화됐습니다</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-60)" }}>
            도장함 한도와 문서 처리 한도가 바로 적용됩니다.
          </p>
          <Link href="/editor" className="btn btn-primary mt-6 inline-block px-5 py-2.5 text-sm no-underline">
            문서 작업 계속하기
          </Link>
        </>
      )}
      {state === "fail" && (
        <>
          <h1 className="font-display mt-4 text-2xl font-bold">승인하지 못했습니다</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--error)" }}>{msg}</p>
          <Link href="/" className="btn btn-outline mt-6 inline-block px-5 py-2.5 text-sm no-underline">
            처음으로
          </Link>
        </>
      )}
    </div>
  );
}

export default function PaymentSuccess() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--paper)" }}>
      <Suspense>
        <Inner />
      </Suspense>
    </main>
  );
}
