// 테스트용 한글 PDF 생성 — 텍스트 레이어가 있어 서명란 추천 검증에 쓴다.
// 실행: node scripts/gen-test-doc.mjs
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const fontBytes = readFileSync("/System/Library/Fonts/Supplemental/AppleMyungjo.ttf");

const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const font = await doc.embedFont(fontBytes);
const page = doc.addPage([595.28, 841.89]); // A4
const { height } = page.getSize();
const T = (t, x, y, s = 12) =>
  page.drawText(t, { x, y: height - y, size: s, font });

T("표 준 계 약 서", 240, 90, 22);
T("갑(이하 \"발주자\")와 을(이하 \"수행자\")은 다음과 같이 계약을 체결한다.", 60, 150);
T("1. 목적: 본 계약은 외주 작업의 범위와 대가를 정한다.", 60, 190);
T("2. 대금: 금삼백만원(₩3,000,000), 착수금 50%, 잔금 50%.", 60, 215);
T("3. 기간: 계약일로부터 60일.", 60, 240);
T("4. 기타: 본 계약서는 두 부를 작성하여 각자 보관한다.", 60, 265);

T("2026년    9월    29일", 215, 320, 14);

// 서명란 — (인) 표기
T("갑  주소: 서울특별시 ○○구 ○○로 1", 60, 380);
T("갑  상호: 주식회사 가나다   대표: 김철수   (인)", 60, 410);
T("을  주소: 경기도 ○○시 ○○로 2", 60, 460);
T("을  성명: 이영희   (인)", 60, 490);
T("을  서명:", 60, 520);

// 두 번째 페이지 — 세로 공백과 성명 패턴
const p2 = doc.addPage([595.28, 841.89]);
const T2 = (t, x, y, s = 12) =>
  p2.drawText(t, { x, y: height - y, size: s, font });
T2("첨부: 이행 확인서", 60, 90, 16);
T2("확인자 성명: 박민수   날인", 60, 130);
T2("비고: 위 계약의 부속 문서로 한다.", 60, 170);

mkdirSync(join(dir, "..", "examples"), { recursive: true });
const out = join(dir, "..", "examples", "계약서-테스트.pdf");
writeFileSync(out, await doc.save());
console.log("written:", out);
