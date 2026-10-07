// HWPX(한글 XML 패키지) — zip 안의 OWPML XML을 직접 수정해 원본 저장.
// 그림은 hp:run 안의 hp:pic으로, (인)·서명 문단에 treatAsChar로 삽입한다.
// 구조는 HWPX 공개 스펙(owpml) 기준 — 한글에서의 재검증은 별도 시험 항목.
import JSZip from "jszip";

const HP_NS = "http://www.hancom.co.kr/hwpml/2011/paragraph";
const HC_NS = "http://www.hancom.co.kr/hwpml/2011/core";
const OPF_NS = "http://www.idpf.org/2007/opf";
const HWPUNIT_PER_MM = 283.4645; // 7200/25.4

export interface HwpxPara {
  section: string; // Contents/sectionN.xml
  paraIndex: number; // 해당 section 내 hp:p 순번
  text: string;
  spot?: boolean;
}

const SPOT_RE =
  /\( ?인 ?\)|（ ?인 ?）|\( ?서 ?명 ?\)|서명란|날인|서명|성명/;

export interface HwpxDoc {
  zip: JSZip;
  sections: { name: string; xml: Document }[];
  paras: HwpxPara[]; // 문서 순서
}

export async function loadHwpx(bytes: ArrayBuffer): Promise<HwpxDoc> {
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files)
    .filter((n) => /^Contents\/section\d+\.xml$/.test(n))
    .sort();
  if (!names.length) throw new Error("section xml 없음 — HWPX가 아니거나 지원하지 않는 구조");
  const sections = [];
  const paras: HwpxPara[] = [];
  for (const name of names) {
    const xml = new DOMParser().parseFromString(
      await zip.file(name)!.async("text"),
      "text/xml"
    );
    const pEls = xml.getElementsByTagNameNS(HP_NS, "p");
    for (let i = 0; i < pEls.length; i++) {
      const tEls = pEls[i].getElementsByTagNameNS(HP_NS, "t");
      let text = "";
      for (const t of Array.from(tEls)) text += t.textContent ?? "";
      paras.push({
        section: name,
        paraIndex: i,
        text: text.trim(),
        spot: SPOT_RE.test(text),
      });
    }
    sections.push({ name, xml });
  }
  return { zip, sections, paras };
}

function dataUrlBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1];
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

export interface HwpxInsertion {
  assetId: string;
  section: string;
  paraIndex: number;
  widthMm: number;
}

/**
 * HWPX 원본에 도장·서명 그림을 삽입해 저장한다.
 * 대상 문단 끝에 hp:run>hp:pic(treatAsChar)를 붙인다.
 */
export async function exportHwpx(
  doc: HwpxDoc,
  insertions: HwpxInsertion[],
  getAsset: (id: string) => { dataUrl: string; aspect: number } | undefined
): Promise<Uint8Array> {
  const zip = doc.zip;
  const hpfFile = zip.file("Contents/content.hpf");
  if (!hpfFile) throw new Error("content.hpf 없음");
  const hpfDoc = new DOMParser().parseFromString(
    await hpfFile.async("text"),
    "text/xml"
  );
  const manifest = hpfDoc.getElementsByTagNameNS(OPF_NS, "manifest")[0]
    ?? hpfDoc.getElementsByTagName("opf:manifest")[0];
  if (!manifest) throw new Error("opf manifest 없음");

  let imgN = 0;
  // 섹션별로 묶어 한 번에 처리
  for (const sec of doc.sections) {
    const secIns = insertions.filter((i) => i.section === sec.name);
    if (!secIns.length) continue;
    const pEls = sec.xml.getElementsByTagNameNS(HP_NS, "p");
    for (const ins of secIns) {
      const asset = getAsset(ins.assetId);
      const pEl = pEls[ins.paraIndex];
      if (!asset || !pEl) continue;
      imgN++;
      const itemId = `jjikgoimg${imgN}`;
      const binName = `BinData/jjikgo-${imgN}.png`;
      zip.file(`Contents/${binName}`, dataUrlBytes(asset.dataUrl));

      // manifest에 바이너리 항목 등록 (기존 item을 복제해 ns/prefix 유지)
      const proto = manifest.getElementsByTagNameNS(OPF_NS, "item")[0]
        ?? manifest.getElementsByTagName("item")[0];
      const item = (proto ? proto.cloneNode(false) : hpfDoc.createElementNS(OPF_NS, "opf:item")) as Element;
      item.setAttribute("id", itemId);
      item.setAttribute("href", binName);
      item.setAttribute("media-type", "image/png");
      manifest.appendChild(item);

      const w = Math.round(ins.widthMm * HWPUNIT_PER_MM);
      const h = Math.round((ins.widthMm / asset.aspect) * HWPUNIT_PER_MM);
      const run = makePicRun(sec.xml, itemId, w, h, imgN);
      // linesegarray가 있으면 그 앞에 붙인다
      const seg = Array.from(pEl.childNodes).find(
        (n) => n.nodeType === 1 && (n as Element).localName === "linesegarray"
      );
      pEl.insertBefore(run, seg ?? null);
    }
    zip.file(sec.name, new XMLSerializer().serializeToString(sec.xml));
  }
  zip.file(
    "Contents/content.hpf",
    new XMLSerializer().serializeToString(hpfDoc)
  );
  return zip.generateAsync({ type: "uint8array" });
}

