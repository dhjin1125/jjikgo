import type { Metadata } from "next";
import Link from "next/link";
import { PolicyPage } from "@/components/PolicyPage";
export const metadata: Metadata = { title: "이용약관 — 찍고" };
export default function TermsPage() {
  return <PolicyPage title="이용약관">
    <section><h2 className="font-bold">1. 서비스와 운영자</h2><p>찍고는 노드오프가 운영하는 문서 편집 도구입니다. 사용자가 준비한 도장·서명 이미지를 문서에 배치하고 파일로 저장할 수 있습니다. 인증서 기반 전자서명, 본인 인증이나 상대방 서명 수집을 제공하는 전자계약 서비스는 아닙니다. 문서의 효력과 제출 요건은 사용자가 제출처에 확인해야 합니다.</p></section>
    <section><h2 className="font-bold">2. 현재 제공 범위</h2><p>현재 공개 베타입니다. 비로그인 사용자는 브라우저에서 문서를 편집·저장할 수 있습니다. 로그인 계정에는 문서 저장 하루 1건과 도장함 동기화 1개 한도가 적용됩니다. DOCX·HWPX는 문서별 호환성 차이가 있으므로 저장된 파일을 제출 전에 확인해 주세요. 구형 HWP는 지원하지 않습니다.</p></section>
    <section><h2 className="font-bold">3. 예정 가격과 판매 상태</h2><p>7일·30일 이용권의 표시 가격과 제공량은 판매 준비를 위한 안내입니다. 현재 구매할 수 없으며 자동으로 결제되지 않습니다. 판매 시작 시 실제 제공 범위, 가격과 환불 조건을 결제 전에 안내합니다. 계획된 이용권은 자동 갱신 없는 일회 결제 방식입니다.</p></section>
    <section><h2 className="font-bold">4. 계정과 자료의 이용</h2><p>계정은 본인이 관리하고, 본인이 사용할 권한이 있는 문서·도장·서명만 처리해야 합니다. 타인 사칭, 위조, 권한 없는 개인정보 수집이나 서비스에 장애를 주는 자동화는 허용되지 않습니다. 원본과 완성본은 사용자 기기에 별도로 보관해 주세요.</p></section>
    <section><h2 className="font-bold">5. 개인정보·문의와 변경</h2><p>문서 처리와 도장함 동기화의 차이, 계정 삭제 방법은 <Link href="/privacy" className="underline">개인정보처리방침</Link>에 설명합니다. 이용·오류·삭제 문의는 <a href="mailto:jin@nodeoff.kr" className="underline">jin@nodeoff.kr</a>로 접수합니다. 주요 이용 조건이 변경되면 사이트에 안내하며, 서비스 이용에 관한 법령상 권리는 이 약관으로 제한하지 않습니다.</p></section>
  </PolicyPage>;
}
