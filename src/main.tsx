import * as React from "react";
import { createRoot } from "react-dom/client";
import { MossPoleConfigurator } from "@/moss-pole/Configurator";
// Paths are relative so the site works under /moss-pole-generator/ on GitHub Pages
createRoot(document.getElementById("root")!).render(
  <MossPoleConfigurator parts={{ url: "./moss-pole/parts.bin", headerUrl: "./moss-pole/parts.json" }} />);
