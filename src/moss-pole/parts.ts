import * as THREE from "three";

// Part meshes per size: quantized positions + indices, gzipped. On the site, serve
// parts_S/M/L.bin + .json from /public; in the standalone preview they are embedded.
export type PartsSource = { url: string; headerUrl: string } | { header: Hdr[]; base64: string };
type Hdr = { name: string; vc: number; ic: number; it?: 2 | 4; voff: number; ioff: number; min: number[]; max: number[] };

async function gunzip(bytes: Uint8Array): Promise<ArrayBuffer> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}
export async function loadParts(src: PartsSource): Promise<Record<string, THREE.BufferGeometry>> {
  let header: Hdr[], gz: Uint8Array;
  if ("url" in src) {
    header = await (await fetch(src.headerUrl)).json();
    gz = new Uint8Array(await (await fetch(src.url)).arrayBuffer());
  } else {
    header = src.header;
    gz = Uint8Array.from(atob(src.base64), c => c.charCodeAt(0));
  }
  const buf = await gunzip(gz);
  const out: Record<string, THREE.BufferGeometry> = {};
  for (const h of header) {
    const q = new Uint16Array(buf, h.voff, h.vc * 3), pos = new Float32Array(h.vc * 3);
    for (let i = 0; i < h.vc; i++) for (let k = 0; k < 3; k++)
      pos[i * 3 + k] = h.min[k] + (q[i * 3 + k] / 65535) * (h.max[k] - h.min[k]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(new THREE.BufferAttribute(h.it === 4 ? new Uint32Array(buf, h.ioff, h.ic) : new Uint16Array(buf, h.ioff, h.ic), 1));
    g.computeBoundingBox();
    out[h.name] = g;
  }
  return out;
}

// Pattern thumbnails rendered from the real panel meshes
export type SizeSources = Record<"S" | "M" | "L", PartsSource>;
export function renderThumbs(geos: Record<string, THREE.BufferGeometry>, ids: string[]): Record<string, string> {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(128, 140);
  const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.1));
  const c = new THREE.OrthographicCamera(-50, 50, 55, -55, 1, 1000); c.position.set(0, 0, 300); c.lookAt(0, 0, 0);
  const out: Record<string, string> = {};
  for (const k of ids) {
    const m = new THREE.Mesh(geos["panel_100_" + k], new THREE.MeshBasicMaterial({ color: 0x4b6a2e }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, -50, 0);
    s.add(m); r.render(s, c); out[k] = r.domElement.toDataURL(); s.remove(m);
  }
  r.dispose(); return out;
}
