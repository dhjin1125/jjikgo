"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Dropzone from "@/components/Dropzone";
import SealMark from "@/components/SealMark";
import BeforeAfter from "@/components/BeforeAfter";
import { pendingFile } from "@/lib/pending";

const PLANS = [
  {
    name: "무료",
    price: "0원",
    unit: "",
    features: [
      "도장·서명 PNG 제작",
      "비로그인: 브라우저에서 문서 편집·저장",
      "로그인: 문서 저장 하루 1건",
      "로그인 도장함 동기화 1개",
    ],
  },
  {
    planId: "pass7" as const,
    name: "7일 이용권 · 판매 예정",
    price: "4,900원",
    unit: "일회 결제 예정",
    features: [
      "문서 20건 · 건당 최대 50쪽",
      "원본 형식 저장",
      "도장함 5개",
      "최대 10개 일괄 처리",
    ],
    accent: true,
  },
  {
    planId: "pro" as const,
    name: "30일 이용권 · 판매 예정",
    price: "9,900원",
    unit: "일회 결제 예정",
    features: [
      "월 최대 100건 · 건당 최대 50쪽 (예정)",
      "도장함 20개 · 반복 서식 20개",
      "최대 20개 일괄 처리",
    ],
  },
];

const FAQS = [
  {
    q: "정말 가입 없이 쓸 수 있나요?",
    a: "네. 문서를 넣으면 바로 편집 화면이 열리고, 결과까지 확인할 수 있습니다. 로그인 없이 도장함은 이 기기에만 저장되고, 로그인하면 기기 간 동기화와 이용권 관리가 됩니다.",
  },
  {
    q: "제 문서가 서버에 올라가나요?",
    a: "PDF·이미지·DOCX·HWPX 문서 편집은 브라우저에서 처리하며 문서 원본을 서버에 업로드하지 않습니다. 다만 로그인 후 도장함에 저장한 도장·서명 이미지와 이름은 기기 간 동기화를 위해 서버에 저장됩니다. 로그인 사용자의 저장 형식·쪽 수·처리 시각도 이용 한도 관리에 사용합니다.",
  },
  {
    q: "한글(HWP)·워드 파일은 어떻게 하나요?",
    a: "DOCX와 HWPX는 원본 형식 그대로 저장됩니다 — (인)·서명이 있는 문단 끝에 도장·서명 그림이 삽입됩니다. 구형 HWP 바이너리는 호환성 검증 중이므로, 한글에서 HWPX 또는 PDF로 저장해 넣어주세요.",
  },
  {
    q: "여기서 찍은 도장이 법적 효력이 있나요?",
    a: "찍고는 문서에 도장·서명 이미지를 넣는 도구입니다. 인증서 기반 전자서명이나 상대방에게 서명을 요청하는 전자계약과는 다릅니다. 문서의 효력 요건은 제출처에 확인하세요.",
  },
  {
    q: "완성본에 워터마크가 붙나요?",
    a: "붙지 않습니다. 모든 상품에서 결과물에 워터마크를 넣지 않는 것이 원칙입니다.",
  },
  {
    q: "자동으로 추천된 서명 위치가 틀리면요?",
    a: "추천은 후보일 뿐입니다. 문서 위 아무 곳이나 눌러 직접 배치하고, 크기와 회전을 조절할 수 있습니다. 스캔본처럼 글자 인식이 안 되는 문서도 직접 배치로 완료됩니다.",
  },
  {
    q: "같은 양식을 여러 번 처리할 수 있나요?",
    a: "네. 배치를 '반복 서식'으로 저장하면 다음 문서에 그대로 적용되고, 편집기 첫 화면에서 같은 서식으로 여러 문서를 한꺼번에 처리해 ZIP으로 받을 수 있습니다. 양식이 다른 문서는 개별 확인으로 전환하세요.",
  },
];

