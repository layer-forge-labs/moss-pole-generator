import { SHOP, PATTERNS, COLOR, SIZES, BASES, type PatternId, type SizeId, type BaseId } from "./config";
import type { Design } from "./types";

// Sections are listed bottom to top. The top section is always the 10 cm one,
// so the water cup always sits flush with the top.
export type Panel = { size: 100 | 200; pat: PatternId; color: string };
export type State = {
  size: SizeId; base: BaseId; baseColor: string; saucerColor: string;
  sections: (100 | 200)[]; sectionColors: string[];
  cup: boolean; cupColor: string; knobColor: string; panels: Panel[];
};
const D = SHOP.defaultColors;
export const SPIKE_ABOVE = 34;   // spike socket height above the soil line (mm)
export const SAUCER_SEAT = 11.9; // the pot's foot rests this far above the saucer bottom (9.5 mm of water space)

// Default design: Medium, 68 cm, white pole in a white pot with an olive saucer, Monstera panels
export function initialState(): State {
  return {
    size: "M", base: "pot", baseColor: "white", saucerColor: "olive",
    sections: [200, 200, 100], sectionColors: ["white", "white", "white"],
    cup: true, cupColor: "white", knobColor: D.knob,
    panels: [{ size: 100, pat: "c", color: "olive" }, { size: 200, pat: "c", color: "olive" }, { size: 200, pat: "c", color: "olive" }],
  };
}
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
// length the panels cover: from the base floor (own base) or the socket top (pot, spike)
export const shellHeight = (s: State) => (s.base === "none" ? 200 : 0) + sum(s.sections);
export function heightMm(s: State) {
  if (s.base === "pot") return SAUCER_SEAT + SIZES[s.size].pot[1] + sum(s.sections);
  if (s.base === "spike") return SPIKE_ABOVE + sum(s.sections);
  return 200 + sum(s.sections);
}
export const heightCm = (s: State) => Math.round(heightMm(s) / 10);
export const heightNote = (s: State) =>
  s.base === "pot" ? "including the pot" : s.base === "spike" ? "above the soil" : "including the 20 cm base in the pot";

// Panels: a 10 cm panel first so panel joints sit between section joints, then 20 cm, a final 10 cm if needed.
export function fitPanels(s: State): State {
  const total = shellHeight(s);
  const sizes: (100 | 200)[] = [100]; let rem = total - 100;
  while (rem >= 200) { sizes.push(200); rem -= 200; }
  if (rem === 100) sizes.push(100);
  const order: PatternId[] = ["c", "a", "b"];
  return { ...s, panels: sizes.map((size, i) => ({ size, pat: s.panels[i]?.pat ?? order[i % 3], color: s.panels[i]?.color ?? D.panel })) };
}
export function addSection(s: State, h: 100 | 200): State {
  if (s.sections.length >= SHOP.maxSections) return s;
  const at = s.sections.length - 1;               // new sections go under the 10 cm top section
  const sections = [...s.sections]; sections.splice(at, 0, h);
  const sectionColors = [...s.sectionColors]; sectionColors.splice(at, 0, s.sectionColors[Math.max(0, at - 1)] ?? D.section);
  return fitPanels({ ...s, sections, sectionColors });
}
export function removeSection(s: State, i: number): State {
  if (i === s.sections.length - 1) return s;       // the top section stays
  return fitPanels({ ...s, sections: s.sections.filter((_, k) => k !== i), sectionColors: s.sectionColors.filter((_, k) => k !== i) });
}
export function setSectionSize(s: State, i: number, h: 100 | 200): State {
  if (i === s.sections.length - 1) return s;
  const sections = [...s.sections]; sections[i] = h;
  return fitPanels({ ...s, sections });
}
export function setBase(s: State, b: BaseId): State {
  // pots, saucers and spikes print on a 0.8 mm nozzle: matte colors only
  const matte = (c: string) => (COLOR[c].finish === "matte" ? c : D.pot);
  return fitPanels({ ...s, base: b, baseColor: b === "none" ? s.baseColor : matte(s.baseColor), saucerColor: matte(s.saucerColor) });
}

// ---------------------------------------------------------------- pricing
// cost  = filament (with waste allowance) + printer time
// price = cost x markup, rounded up to the next $0.50
function partData(size: SizeId, key: string) {
  return SHOP.pricing.parts[size]?.[key] ?? SHOP.pricing.parts.M?.[key] ?? { grams: 0, hours: 0 };
}
export function partCost(size: SizeId, key: string, colorId: string) {
  const P = SHOP.pricing, p = partData(size, key);
  return (p.grams / 1000) * P.materialPerKg[COLOR[colorId].finish] * P.wasteFactor + p.hours * P.machinePerHour;
}
export const partPrice = (size: SizeId, key: string, colorId: string, markup = SHOP.pricing.markup) =>
  Math.ceil(partCost(size, key, colorId) * markup * 2) / 2;

