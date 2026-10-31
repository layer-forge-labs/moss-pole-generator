import type { ColorDef } from "./types";

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
    parts: {
      base:       { grams: 108.8, hours: 7.93 },
      section100: { grams: 56.1,  hours: 4.12 },
      section200: { grams: 105.3, hours: 7.94 },
      cup:        { grams: 54.9,  hours: 1.76 },
      panel100a:  { grams: 9.8,   hours: 0.55 },
      panel100b:  { grams: 11.3,  hours: 0.64 },
      panel100c:  { grams: 10.9,  hours: 0.62 },
      panel200a:  { grams: 18.4,  hours: 1.03 },
      panel200b:  { grams: 21.1,  hours: 1.21 },
      panel200c:  { grams: 20.6,  hours: 1.16 },
    } as Record<string, { grams: number; hours: number }>,
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
  defaultColors: { base: "olive", section: "olive", cup: "olive", panel: "olive_tr" },
  maxSections: 6,
  note: "Prices are estimates. We’ll confirm your final price before printing.",
};

export const PATTERNS = { a: "Large cells", b: "Medium cells", c: "Monstera" } as const;
export type PatternId = keyof typeof PATTERNS;
export const COLOR: Record<string, ColorDef> = Object.fromEntries(SHOP.colors.map(c => [c.id, c]));
