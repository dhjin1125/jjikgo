// 인주 찍힘 — 찍고의 시그니처 마크. 불규칙한 원형 테두리 + "찍" 전서체 느낌.
export default function SealMark({
  size = 28,
  glyph = true,
  className = "",
}: {
  size?: number;
  glyph?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M24 4.5c3.2-.6 6.9.2 9.7 1.8 3.4 1.9 6.1 4.7 7.6 8.1 1.6 3.8 2.2 8 1.4 12-.9 4.3-3.1 8.3-6.3 11.2-3 2.7-6.9 4.4-10.9 4.7-4.4.3-8.9-.9-12.4-3.4C9.6 36.5 7.1 33 6 29c-1-3.9-.8-8.1.5-11.9C7.8 13.4 10.4 10 13.8 7.8 16.6 6 20.5 5 24 4.5Z"
        fill="none"
        stroke="#c93a1e"
        strokeWidth="3.4"
        strokeLinecap="round"
        opacity="0.92"
      />
      <path
        d="M24.5 7.2c6.9-.4 13.4 3.8 15.4 10.3"
        fill="none"
        stroke="#c93a1e"
        strokeWidth="1.4"
        opacity="0.45"
      />
      {glyph && (
        <text
          x="24"
          y="26.5"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#c93a1e"
          fontSize="19"
          fontWeight="900"
          fontFamily='"Noto Serif KR", serif'
        >
          찍
        </text>
      )}
    </svg>
  );
}
