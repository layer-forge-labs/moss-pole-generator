// Builds Bambu Studio projects (.3mf) for one moss pole design, in the browser or in Node.
// Parts come from the same meshes the 3D preview uses; printer settings come from small
// per-printer templates. Pole parts go to an X2D 0.4 project (one named plate per part,
// one filament slot per color, Assembly View stacked); the pot/saucer or spike go to an
// X2D 0.8 project, or an H2D 0.8 project for the large pot and saucer.
import JSZip from "jszip";
import type { Design, ColorDef } from "./types";
import { SIZES, type SizeId } from "./config";

export type Mesh = { pos: ArrayLike<number>; idx: ArrayLike<number> };           // mm, assembly frame, z up
export type PrinterTemplate = {
  settings: Record<string, any>; perFilamentKeys: Record<string, number>; sourceNames: string[]; inheritsGroup: string[];
  sources: { matte: number; translucent: number | null }; bed: [number, number]; area: [number, number, number, number];
  partBlock: string; subHeader: string; contentTypes: string; sliceInfo: string; cutInfo: string;
};
type Rot = "RZ0" | "RZ180" | "RX180" | "FLAT0" | "FLAT90";
export type Part = { mesh: Mesh; name: string; plate: number; plateName: string; color: string; rot: Rot; brim: boolean; asm?: [number, number, number] };

