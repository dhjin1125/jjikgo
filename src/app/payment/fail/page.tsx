"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import SealMark from "@/components/SealMark";

function Inner() {
  const params = useSearchParams();
  const msg = params.get("message") ?? "결제가 취소되거나 실패했습니다.";
  return (
    <div className="sheet mx-auto w-full max-w-md p-8 text-center">
      <SealMark size={34} className="mx-auto" />
      <h1 className="font-display mt-4 text-2xl font-bold">결제가 완료되지 않았습니다</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--ink-60)" }}>
        {msg}
        <br />
        결제된 내역이 있다면 자동으로 취소됩니다. 다시 시도해주세요.
      </p>
      <Link href="/" className="btn btn-primary mt-6 inline-block px-5 py-2.5 text-sm no-underline">
        돌아가기
      </Link>
    </div>
  );
}

export default function PaymentFail() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6" style={{ background: "var(--paper)" }}>
      <Suspense>
        <Inner />
      </Suspense>
    </main>
  );
}
