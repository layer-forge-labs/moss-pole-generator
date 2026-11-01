import * as React from "react";
import { createRoot } from "react-dom/client";
import { MossPoleConfigurator } from "@/moss-pole/Configurator";
declare const __PARTS_VERSION__: string;   // set by scripts/build.mjs: changes when the part meshes change
// Paths are relative so the site works under /moss-pole-generator/ on GitHub Pages.
// Each size's parts load the first time that size is shown.
const v = `?v=${__PARTS_VERSION__}`;
const src = (z: string) => ({ url: `./moss-pole/parts_${z}.bin${v}`, headerUrl: `./moss-pole/parts_${z}.json${v}` });
createRoot(document.getElementById("root")!).render(<MossPoleConfigurator parts={{ S: src("S"), M: src("M"), L: src("L") }} />);
