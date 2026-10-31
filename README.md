# Moss pole generator

Customer-facing 3D configurator for the Layer Forge Labs modular moss pole.
Live site: https://layer-forge-labs.github.io/moss-pole-generator/

## Develop

```sh
npm ci
npm run build          # outputs dist/
npx serve dist         # or any static server
```

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/pages.yml`).

## Settings

`src/moss-pole/config.ts`: prices (cost model, markup, order fee), colors, max sections.

The admin tools (markup/discount/profit view and Bambu Studio export) and the print
template are intentionally **not** in this repo.
