export type ColorDef = { id: string; name: string; hex: string; finish: "matte" | "translucent" };
export type Design = {
  type: "layer-forge-labs/moss-pole-design"; version: 1;
  total_height_cm?: number;
  base: { size_cm: 20; color: string };
  sections: { size_cm: 10 | 20; color: string }[];          // bottom to top
  panels: { size_cm: 10 | 20; design: "a" | "b" | "c"; design_name?: string; color: string }[];  // bottom to top
  water_cup: { included: boolean; color: string };
};