function makePicRun(
  xmlDoc: Document,
  itemId: string,
  w: number,
  h: number,
  seq: number
): Element {
  const el = (
    ns: string,
    tag: string,
    attrs: Record<string, string> = {}
  ): Element => {
    const e = xmlDoc.createElementNS(ns === "hp" ? HP_NS : HC_NS, `${ns}:${tag}`);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const run = el("hp", "run");
  const pic = el("hp", "pic", {
    id: String(990000 + seq),
    zOrder: "0",
    numberingType: "NONE",
    textWrap: "TOP_AND_BOTTOM",
    textFlow: "BOTH_SIDES",
    lock: "0",
    dropcapstyle: "None",
    href: "",
    groupLevel: "0",
    instid: String(990000000 + seq),
    reverse: "0",
  });
  pic.appendChild(el("hp", "offset", { x: "0", y: "0" }));
  pic.appendChild(el("hp", "orgSz", { width: String(w), height: String(h) }));
  pic.appendChild(el("hp", "curSz", { width: "0", height: "0" }));
  pic.appendChild(el("hp", "flip", { horizontal: "0", vertical: "0" }));
  const rot = el("hp", "rotationInfo", {
    angle: "0",
    centerX: String(w / 2),
    centerY: String(h / 2),
    rotateimage: "1",
  });
  pic.appendChild(rot);
  const ri = el("hp", "renderingInfo");
  for (const m of ["transMatrix", "scaMatrix", "rotMatrix"]) {
    ri.appendChild(
      el("hc", m, { e1: "1", e2: "0", e3: "0", e4: "0", e5: "1", e6: "0" })
    );
  }
  pic.appendChild(ri);
  pic.appendChild(
    el("hp", "img", {
      binaryItemIDRef: itemId,
      dim: "0",
      effect: "REAL_PIC",
      alpha: "0",
    })
  );
  const rect = el("hp", "imgRect");
  rect.appendChild(el("hc", "pt0", { x: "0", y: "0" }));
  rect.appendChild(el("hc", "pt1", { x: String(w), y: "0" }));
  rect.appendChild(el("hc", "pt2", { x: String(w), y: String(h) }));
  rect.appendChild(el("hc", "pt3", { x: "0", y: String(h) }));
  pic.appendChild(rect);
  pic.appendChild(
    el("hp", "sz", {
      width: String(w),
      height: String(h),
      widthRelTo: "ABSOLUTE",
      heightRelTo: "ABSOLUTE",
      protect: "0",
    })
  );
  pic.appendChild(
    el("hp", "pos", {
      treatAsChar: "1",
      affectLSpacing: "0",
      flowWithText: "0",
      allowOverlap: "0",
      holdAnchorAndSO: "0",
      vertRelTo: "PARA",
      horzRelTo: "PARA",
      vertAlign: "TOP",
      horzAlign: "LEFT",
      vertOffset: "0",
      horzOffset: "0",
    })
  );
  pic.appendChild(
    el("hp", "outMargin", { left: "0", right: "0", top: "0", bottom: "0" })
  );
  run.appendChild(pic);
  return run;
}