const M3 = (a: number[]) => a;                     // 3x3 row-major
const ROT: Record<Rot, number[]> = {
  RZ0: M3([1, 0, 0, 0, 1, 0, 0, 0, 1]),
  RZ180: M3([-1, 0, 0, 0, -1, 0, 0, 0, 1]),
  RX180: M3([1, 0, 0, 0, -1, 0, 0, 0, -1]),
  FLAT0: M3([-1, 0, 0, 0, 0, 1, 0, 1, 0]),         // standing panel -> flat
  FLAT90: M3([0, 0, -1, -1, 0, 0, 0, 1, 0]),       // RZ(90) * FLAT0
};
const mul = (R: number[], v: number[]) => [R[0]*v[0]+R[1]*v[1]+R[2]*v[2], R[3]*v[0]+R[4]*v[1]+R[5]*v[2], R[6]*v[0]+R[7]*v[1]+R[8]*v[2]];
const bblCols = (n: number) => { const v = Math.sqrt(n), r = Math.round(v); return v > r ? r + 1 : r; };
const BAD = /[<>:\/\\|?*"&']/g;                     // Bambu rejects these in plate and object names
const esc = (s: string) => s.replace(BAD, "-");
const f4 = (v: number) => (Math.abs(v) < 5e-5 ? 0 : +v.toFixed(4)).toString();
let uN = 0;
const uuid = () => { uN++; const h = (n: number, w: number) => n.toString(16).padStart(w, "0").slice(-w);
  return `${h(0x6d6f7373 + uN, 8)}-${h(uN, 4)}-4c03-9d28-${h(0x80fed5dfa1dc + uN * 7, 12)}`; };

function bbox(m: Mesh) {
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.pos.length; i += 3) for (let k = 0; k < 3; k++) { const v = m.pos[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v; }
  return { mn, mx };
}

export async function buildProject(parts: Part[], tpl: PrinterTemplate, colors: ColorDef[], title: string): Promise<Uint8Array> {
  const byId = Object.fromEntries(colors.map(c => [c.id, c]));
  // ---- filament slots: one per color used
  const slots: { color: ColorDef; src: number }[] = []; const slotOf: Record<string, number> = {};
  for (const p of parts) if (!(p.color in slotOf)) {
    const c = byId[p.color]; if (!c) throw new Error(`Unknown color: ${p.color}`);
    const src = c.finish === "translucent" ? tpl.sources.translucent : tpl.sources.matte;
    if (src === null) throw new Error(`${c.name} isn't available for ${p.name.toLowerCase()} (matte colors only).`);
    slotOf[p.color] = slots.length; slots.push({ color: c, src });
  }
  const N = slots.length, n0 = tpl.sourceNames.length;
  const ps = JSON.parse(JSON.stringify(tpl.settings));
  for (const [k, stride] of Object.entries(tpl.perFilamentKeys)) {
    const arr = ps[k]; if (!Array.isArray(arr) || arr.length !== stride * n0) continue;
    ps[k] = slots.flatMap(s => arr.slice(s.src * stride, s.src * stride + stride));
  }
  if (tpl.perFilamentKeys.filament_self_index) ps.filament_self_index = slots.flatMap((_, i) => Array(tpl.perFilamentKeys.filament_self_index).fill(String(i + 1)));
  ps.filament_colour = slots.map(s => s.color.hex.toUpperCase());
  const cap = (n: string) => n.replace(/\b\w/g, m => m.toUpperCase());
  ps.filament_settings_id = slots.map(s => {
    const base = tpl.sourceNames[s.src];
    return s.src === tpl.sources.translucent ? base : base.replace(" @", ` ${cap(s.color.name)} @`);
  });
  const ig = tpl.inheritsGroup, dst = ps.different_settings_to_system;
  ps.inherits_group = [ig[0], ...slots.map(s => ig[1 + s.src]), ig[ig.length - 1]];
  ps.different_settings_to_system = [dst[0], ...slots.map(s => dst[1 + s.src]), dst[dst.length - 1]];
  ps.filament_map = slots.map(s => (s.src === tpl.sources.translucent ? "2" : "1"));
  ps.filament_map_2 = [...ps.filament_map]; ps.filament_nozzle_map = [...ps.filament_map];
  ps.filament_volume_map = slots.map(() => "0");
  ps.flush_volumes_matrix = [0, 1].flatMap(() => slots.flatMap((_, a) => slots.map((_, b) => (a === b ? "0" : "280"))));
  ps.flush_volumes_vector = Array(4 * N).fill("140");

  const out = new JSZip();
  out.file("[Content_Types].xml", tpl.contentTypes);
  out.file("Metadata/slice_info.config", tpl.sliceInfo);
  out.file("Metadata/cut_information.xml", tpl.cutInfo);
  out.file("Metadata/project_settings.config", JSON.stringify(ps, null, 4));

  // ---- plate layout: shelf-pack each plate's parts inside the printable area
  const [bw, bh] = tpl.bed, [ax0, ay0, ax1, ay1] = tpl.area;
  const nPlates = Math.max(...parts.map(p => p.plate)), cols = bblCols(nPlates);
  const placed = parts.map(p => {
    const { mn, mx } = bbox(p.mesh), R = ROT[p.rot];
    const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
    const rmn = [Infinity, Infinity, Infinity], rmx = [-Infinity, -Infinity, -Infinity];
    for (const x of [mn[0], mx[0]]) for (const y of [mn[1], mx[1]]) for (const z of [mn[2], mx[2]]) {
      const v = mul(R, [x, y, z]); for (let k = 0; k < 3; k++) { rmn[k] = Math.min(rmn[k], v[k]); rmx[k] = Math.max(rmx[k], v[k]); }
    }
    return { p, c, R, rmn, rmx, T: [0, 0, 0] as number[] };
  });
  for (let pl = 1; pl <= nPlates; pl++) {
    const its = placed.filter(q => q.p.plate === pl);
    let x = 0, y = 0, rowh = 0; const pos: number[][] = [];
    for (const q of its) {
      const w = q.rmx[0] - q.rmn[0], h = q.rmx[1] - q.rmn[1];
      if (x > 0 && x + w > ax1 - ax0 - 8) { x = 0; y += rowh + 12; rowh = 0; }
      pos.push([x, y]); x += w + 12; rowh = Math.max(rowh, h);
    }
    const gw = Math.max(...its.map((q, i) => pos[i][0] + q.rmx[0] - q.rmn[0])), gh = Math.max(...its.map((q, i) => pos[i][1] + q.rmx[1] - q.rmn[1]));
    if (gw > ax1 - ax0 - 4 || gh > ay1 - ay0 - 4) throw new Error(`Plate ${pl} does not fit the printer (${gw.toFixed(0)} x ${gh.toFixed(0)} mm).`);
    const ox = ((pl - 1) % cols) * bw * 1.2, oy = -Math.floor((pl - 1) / cols) * bh * 1.2;
    const sx = ax0 + (ax1 - ax0 - gw) / 2, sy = ay0 + (ay1 - ay0 - gh) / 2;
    its.forEach((q, i) => { q.T = [ox + sx + pos[i][0] - q.rmn[0], oy + sy + pos[i][1] - q.rmn[1], -q.rmn[2]]; });
  }

  // ---- objects
  let resources = "", build = "", rels = "", objSettings = "", plates = "", asm = "";
  placed.forEach((q, k) => {
    const { p, c, R, T } = q, oid = 2 * (k + 1), sid = oid - 1, path = `3D/Objects/object_${k + 1}.model`;
    const nf = p.mesh.idx.length / 3;
    const vs: string[] = [], ts: string[] = [];
    for (let i = 0; i < p.mesh.pos.length; i += 3) vs.push(`     <vertex x="${f4(p.mesh.pos[i] - c[0])}" y="${f4(p.mesh.pos[i + 1] - c[1])}" z="${f4(p.mesh.pos[i + 2] - c[2])}"/>`);
    for (let i = 0; i < p.mesh.idx.length; i += 3) ts.push(`     <triangle v1="${p.mesh.idx[i]}" v2="${p.mesh.idx[i + 1]}" v3="${p.mesh.idx[i + 2]}"/>`);
    out.file(path, `${tpl.subHeader}<resources>\n  <object id="${sid}" p:UUID="${uuid()}" type="model">\n   <mesh>\n    <vertices>\n${vs.join("\n")}\n    </vertices>\n    <triangles>\n${ts.join("\n")}\n    </triangles>\n   </mesh>\n  </object>\n </resources>\n <build/>\n</model>\n`);
    rels += ` <Relationship Target="/${path}" Id="rel-${k + 1}" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n`;
    const ct = `1 0 0 0 1 0 0 0 1 ${f4(c[0])} ${f4(c[1])} ${f4(c[2])}`;
    resources += `  <object id="${oid}" p:UUID="${uuid()}" type="model">\n   <components>\n    <component p:path="/${path}" objectid="${sid}" p:UUID="${uuid()}" transform="${ct}"/>\n   </components>\n  </object>\n`;
    const m = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8], T[0], T[1], T[2]];   // 3MF: column-major 3x3 + translation
    build += `  <item objectid="${oid}" p:UUID="${uuid()}" transform="${m.map(f4).join(" ")}" printable="1"/>\n`;
    const name = esc(p.name);
    const part = tpl.partBlock
      .replace(/<part id="\d+"/, `<part id="${sid}"`).replace(/uuid="[^"]*"/, `uuid="${uuid()}"`)
      .replace(/(<metadata key="name" value=")[^"]*"/, (_m, a) => `${a}${name}"`)
      .replace(/(<metadata key="matrix" value=")[^"]*"/, (_m, a) => `${a}1 0 0 ${f4(c[0])} 0 1 0 ${f4(c[1])} 0 0 1 ${f4(c[2])} 0 0 0 1"`)
      .replace(/(<metadata key="source_file" value=")[^"]*"/, (_m, a) => `${a}${name}.stl"`)
      .replace(/(<metadata key="source_offset_x" value=")[^"]*"/, (_m, a) => `${a}${f4(c[0])}"`)
      .replace(/(<metadata key="source_offset_y" value=")[^"]*"/, (_m, a) => `${a}${f4(c[1])}"`)
      .replace(/(<metadata key="source_offset_z" value=")[^"]*"/, (_m, a) => `${a}${f4(c[2])}"`)
      .replace(/face_count="\d+"/, `face_count="${nf}"`);
    objSettings += `  <object id="${oid}">\n    <metadata key="name" value="${name}"/>\n    <metadata key="extruder" value="${slotOf[p.color] + 1}"/>\n`
      + (p.brim ? "" : `    <metadata key="brim_type" value="no_brim"/>\n`) + `    <metadata face_count="${nf}"/>\n${part}\n  </object>\n`;
    if (p.asm) asm += `   <assemble_item object_id="${oid}" instance_id="0" transform="1 0 0 0 1 0 0 0 1 ${f4(p.asm[0] + c[0])} ${f4(p.asm[1] + c[1])} ${f4(p.asm[2] + c[2])}" offset="0 0 0"/>\n`;
  });
  for (let pl = 1; pl <= nPlates; pl++) {
    const its = placed.map((q, k) => ({ q, k })).filter(x => x.q.p.plate === pl);
    plates += `  <plate>\n    <metadata key="plater_id" value="${pl}"/>\n    <metadata key="plater_name" value="${esc(its[0].q.p.plateName)}"/>\n    <metadata key="locked" value="false"/>\n    <metadata key="filament_map_mode" value="Auto For Flush"/>\n    <metadata key="gcode_file" value=""/>\n`
      + its.map(({ k }) => `    <model_instance>\n      <metadata key="object_id" value="${2 * (k + 1)}"/>\n      <metadata key="instance_id" value="0"/>\n      <metadata key="identify_id" value="${300 + k}"/>\n    </model_instance>\n`).join("") + `  </plate>\n`;
  }
  const now = new Date().toISOString().slice(0, 10);
  out.file("3D/3dmodel.model", `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
 <metadata name="Application">BambuStudio-02.08.02.61</metadata>
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <metadata name="CreationDate">${now}</metadata>
 <metadata name="ModificationDate">${now}</metadata>
 <metadata name="Title">${esc(title)}</metadata>
 <resources>
${resources} </resources>
 <build p:UUID="${uuid()}">
${build} </build>
</model>
`);
  out.file("3D/_rels/3dmodel.model.rels", `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n${rels}</Relationships>`);
  out.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>\n</Relationships>`);
  out.file("Metadata/model_settings.config", `<?xml version="1.0" encoding="UTF-8"?>\n<config>\n${objSettings}${plates}  <assemble>\n${asm}  </assemble>\n</config>\n`);
  out.file("Metadata/filament_sequence.json", JSON.stringify(Object.fromEntries(Array.from({ length: nPlates }, (_, i) => [`plate_${i + 1}`, { nozzle_sequence: [], optimal_assignment: [], sequence: [] }]))));
  return out.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

// ---------------------------------------------------------------- planning
// Mesh bottoms in the design frame (same for every size): see parts payload
export const POS = { collar: 22, cupSeat: 8.412, lidAbove: 97.8, stemAbove: 2, knobAbove: 109.3, panelGap: 0.075, baseShell: 200, floor: 2.4 };   // lid mesh starts at its boss, 8 mm under the rim
const nameOf = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function planPole(d: Design, meshes: Record<string, Mesh>, colors: ColorDef[]): Part[] {
  const cn = (id: string) => colors.find(c => c.id === id)?.name ?? id;
  const parts: Part[] = []; let pl = 1;
  const withBase = d.base.type === "none";
  // pole-local frame: z = 0 at the first joint (top of the base section, pot socket or spike socket)
  const j0 = withBase ? POS.baseShell + POS.floor : POS.collar;
  if (withBase) parts.push({ mesh: meshes.base, name: "Base 20 cm", plate: pl, plateName: `Base 20 cm - ${cn(d.base.color)}`, color: d.base.color, rot: "RZ180", brim: true, asm: [0, 0, 0] }), pl++;
  let joint = j0;
  d.sections.forEach((s, i) => {
    const mm = Math.round(s.size_cm * 10), top = i === d.sections.length - 1;
    parts.push({ mesh: meshes[`pole_${mm}`], name: `Section ${i + 1} - ${s.size_cm} cm${top ? " top" : ""}`, plate: pl, plateName: `Section ${i + 1} - ${s.size_cm} cm - ${cn(s.color)}`,
                 color: s.color, rot: "RX180", brim: true, asm: [0, 0, joint - POS.collar] }); pl++;
    joint += mm;
  });
  const cupZ = joint - 100 - POS.cupSeat;
  if (d.water_cup.included) {
    const c = d.water_cup.color;
    parts.push({ mesh: meshes.cup, name: "Water cup", plate: pl, plateName: `Water cup - ${cn(c)}`, color: c, rot: "RZ180", brim: true, asm: [0, 0, cupZ] }); pl++;
    const lidPlate = (d.water_cup.knob_color || c) === c ? `Valve - lid, stem, knob - ${cn(c)}` : `Valve - lid and stem - ${cn(c)}`;
    parts.push({ mesh: meshes.cup_lid, name: "Valve lid", plate: pl, plateName: lidPlate, color: c, rot: "RX180", brim: false, asm: [0, 0, cupZ + POS.lidAbove] });   // printed upside down: smooth top
    parts.push({ mesh: meshes.valve_stem, name: "Valve stem", plate: pl, plateName: lidPlate, color: c, rot: "RX180", brim: true, asm: [0, 0, cupZ + POS.stemAbove] });
    const k = d.water_cup.knob_color || c;      // a knob in another color gets its own plate (one filament per plate)
    if (k !== c) pl++;
    parts.push({ mesh: meshes.valve_knob, name: "Valve knob", plate: pl, plateName: k === c ? `Valve - lid, stem, knob - ${cn(c)}` : `Valve knob - ${cn(k)}`,
                 color: k, rot: "RZ0", brim: true, asm: [0, 0, cupZ + POS.knobAbove] }); pl++;
  }
  let z = (withBase ? POS.floor : POS.collar) + POS.panelGap;
  const n = d.panels.length;
  d.panels.forEach((p, i) => {
    const mm = Math.round(p.size_cm * 10), pos = i === n - 1 ? "Top" : i === 0 ? "Bottom" : `Level ${i + 1}`, dn = p.design_name || p.design;
    parts.push({ mesh: meshes[`panel_${mm}_${p.design}`], name: `Panel ${pos} - ${p.size_cm} cm ${dn}`, plate: pl, plateName: `Panel ${pos} - ${p.size_cm} cm ${dn} - ${cn(p.color)}`,
                 color: p.color, rot: mm === 200 ? "FLAT90" : "FLAT0", brim: false, asm: [0, 0, z] }); pl++;
    z += mm;
  });
  return parts;
}
export function planBase(d: Design, meshes: Record<string, Mesh>, colors: ColorDef[]): { printer: "x2d_08" | "h2d_08"; parts: Part[] } | null {
  const cn = (id: string) => colors.find(c => c.id === id)?.name ?? id;
  const sz = d.size as SizeId, label = SIZES[sz].name;
  if (d.base.type === "pot") {
    return { printer: sz === "L" ? "h2d_08" : "x2d_08", parts: [
      { mesh: meshes.pot, name: `Pot ${label}`, plate: 1, plateName: `Pot ${label} - ${cn(d.base.color)}`, color: d.base.color, rot: "RZ0", brim: false },
      { mesh: meshes.saucer, name: `Saucer ${label}`, plate: 2, plateName: `Saucer ${label} - ${cn(d.base.saucer_color || d.base.color)}`, color: d.base.saucer_color || d.base.color, rot: "RZ0", brim: false },
    ] };
  }
  if (d.base.type === "spike")
    return { printer: "x2d_08", parts: [{ mesh: meshes.spike, name: `Spike ${label}`, plate: 1, plateName: `Spike ${label} - ${cn(d.base.color)}`, color: d.base.color, rot: "RX180", brim: true }] };
  return null;
}

/** One design -> a .3mf (pole only) or a .zip with the pole and base projects. */
export async function exportDesign(d: Design, meshes: Record<string, Mesh>, templates: Record<string, PrinterTemplate>, colors: ColorDef[]) {
  const top = d.sections[d.sections.length - 1];
  if (!top || top.size_cm !== 10) throw new Error("The top section must be the 10 cm section.");
  const sz = SIZES[d.size as SizeId].name, h = d.total_height_cm ?? "", stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const stem = `moss-pole-${sz.toLowerCase()}-${h}cm-${stamp}`;
  const pole = await buildProject(planPole(d, meshes, colors), templates.x2d_04, colors, `Moss pole ${sz} ${h} cm`);
  const base = planBase(d, meshes, colors);
  if (!base) return { name: `${stem}.3mf`, data: pole };
  const bp = await buildProject(base.parts, templates[base.printer], colors, `Moss pole ${sz} ${d.base.type}`);
  const z = new JSZip();
  z.file(`${stem}_pole_X2D_0.4.3mf`, pole);
  z.file(`${stem}_${d.base.type}_${base.printer === "h2d_08" ? "H2D" : "X2D"}_0.8.3mf`, bp);
  z.file(`${stem}_design.json`, JSON.stringify(d, null, 2));
  return { name: `${stem}.zip`, data: await z.generateAsync({ type: "uint8array", compression: "DEFLATE" }) };
}
