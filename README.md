# vite-plugin-bettera11y

Vite plugin for running BetterA11y audits during local development.

## Install

```bash
npm install vite-plugin-bettera11y bettera11y
```

## Usage

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { bettera11yPlugin, recommendedPreset } from "vite-plugin-bettera11y";

export default defineConfig({
    plugins: [
        bettera11yPlugin({
            rules: recommendedPreset,
            overlay: true,
            include: ["src/**/*.{html,jsx,tsx,css,scss,md}"],
            exclude: ["**/*.stories.tsx"]
        }),
        react()
    ]
});
```

## Options

- `include`: glob(s) for files to audit.
- `exclude`: glob(s) to skip.
- `overlay`: emit warnings/errors through Vite for browser overlay visibility.
- `failOnError`: throw when error diagnostics are found (off by default for dev ergonomics).
- `logLevel`: `error`, `warn`, or `info` terminal logging.
- `rules`, `ruleOptions`, `normalizers`: passthrough BetterA11y runtime options.
- `recommendedPreset`, `strictPreset`, `wcagAaBaselinePreset`: re-exported from BetterA11y to keep rule config aligned with the plugin runtime version.

## Example

A runnable Vite + React demo lives under [`examples/vite-demo`](examples/vite-demo). From the repo root, run `npm run example:dev` (builds the plugin, installs the example, starts Vite), or follow the example README to run it manually.

## Notes

- Audits only run in `vite dev` mode.
- Register **`bettera11yPlugin` before `@vitejs/plugin-react`**. Both run in the `pre` transform stage; React must not compile TSX/JSX first or audits will see runtime output instead of source and miss most markup rules.
- The plugin skips virtual modules and `node_modules`.
- Diagnostics are emitted with the same mechanism as other Vite plugin warnings (`transform` warnings with `loc` when available). With `overlay: true`, you get a single terminal line per issue plus the browser overlay, not a separate custom logger line.
- Include and exclude globs are matched against paths **relative to the Vite project root**, while module ids are absolute internally.
- The `main-landmark` rule in BetterA11y is skipped for `jsx`, `tsx`, and `css` inputs (component or stylesheet fragments, not full HTML documents). Upgrade `bettera11y` to the latest release that includes that behavior if you still see per-file landmark noise on older versions.
