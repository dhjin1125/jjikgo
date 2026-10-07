// "샘플로 체험하기" — 위임장 형태의 1쪽 문서를 캔버스로 생성한다.
// 외부 자산 없이 실제 편집 흐름(배치·합성·다운로드)을 체험하게 한다.
import type { SignatureSpot } from "./types";

// 아래 makeSampleDoc의 서명란 위치와 맞춘 비율 좌표
// "(인)" 글자: x=W-110-90≈1040/1240, 위임인 y≈1200/1754, 수임인 y≈1350/1754
export const SAMPLE_SPOTS: SignatureSpot[] = [
  { page: 0, x: 0.84, y: 0.679, r: 0.042, label: "위임인 (인)" },
  { page: 0, x: 0.84, y: 0.765, r: 0.042, label: "수임인 (인)" },
];

export async function makeSampleDoc(): Promise<{
  dataUrl: string;
  w: number;
  h: number;
}> {
  const W = 1240;
  const H = 1754; // A4 @150dpi
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#1c1b1a";
  ctx.strokeStyle = "#1c1b1a";

  const M = 110;
  ctx.textAlign = "center";
  ctx.font = '700 64px "Noto Serif KR", serif';
  ctx.fillText("위  임  장", W / 2, 200);
  ctx.lineWidth = 2;
  ctx.strokeRect(M, 260, W - M * 2, 1);

  ctx.textAlign = "left";
  ctx.font = '400 30px "IBM Plex Sans KR", sans-serif';
  const lines = [
    "위임인(본인)은 아래 수임인에게 다음의 업무를 위임합니다.",
    "",
    "1. 위임 업무: 각종 신청서 작성 및 제출에 관한 사항",
    "2. 위임 기간: 서명일로부터 30일",
    "3. 기타: 본 위임에 따른 법적 책임은 위임인에게 있다.",
    "",
    "위임 내용을 확인하였으며 위와 같이 위임장을 작성합니다.",
  ];
  let y = 340;
  for (const l of lines) {
    ctx.fillText(l, M, y);
    y += 52;
  }

  const today = new Date();
  ctx.textAlign = "center";
  ctx.font = '400 32px "IBM Plex Sans KR", sans-serif';
  ctx.fillText(
    `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`,
    W / 2,
    1050
  );

  // 위임인·수임인 블록 — 서명란
  const block = (label: string, by: number) => {
    ctx.textAlign = "left";
    ctx.font = '500 34px "IBM Plex Sans KR", sans-serif';
    ctx.fillText(label, M, by);
    ctx.font = '400 30px "IBM Plex Sans KR", sans-serif';
    ctx.fillStyle = "rgba(28,27,26,.6)";
    ctx.fillText("성명:", M + 560, by);
    ctx.strokeStyle = "rgba(28,27,26,.4)";
    ctx.strokeRect(M + 650, by - 34, 180, 44);
    ctx.fillText("(인)", W - M - 90, by);
    ctx.fillStyle = "#1c1b1a";
    ctx.strokeStyle = "#1c1b1a";
  };
  block("위임인", 1200);
  block("수임인", 1350);

  ctx.textAlign = "left";
  ctx.font = '400 22px "IBM Plex Sans KR", sans-serif';
  ctx.fillStyle = "rgba(28,27,26,.5)";
  ctx.fillText("※ 찍고 샘플 문서입니다. 실제 제출용이 아닙니다.", M, H - 80);

  return { dataUrl: cv.toDataURL("image/png"), w: W, h: H };
}
