import Link from "next/link";
import type { ReactNode } from "react";

export function PolicyPage({ title, children }: { title: string; children: ReactNode }) {
  return <main className="mx-auto max-w-[760px] px-6 py-12">
    <Link href="/" className="text-sm underline">← 찍고로 돌아가기</Link>
    <h1 className="font-display mb-3 mt-8 text-3xl font-bold">{title}</h1>
    <p className="mb-8 text-sm" style={{ color: "var(--ink-60)" }}>시행일: 2026년 10월 7일 · 공개 베타</p>
    <div className="space-y-8 text-sm leading-7">{children}</div>
  </main>;
}