export type Line = { label: string; qty: number; each: number; cost: number };   // cost is per item
export function orderLines(s: State, markup = SHOP.pricing.markup): Line[] {
  const items: Line[] = [], z = s.size, sz = SIZES[z].name;
  const add = (label: string, key: string | null, color?: string) => {
    const each = key ? partPrice(z, key, color!, markup) : SHOP.pricing.orderFee;
    const cost = key ? partCost(z, key, color!) : SHOP.pricing.packingCost;
    const f = items.find(x => x.label === label && x.each === each);
    f ? f.qty++ : items.push({ label, qty: 1, each, cost });
  };
  if (s.base === "none") add(`Base, 20 cm, ${sz}, ${COLOR[s.baseColor].name}`, "base", s.baseColor);
  if (s.base === "pot") { add(`Pot, ${sz}, ${COLOR[s.baseColor].name}`, "pot", s.baseColor); add(`Saucer, ${sz}, ${COLOR[s.saucerColor].name}`, "saucer", s.saucerColor); }
  if (s.base === "spike") add(`Spike, ${sz}, ${COLOR[s.baseColor].name}`, "spike", s.baseColor);
  s.sections.map((h, i) => [h, s.sectionColors[i]] as const).sort((a, b) => b[0] - a[0])
    .forEach(([h, c]) => add(`Section, ${h / 10} cm, ${sz}, ${COLOR[c].name}`, "section" + h, c));
  s.panels.forEach(p => add(`Panel ${p.size / 10} cm, ${PATTERNS[p.pat]}, ${COLOR[p.color].name}`, `panel${p.size}${p.pat}`, p.color));
  if (s.cup) add(`Water cup with twist valve, ${COLOR[s.cupColor].name}`, "cup", s.cupColor);
  if (SHOP.pricing.orderFee) add("Packing and finishing", null);
  return items;
}
export type Discount = { kind: "percent" | "amount"; value: number };
export function orderTotals(s: State, markup = SHOP.pricing.markup, discount: Discount = { kind: "percent", value: 0 }) {
  const lines = orderLines(s, markup);
  const subtotal = lines.reduce((t, x) => t + x.qty * x.each, 0);
  const cost = lines.reduce((t, x) => t + x.qty * x.cost, 0);
  const off = Math.min(subtotal, Math.max(0, discount.kind === "percent" ? subtotal * discount.value / 100 : discount.value));
  const total = Math.round((subtotal - off) * 100) / 100;
  const profit = total - cost;
  return { lines, subtotal, discount: off, total, cost, profit, margin: total > 0 ? profit / total : 0 };
}
export const orderTotal = (s: State) => orderTotals(s).total;
export const fmt = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency: SHOP.currency, maximumFractionDigits: 2, minimumFractionDigits: Math.abs(n % 1) > 0.001 ? 2 : 0 }).format(n);

// ------------------------------------------------------ design file (no prices)
export const DESIGN_TYPE = "layer-forge-labs/moss-pole-design";
export function toDesign(s: State): Design {
  return {
    type: DESIGN_TYPE, version: 2, size: s.size, total_height_cm: heightCm(s),
    base: { type: s.base, color: s.baseColor, ...(s.base === "pot" ? { saucer_color: s.saucerColor } : {}) },
    sections: s.sections.map((h, i) => ({ size_cm: (h / 10) as 10 | 20, color: s.sectionColors[i] })),
    panels: s.panels.map(p => ({ size_cm: (p.size / 10) as 10 | 20, design: p.pat, design_name: PATTERNS[p.pat], color: p.color })),
    water_cup: { included: s.cup, color: s.cupColor, knob_color: s.knobColor },
  };
}
export function fromDesign(d: any): State {
  if (!d || d.type !== DESIGN_TYPE) throw new Error("This isn’t a moss pole design file.");
  const ok = (c: unknown, fb: string) => (typeof c === "string" && COLOR[c] ? c : fb);
  const secs = (Array.isArray(d.sections) ? d.sections : []).map((x: any) => ({ h: Math.round(+x.size_cm * 10), c: x.color }));
  if (!secs.length || secs.length > SHOP.maxSections || secs.some((x: any) => x.h !== 100 && x.h !== 200))
    throw new Error(`A design needs 1 to ${SHOP.maxSections} sections, each 10 or 20 cm.`);
  if (secs[secs.length - 1].h !== 100) throw new Error("The top section must be the 10 cm section.");
  const size: SizeId = d.size in SIZES ? d.size : "M";                       // version 1 files were all Medium
  const base: BaseId = d.base?.type in BASES ? d.base.type : "none";
  const st = fitPanels({
    size, base, baseColor: ok(d.base?.color, D.base), saucerColor: ok(d.base?.saucer_color, D.saucer),
    sections: secs.map((x: any) => x.h), sectionColors: secs.map((x: any) => ok(x.c, D.section)),
    cup: !!d.water_cup?.included, cupColor: ok(d.water_cup?.color, D.cup), knobColor: ok(d.water_cup?.knob_color, D.knob),
    panels: (Array.isArray(d.panels) ? d.panels : []).map((p: any) => ({
      size: Math.round(+p.size_cm * 10), pat: (p.design in PATTERNS ? p.design : "a") as PatternId, color: ok(p.color, D.panel) })),
  });
  return setBase(st, base);
}
