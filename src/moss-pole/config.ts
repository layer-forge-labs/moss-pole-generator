import type { ColorDef } from "./types";
import PART_DATA from "./part-data.json";

export const SIZES = {
  S: { name: "Small",  W: 80,  D: 47, pot: [180, 150], note: "Pothos, philodendron, young monstera" },
  M: { name: "Medium", W: 95,  D: 55, pot: [220, 175], note: "Most climbing plants" },
  L: { name: "Large",  W: 115, D: 67, pot: [280, 210], note: "Mature monstera and big climbers" },
} as const;
export type SizeId = keyof typeof SIZES;
export const BASES = {
  none:  { name: "In your pot", note: "A 20 cm base section pushes into the soil of the pot you have." },
  pot:   { name: "With our pot", note: "Ribbed pot and saucer; the pole locks into a socket at the back." },
  spike: { name: "Spike", note: "Pushes into your pot's soil; the pole locks into its socket." },
} as const;
export type BaseId = keyof typeof BASES;

// ---------------------------------------------------------------------------
// Shop settings. Edit these; nothing else needs to change.
// ---------------------------------------------------------------------------
export const SHOP = {
  currency: "USD",
  // Price per part = (filament + printer time) x markup, rounded up to $0.50.
  // grams / hours come from slicing each part (0.2 mm layers, 2 walls, 20% gyroid).
  pricing: {
    materialPerKg: { matte: 16, translucent: 20 },
    wasteFactor: 1.1,       // purge, test prints, failed prints
    machinePerHour: 0.5,    // power, nozzle and printer wear
    markup: 2.5,
    orderFee: 4,            // packing and finishing, once per order (charged)
    packingCost: 1.5,       // what packing actually costs you (box, filler, tape)
    // grams / hours per part and size, from slicing the print projects (filled in by the build)
    parts: PART_DATA as Record<SizeId, Record<string, { grams: number; hours: number }>>,
  },
  colors: [
    { id: "olive",    name: "Olive green",       hex: "#5A6D3D", finish: "matte" },
    { id: "olive_tr", name: "Translucent olive", hex: "#748C45", finish: "translucent" },
    { id: "white",    name: "White",             hex: "#EFF0F1", finish: "matte" },
    { id: "bone",     name: "Bone white",        hex: "#EEE7D4", finish: "matte" },
    { id: "black",    name: "Black",             hex: "#000000", finish: "matte" },
    { id: "oak",      name: "Oak",               hex: "#C2B29A", finish: "matte" },
    { id: "coffee",   name: "Coffee brown",      hex: "#362111", finish: "matte" },
  ] as ColorDef[],
  defaultColors: { base: "olive", section: "olive", cup: "olive", knob: "olive", panel: "olive_tr", pot: "olive", saucer: "bone" },
  maxSections: 6,
  note: "Prices are estimates. We’ll confirm your final price before printing.",
};

export const PATTERNS = { a: "Large cells", b: "Medium cells", c: "Monstera" } as const;
export type PatternId = keyof typeof PATTERNS;
export const COLOR: Record<string, ColorDef> = Object.fromEntries(SHOP.colors.map(c => [c.id, c]));
