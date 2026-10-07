import { NodeoffBusiness } from "@/components/NodeoffBusiness";
import type { Metadata, Viewport } from "next";
import { Noto_Serif_KR, IBM_Plex_Sans_KR, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const serifKR = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  variable: "--font-serif-kr",
});

const plexSans = IBM_Plex_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  creator: "노드오프",
  publisher: "노드오프",
  title: "찍고 — 도장과 서명, 넣고 바로 제출하세요",
  description:
    "서명 사진을 깔끔하게 다듬고, 한글·워드·PDF의 원하는 자리에 넣어보세요. 가입 없이 문서를 넣으면 바로 시작할 수 있습니다.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fcfbf8",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ko"
      className={`${serifKR.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>{children}<footer style={{maxWidth:1120,margin:"0 auto",padding:"0 24px 28px"}}><NodeoffBusiness /></footer></body>
    </html>
  );
}
