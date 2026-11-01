export type ColorDef = { id: string; name: string; hex: string; finish: "matte" | "translucent" };
export type Design = {
  type: "layer-forge-labs/moss-pole-design"; version: 2;
  size: "S" | "M" | "L";
  total_height_cm?: number;
  base: { type: "none" | "pot" | "spike"; color: string; saucer_color?: string };   // none = 20 cm base section for the customer's pot
  sections: { size_cm: 10 | 20; color: string }[];          // bottom to top; the top one is always 10 cm
  panels: { size_cm: 10 | 20; design: "a" | "b" | "c"; design_name?: string; color: string }[];  // bottom to top
  water_cup: { included: boolean; color: string; knob_color?: string };   // cup with the twist valve: lid and stem in color, knob in knob_color
};
