// 테스트용 최소 HWPX 생성 (OCF 패키지 구조)
import JSZip from "jszip";
import { writeFileSync } from "fs";

const HP = "http://www.hancom.co.kr/hwpml/2011/paragraph";
const p = (t) =>
  `<hp:p><hp:run><hp:secPr><hp:grid><hp:lineGrid/><hp:charGrid/></hp:grid></hp:secPr><hp:ctrl/><hp:t>${t}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="800" baseline="850" spacing="0" horzpos="0" horzsize="48000" flags="196608"/></hp:linesegarray></hp:p>`;

const section = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="${HP}" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core">
${p("표  준  계  약  서")}
${p("갑(이하 발주자)과 을(이하 수행자)은 다음과 같이 계약을 체결한다.")}
${p("1. 대금: 금삼백만원(₩3,000,000)")}
${p("2026년 9월 29일")}
${p("갑  상호: 주식회사 가나다   대표: 김철수   (인)")}
${p("을  성명: 이영희   (인)")}
${p("을  서명:")}
</hs:sec>`;

const contentHpf = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<opf:package xmlns:opf="http://www.idpf.org/2007/opf" xmlns:has="http://www.hancom.co.kr/hwpml/2011/app" version="1.4" unique-identifier="title">
  <opf:metadata>
    <opf:title>테스트</opf:title>
  </opf:metadata>
  <opf:manifest>
    <opf:item id="header" href="header.xml" media-type="application/x-hwpml"/>
    <opf:item id="section0" href="section0.xml" media-type="application/x-hwpml"/>
    <opf:item id="settings" href="settings.xml" media-type="application/x-hwpml"/>
  </opf:manifest>
  <opf:spine>
    <opf:itemref idref="header"/>
    <opf:itemref idref="section0"/>
  </opf:spine>
</opf:package>`;

const header = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<hh:head xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" version="1.4" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/></hh:head>`;

const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ha:HwpApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app"/>`;

const container = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ocf:container xmlns:ocf="urn:ocf:names:tc:opendocument:xmlns:container" version="1.0">
<ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwp+zip"/></ocf:rootfiles>
</ocf:container>`;

const manifest = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ocf:manifest xmlns:ocf="urn:ocf:names:tc:opendocument:xmlns:container"/>`;

const zip = new JSZip();
zip.file("META-INF/container.xml", container);
zip.file("META-INF/manifest.xml", manifest);
zip.file("Contents/content.hpf", contentHpf);
zip.file("Contents/header.xml", header);
zip.file("Contents/settings.xml", settings);
zip.file("Contents/section0.xml", section);

const buf = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("examples/계약서-테스트.hwpx", buf);
console.log("examples/계약서-테스트.hwpx", buf.length, "bytes");
