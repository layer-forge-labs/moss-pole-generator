// Builds the static site into dist/: bundles the React app and compiles Tailwind.
// Every file the page loads gets a content hash in its URL (?v=...), so browsers
// never show a stale copy after a deploy.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist/assets", { recursive: true });
cpSync("site", "dist", { recursive: true });
const hash = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 10);
// one version for the part meshes: changes whenever any of them changes
const partsVersion = hash(Buffer.concat(readdirSync("site/moss-pole").sort().map(f => readFileSync(`site/moss-pole/${f}`))));
execSync("npx tailwindcss -i src/globals.css -o dist/assets/app.css --minify", { stdio: "inherit" });
await build({
  entryPoints: ["src/main.tsx"], bundle: true, minify: true, format: "iife", target: "es2020",
  jsx: "automatic", tsconfig: "tsconfig.json", outfile: "dist/assets/app.js", loader: { ".json": "json" },
  define: { "process.env.NODE_ENV": '"production"', __PARTS_VERSION__: JSON.stringify(partsVersion) }, logLevel: "warning",
});
const jsV = hash(readFileSync("dist/assets/app.js")), cssV = hash(readFileSync("dist/assets/app.css"));
let html = readFileSync("dist/index.html", "utf8")
  .replace('./assets/app.js"', `./assets/app.js?v=${jsV}"`)
  .replace('./assets/app.css"', `./assets/app.css?v=${cssV}"`);
writeFileSync("dist/index.html", html);
console.log(`Built dist/ (app ${jsV}, styles ${cssV}, parts ${partsVersion})`);
