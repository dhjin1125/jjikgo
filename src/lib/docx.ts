// DOCX 불러오기·미리보기·서명란 추천·OOXML 이미지 삽입·원본 저장.
// 전략: 임의 좌표가 아니라 (인)·서명 텍스트가 있는 문단에 그림을 "인라인"으로 삽입한다.
// 텍스트와 연결돼 있어 레이아웃이 바뀌어도 위치가 어긋나지 않는다.
import JSZip from "jszip";
import { renderAsync } from "docx-preview";

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const EMU_PER_MM = 36000;

export interface DocxSpot {
  paraIndex: number; // body 내 w:p 순번
  label: string;
}

export interface DocxInsertion {
  assetId: string;
  paraIndex: number;
  widthMm: number;
}

const SPOT_RE =
  /\( ?인 ?\)|（ ?인 ?）|\( ?서 ?명 ?\)|서명란|날인|서명|성명/;

export async function loadDocx(bytes: ArrayBuffer) {
  const zip = await JSZip.loadAsync(bytes);
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new Error("document.xml 없음");
  const xmlText = await docXmlFile.async("text");
  const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
  return { zip, xmlDoc };
}

/** document.xml에서 서명란 문단 순번을 찾는다 */
export function findDocxSpots(xmlDoc: Document): DocxSpot[] {
  const paras = xmlDoc.getElementsByTagNameNS(W_NS, "p");
  const spots: DocxSpot[] = [];
  for (let i = 0; i < paras.length; i++) {
    const texts = paras[i].getElementsByTagNameNS(W_NS, "t");
    let s = "";
    for (const t of Array.from(texts)) s += t.textContent ?? "";
    if (SPOT_RE.test(s)) {
      spots.push({ paraIndex: i, label: s.trim().slice(0, 18) });
    }
  }
  return spots;
}

/** docx-preview로 미리보기 렌더 — 반환된 컨테이너 DOM */
export async function renderDocxPreview(
  bytes: ArrayBuffer,
  container: HTMLElement
) {
  container.innerHTML = "";
  await renderAsync(bytes, container, undefined, {
    className: "docx",
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    experimental: false,
    trimXmlDeclaration: true,
  });
  return container;
}

/**
 * 미리보기 DOM에서 "(인)" 등 매칭 텍스트 노드의 화면 위치를 찾는다.
 * paraIndex = 해당 텍스트가 속한 렌더된 <p>가 컨테이너 내 모든 <p> 중 몇 번째인가.
 * docx-preview는 w:p → <p>로 문서 순서대로 렌더하므로, 이 순번은
 * document.xml의 w:p 순번과 일치한다.
 * 반환 좌표는 container 기준 상대 px.
 */
export function findPreviewSpots(
  container: HTMLElement
): { x: number; y: number; h: number; label: string; paraIndex: number }[] {
  const spots: { x: number; y: number; h: number; label: string; paraIndex: number }[] = [];
  const crect = container.getBoundingClientRect();
  const allParas = Array.from(container.querySelectorAll("p"));
  const seen = new Set<number>(); // 같은 문단의 중복 매칭은 한 번만
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const s = node.textContent ?? "";
    const m = s.match(SPOT_RE);
    if (!m || m.index === undefined) continue;
    const pEl = (node as Text).parentElement?.closest("p");
    if (!pEl) continue;
    const paraIndex = allParas.indexOf(pEl);
    if (paraIndex < 0 || seen.has(paraIndex)) continue;
    seen.add(paraIndex);
    const range = document.createRange();
    const hit = m[0];
    const start = s.indexOf(hit);
    range.setStart(node, start);
    range.setEnd(node, Math.min(start + hit.length, s.length));
    const r = range.getBoundingClientRect();
    if (!r.width) continue;
    spots.push({
      x: r.right - crect.left,
      y: r.top - crect.top + r.height / 2,
      h: r.height,
      label: hit,
      paraIndex,
    });
  }
  return spots;
}

/** 미리보기에서 임의 클릭 위치 아래의 문단 순번 (없으면 -1) */
export function paraIndexAt(
  container: HTMLElement,
  clientX: number,
  clientY: number
): number {
  const el = document.elementFromPoint(clientX, clientY);
  const pEl = el?.closest("p");
  if (!pEl || !container.contains(pEl)) return -1;
  return Array.from(container.querySelectorAll("p")).indexOf(pEl);
}

/** PNG dataURL → 바이너리 */
function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1];
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function nextRid(relsXml: Document): string {
  const rels = relsXml.getElementsByTagName("Relationship");
  let max = 0;
  for (const r of Array.from(rels)) {
    const n = parseInt((r.getAttribute("Id") ?? "").replace(/\D/g, ""), 10);
    if (!isNaN(n)) max = Math.max(max, n);
  }
  return `rId${max + 1}`;
}

/**
 * DOCX 원본에 인라인 이미지를 삽입해 저장한다.
 * insertions: 문단 순번 + 너비(mm) + PNG.
 */
