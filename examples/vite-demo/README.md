# vite-plugin-bettera11y demo

Minimal Vite + React (TypeScript) app that uses the local plugin via `file:../..`.

## Prerequisites

From the **repository root** (`vite-plugin-bettera11y`), build the plugin once so `exports` resolve to `dist/`:

```bash
npm run build
```

## Run the demo

```bash
cd examples/vite-demo
npm install
npm run dev
```

With the default `App.tsx`, BetterA11y reports an `image-alt` finding in the terminal and through the Vite overlay (`overlay: true` in `vite.config.ts`).

The demo imports `recommendedPreset` from `vite-plugin-bettera11y` (not directly from `bettera11y`) so the preset and runtime always come from the same version.

You can also start from the repo root:

```bash
npm run example:dev
```

## Plugin options

See the [main README](../../README.md) for `include`, `exclude`, `failOnError`, and other settings.

## Note on `file:../..` and TypeScript

This demo links the parent package with `file:../..`. Your editor may resolve `vite` types from both the example app and the plugin repo root; `vite.config.ts` uses a small `PluginOption` cast so `tsc -b` stays green. Published installs from npm typically dedupe a single `vite` and do not need the cast.
