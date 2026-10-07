// 테스트용 DOCX 생성 — (인)·서명 텍스트가 있는 최소 OOXML 문서
import JSZip from "jszip";
import { writeFileSync } from "fs";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

const para = (t) =>
  `<w:p><w:pPr><w:spacing w:after="160"/></w:pPr><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;

const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>
${para("표  준  계  약  서")}
${para("갑(이하 발주자)과 을(이하 수행자)은 다음과 같이 계약을 체결한다.")}
${para("1. 목적: 본 계약은 외주 작업의 범위와 대가를 정한다.")}
${para("2. 대금: 금삼백만원(₩3,000,000), 착수금 50%, 잔금 50%.")}
${para("2026년 9월 29일")}
${para("갑  주소: 서울특별시 ○○구 ○○로 1")}
${para("갑  상호: 주식회사 가나다   대표: 김철수   (인)")}
${para("을  주소: 경기도 ○○시 ○○로 2")}
${para("을  성명: 이영희   (인)")}
${para("을  서명:")}
<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body>
</w:document>`;

const ct = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

const zip = new JSZip();
zip.file("[Content_Types].xml", ct);
zip.file("_rels/.rels", rootRels);
zip.file("word/document.xml", docXml);
zip.file("word/_rels/document.xml.rels", docRels);

const buf = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync("examples/계약서-테스트.docx", buf);
console.log("examples/계약서-테스트.docx", buf.length, "bytes");