export async function exportDocx(
  zip: JSZip,
  insertions: DocxInsertion[],
  getAsset: (id: string) => { dataUrl: string; aspect: number } | undefined
): Promise<Uint8Array> {
  const docXmlFile = zip.file("word/document.xml")!;
  const xmlDoc = new DOMParser().parseFromString(
    await docXmlFile.async("text"),
    "text/xml"
  );
  const relsFile = zip.file("word/_rels/document.xml.rels")!;
  const REL_NS =
    "http://schemas.openxmlformats.org/package/2006/relationships";
  const relsDoc = new DOMParser().parseFromString(
    await relsFile.async("text"),
    "text/xml"
  );

  // [Content_Types].xml에 png 확장 확인
  const ctFile = zip.file("[Content_Types].xml")!;
  const ctDoc = new DOMParser().parseFromString(
    await ctFile.async("text"),
    "text/xml"
  );
  const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
  const hasPng = Array.from(ctDoc.getElementsByTagNameNS(CT_NS, "Default")).some(
    (d) => d.getAttribute("Extension") === "png"
  );
  if (!hasPng) {
    const d = ctDoc.createElementNS(CT_NS, "Default");
    d.setAttribute("Extension", "png");
    d.setAttribute(
      "ContentType",
      "image/png"
    );
    ctDoc.documentElement.appendChild(d);
  }

  const paras = xmlDoc.getElementsByTagNameNS(W_NS, "p");
  let imgN = 0;
  // 같은 문단에 여러 삽입이 있어도 순서대로 뒤에 붙는다
  for (const ins of insertions) {
    const asset = getAsset(ins.assetId);
    const para = paras[ins.paraIndex];
    if (!asset || !para) continue;
    imgN++;
    const mediaName = `jjikgo-${imgN}.png`;
    zip.file(`word/media/${mediaName}`, dataUrlBytes(asset.dataUrl));

    const rid = nextRid(relsDoc);
    const rel = relsDoc.createElementNS(REL_NS, "Relationship");
    rel.setAttribute("Id", rid);
    rel.setAttribute(
      "Type",
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
    );
    rel.setAttribute("Target", `media/${mediaName}`);
    relsDoc.documentElement.appendChild(rel);

    const cx = Math.round(ins.widthMm * EMU_PER_MM);
    const cy = Math.round((ins.widthMm / asset.aspect) * EMU_PER_MM);
    const run = makeImageRun(xmlDoc, rid, mediaName, cx, cy, 100 + imgN);
    para.appendChild(run);
  }

  zip.file("word/document.xml", new XMLSerializer().serializeToString(xmlDoc));
  zip.file(
    "word/_rels/document.xml.rels",
    new XMLSerializer().serializeToString(relsDoc)
  );
  zip.file(
    "[Content_Types].xml",
    new XMLSerializer().serializeToString(ctDoc)
  );
  return zip.generateAsync({ type: "uint8array" });
}

function makeImageRun(
  xmlDoc: Document,
  rid: string,
  name: string,
  cx: number,
  cy: number,
  docPrId: number
): Element {
  const NS: Record<string, string> = {
    w: W_NS,
    r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    a: "http://schemas.openxmlformats.org/drawingml/2006/main",
    pic: "http://schemas.openxmlformats.org/drawingml/2006/picture",
  };
  const el = (ns: string, tag: string, attrs: Record<string, string> = {}) => {
    const e = xmlDoc.createElementNS(NS[ns], `${ns}:${tag}`);
    for (const [k, v] of Object.entries(attrs)) {
      if (k.includes(":")) {
        const [p, n] = k.split(":");
        e.setAttributeNS(NS[p], `${p}:${n}`, v);
      } else e.setAttribute(k, v);
    }
    return e;
  };
  const run = el("w", "r");
  const drawing = el("w", "drawing");
  const inline = el("wp", "inline", {
    distT: "0",
    distB: "0",
    distL: "0",
    distR: "0",
  });
  inline.appendChild(el("wp", "extent", { cx: String(cx), cy: String(cy) }));
  inline.appendChild(
    el("wp", "effectExtent", { l: "0", t: "0", r: "0", b: "0" })
  );
  inline.appendChild(
    el("wp", "docPr", { id: String(docPrId), name: `jjikgo${docPrId}` })
  );
  inline.appendChild(el("wp", "cNvGraphicFramePr"));
  const graphic = el("a", "graphic");
  const graphicData = el("a", "graphicData", {
    uri: "http://schemas.openxmlformats.org/drawingml/2006/picture",
  });
  const pic = el("pic", "pic");
  const nvPicPr = el("pic", "nvPicPr");
  nvPicPr.appendChild(
    el("pic", "cNvPr", { id: String(docPrId), name })
  );
  nvPicPr.appendChild(el("pic", "cNvPicPr"));
  pic.appendChild(nvPicPr);
  const blipFill = el("pic", "blipFill");
  const blip = el("a", "blip");
  blip.setAttributeNS(NS.r, "r:embed", rid);
  blipFill.appendChild(blip);
  const stretch = el("a", "stretch");
  stretch.appendChild(el("a", "fillRect"));
  blipFill.appendChild(stretch);
  pic.appendChild(blipFill);
  const spPr = el("pic", "spPr");
  const xfrm = el("a", "xfrm");
  xfrm.appendChild(el("a", "off", { x: "0", y: "0" }));
  xfrm.appendChild(el("a", "ext", { cx: String(cx), cy: String(cy) }));
  spPr.appendChild(xfrm);
  const prst = el("a", "prstGeom", { prst: "rect" });
  prst.appendChild(el("a", "avLst"));
  spPr.appendChild(prst);
  pic.appendChild(spPr);
  graphicData.appendChild(pic);
  graphic.appendChild(graphicData);
  inline.appendChild(graphic);
  drawing.appendChild(inline);
  run.appendChild(drawing);
  return run;
}
