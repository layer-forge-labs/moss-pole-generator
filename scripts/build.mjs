// Builds the static site into dist/: bundles the React app and compiles Tailwind.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/assets", { recursive: true });
cpSync("site", "dist", { recursive: true });
execSync("npx tailwindcss -i src/globals.css -o dist/assets/app.css --minify", { stdio: "inherit" });
await build({
  entryPoints: ["src/main.tsx"], bundle: true, minify: true, format: "iife", target: "es2020",
  jsx: "automatic", tsconfig: "tsconfig.json", outfile: "dist/assets/app.js",
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning",
});
console.log("Built dist/");
