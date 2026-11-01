import * as React from "react";
import { createRoot } from "react-dom/client";
import { MossPoleConfigurator } from "@/moss-pole/Configurator";
// Paths are relative so the site works under /moss-pole-generator/ on GitHub Pages.
// Each size's parts load the first time that size is shown.
const src = (z: string) => ({ url: `./moss-pole/parts_${z}.bin`, headerUrl: `./moss-pole/parts_${z}.json` });
createRoot(document.getElementById("root")!).render(<MossPoleConfigurator parts={{ S: src("S"), M: src("M"), L: src("L") }} />);