export default function Landing() {
  const router = useRouter();
  const goFile = (f: File) => {
    pendingFile.file = f;
    router.push("/editor");
  };
  const goSample = () => {
    pendingFile.sample = true;
    router.push("/editor");
  };

  return (
    <div>
      {/* 헤더 */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{ borderColor: "var(--ink-08)", background: "rgba(252,251,248,.92)", backdropFilter: "blur(8px)" }}
      >
        <div className="mx-auto flex h-14 max-w-[1120px] items-center gap-3 px-6">
          <a href="#" className="flex items-center gap-2">
            <SealMark size={26} />
            <span className="font-display text-lg font-black">찍고</span>
          </a>
          <nav className="mono-label ml-auto hidden gap-6 sm:flex">
            <a href="#how" className="hover:text-ink">사용법</a>
            <a href="#formats" className="hover:text-ink">지원 형식</a>
            <a href="#price" className="hover:text-ink">가격</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <Link href="/login" className="mono-label ml-4 hover:text-ink">
            로그인
          </Link>
          <button
            className="btn btn-primary ml-4 px-4 py-2 text-sm sm:ml-6"
            onClick={() => document.getElementById("drop")?.scrollIntoView({ behavior: "smooth" })}
          >
            문서 넣기
          </button>
        </div>
      </header>

      {/* 히어로 — 업로드 우선 */}
      <section className="mx-auto grid max-w-[1120px] gap-10 px-6 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="fade-up">
          <p className="mono-label mb-4 flex items-center gap-2">
            <SealMark size={16} glyph={false} />
            도장·서명 문서 완성 도구
          </p>
          <h1 className="font-display text-[38px] font-black leading-[1.25] sm:text-[52px]">
            도장과 서명,
            <br />
            넣고 바로 제출하세요.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-[1.75]" style={{ color: "var(--ink-60)" }}>
            서명 사진을 깔끔하게 다듬고, 한글·워드·PDF의 원하는 자리에 넣어보세요.
            가입 없이 문서를 넣으면 바로 시작됩니다.
          </p>
          <div className="mt-8 hidden items-center gap-2 lg:flex">
            <button className="btn btn-ghost px-0 text-sm" onClick={goSample}>
              샘플로 체험하기 →
            </button>
          </div>
        </div>
        <div id="drop" className="fade-up" style={{ animationDelay: "80ms" }}>
          <Dropzone onFile={goFile} />
          <button className="btn btn-ghost mt-3 w-full justify-center text-sm lg:hidden" onClick={goSample}>
            샘플로 체험하기
          </button>
        </div>
      </section>

      {/* 실제 전후 비교 */}
      <section className="border-t" style={{ borderColor: "var(--ink-08)" }}>
        <div className="mx-auto grid max-w-[1120px] gap-10 px-6 py-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mono-label mb-3">전후 비교</p>
            <h2 className="font-display text-3xl font-bold leading-snug">
              찍은 것처럼 보여야 합니다
            </h2>
            <ul className="mt-6 space-y-3 text-[15px] leading-relaxed" style={{ color: "var(--ink-60)" }}>
              <li>— 종이 배경과 그림자를 지우고 가는 획을 살립니다.</li>
              <li>— 흰 사각형, 가장자리 테두리가 남지 않습니다.</li>
              <li>— 올린 서명의 필체와 도장 모양을 그대로 보존합니다.</li>
              <li>— 과한 보정은 강도 조절과 원본 비교로 되돌릴 수 있습니다.</li>
            </ul>
            <p className="mt-6 text-xs" style={{ color: "var(--ink-40)" }}>
              오른쪽 문서는 실제 보정 로직으로 처리한 시연입니다. 슬라이더를 움직여보세요.
            </p>
          </div>
          <BeforeAfter />
        </div>
      </section>

      {/* 3단계 사용법 */}
      <section id="how" className="border-t" style={{ borderColor: "var(--ink-08)" }}>
        <div className="mx-auto max-w-[1120px] px-6 py-20">
          <p className="mono-label mb-3">사용법</p>
          <h2 className="font-display text-3xl font-bold">세 번이면 끝납니다</h2>
          <ol className="mt-10 grid gap-px overflow-hidden rounded-sm sm:grid-cols-3" style={{ background: "var(--ink-15)", border: "1px solid var(--ink-15)" }}>
            {[
              ["문서를 넣는다", "PDF·JPG·PNG·DOCX·HWPX를 끌어 넣습니다. 구형 HWP는 HWPX·PDF로 저장해 넣어주세요."],
              ["도장·서명을 준비한다", "이름으로 도장을 만들거나, 사진에서 서명을 추출하거나, 직접 그립니다. 저장하면 도장함에 남습니다."],
              ["자리에 찍고 저장한다", "(인)·서명 자리를 추천받거나 직접 눌러 배치합니다. PDF·DOCX·HWPX 원본 형식으로 바로 내려받습니다."],
            ].map(([t, d], i) => (
              <li key={t} className="bg-white p-6">
                <div className="flex items-center gap-2">
                  <SealMark size={22} glyph={false} />
                  <span className="mono-label">0{i + 1}</span>
                </div>
                <h3 className="font-display mt-4 text-lg font-bold">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-60)" }}>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 지원 형식 + 보관 안내 */}
      <section id="formats" className="border-t" style={{ borderColor: "var(--ink-08)" }}>
        <div className="mx-auto grid max-w-[1120px] gap-12 px-6 py-20 lg:grid-cols-2">
          <div>
            <p className="mono-label mb-3">지원 형식</p>
            <h2 className="font-display text-2xl font-bold">무엇을 넣고, 무엇으로 받나요</h2>
            <table className="mt-6 w-full text-sm">
              <thead>
                <tr className="mono-label text-left" style={{ borderBottom: "1px solid var(--ink-15)" }}>
                  <th className="pb-2 font-medium">형식</th>
                  <th className="pb-2 font-medium">불러오기</th>
                  <th className="pb-2 font-medium">저장</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["PDF", "지원", "PDF"],
                  ["JPG · PNG", "지원", "PDF · PNG"],
                  ["DOCX", "지원", "DOCX 원본 — 문단에 그림 삽입"],
                  ["HWPX", "지원(검증 중)", "HWPX 원본 — 문단에 그림 삽입"],
                  ["HWP", "검증 중", "한글에서 HWPX·PDF로 저장 후 이용"],
                ].map(([f, i, o]) => (
                  <tr key={f} style={{ borderBottom: "1px solid var(--ink-08)" }}>
                    <td className="py-2.5 font-mono2 text-xs font-medium">{f}</td>
                    <td className="py-2.5" style={{ color: i === "지원" ? "var(--success)" : "var(--warning)" }}>{i}</td>
                    <td className="py-2.5" style={{ color: "var(--ink-60)" }}>{o}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs" style={{ color: "var(--ink-40)" }}>
              암호 설정·편집 제한·이미 전자서명된 문서는 작업 전에 안내합니다.
            </p>
          </div>
          <div>
            <p className="mono-label mb-3">보관 안내</p>
            <h2 className="font-display text-2xl font-bold">문서는 어디에 남나요</h2>
            <ul className="mt-6 space-y-4 text-sm leading-relaxed" style={{ color: "var(--ink-60)" }}>
              <li className="flex gap-3">
                <SealMark size={18} glyph={false} className="mt-0.5 shrink-0" />
                <span><strong style={{ color: "var(--ink)" }}>PDF·이미지·DOCX·HWPX는 브라우저 안에서 처리</strong>됩니다. 파일이 서버로 전송되지 않습니다.</span>
              </li>
              <li className="flex gap-3">
                <SealMark size={18} glyph={false} className="mt-0.5 shrink-0" />
                <span>로그인 후 저장한 도장·서명은 <strong style={{ color: "var(--ink)" }}>기기 간 동기화를 위해 서버에도</strong> 보관합니다. 문서 원본은 전송하지 않습니다.</span>
              </li>
              <li className="flex gap-3">
                <SealMark size={18} glyph={false} className="mt-0.5 shrink-0" />
                <span>도장함의 이미지와 이름, 계정 정보의 처리·삭제 방법은 <Link href="/privacy" className="underline">개인정보처리방침</Link>에서 확인할 수 있습니다.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 가격 */}
      <section id="price" className="border-t" style={{ borderColor: "var(--ink-08)" }}>
        <div className="mx-auto max-w-[1120px] px-6 py-20">
          <p className="mono-label mb-3">현재 무료 이용 · 유료 이용권 준비 중</p>
          <h2 className="font-display text-3xl font-bold">급한 서류부터 반복 작업까지</h2>
          <p className="mt-3 text-sm" style={{ color: "var(--ink-60)" }}>
            현재 공개 베타로 무료 기능을 이용할 수 있습니다. 비로그인 문서 작업과 로그인 계정의 이용 한도는 아래 안내를 확인해 주세요. 유료 이용권은 아직 판매하지 않으며, 표시 금액은 부가세를 포함한 예정 가격입니다.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-sm sm:grid-cols-3" style={{ background: "var(--ink-15)", border: "1px solid var(--ink-15)" }}>
            {PLANS.map((p) => (
              <div key={p.name} className="flex flex-col bg-white p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">{p.name}</h3>
                  {p.accent && <SealMark size={20} glyph={false} />}
                </div>
                <p className="mt-4">
                  <span className="font-display text-3xl font-black">{p.price}</span>
                  {p.unit && (
                    <span className="mono-label ml-2">{p.unit}</span>
                  )}
                </p>
                <ul className="mt-5 flex-1 space-y-2 text-sm" style={{ color: "var(--ink-60)" }}>
                  {p.features.map((f) => (
                    <li key={f}>— {f}</li>
                  ))}
                </ul>
                {p.planId ? (
                  <button
                    className="btn btn-outline mt-6 justify-center py-2 text-sm"
                    disabled
                    aria-label={`${p.name}: 현재 구매할 수 없습니다`}
                  >
                    판매 준비 중
                  </button>
                ) : (
                  <p className="mono-label mt-6" style={{ color: "var(--ink-40)" }}>
                    지금 바로 사용
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--ink-40)" }}>
            모든 상품에 워터마크가 없습니다. 원본+PDF를 함께 받아도 1건, 출력 실패는 차감하지 않고,
            일괄 작업은 성공한 문서 수만 차감합니다. 예정된 7일·30일 이용권은 자동 갱신 없는 일회 결제입니다. 판매 시작 전 제공 범위와 이용 조건을 다시 안내합니다.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t" style={{ borderColor: "var(--ink-08)" }}>
        <div className="mx-auto max-w-[760px] px-6 py-20">
          <p className="mono-label mb-3">FAQ</p>
          <h2 className="font-display text-3xl font-bold">남는 궁금증</h2>
          <dl className="mt-10 divide-y" style={{ borderColor: "var(--ink-15)" }}>
            {FAQS.map((f) => (
              <div key={f.q} className="py-6" style={{ borderColor: "var(--ink-08)" }}>
                <dt className="font-display text-[17px] font-bold">{f.q}</dt>
                <dd className="mt-2.5 text-sm leading-[1.8]" style={{ color: "var(--ink-60)" }}>{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 마지막 CTA */}
      <section className="border-t" style={{ borderColor: "var(--ink-08)" }}>
        <div className="mx-auto max-w-[1120px] px-6 py-20 text-center">
          <SealMark size={48} className="mx-auto" />
          <h2 className="font-display mt-6 text-3xl font-bold">지금 문서를 넣어보세요</h2>
          <p className="mt-3 text-sm" style={{ color: "var(--ink-60)" }}>
            가입 없이, 이 브라우저 안에서 바로 처리됩니다.
          </p>
          <div className="mx-auto mt-8 max-w-lg">
            <Dropzone onFile={goFile} compact />
          </div>
        </div>
      </section>

      <footer className="border-t py-10" style={{ borderColor: "var(--ink-08)" }}>
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-6 text-xs" style={{ color: "var(--ink-40)" }}>
          <div className="flex items-center gap-2">
            <SealMark size={18} />
            <span className="font-display font-bold" style={{ color: "var(--ink)" }}>찍고</span>
          </div>
          <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {[
              ["도장 만들기", "/tools/make-seal"],
              ["서명 배경 제거", "/tools/signature-cleanup"],
              ["서명 직접 그리기", "/tools/draw-sign"],
              ["PDF 서명 넣기", "/tools/pdf-sign"],
              ["한글 도장 넣기", "/tools/hwp-stamp"],
              ["워드 서명 넣기", "/tools/docx-sign"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="underline underline-offset-4 hover:text-ink" style={{ textDecorationColor: "var(--ink-15)" }}>
                {label}
              </a>
            ))}
          </nav>
          <p>‘찍고’는 가칭입니다. 정식 이름과 도메인은 출시 전 확정됩니다.</p>
          <p>문서는 브라우저에서 처리되며 외부에 저장되지 않습니다.</p>
        </div>
      </footer>
    </div>
  );
}
