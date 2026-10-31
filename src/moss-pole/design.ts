import { SHOP, PATTERNS, COLOR, type PatternId } from "./config";
import type { Design } from "./types";

// Sections are listed bottom to top. The top section is always the 10 cm one,
// so the water cup always sits flush with the top.
export type Panel = { size: 100 | 200; pat: PatternId; color: string };
export type State = {
  sections: (100 | 200)[]; sectionColors: string[];
  baseColor: string; cup: boolean; cupColor: string; panels: Panel[];
};
const D = SHOP.defaultColors;

export function initialState(): State {
  return fitPanels({ sections: [200, 100], sectionColors: [D.section, D.section], baseColor: D.base,
                     cup: true, cupColor: D.cup, panels: [] });
}
export const shellHeight = (s: State) => 200 + s.sections.reduce((a, b) => a + b, 0);
export const heightCm = (s: State) => shellHeight(s) / 10;

// Panels: a 10 cm panel first so panel joints sit between section joints, then 20 cm, a final 10 cm if needed.
export function fitPanels(s: State): State {
  const sizes: (100 | 200)[] = [100]; let rem = shellHeight(s) - 100;
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
  const sections = s.sections.filter((_, k) => k !== i), sectionColors = s.sectionColors.filter((_, k) => k !== i);
  return fitPanels({ ...s, sections, sectionColors });
}
export function setSectionSize(s: State, i: number, h: 100 | 200): State {
  if (i === s.sections.length - 1) return s;
  const sections = [...s.sections]; sections[i] = h;
  return fitPanels({ ...s, sections });
}

// ---------------------------------------------------------------- pricing
// cost  = filament (with waste allowance) + printer time
// price = cost x markup, rounded up to the next $0.50
export function partCost(key: string, colorId: string) {
  const P = SHOP.pricing, p = P.parts[key];
  return (p.grams / 1000) * P.materialPerKg[COLOR[colorId].finish] * P.wasteFactor + p.hours * P.machinePerHour;
}
export const partPrice = (key: string, colorId: string, markup = SHOP.pricing.markup) =>
  Math.ceil(partCost(key, colorId) * markup * 2) / 2;

export type Line = { label: string; qty: number; each: number; cost: number };   // cost is per item
export function orderLines(s: State, markup = SHOP.pricing.markup): Line[] {
  const items: Line[] = [];
  const add = (label: string, key: string | null, color?: string) => {
    const each = key ? partPrice(key, color!, markup) : SHOP.pricing.orderFee;
    const cost = key ? partCost(key, color!) : SHOP.pricing.packingCost;
    const f = items.find(x => x.label === label && x.each === each);
    f ? f.qty++ : items.push({ label, qty: 1, each, cost });
  };
  add(`Base, 20 cm, ${COLOR[s.baseColor].name}`, "base", s.baseColor);
  s.sections.map((h, i) => [h, s.sectionColors[i]] as const).sort((a, b) => b[0] - a[0])
    .forEach(([h, c]) => add(`Section, ${h / 10} cm, ${COLOR[c].name}`, "section" + h, c));
  s.panels.forEach(p => add(`Panel ${p.size / 10} cm, ${PATTERNS[p.pat]}, ${COLOR[p.color].name}`, `panel${p.size}${p.pat}`, p.color));
  if (s.cup) add(`Water cup, ${COLOR[s.cupColor].name}`, "cup", s.cupColor);
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
    type: DESIGN_TYPE, version: 1, total_height_cm: heightCm(s),
    base: { size_cm: 20, color: s.baseColor },
    sections: s.sections.map((h, i) => ({ size_cm: (h / 10) as 10 | 20, color: s.sectionColors[i] })),
    panels: s.panels.map(p => ({ size_cm: (p.size / 10) as 10 | 20, design: p.pat, design_name: PATTERNS[p.pat], color: p.color })),
    water_cup: { included: s.cup, color: s.cupColor },
  };
}
export function fromDesign(d: any): State {
  if (!d || d.type !== DESIGN_TYPE) throw new Error("This isn’t a moss pole design file.");
  const ok = (c: unknown, fb: string) => (typeof c === "string" && COLOR[c] ? c : fb);
  const secs = (Array.isArray(d.sections) ? d.sections : []).map((x: any) => ({ h: Math.round(+x.size_cm * 10), c: x.color }));
  if (!secs.length || secs.length > SHOP.maxSections || secs.some((x: any) => x.h !== 100 && x.h !== 200))
    throw new Error(`A design needs 1 to ${SHOP.maxSections} sections, each 10 or 20 cm.`);
  if (secs[secs.length - 1].h !== 100) throw new Error("The top section must be the 10 cm section.");
  return fitPanels({
    sections: secs.map((x: any) => x.h), sectionColors: secs.map((x: any) => ok(x.c, D.section)),
    baseColor: ok(d.base?.color, D.base), cup: !!d.water_cup?.included, cupColor: ok(d.water_cup?.color, D.cup),
    panels: (Array.isArray(d.panels) ? d.panels : []).map((p: any) => ({
      size: Math.round(+p.size_cm * 10), pat: (p.design in PATTERNS ? p.design : "a") as PatternId, color: ok(p.color, D.panel) })),
  });
}
