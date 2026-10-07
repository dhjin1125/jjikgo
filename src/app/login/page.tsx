"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import SealMark from "@/components/SealMark";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(
    params.get("error") ? "카카오 로그인에 실패했습니다. 다시 시도하거나 이메일로 로그인하세요." : null
  );
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setErr(j.error ?? "실패했습니다.");
      return;
    }
    router.push("/editor");
    router.refresh();
  };

  return (
    <div className="sheet mx-auto w-full max-w-sm p-8">
      <div className="mb-6 flex items-center gap-2">
        <SealMark size={28} />
        <span className="font-display text-xl font-black">찍고</span>
      </div>
      <h1 className="font-display text-2xl font-bold">
        {mode === "login" ? "로그인" : "가입하기"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-60)" }}>
        로그인하면 도장함이 기기 간 동기화되고, 이용권과 원본 저장 한도가 관리됩니다.
        로그인 없이도 문서 작업은 바로 할 수 있습니다.
      </p>

      <a
        href="/api/auth/kakao"
        className="btn mt-6 w-full justify-center py-2.5 text-sm font-semibold"
        style={{ background: "#FEE500", color: "#3c1e1e" }}
      >
        카카오로 시작하기
      </a>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1" style={{ background: "var(--ink-15)" }} />
        <span className="mono-label">또는 이메일</span>
        <span className="h-px flex-1" style={{ background: "var(--ink-15)" }} />
      </div>

      {mode === "register" && (
        <input
          className="field mb-2"
          placeholder="이름 (선택)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      )}
      <input
        className="field mb-2"
        type="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="field mb-3"
        type="password"
        placeholder={mode === "register" ? "비밀번호 (8자 이상)" : "비밀번호"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      {err && (
        <p className="mb-3 text-sm" style={{ color: "var(--error)" }}>
          {err}
        </p>
      )}
      <button
        className="btn btn-primary w-full justify-center py-2.5 text-sm"
        disabled={busy}
        onClick={submit}
      >
        {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입하고 시작"}
      </button>
      <button
        className="mt-3 w-full text-center text-xs underline"
        style={{ color: "var(--ink-60)" }}
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "처음이라면 — 이메일로 가입" : "이미 계정이 있나요? 로그인"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16" style={{ background: "var(--paper)" }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
